import { defineAction, fail } from "@agent-native/core/action";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  parseJson,
  requireEmail,
  type InputDef,
} from "../server/lib/handoff.js";

export default defineAction({
  description:
    "Read one runbook with its start inputs and ordered steps (title, instructions, owner, approval gate).",
  schema: z.object({
    id: z.string().describe("Runbook id from list-runbooks"),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ id }, ctx) => {
    const email = requireEmail(ctx);
    const { runbooks, runbookSteps } = schema;
    const [runbook] = await getDb()
      .select()
      .from(runbooks)
      .where(and(eq(runbooks.id, id), eq(runbooks.ownerEmail, email)))
      .limit(1);
    if (!runbook) {
      fail("Runbook not found.", { errorCode: "not_found", statusCode: 404 });
    }
    const steps = await getDb()
      .select({
        id: runbookSteps.id,
        position: runbookSteps.position,
        title: runbookSteps.title,
        instructions: runbookSteps.instructions,
        owner: runbookSteps.owner,
        needsApproval: runbookSteps.needsApproval,
      })
      .from(runbookSteps)
      .where(eq(runbookSteps.runbookId, id))
      .orderBy(asc(runbookSteps.position));
    return {
      id: runbook.id,
      title: runbook.title,
      description: runbook.description,
      inputs: parseJson<InputDef[]>(runbook.inputs, []),
      steps,
      updatedAt: runbook.updatedAt,
    };
  },
});
