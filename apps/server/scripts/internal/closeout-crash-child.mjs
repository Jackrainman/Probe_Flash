// apps/server/scripts/internal/closeout-crash-child.mjs
// Fault-injection child invoked by verify-server-closeout-atomicity.mjs Test 5.
//
// Reproduces the "OS killed the process mid-closeout" crash:
//   1. autocommit-write the 'pending' marker on issues.closeout_state
//   2. BEGIN IMMEDIATE
//   3. INSERT a row into archives (txn-buffered, NOT yet committed)
//   4. SIGKILL self before COMMIT runs
//
// Because SIGKILL bypasses every JS / libc / SQLite cleanup hook, the WAL
// frames for the uncommitted transaction must never become visible to a
// subsequent reader. The parent verify reopens the DB after the child dies
// and asserts: archive row absent, marker still 'pending'.
//
// Inputs come from env vars instead of argv so the parent can pass them
// without quoting.

import { DatabaseSync } from "node:sqlite";

const dbPath = process.env.PROBEFLASH_CRASH_DB_PATH;
const workspaceId = process.env.PROBEFLASH_CRASH_WORKSPACE_ID;
const issueId = process.env.PROBEFLASH_CRASH_ISSUE_ID;
const archiveFileName = process.env.PROBEFLASH_CRASH_ARCHIVE_FILE_NAME;
const archiveFilePath = process.env.PROBEFLASH_CRASH_ARCHIVE_FILE_PATH;
const generatedAt = process.env.PROBEFLASH_CRASH_GENERATED_AT;
const payloadJson = process.env.PROBEFLASH_CRASH_ARCHIVE_PAYLOAD_JSON;

if (
  !dbPath ||
  !workspaceId ||
  !issueId ||
  !archiveFileName ||
  !archiveFilePath ||
  !generatedAt ||
  !payloadJson
) {
  console.error("[closeout-crash-child] missing required env var(s)");
  process.exit(2);
}

const db = new DatabaseSync(dbPath);

db.prepare(
  `UPDATE issues SET closeout_state = 'pending' WHERE workspace_id = ? AND id = ?`,
).run(workspaceId, issueId);

db.exec("BEGIN IMMEDIATE");
db.prepare(`
  INSERT INTO archives (workspace_id, file_name, issue_id, file_path, generated_at, payload_json)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(workspaceId, archiveFileName, issueId, archiveFilePath, generatedAt, payloadJson);

// Signal the parent that we reached the post-INSERT / pre-COMMIT moment, then
// die hard. Stdout flushes synchronously to the inherited pipe before SIGKILL.
process.stdout.write("READY_TO_CRASH\n");
process.kill(process.pid, "SIGKILL");
