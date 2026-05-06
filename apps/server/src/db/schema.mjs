// apps/server/src/db/schema.mjs
// TECH-10: schema setup + idempotent migrations + default workspace seed.
// Called once by createProbeFlashDatabase right after the DatabaseSync handle
// is opened. Lifted out of database.mjs so the coordinator file can stay tight.

import { SCHEMA_VERSION } from "./constants.mjs";

export function applySchema(db, defaultWorkspace) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_single_default
    ON workspaces (is_default)
    WHERE is_default = 1;

    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      title TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      closeout_state TEXT,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_issues_workspace_status_created
    ON issues (workspace_id, status, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_issues_workspace_closeout_state
    ON issues (workspace_id, closeout_state)
    WHERE closeout_state IS NOT NULL;

    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      issue_id TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT,
      FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_records_issue_created
    ON records (issue_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS archives (
      workspace_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      issue_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (workspace_id, file_name),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT,
      FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_archives_workspace_generated
    ON archives (workspace_id, generated_at DESC);

    CREATE TABLE IF NOT EXISTS error_entries (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      source_issue_id TEXT NOT NULL,
      error_code TEXT NOT NULL,
      category TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT,
      FOREIGN KEY (source_issue_id) REFERENCES issues(id) ON DELETE RESTRICT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_error_entries_workspace_error_code
    ON error_entries (workspace_id, error_code);

    CREATE TABLE IF NOT EXISTS form_drafts (
      workspace_id TEXT NOT NULL,
      form_kind TEXT NOT NULL,
      item_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (workspace_id, form_kind, item_id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_form_drafts_workspace_updated
    ON form_drafts (workspace_id, updated_at DESC);
  `);

  // Idempotent additive migration: pre-existing dbs (created before SCHEMA_VERSION 3)
  // need closeout_state column added. CREATE TABLE IF NOT EXISTS won't add columns
  // to an existing table, so we inspect via PRAGMA table_info and ALTER TABLE if missing.
  const issueColumns = db.prepare(`PRAGMA table_info('issues')`).all();
  if (!issueColumns.some((column) => column.name === "closeout_state")) {
    db.exec(`ALTER TABLE issues ADD COLUMN closeout_state TEXT`);
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_issues_workspace_closeout_state
       ON issues (workspace_id, closeout_state)
       WHERE closeout_state IS NOT NULL`,
    );
  }

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO schema_meta (key, value, updated_at)
    VALUES ('schema_version', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(String(SCHEMA_VERSION), now);

  db.prepare(`
    UPDATE workspaces
    SET is_default = 0, updated_at = ?
    WHERE id <> ? AND is_default = 1
  `).run(now, defaultWorkspace.id);

  db.prepare(`
    INSERT INTO workspaces (id, name, description, is_default, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      is_default = 1,
      updated_at = excluded.updated_at
  `).run(
    defaultWorkspace.id,
    defaultWorkspace.name,
    defaultWorkspace.description,
    now,
    now,
  );

  // Bump user_version *last*, only after every CREATE / ALTER / seed succeeded.
  // Putting it inside the bulk exec at the top would mark the file as v${SCHEMA_VERSION}
  // even if a later migration step (e.g. ALTER TABLE for closeout_state) failed,
  // which would let the next boot skip re-trying the missing column.
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
