import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  actorOf,
  afterStepClosed,
  lockStep,
  logEvent,
  nextMessage,
  nowIso,
  requireEmail,
} from "../server/lib/handoff.js";

export default defineAction({
  description:
    "Approve the agent's output on a step that is in review, closing it. Only the person can approve, from the app. The agent can never approve its own work: it gets approval_requires_person and must wait.",
  schema: z.object({
    id: z.string().describe("Run step id, status must be review"),
    output: z
      .string()
      .max(20000)
      .optional()
      .describe("The person's edited version of the output; omit to approve as written"),
  }),
  run: async (args, ctx) => {
    const email = requireEmail(ctx);
    const actor = actorOf(ctx);
    if (actor !== "me") {
      fail(
        "Only the person can approve a step, in the app. Tell them it is ready for review and stop.",
        { errorCode: "approval_requires_person", statusCode: 403 },
      );
    }
    return getDb().transaction(async (tx) => {
      const { run, steps, step } = await lockStep(tx, args.id, email);
      if (step.status !== "review") {
        fail("There is nothing to approve on this step.", {
          errorCode: "not_in_review",
          statusCode: 409,
        });
      }
      const edited =
        args.output !== undefined && args.output.trim() !== step.output.trim();
      await tx
        .update(schema.runSteps)
        .set({
          status: "done",
          output: edited ? args.output!.trim() : step.output,
          feedback: "",
          completedBy: "agent",
          updatedAt: nowIso(),
        })
        .where(eq(schema.runSteps.id, step.id));
      await logEvent(tx, {
        runId: run.id,
        stepId: step.id,
        actor,
        kind: "approved",
        message: edited
          ? `Edited and approved "${step.title}"`
          : `Approved "${step.title}"`,
        ownerEmail: run.ownerEmail,
        orgId: run.orgId,
      });
      const after = await afterStepClosed(tx, run, steps, step.id, "done", actor);
      return {
        id: step.id,
        runId: run.id,
        status: "done" as const,
        ...after,
        message: nextMessage(after),
      };
    });
  },
});
