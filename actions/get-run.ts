import { defineAction, fail } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  parseJson,
  requireEmail,
  summarize,
  type InputDef,
} from "../server/lib/handoff.js";

export default defineAction({
  description:
    "Read one run in full: start inputs, every step with its owner, status, instructions, output and the person's feedback, plus currentStepId and waitingOn. Read this before working a step.",
  schema: z.object({ id: z.string().describe("Run id from list-runs") }),
  http: { method: "GET" },
  readOnly: true,
  link: ({ args }) => ({
    url: buildDeepLink({
      view: "run",
      to: `/runs/${encodeURIComponent(args.id)}`,
      params: { runId: args.id },
    }),
    label: "Open run",
  }),
  run: async ({ id }, ctx) => {
    const email = requireEmail(ctx);
    const { runs, runSteps, runEvents } = schema;
    const [run] = await getDb()
      .select()
      .from(runs)
      .where(and(eq(runs.id, id), eq(runs.ownerEmail, email)))
      .limit(1);
    if (!run) {
      fail("Run not found.", { errorCode: "not_found", statusCode: 404 });
    }
    const steps = await getDb()
      .select({
        id: runSteps.id,
        position: runSteps.position,
        title: runSteps.title,
        instructions: runSteps.instructions,
        owner: runSteps.owner,
        needsApproval: runSteps.needsApproval,
        status: runSteps.status,
        output: runSteps.output,
        feedback: runSteps.feedback,
        completedBy: runSteps.completedBy,
        updatedAt: runSteps.updatedAt,
      })
      .from(runSteps)
      .where(eq(runSteps.runId, id))
      .orderBy(asc(runSteps.position));
    const events = await getDb()
      .select({
        id: runEvents.id,
        stepId: runEvents.stepId,
        actor: runEvents.actor,
        kind: runEvents.kind,
        message: runEvents.message,
        createdAt: runEvents.createdAt,
      })
      .from(runEvents)
      .where(eq(runEvents.runId, id))
      .orderBy(desc(runEvents.createdAt))
      .limit(80);

    const values = parseJson<Record<string, string>>(run.inputs, {});
    const defs = parseJson<InputDef[]>(run.inputDefs, []);
    const summary = summarize(steps);
    const active = run.status === "active";
    return {
      id: run.id,
      title: run.title,
      status: run.status,
      runbookId: run.runbookId,
      createdAt: run.createdAt,
      completedAt: run.completedAt,
      inputs: defs.map((def) => ({
        key: def.key,
        label: def.label,
        value: values[def.key] ?? "",
      })),
      steps,
      total: summary.total,
      closed: summary.closed,
      currentStepId: active ? summary.currentStepId : null,
      waitingOn: active ? summary.waitingOn : null,
      events,
    };
  },
});
