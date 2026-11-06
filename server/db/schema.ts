import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core";

/**
 * Handoff data model.
 *
 * A runbook is a reusable template: an ordered list of steps, each owned by
 * "me" (the person) or "agent". A run is one execution of a runbook: its
 * steps are snapshotted so editing the template never rewrites history.
 *
 * Everything is private to its creator (owner_email). Child rows carry the
 * same owner so the framework's scoped SQL tools see the same rows the
 * actions do.
 */

const owned = {
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
};

export const runbooks = pgTable("runbooks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  /** JSON array of { key, label, placeholder?, multiline? } asked at run start. */
  inputs: text("inputs").notNull().default("[]"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`now()`),
  ...owned,
});

export const runbookSteps = pgTable("runbook_steps", {
  id: text("id").primaryKey(),
  runbookId: text("runbook_id").notNull(),
  position: integer("position").notNull(),
  title: text("title").notNull(),
  instructions: text("instructions").notNull().default(""),
  owner: text("owner", { enum: ["me", "agent"] }).notNull(),
  needsApproval: boolean("needs_approval").notNull().default(false),
  ...owned,
});

export const runs = pgTable("runs", {
  id: text("id").primaryKey(),
  runbookId: text("runbook_id"),
  title: text("title").notNull(),
  status: text("status", { enum: ["active", "done", "cancelled"] })
    .notNull()
    .default("active"),
  /** JSON object of input key -> value captured at start. */
  inputs: text("inputs").notNull().default("{}"),
  /** JSON array snapshot of the runbook's input definitions (for labels). */
  inputDefs: text("input_defs").notNull().default("[]"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
  completedAt: text("completed_at"),
  ...owned,
});

export const runSteps = pgTable("run_steps", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  position: integer("position").notNull(),
  title: text("title").notNull(),
  instructions: text("instructions").notNull().default(""),
  owner: text("owner", { enum: ["me", "agent"] }).notNull(),
  needsApproval: boolean("needs_approval").notNull().default(false),
  status: text("status", {
    enum: ["todo", "review", "changes", "done", "skipped"],
  })
    .notNull()
    .default("todo"),
  /** Markdown work product for this step. */
  output: text("output").notNull().default(""),
  /** The person's latest change request, shown to the agent. */
  feedback: text("feedback").notNull().default(""),
  completedBy: text("completed_by", { enum: ["me", "agent"] }),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`now()`),
  ...owned,
});

export const runEvents = pgTable("run_events", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  stepId: text("step_id"),
  actor: text("actor", { enum: ["me", "agent"] }).notNull(),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
  ...owned,
});
