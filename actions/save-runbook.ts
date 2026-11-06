import { defineAction, fail } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { nowIso, requireEmail } from "../server/lib/handoff.js";
import { inputDefSchema, stepSchema } from "../server/lib/runbook-shape.js";

export default defineAction({
  description:
    "Create a runbook, or replace an existing one when id is given. Takes the whole runbook: title, description, start inputs, and the ordered steps with an owner (me or agent) for each. Runs already started keep their own copy of the steps.",
  schema: z.object({
    id: z
      .string()
      .optional()
      .describe("Existing runbook id to replace; omit to create a new runbook"),
    title: z.string().min(1).max(120).describe("Runbook name"),
    description: z
      .string()
      .default("")
      .describe("One sentence on when to run this; defaults to empty"),
    inputs: z
      .array(inputDefSchema)
      .max(8)
      .default([])
      .describe("Facts asked when a run starts; defaults to none"),
    steps: z.array(stepSchema).min(1).max(30).describe("Steps in run order"),
  }),
  link: ({ result }) => ({
    url: buildDeepLink({
      view: "runbook",
      to: `/runbooks/${encodeURIComponent(result.id)}`,
      params: { runbookId: result.id },
    }),
    label: `Open ${result.title}`,
  }),
  run: async (args, ctx) => {
    const ownerEmail = requireEmail(ctx);
    const orgId = ctx?.orgId ?? null;
    const keys = args.inputs.map((input) => input.key);
    if (new Set(keys).size !== keys.length) {
      fail("Input keys must be unique.", { errorCode: "duplicate_input_key" });
    }
    const { runbooks, runbookSteps } = schema;
    const id = args.id ?? crypto.randomUUID();
    const now = nowIso();

    await getDb().transaction(async (tx) => {
      if (args.id) {
        const [updated] = await tx
          .update(runbooks)
          .set({
            title: args.title,
            description: args.description,
            inputs: JSON.stringify(args.inputs),
            updatedAt: now,
          })
          .where(and(eq(runbooks.id, id), eq(runbooks.ownerEmail, ownerEmail)))
          .returning({ id: runbooks.id });
        if (!updated) {
          fail("Runbook not found.", {
            errorCode: "not_found",
            statusCode: 404,
          });
        }
        await tx.delete(runbookSteps).where(eq(runbookSteps.runbookId, id));
      } else {
        await tx.insert(runbooks).values({
          id,
          title: args.title,
          description: args.description,
          inputs: JSON.stringify(args.inputs),
          createdAt: now,
          updatedAt: now,
          ownerEmail,
          orgId,
        });
      }
      await tx.insert(runbookSteps).values(
        args.steps.map((step, index) => ({
          id: crypto.randomUUID(),
          runbookId: id,
          position: index + 1,
          title: step.title,
          instructions: step.instructions,
          owner: step.owner,
          needsApproval: step.owner === "agent" ? step.needsApproval : false,
          ownerEmail,
          orgId,
        })),
      );
    });

    return {
      id,
      title: args.title,
      stepCount: args.steps.length,
      agentSteps: args.steps.filter((step) => step.owner === "agent").length,
      message: args.id ? "Runbook updated." : "Runbook created.",
    };
  },
});
