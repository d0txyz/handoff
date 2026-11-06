---
name: working-a-run
description: >-
  How to work a Handoff run and how to write a runbook. Use when asked to do,
  continue or revise steps in a run, when a step is handed to the agent, when
  asked what is waiting on whom, or when turning a described process into a
  runbook.
scope: both
---

# Working a Run

A run is a relay between one person and the agent. Each step has one owner.
Your job is to do your steps well and pass the baton back at the right moment.

## Work a run

1. Find the run. Use the `runId` in the message context or `<current-screen>`;
   otherwise `list-runs` and pick the one waiting on `agent`. If several fit
   and none was named, ask which.
2. `get-run`. Read the inputs, every earlier step's `output`, and the current
   step's `instructions` and `feedback`.
3. If the current step is yours (`owner: agent`, status `todo` or `changes`):
   do it, then `submit-step` with the result in `output`.
   - Status `changes` means the person sent it back. Apply their `feedback`
     to the previous `output`; change what they asked and keep the rest.
4. Read the result. When `next.waitingOn` is `agent`, go to 2 for that step.
   When it is `me`, or the step went to `review`, stop.
5. End with one or two lines: what you finished and exactly what is waiting on
   the person ("Step 2 is yours: send the email", "Step 4 is ready to review").
   Do not paste the output into chat; it is on the step.

## Rules

- Output is the deliverable itself, ready to use: the email with a subject
  line, the checklist, the agenda. No preamble such as "Here is the draft".
- Use only the run inputs and earlier outputs. If a fact is missing, write a
  clearly marked placeholder like `[payment date?]` and list the gaps at the
  end under "Needs from you". Never invent names, numbers, dates or quotes.
- Follow length and tone limits in the instructions exactly.
- Never use em dashes, in step output or in chat. Use a colon, a comma,
  parentheses or a new sentence.
- You cannot approve, request changes, skip, cancel or delete, and you cannot
  do or take a step owned by the person. Those errors are final: say what is
  waiting on them and stop.
- If a step of yours needs access you do not have (sending, logging in,
  paying, calling), give it to the person with `assign-step` (`owner: "me"`)
  and a short `reason`.
- "This step" or "this one" means `stepId` in `<current-screen>`; call
  `view-screen` when unsure.

## Write a runbook

Use `save-runbook` with the whole runbook. To change one, `get-runbook`
first and send the full edited version with its `id`.

- 3 to 8 steps, each one outcome, titled with a verb.
- `agent` owns work made of words and structure: drafts, summaries,
  checklists, agendas, comparisons, sorting notes.
- `me` owns anything that touches the outside world or needs their judgment
  or access: sending, calling, paying, signing, booking, confirming numbers.
- Set `needsApproval: true` on agent steps whose output goes to another
  person or commits the user to something. Leave internal working steps open
  so the run keeps moving.
- Put the facts that change per run in `inputs` (2 to 5, one `multiline` for
  pasted notes). Agent step instructions should name which inputs or earlier
  steps to use and any length limit.
- After saving, tell the person the split in one line and offer to start a run.
