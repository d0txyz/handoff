import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { requireEmail, summarize } from "../server/lib/handoff.js";

export default defineAction({
  description:
    "List runs with progress, the current step, and who each run is waiting on (me = the person, agent = you). Use it to find runs with agent work pending.",
  schema: z.object({
    status: z
      .enum(["active", "done", "cancelled", "all"])
      .default("active")
      .describe(
        'Which runs: "active", "done", "cancelled" or "all"; defaults to "active"',
      ),
  }),
  http: { method: "GET" },
  readOnly: true,
  link: () => ({
    url: buildDeepLink({ view: "runs", to: "/runs" }),
    label: "Open runs",
  }),
  run: async ({ status }, ctx) => {
    const email = requireEmail(ctx);
    const { runs, runSteps } = schema;
    const rows = await getDb()
      .select({
        id: runs.id,
        title: runs.title,
        status: runs.status,
        runbookId: runs.runbookId,
        createdAt: runs.createdAt,
        completedAt: runs.completedAt,
      })
      .from(runs)
      .where(
        status === "all"
          ? eq(runs.ownerEmail, email)
          : and(eq(runs.ownerEmail, email), eq(runs.status, status)),
      )
      .orderBy(desc(runs.createdAt))
      .limit(60);
    const ids = rows.map((row) => row.id);
    const steps = ids.length
      ? await getDb()
          .select({
            id: runSteps.id,
            runId: runSteps.runId,
            position: runSteps.position,
            title: runSteps.title,
            owner: runSteps.owner,
            status: runSteps.status,
            needsApproval: runSteps.needsApproval,
          })
          .from(runSteps)
          .where(inArray(runSteps.runId, ids))
          .orderBy(asc(runSteps.position))
      : [];
    return {
      runs: rows.map((row) => {
        const own = steps.filter((step) => step.runId === row.id);
        const summary = summarize(own);
        return {
          ...row,
          total: summary.total,
          closed: summary.closed,
          currentStep: row.status === "active" ? summary.currentStep : null,
          waitingOn: row.status === "active" ? summary.waitingOn : null,
          lanes: own.map((step) => ({ owner: step.owner, status: step.status })),
        };
      }),
    };
  },
});
