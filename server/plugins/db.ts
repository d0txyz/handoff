import { runMigrations } from "@agent-native/core/db";

export default runMigrations(
  [
    {
      version: 1,
      name: "handoff-runbooks-and-runs",
      sql: `CREATE TABLE IF NOT EXISTS runbooks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  inputs TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (now()),
  updated_at TEXT NOT NULL DEFAULT (now()),
  owner_email TEXT NOT NULL,
  org_id TEXT
);
CREATE TABLE IF NOT EXISTS runbook_steps (
  id TEXT PRIMARY KEY,
  runbook_id TEXT NOT NULL REFERENCES runbooks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL CHECK (owner IN ('me', 'agent')),
  needs_approval BOOLEAN NOT NULL DEFAULT FALSE,
  owner_email TEXT NOT NULL,
  org_id TEXT
);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  runbook_id TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'cancelled')),
  inputs TEXT NOT NULL DEFAULT '{}',
  input_defs TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (now()),
  completed_at TEXT,
  owner_email TEXT NOT NULL,
  org_id TEXT
);
CREATE TABLE IF NOT EXISTS run_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL CHECK (owner IN ('me', 'agent')),
  needs_approval BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'review', 'changes', 'done', 'skipped')),
  output TEXT NOT NULL DEFAULT '',
  feedback TEXT NOT NULL DEFAULT '',
  completed_by TEXT CHECK (completed_by IN ('me', 'agent')),
  updated_at TEXT NOT NULL DEFAULT (now()),
  owner_email TEXT NOT NULL,
  org_id TEXT
);
CREATE TABLE IF NOT EXISTS run_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  step_id TEXT,
  actor TEXT NOT NULL CHECK (actor IN ('me', 'agent')),
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (now()),
  owner_email TEXT NOT NULL,
  org_id TEXT
);
CREATE INDEX IF NOT EXISTS runbooks_owner_updated_idx ON runbooks (owner_email, updated_at);
CREATE INDEX IF NOT EXISTS runbook_steps_runbook_idx ON runbook_steps (runbook_id, position);
CREATE INDEX IF NOT EXISTS runs_owner_status_idx ON runs (owner_email, status, created_at);
CREATE INDEX IF NOT EXISTS run_steps_run_idx ON run_steps (run_id, position);
CREATE INDEX IF NOT EXISTS run_events_run_idx ON run_events (run_id, created_at)`,
    },
  ],
  { table: "handoff_migrations" },
);
