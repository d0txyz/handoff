import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  actorOf,
  lockStep,
  logEvent,
  nowIso,
  requireEmail,
} from "../server/lib/handoff.js";

export default defineAction({
  description:
    "Send a step that is in review back to the agent with the person's feedback (status changes). Only the person can do this, from the app. The agent then revises and calls submit-step again.",
  schema: z.object({
    id: z.string().describe("Run step id, status must be review"),
    feedback: z
      .string()
      .min(1)
      .max(4000)
      .describe("What to change, in the person's words"),
  }),
  run: async (args, ctx) => {
    const email = requireEmail(ctx);
    const actor = actorOf(ctx);
    if (actor !== "me") {
      fail("Only the person can request changes, in the app.", {
        errorCode: "requires_person",
        statusCode: 403,
      });
    }
    return getDb().transaction(async (tx) => {
      const { run, step } = await lockStep(tx, args.id, email);
      if (step.status !== "review") {
        fail("This step is not in review.", {
          errorCode: "not_in_review",
          statusCode: 409,
        });
      }
      const feedback = args.feedback.trim();
      await tx
        .update(schema.runSteps)
        .set({ status: "changes", feedback, updatedAt: nowIso() })
        .where(eq(schema.runSteps.id, step.id));
      await logEvent(tx, {
        runId: run.id,
        stepId: step.id,
        actor,
        kind: "changes_requested",
        message: `Asked for changes on "${step.title}": ${feedback.slice(0, 200)}`,
        ownerEmail: run.ownerEmail,
        orgId: run.orgId,
      });
      return {
        id: step.id,
        runId: run.id,
        status: "changes" as const,
        message: "Sent back to the agent.",
      };
    });
  },
});
