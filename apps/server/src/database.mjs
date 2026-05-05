// apps/server/src/database.mjs
// SQLite-backed store for Probe_Flash. Coordinator after TECH-10:
//
//   apps/server/src/database.mjs           ← assemble entity ops into one store (this file)
//   apps/server/src/db/constants.mjs       ← schema enums + literal patterns
//   apps/server/src/db/storage-error.mjs   ← createStorageError + sqlite helpers
//   apps/server/src/db/validation.mjs      ← assertion + payload normalizers
//   apps/server/src/db/schema.mjs          ← CREATE TABLE + idempotent migration + default workspace seed
//   apps/server/src/db/lookups.mjs         ← shared workspace/issue row lookups
//   apps/server/src/db/<entity>.mjs        ← per-entity SQL ops factories
//   apps/server/src/db/search.mjs          ← cross-entity search facade
//
// `createProbeFlashDatabase(dbPath, options)` keeps its previous external shape
// — a single `store` object exposing health/listX/getX/createX/updateX/closeoutIssue/
// search/listCloseoutRecovery/clearCloseoutState/etc. The Repository layer (TECH-08)
// + route layer (TECH-09) consume this object unchanged.

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { applySchema } from "./db/schema.mjs";
import { classifyDbPath, dbFileName } from "./db/storage-error.mjs";
import { createArchiveOps } from "./db/archive.mjs";
import { createCloseoutRecoveryOps } from "./db/closeoutRecovery.mjs";
import { createErrorEntryOps } from "./db/errorEntry.mjs";
import { createFormDraftOps } from "./db/formDraft.mjs";
import { createIssueOps } from "./db/issue.mjs";
import { createLookups } from "./db/lookups.mjs";
import { createRecordOps } from "./db/record.mjs";
import { createSearchOps } from "./db/search.mjs";
import { createWorkspaceOps } from "./db/workspace.mjs";
import { SCHEMA_VERSION, normalizeDefaultWorkspace } from "./db/constants.mjs";

export { SCHEMA_VERSION, CLOSEOUT_STATES, DEFAULT_WORKSPACE, normalizeDefaultWorkspace } from "./db/constants.mjs";

export function createProbeFlashDatabase(dbPath, options = {}) {
  const defaultWorkspace = normalizeDefaultWorkspace(options.defaultWorkspace);
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);

  applySchema(db, defaultWorkspace);

  const lookups = createLookups(db);
  const ctx = { db, lookups };

  const workspaceOps = createWorkspaceOps(ctx);
  const issueOps = createIssueOps(ctx);
  const recordOps = createRecordOps(ctx);
  const archiveOps = createArchiveOps(ctx);
  const errorEntryOps = createErrorEntryOps(ctx);
  const formDraftOps = createFormDraftOps(ctx);
  const closeoutRecoveryOps = createCloseoutRecoveryOps(ctx);
  const searchOps = createSearchOps(ctx);

  return {
    dbPath,
    close() {
      db.close();
    },
    health() {
      const workspace = lookups.requireWorkspace(defaultWorkspace.id);
      return {
        status: "ok",
        serverTime: new Date().toISOString(),
        schemaVersion: SCHEMA_VERSION,
        storage: {
          kind: "sqlite",
          ready: true,
          dbPathClass: classifyDbPath(dbPath),
          dbFileName: dbFileName(dbPath),
        },
        workspace: {
          defaultWorkspaceId: workspace.id,
          defaultWorkspaceName: workspace.name,
          seeded: true,
        },
      };
    },
    ...workspaceOps,
    ...issueOps,
    ...recordOps,
    ...archiveOps,
    ...errorEntryOps,
    ...formDraftOps,
    ...closeoutRecoveryOps,
    ...searchOps,
  };
}
