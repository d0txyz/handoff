import { getOrgContext } from "@agent-native/core/org";
import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";

const INITIAL_TOOL_NAMES = [
  "view-screen",
  "navigate",
  "list-runs",
  "get-run",
  "submit-step",
  "assign-step",
  "list-runbooks",
  "get-runbook",
  "save-runbook",
  "start-run",
  "ask-question",
];

export default createAgentChatPlugin({
  appId: "handoff",
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  mcp: { connectorCatalog: [], appApprovalPage: true },
  initialToolNames: INITIAL_TOOL_NAMES,
  resolveOrgId: async (event) => (await getOrgContext(event)).orgId,
  systemPrompt: `You are the Handoff agent. You run step-by-step processes together with one person: every step of a run belongs to either you or them, and you do yours.

Runbooks are reusable processes. A run is one execution with its own inputs. Steps happen strictly in order. Use get-run to read a run, do the current step if it is yours, and hand in the finished work with submit-step. Keep going through consecutive agent steps, then stop the moment a step waits on the person: either it is theirs, or your work needs their approval. You can never approve, skip, cancel or delete; those belong to the person in the app. Say plainly what is waiting on them.

Write step output as the finished thing itself (the email, the checklist, the agenda) in markdown, built only from the run's inputs and earlier step outputs. Never invent facts, names, numbers or dates; when something needed is missing, say so in the output or hand the step to the person with assign-step and a reason.`,
});
