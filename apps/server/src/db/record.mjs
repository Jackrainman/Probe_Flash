// apps/server/src/db/record.mjs
// TECH-10: investigation record ops.

import { createStorageError, isUniqueConstraintError, parsePayload } from "./storage-error.mjs";
import { normalizeRecordPayload } from "./validation.mjs";

export function createRecordOps({ db, lookups }) {
  return {
    listRecords(workspaceId, issueId) {
      lookups.requireWorkspace(workspaceId);
      lookups.requireIssue(workspaceId, issueId);
      const rows = db
        .prepare(
          `SELECT payload_json FROM records WHERE workspace_id = ? AND issue_id = ? ORDER BY created_at ASC`,
        )
        .all(workspaceId, issueId);
      return rows.map(parsePayload);
    },
    createRecord(workspaceId, issueId, payload) {
      lookups.requireWorkspace(workspaceId);
      lookups.requireIssue(workspaceId, issueId);
      const record = normalizeRecordPayload(workspaceId, issueId, structuredClone(payload));
      try {
        db.prepare(`
          INSERT INTO records (id, workspace_id, issue_id, type, created_at, payload_json)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          record.id,
          workspaceId,
          issueId,
          record.type,
          record.createdAt,
          JSON.stringify(record),
        );
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw createStorageError(`record ${record.id} already exists`, "CONFLICT");
        }
        throw error;
      }
      return record;
    },
  };
}
