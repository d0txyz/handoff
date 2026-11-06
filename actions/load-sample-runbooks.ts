import { defineAction } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { nowIso, requireEmail } from "../server/lib/handoff.js";
import { SAMPLE_RUNBOOKS } from "../server/lib/samples.js";

export default defineAction({
  description:
    "Add the three sample runbooks (client onboarding, weekly operations report, overdue invoice follow-up). Samples whose title already exists are skipped, so calling it twice adds nothing.",
  schema: z.object({}),
  retrySafe: true,
  run: async (_args, ctx) => {
    const ownerEmail = requireEmail(ctx);
    const orgId = ctx?.orgId ?? null;
    const { runbooks, runbookSteps } = schema;
    const added: { id: string; title: string }[] = [];

    await getDb().transaction(async (tx) => {
      const existing = await tx
        .select({ title: runbooks.title })
        .from(runbooks)
        .where(eq(runbooks.ownerEmail, ownerEmail));
      const titles = new Set(existing.map((row) => row.title));
      const base = Date.now();
      for (const [index, sample] of SAMPLE_RUNBOOKS.entries()) {
        if (titles.has(sample.title)) continue;
        const id = crypto.randomUUID();
        // Stagger timestamps so the library keeps the samples' order.
        const stamp = new Date(base - index * 1000).toISOString();
        await tx.insert(runbooks).values({
          id,
          title: sample.title,
          description: sample.description,
          inputs: JSON.stringify(sample.inputs),
          createdAt: stamp,
          updatedAt: stamp,
          ownerEmail,
          orgId,
        });
        await tx.insert(runbookSteps).values(
          sample.steps.map((step, position) => ({
            id: crypto.randomUUID(),
            runbookId: id,
            position: position + 1,
            title: step.title,
            instructions: step.instructions,
            owner: step.owner,
            needsApproval: step.owner === "agent" && Boolean(step.needsApproval),
            ownerEmail,
            orgId,
          })),
        );
        added.push({ id, title: sample.title });
      }
    });

    return {
      added,
      message: added.length
        ? `Added ${added.length} sample runbook${added.length === 1 ? "" : "s"}.`
        : "The sample runbooks are already in the library.",
      at: nowIso(),
    };
  },
});
