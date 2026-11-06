import { fail, type ActionRunContext } from "@agent-native/core/action";
import { and, asc, eq } from "drizzle-orm";

import { getDb, schema } from "../db/index.js";

export type Actor = "me" | "agent";
export type StepStatus = "todo" | "review" | "changes" | "done" | "skipped";

/**
 * Who is acting. Only a click in the app's own UI counts as the person.
 * The in-app agent ("tool"), the CLI, MCP, A2A, automations and raw HTTP are
 * all treated as the agent, so nothing outside the UI can approve gated work.
 */
export function actorOf(ctx?: Pick<ActionRunContext, "caller">): Actor {
  return ctx?.caller === "frontend" ? "me" : "agent";
}

export function requireEmail(ctx?: ActionRunContext): string {
  return ctx?.userEmail ?? fail("Sign in first.", { statusCode: 401 });
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export interface InputDef {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
}

export interface StepLike {
  id: string;
  position: number;
  title: string;
  owner: Actor;
  status: StepStatus;
  needsApproval: boolean;
}

export function isClosed(status: StepStatus): boolean {
  return status === "done" || status === "skipped";
}

/** The first step that is not done or skipped. Steps run strictly in order. */
export function currentStepOf<T extends StepLike>(steps: T[]): T | null {
  return (
    [...steps]
      .sort((a, b) => a.position - b.position)
      .find((step) => !isClosed(step.status)) ?? null
  );
}

/** Whose move it is on a step: a draft in review always waits on the person. */
export function waitingOnOf(step: StepLike | null): Actor | null {
  if (!step) return null;
  if (step.status === "review") return "me";
  return step.owner;
}

export function summarize(steps: StepLike[]) {
  const current = currentStepOf(steps);
  return {
    total: steps.length,
    closed: steps.filter((step) => isClosed(step.status)).length,
    currentStepId: current?.id ?? null,
    currentStep: current
      ? {
          id: current.id,
          position: current.position,
          title: current.title,
          owner: current.owner,
          status: current.status,
        }
      : null,
    waitingOn: waitingOnOf(current),
  };
}

type Db = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Lock the run row, then load the step and its siblings. Every step
 * transition goes through here so concurrent person and agent writes to one
 * run serialize instead of both passing the "is this the current step" check.
 */
export async function lockStep(tx: Tx, stepId: string, email: string) {
  const { runs, runSteps } = schema;
  const [found] = await tx
    .select({ runId: runSteps.runId })
    .from(runSteps)
    .where(and(eq(runSteps.id, stepId), eq(runSteps.ownerEmail, email)))
    .limit(1);
  if (!found) {
    fail("Step not found.", { errorCode: "not_found", statusCode: 404 });
  }
  const [run] = await tx
    .select()
    .from(runs)
    .where(and(eq(runs.id, found.runId), eq(runs.ownerEmail, email)))
    .for("update");
  if (!run) fail("Run not found.", { errorCode: "not_found", statusCode: 404 });
  if (run.status !== "active") {
    fail(`This run is ${run.status}; its steps can no longer change.`, {
      errorCode: "run_closed",
      statusCode: 409,
    });
  }
  const steps = await tx
    .select()
    .from(runSteps)
    .where(eq(runSteps.runId, run.id))
    .orderBy(asc(runSteps.position));
  const step = steps.find((candidate) => candidate.id === stepId);
  if (!step) {
    fail("Step not found.", { errorCode: "not_found", statusCode: 404 });
  }
  return { run, steps, step };
}

/** Reject work on a step while an earlier step is still open. */
export function assertCurrent(steps: StepLike[], step: StepLike) {
  if (isClosed(step.status)) {
    fail(`Step ${step.position} "${step.title}" is already ${step.status}.`, {
      errorCode: "step_closed",
      statusCode: 409,
    });
  }
  const current = currentStepOf(steps);
  if (current && current.id !== step.id) {
    const who = waitingOnOf(current) === "me" ? "the person" : "the agent";
    fail(
      `Step ${current.position} "${current.title}" has to finish first. It is waiting on ${who}.`,
      {
        errorCode: "step_blocked",
        statusCode: 409,
        details: { currentStepId: current.id },
      },
    );
  }
}

export async function logEvent(
  tx: Tx,
  event: {
    runId: string;
    stepId?: string | null;
    actor: Actor;
    kind: string;
    message: string;
    ownerEmail: string;
    orgId: string | null;
  },
) {
  await tx.insert(schema.runEvents).values({
    id: crypto.randomUUID(),
    runId: event.runId,
    stepId: event.stepId ?? null,
    actor: event.actor,
    kind: event.kind,
    message: event.message,
    createdAt: nowIso(),
    ownerEmail: event.ownerEmail,
    orgId: event.orgId,
  });
}

/**
 * After a step closes: finish the run when nothing is left, and tell the
 * caller what comes next so the agent keeps going or stops for the person.
 */
export async function afterStepClosed(
  tx: Tx,
  run: { id: string; ownerEmail: string; orgId: string | null },
  steps: StepLike[],
  closedId: string,
  closedAs: StepStatus,
  actor: Actor,
) {
  const remaining = steps.map((step) =>
    step.id === closedId ? { ...step, status: closedAs } : step,
  );
  const next = currentStepOf(remaining);
  if (!next) {
    await tx
      .update(schema.runs)
      .set({ status: "done", completedAt: nowIso() })
      .where(eq(schema.runs.id, run.id));
    await logEvent(tx, {
      runId: run.id,
      actor,
      kind: "run_done",
      message: "Run complete",
      ownerEmail: run.ownerEmail,
      orgId: run.orgId,
    });
  }
  return {
    runStatus: next ? ("active" as const) : ("done" as const),
    next: next
      ? {
          id: next.id,
          position: next.position,
          title: next.title,
          owner: next.owner,
          status: next.status,
          waitingOn: waitingOnOf(next),
        }
      : null,
  };
}

export function nextMessage(result: {
  next: { position: number; title: string; waitingOn: Actor | null } | null;
}): string {
  if (!result.next) return "Run complete.";
  const who = result.next.waitingOn === "agent" ? "the agent" : "the person";
  return `Next is step ${result.next.position} "${result.next.title}", waiting on ${who}.`;
}
