import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  actorOf,
  logEvent,
  nowIso,
  requireEmail,
} from "../server/lib/handoff.js";

export default defineAction({
  description:
    "Cancel an active run, or with remove true delete a run and its history. Only the person can do either, from the app.",
  schema: z.object({
    id: z.string().describe("Run id"),
    remove: z
      .boolean()
      .default(false)
      .describe("true deletes the run permanently; defaults to false (cancel only)"),
  }),
  run: async ({ id, remove }, ctx) => {
    const email = requireEmail(ctx);
    const actor = actorOf(ctx);
    if (actor !== "me") {
      fail("Only the person can cancel or delete a run, in the app.", {
        errorCode: "requires_person",
        statusCode: 403,
      });
    }
    const { runs } = schema;
    const mine = and(eq(runs.id, id), eq(runs.ownerEmail, email));
    if (remove) {
      const [deleted] = await getDb()
        .delete(runs)
        .where(mine)
        .returning({ id: runs.id });
      if (!deleted) {
        fail("Run not found.", { errorCode: "not_found", statusCode: 404 });
      }
      return { id, status: "deleted" as const };
    }
    return getDb().transaction(async (tx) => {
      const [run] = await tx
        .update(runs)
        .set({ status: "cancelled", completedAt: nowIso() })
        .where(and(mine, eq(runs.status, "active")))
        .returning({ id: runs.id, orgId: runs.orgId });
      if (!run) {
        fail("Run not found or no longer active.", {
          errorCode: "not_found",
          statusCode: 404,
        });
      }
      await logEvent(tx, {
        runId: id,
        actor,
        kind: "run_cancelled",
        message: "Cancelled the run",
        ownerEmail: email,
        orgId: run.orgId,
      });
      return { id, status: "cancelled" as const };
    });
  },
});
