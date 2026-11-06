import { defineAction, fail } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  actorOf,
  logEvent,
  nowIso,
  parseJson,
  requireEmail,
  summarize,
  type InputDef,
} from "../server/lib/handoff.js";

export default defineAction({
  description:
    "Start a run of a runbook. Copies the runbook's steps into a new run and stores the start inputs. Returns the run id and the first step; if that step belongs to the agent, work it with submit-step.",
  schema: z.object({
    runbookId: z.string().describe("Runbook id from list-runbooks"),
    title: z
      .string()
      .max(140)
      .optional()
      .describe(
        'Name for this run, e.g. "Onboarding: Harbor & Pine"; defaults to the runbook title plus today\'s date',
      ),
    inputs: z
      .record(z.string(), z.string())
      .default({})
      .describe(
        "Start input values keyed by the runbook's input keys (see get-runbook); unknown keys are rejected; defaults to empty",
      ),
  }),
  link: ({ result }) => ({
    url: buildDeepLink({
      view: "run",
      to: `/runs/${encodeURIComponent(result.id)}`,
      params: { runId: result.id },
    }),
    label: `Open ${result.title}`,
  }),
  run: async (args, ctx) => {
    const ownerEmail = requireEmail(ctx);
    const orgId = ctx?.orgId ?? null;
    const actor = actorOf(ctx);
    const { runbooks, runbookSteps, runs, runSteps } = schema;

    const [runbook] = await getDb()
      .select()
      .from(runbooks)
      .where(
        and(eq(runbooks.id, args.runbookId), eq(runbooks.ownerEmail, ownerEmail)),
      )
      .limit(1);
    if (!runbook) {
      fail("Runbook not found.", { errorCode: "not_found", statusCode: 404 });
    }
    const templateSteps = await getDb()
      .select()
      .from(runbookSteps)
      .where(eq(runbookSteps.runbookId, runbook.id))
      .orderBy(asc(runbookSteps.position));
    if (!templateSteps.length) {
      fail("This runbook has no steps yet.", { errorCode: "empty_runbook" });
    }

    const defs = parseJson<InputDef[]>(runbook.inputs, []);
    const known = new Set(defs.map((def) => def.key));
    const unknown = Object.keys(args.inputs).filter((key) => !known.has(key));
    if (unknown.length) {
      fail(
        `Unknown input ${unknown.join(", ")}. This runbook takes: ${
          [...known].join(", ") || "no inputs"
        }.`,
        { errorCode: "unknown_input", details: { known: [...known] } },
      );
    }

    const id = crypto.randomUUID();
    const now = nowIso();
    const title =
      args.title?.trim() ||
      `${runbook.title}, ${new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}`;
    const steps = templateSteps.map((step) => ({
      id: crypto.randomUUID(),
      runId: id,
      position: step.position,
      title: step.title,
      instructions: step.instructions,
      owner: step.owner,
      needsApproval: step.needsApproval,
      status: "todo" as const,
      updatedAt: now,
      ownerEmail,
      orgId,
    }));

    await getDb().transaction(async (tx) => {
      await tx.insert(runs).values({
        id,
        runbookId: runbook.id,
        title,
        inputs: JSON.stringify(args.inputs),
        inputDefs: JSON.stringify(defs),
        createdAt: now,
        ownerEmail,
        orgId,
      });
      await tx.insert(runSteps).values(steps);
      await logEvent(tx, {
        runId: id,
        actor,
        kind: "run_started",
        message: `Started from "${runbook.title}"`,
        ownerEmail,
        orgId,
      });
    });

    const summary = summarize(steps);
    return {
      id,
      title,
      stepCount: steps.length,
      currentStep: summary.currentStep,
      waitingOn: summary.waitingOn,
      message: `Run started. Step 1 "${steps[0]?.title ?? ""}" is waiting on ${
        summary.waitingOn === "agent" ? "the agent" : "the person"
      }.`,
    };
  },
});
