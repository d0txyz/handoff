import { z } from "zod";

export const inputDefSchema = z.object({
  key: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*$/)
    .describe('Short snake_case key, e.g. "client_name"'),
  label: z
    .string()
    .min(1)
    .describe('Label shown to the person, e.g. "Client name"'),
  placeholder: z.string().optional().describe("Example value shown as a hint"),
  multiline: z
    .boolean()
    .optional()
    .describe("true for long pasted text such as notes; defaults to false"),
});

export const stepSchema = z.object({
  title: z.string().min(1).max(140).describe("Short imperative step title"),
  instructions: z
    .string()
    .default("")
    .describe(
      "What doing this step well means. For agent steps, say what to produce and from which inputs or earlier steps.",
    ),
  owner: z
    .enum(["me", "agent"])
    .describe(
      '"agent" for work the agent can produce (drafts, summaries, checklists, analysis); "me" for anything only the person can do (sending, calling, paying, signing, logging in)',
    ),
  needsApproval: z
    .boolean()
    .default(false)
    .describe(
      'true when the person must review the agent\'s output before the run moves on; ignored for "me" steps; defaults to false',
    ),
});
