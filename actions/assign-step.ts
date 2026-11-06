import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  actorOf,
  isClosed,
  lockStep,
  logEvent,
  nowIso,
  requireEmail,
} from "../server/lib/handoff.js";

export default defineAction({
  description:
    'Hand an open step of a run to the other side. The person can hand a step to the agent or take one back. The agent can only give a step to the person (owner "me"), for example when it lacks the access or facts to do it; it cannot take a step for itself.',
  schema: z.object({
    id: z.string().describe("Run step id; the step must not be done or skipped"),
    owner: z
      .enum(["me", "agent"])
      .describe('New owner: "me" (the person) or "agent"'),
    reason: z
      .string()
      .max(500)
      .optional()
      .describe("Why, shown in the run's activity; the agent should always give one"),
  }),
  run: async (args, ctx) => {
    const email = requireEmail(ctx);
    const actor = actorOf(ctx);
    if (actor === "agent" && args.owner === "agent") {
      fail(
        "The agent cannot take a step for itself. Ask the person to hand it over in the app.",
        { errorCode: "handoff_requires_person", statusCode: 403 },
      );
    }
    return getDb().transaction(async (tx) => {
      const { run, step } = await lockStep(tx, args.id, email);
      if (isClosed(step.status)) {
        fail(`Step ${step.position} is already ${step.status}.`, {
          errorCode: "step_closed",
          statusCode: 409,
        });
      }
      if (step.owner === args.owner && step.status !== "review") {
        return {
          id: step.id,
          runId: run.id,
          owner: step.owner,
          status: step.status,
          message: "No change: that side already owns this step.",
        };
      }
      await tx
        .update(schema.runSteps)
        .set({
          owner: args.owner,
          // A draft waiting for review is withdrawn when the step changes hands.
          status: "todo",
          needsApproval: args.owner === "agent" ? step.needsApproval : false,
          updatedAt: nowIso(),
        })
        .where(eq(schema.runSteps.id, step.id));
      const reason = args.reason?.trim();
      await logEvent(tx, {
        runId: run.id,
        stepId: step.id,
        actor,
        kind: "handoff",
        message:
          (args.owner === "agent"
            ? `Handed "${step.title}" to the agent`
            : actor === "me"
              ? `Took over "${step.title}"`
              : `Handed "${step.title}" to the person`) +
          (reason ? `: ${reason}` : ""),
        ownerEmail: run.ownerEmail,
        orgId: run.orgId,
      });
      return {
        id: step.id,
        runId: run.id,
        owner: args.owner,
        status: "todo" as const,
        message:
          args.owner === "agent"
            ? "The step now belongs to the agent."
            : "The step now belongs to the person.",
      };
    });
  },
});
