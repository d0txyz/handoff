import { defineAction } from "@agent-native/core/action";
import { readAppState } from "@agent-native/core/application-state";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { summarize } from "../server/lib/handoff.js";

export default defineAction({
  description:
    "Read what the person is looking at right now: the navigation state and, on a run page, that run's title, steps (id, owner, status) and the step they have selected. Basic navigation is already in <current-screen>; call this for a fresh read before acting on \"this run\" or \"this step\".",
  schema: z.object({}),
  http: false,
  readOnly: true,
  run: async (_args, ctx) => {
    const navigation = (await readAppState("navigation")) as
      | { view?: string; runId?: string; stepId?: string; runbookId?: string }
      | null
      | undefined;
    if (!navigation) return "No application state found. Is the app running?";

    const screen: Record<string, unknown> = { navigation };
    const email = ctx?.userEmail;
    if (navigation.runId && email) {
      const { runs, runSteps } = schema;
      const [run] = await getDb()
        .select({ id: runs.id, title: runs.title, status: runs.status })
        .from(runs)
        .where(and(eq(runs.id, navigation.runId), eq(runs.ownerEmail, email)))
        .limit(1);
      if (run) {
        const steps = await getDb()
          .select({
            id: runSteps.id,
            position: runSteps.position,
            title: runSteps.title,
            owner: runSteps.owner,
            status: runSteps.status,
            needsApproval: runSteps.needsApproval,
          })
          .from(runSteps)
          .where(eq(runSteps.runId, run.id))
          .orderBy(asc(runSteps.position));
        const summary = summarize(steps);
        screen.run = {
          ...run,
          steps,
          currentStepId: summary.currentStepId,
          waitingOn: run.status === "active" ? summary.waitingOn : null,
          selectedStepId: navigation.stepId ?? summary.currentStepId,
        };
      }
    }
    return screen;
  },
});
