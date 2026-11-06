import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { actorOf, requireEmail } from "../server/lib/handoff.js";

export default defineAction({
  description:
    "Delete a runbook. Only the person can do this, from the app; runs already started from it are kept.",
  schema: z.object({ id: z.string().describe("Runbook id") }),
  run: async ({ id }, ctx) => {
    const email = requireEmail(ctx);
    if (actorOf(ctx) !== "me") {
      fail(
        "Only the person can delete a runbook. Ask them to delete it in the app.",
        { errorCode: "requires_person", statusCode: 403 },
      );
    }
    const { runbooks } = schema;
    const [deleted] = await getDb()
      .delete(runbooks)
      .where(and(eq(runbooks.id, id), eq(runbooks.ownerEmail, email)))
      .returning({ id: runbooks.id });
    if (!deleted) {
      fail("Runbook not found.", { errorCode: "not_found", statusCode: 404 });
    }
    return { id, deleted: true };
  },
});
