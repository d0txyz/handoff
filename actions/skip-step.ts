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
    "Skip the current step of a run so the next one can start. Only the person can skip, from the app.",
  schema: z.object({
    id: z.string().describe("Run step id; must be the run's current step"),
  }),
  run: async (args, ctx) => {
    const email = requireEmail(ctx);
    const actor = actorOf(ctx);
    if (actor !== "me") {
      fail("Only the person can skip a step, in the app.", {
        errorCode: "requires_person",
        statusCode: 403,
      });
    }
    return getDb().transaction(async (tx) => {
      const { run, steps, step } = await lockStep(tx, args.id, email);
      assertCurrent(steps, step);
      await tx
        .update(schema.runSteps)
        .set({ status: "skipped", updatedAt: nowIso() })
        .where(eq(schema.runSteps.id, step.id));
      await logEvent(tx, {
        runId: run.id,
        stepId: step.id,
        actor,
        kind: "skipped",
        message: `Skipped "${step.title}"`,
        ownerEmail: run.ownerEmail,
        orgId: run.orgId,
      });
      const after = await afterStepClosed(
        tx,
        run,
        steps,
        step.id,
        "skipped",
        actor,
      );
      return {
        id: step.id,
        runId: run.id,
        status: "skipped" as const,
        ...after,
        message: nextMessage(after),
      };
    });
  },
});
