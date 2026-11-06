import type { Actor, InputDef } from "./handoff.js";

export interface SampleRunbook {
  title: string;
  description: string;
  inputs: InputDef[];
  steps: {
    title: string;
    instructions: string;
    owner: Actor;
    needsApproval?: boolean;
  }[];
}

export const SAMPLE_RUNBOOKS: SampleRunbook[] = [
  {
    title: "New client onboarding",
    description: "From signed contract to a scheduled kickoff call.",
    inputs: [
      { key: "client_name", label: "Client name", placeholder: "Harbor & Pine Coffee" },
      { key: "contact", label: "Main contact", placeholder: "Dana Reyes, Operations Lead" },
      { key: "service", label: "What they bought", placeholder: "Monthly reporting automation" },
      {
        key: "sales_notes",
        label: "Notes from the sales call",
        placeholder: "Goals, worries, deadlines, tools they use...",
        multiline: true,
      },
    ],
    steps: [
      {
        title: "Draft the welcome email",
        instructions:
          "Write a short, warm welcome email to the main contact. Confirm what they bought, name the two or three goals from the sales notes in their own words, and say the next step is a 30 minute kickoff call. Plain language, under 150 words, no buzzwords.",
        owner: "agent",
        needsApproval: true,
      },
      {
        title: "Send the welcome email",
        instructions:
          "Send the approved email from your own inbox and add the client to the shared folder.",
        owner: "me",
      },
      {
        title: "Build the 30 day onboarding checklist",
        instructions:
          "Turn the sales notes into a week by week checklist for the first 30 days. Mark each item as ours or the client's. Flag anything in the notes that is unclear or risky as an open question at the end.",
        owner: "agent",
      },
      {
        title: "Draft the kickoff agenda",
        instructions:
          "Write a 30 minute kickoff agenda with time boxes. Use the open questions from the checklist as the discussion items, and end with owners and dates.",
        owner: "agent",
        needsApproval: true,
      },
      {
        title: "Schedule the kickoff call",
        instructions:
          "Book the call with the main contact and paste the agenda into the invite.",
        owner: "me",
      },
    ],
  },
  {
    title: "Weekly operations report",
    description: "Turn a week of raw notes into a report leadership will read.",
    inputs: [
      { key: "week_ending", label: "Week ending", placeholder: "Friday, 6 November" },
      {
        key: "raw_notes",
        label: "Raw notes and numbers",
        placeholder: "Paste anything: chat messages, numbers, half sentences...",
        multiline: true,
      },
    ],
    steps: [
      {
        title: "Sort the raw notes",
        instructions:
          "Sort every item in the raw notes into Wins, Problems, Numbers, and Decisions needed. Keep the original meaning; do not add facts. List anything that looks like a number without a source under Needs checking.",
        owner: "agent",
      },
      {
        title: "Confirm the numbers",
        instructions:
          "Check the items under Needs checking against the real source and type the confirmed figures here.",
        owner: "me",
      },
      {
        title: "Write the report",
        instructions:
          "Write the weekly report: three line summary first, then Wins, Problems with what is being done, Numbers (use only the confirmed figures from the previous step), and Decisions needed with a recommended choice. One page at most.",
        owner: "agent",
        needsApproval: true,
      },
      {
        title: "Send to leadership",
        instructions: "Send the approved report and note who received it.",
        owner: "me",
      },
    ],
  },
  {
    title: "Overdue invoice follow-up",
    description: "Chase a late payment politely, then firmly.",
    inputs: [
      { key: "customer", label: "Customer", placeholder: "Northwind Traders" },
      { key: "invoice", label: "Invoice number and amount", placeholder: "INV-2041, $3,200" },
      { key: "days_overdue", label: "Days overdue", placeholder: "21" },
      {
        key: "history",
        label: "What has happened so far",
        placeholder: "Reminders sent, replies, promises made...",
        multiline: true,
      },
    ],
    steps: [
      {
        title: "Draft the reminder",
        instructions:
          "Write a polite, direct payment reminder. State the invoice, amount and days overdue, refer to the history honestly, and ask for a payment date. Under 120 words.",
        owner: "agent",
        needsApproval: true,
      },
      {
        title: "Send the reminder",
        instructions: "Send it and record the date sent.",
        owner: "me",
      },
      {
        title: "Prepare the escalation",
        instructions:
          "Draft the firmer second message to use if there is no reply in five working days, and a three line call script covering the same points.",
        owner: "agent",
      },
      {
        title: "Log the outcome",
        instructions: "Record what the customer said and the agreed payment date.",
        owner: "me",
      },
    ],
  },
];
