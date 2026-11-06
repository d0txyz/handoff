import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  actorOf,
  afterStepClosed,
  assertCurrent,
  lockStep,
  logEvent,
  nextMessage,
  nowIso,
  requireEmail,
} from "../server/lib/handoff.js";

export default defineAction({
  description:
    "Finish the current step of a run. The agent calls it with its work as markdown in output; if the step has an approval gate the output goes to the person for review (status review) instead of closing. The person calls it to mark their own step done. Fails with step_blocked if an earlier step is still open and not_your_step if the agent tries a step owned by the person.",
  schema: z.object({
    id: z.string().describe("Run step id from get-run"),
    output: z
      .string()
      .max(20000)
      .optional()
      .describe(
        "The work product as markdown (the email, checklist, summary). Required when the agent submits; optional notes when the person does",
      ),
  }),
  run: async (args, ctx) => {
    const email = requireEmail(ctx);
    const actor = actorOf(ctx);
    const output = args.output?.trim() ?? "";
    if (actor === "agent" && !output) {
      fail("Pass the finished work in output.", { errorCode: "output_required" });
    }

    return getDb().transaction(async (tx) => {
      const { run, steps, step } = await lockStep(tx, args.id, email);
      assertCurrent(steps, step);
      if (step.status === "review") {
        fail(
          "This step is already submitted and is waiting for the person's review.",
          { errorCode: "awaiting_review", statusCode: 409 },
        );
      }
      if (actor === "agent" && step.owner === "me") {
        fail(
          `Step ${step.position} "${step.title}" belongs to the person. Tell them it is their turn; do not do it for them unless they hand it to you.`,
          { errorCode: "not_your_step", statusCode: 403 },
        );
      }

      const toReview = actor === "agent" && step.needsApproval;
      const status = toReview ? ("review" as const) : ("done" as const);
      await tx
        .update(schema.runSteps)
        .set({
          status,
          output: output || step.output,
          feedback: "",
          completedBy: toReview ? null : actor,
          updatedAt: nowIso(),
        })
        .where(eq(schema.runSteps.id, step.id));
      await logEvent(tx, {
        runId: run.id,
        stepId: step.id,
        actor,
        kind: toReview ? "submitted" : "done",
        message: toReview
          ? `Sent "${step.title}" for review`
          : `Finished "${step.title}"`,
        ownerEmail: run.ownerEmail,
        orgId: run.orgId,
      });

      if (toReview) {
        return {
          id: step.id,
          runId: run.id,
          status,
          runStatus: "active" as const,
          next: null,
          message: `Step ${step.position} is waiting for the person's approval. Stop here and tell them it is ready to review.`,
        };
      }
      const after = await afterStepClosed(tx, run, steps, step.id, "done", actor);
      return {
        id: step.id,
        runId: run.id,
        status,
        ...after,
        message: nextMessage(after),
      };
    });
  },
});
