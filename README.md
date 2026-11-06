# Handoff

Runbooks you and your agent run together.

Every process has steps a person must do (send it, sign it, call them) and steps an agent can do (draft it, sort it, summarize it). Handoff puts both in one run. Each step has an owner, **You** or **Agent**, and the baton passes between the two lanes until the work is done.

Built with [Agent-Native](https://www.agent-native.com) for the Agent-Native Hackathon.

## What it does

- **Runbooks**: a reusable process, split into ordered steps. Each step is yours or the agent's. Agent steps can be gated: "I approve this before the run moves on."
- **Runs**: one execution of a runbook, with its own inputs (client name, pasted notes). Steps are copied into the run, so editing a runbook never rewrites history.
- **The two-lane view**: the run page draws a You lane and an Agent lane. The line crosses over at every handoff. Hover the other lane on any open step to hand it over or take it back.
- **Review loop**: the agent's gated work lands as a draft. Approve it, edit it and approve, or send it back with feedback. The agent revises and resubmits.
- **Automatic baton pass**: when you finish a step and the next one is the agent's, it starts on its own in the sidebar chat.
- **Describe a process**: tell the agent how you do something and it writes the runbook, deciding who owns each step.

## The rule that makes it safe

The same actions serve the UI and the agent, and each action checks who is calling. Only a click in the app counts as the person. The agent (and the CLI, MCP and A2A callers) cannot:

- approve its own work (`approval_requires_person`)
- do a step that belongs to you (`not_your_step`)
- take a step for itself (`handoff_requires_person`)
- work ahead of the current step (`step_blocked`)
- skip, cancel or delete anything

This lives in `server/lib/handoff.ts` (`actorOf`, `lockStep`, `assertCurrent`) and holds on every surface, because there is only one implementation.

## How it uses Agent-Native

| Piece | Where |
| --- | --- |
| 14 shared actions (UI hooks, agent tools, CLI, MCP, A2A) | `actions/` |
| Caller-aware rules from `ctx.caller` | `server/lib/handoff.ts` |
| Postgres schema and migration (PGlite locally) | `server/db/`, `server/plugins/db.ts` |
| Agent context: `runId`, `stepId`, `runbookId` in navigation state | `app/hooks/use-navigation-state.ts`, `actions/view-screen.ts` |
| UI to agent delegation with `sendToAgentChat` (no inline LLM calls) | `app/routes/runs.$runId.tsx`, `app/components/handoff/` |
| Agent instructions and the run-working skill | `AGENTS.md`, `.agents/skills/working-a-run/SKILL.md` |
| Live refresh after agent writes | action queries, automatic |

## Run it

Needs Node.js 22.22 or later.

```bash
corepack pnpm install
```

```bash
corepack pnpm dev
```

Open the printed URL, choose **Continue as local dev**, then connect a model in the agent sidebar (Builder.io, or your own provider key). Click **Add three sample runbooks** and start one.

## Checks

```bash
corepack pnpm typecheck
```

```bash
corepack pnpm agent-native:doctor
```

## What was pre-existing

The project started from the Agent-Native `chat` template (`@agent-native/core` 0.224.0), which provides the app shell, auth, chat sidebar and settings pages. Everything listed under "How it uses Agent-Native" was written for the hackathon, between its start on October 27, 2026 and the deadline.
