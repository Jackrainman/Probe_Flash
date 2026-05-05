// apps/server/src/db/errorEntry.mjs
// TECH-10: error entry ops (DBG-* records).

import { createStorageError, isUniqueConstraintError, parsePayload } from "./storage-error.mjs";
import { normalizeErrorEntryPayload } from "./validation.mjs";

export function createErrorEntryOps({ db, lookups }) {
  return {
    listErrorEntries(workspaceId) {
      lookups.requireWorkspace(workspaceId);
      const rows = db
        .prepare(
          `SELECT payload_json FROM error_entries WHERE workspace_id = ? ORDER BY created_at DESC`,
        )
        .all(workspaceId);
      return rows.map(parsePayload);
    },
    createErrorEntry(workspaceId, payload) {
      lookups.requireWorkspace(workspaceId);
      const entry = normalizeErrorEntryPayload(workspaceId, structuredClone(payload));
      lookups.requireIssue(workspaceId, entry.sourceIssueId);
      try {
        db.prepare(`
          INSERT INTO error_entries (
            id, workspace_id, source_issue_id, error_code, category, created_at, updated_at, payload_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          entry.id,
          workspaceId,
          entry.sourceIssueId,
          entry.errorCode,
          entry.category,
          entry.createdAt,
          entry.updatedAt,
          JSON.stringify(entry),
        );
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw createStorageError(`error entry conflict for ${entry.id}`, "CONFLICT");
        }
        throw error;
      }
      return entry;
    },
    getErrorEntry(workspaceId, entryId) {
      lookups.requireWorkspace(workspaceId);
      const row = db
        .prepare(
          `SELECT payload_json FROM error_entries WHERE workspace_id = ? AND id = ?`,
        )
        .get(workspaceId, entryId);
      if (!row) {
        throw createStorageError(`error entry ${entryId} not found`, "NOT_FOUND");
      }
      return parsePayload(row);
    },
  };
}
