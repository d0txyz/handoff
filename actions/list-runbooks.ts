import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { requireEmail } from "../server/lib/handoff.js";

export default defineAction({
  description:
    "List the user's runbooks (reusable step-by-step processes) with each one's step count and which steps belong to the agent.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  link: () => ({
    url: buildDeepLink({ view: "runs", to: "/runs" }),
    label: "Open Handoff",
  }),
  run: async (_args, ctx) => {
    const email = requireEmail(ctx);
    const { runbooks, runbookSteps } = schema;
    const rows = await getDb()
      .select({
        id: runbooks.id,
        title: runbooks.title,
        description: runbooks.description,
        updatedAt: runbooks.updatedAt,
      })
      .from(runbooks)
      .where(eq(runbooks.ownerEmail, email))
      .orderBy(desc(runbooks.updatedAt))
      .limit(100);
    const ids = rows.map((row) => row.id);
    const steps = ids.length
      ? await getDb()
          .select({
            runbookId: runbookSteps.runbookId,
            owner: runbookSteps.owner,
          })
          .from(runbookSteps)
          .where(inArray(runbookSteps.runbookId, ids))
          .orderBy(asc(runbookSteps.position))
      : [];
    return {
      runbooks: rows.map((row) => {
        const own = steps.filter((step) => step.runbookId === row.id);
        return {
          ...row,
          stepCount: own.length,
          agentSteps: own.filter((step) => step.owner === "agent").length,
          lanes: own.map((step) => step.owner),
        };
      }),
    };
  },
});
