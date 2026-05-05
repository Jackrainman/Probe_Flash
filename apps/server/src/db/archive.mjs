// apps/server/src/db/archive.mjs
// TECH-10: archive document ops. createArchive guards against duplicate file
// names per workspace (UNIQUE on (workspace_id, file_name)).

import { createStorageError, isUniqueConstraintError, parsePayload } from "./storage-error.mjs";
import { normalizeArchivePayload } from "./validation.mjs";

export function createArchiveOps({ db, lookups }) {
  return {
    listArchives(workspaceId) {
      lookups.requireWorkspace(workspaceId);
      const rows = db
        .prepare(
          `SELECT payload_json FROM archives WHERE workspace_id = ? ORDER BY generated_at DESC`,
        )
        .all(workspaceId);
      return rows.map(parsePayload);
    },
    createArchive(workspaceId, payload) {
      lookups.requireWorkspace(workspaceId);
      const archive = normalizeArchivePayload(workspaceId, structuredClone(payload));
      lookups.requireIssue(workspaceId, archive.issueId);
      try {
        db.prepare(`
          INSERT INTO archives (workspace_id, file_name, issue_id, file_path, generated_at, payload_json)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          workspaceId,
          archive.fileName,
          archive.issueId,
          archive.filePath,
          archive.generatedAt,
          JSON.stringify(archive),
        );
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw createStorageError(`archive ${archive.fileName} already exists`, "CONFLICT");
        }
        throw error;
      }
      return archive;
    },
    getArchive(workspaceId, fileName) {
      lookups.requireWorkspace(workspaceId);
      const row = db
        .prepare(
          `SELECT payload_json FROM archives WHERE workspace_id = ? AND file_name = ?`,
        )
        .get(workspaceId, fileName);
      if (!row) {
        throw createStorageError(`archive ${fileName} not found`, "NOT_FOUND");
      }
      return parsePayload(row);
    },
  };
}
