// apps/server/src/db/issue.mjs
// TECH-10: issue ops + atomic closeout transaction (TECH-01). closeoutIssue
// must touch issues / archives / error_entries inside a single
// BEGIN IMMEDIATE / COMMIT / ROLLBACK transaction; the marker writes around
// the transaction record pending/failed state for TECH-02 recovery.

import {
  createStorageError,
  isUniqueConstraintError,
  parsePayload,
} from "./storage-error.mjs";
import {
  assertObject,
  normalizeArchivePayload,
  normalizeErrorEntryPayload,
  normalizeIssuePayload,
} from "./validation.mjs";

export function createIssueOps({ db, lookups }) {
  function getIssueResponse(workspaceId, issueId) {
    const row = lookups.readIssueRow(workspaceId, issueId);
    if (!row) {
      throw createStorageError(`issue ${issueId} not found`, "NOT_FOUND");
    }
    return { ...parsePayload(row), closeoutState: row.closeout_state ?? null };
  }

  return {
    listIssues(workspaceId, statusFilter = "active") {
      lookups.requireWorkspace(workspaceId);
      let sql = `
        SELECT id, title, severity, status, created_at, updated_at, closeout_state
        FROM issues
        WHERE workspace_id = ?
      `;
      if (statusFilter === "active") {
        sql += ` AND status <> 'archived'`;
      } else if (statusFilter === "archived") {
        sql += ` AND status = 'archived'`;
      }
      sql += ` ORDER BY created_at DESC`;
      const rows = db.prepare(sql).all(workspaceId);
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        severity: row.severity,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        closeoutState: row.closeout_state ?? null,
      }));
    },
    createIssue(workspaceId, payload) {
      lookups.requireWorkspace(workspaceId);
      const issue = normalizeIssuePayload(workspaceId, structuredClone(payload));
      try {
        db.prepare(`
          INSERT INTO issues (id, workspace_id, title, severity, status, created_at, updated_at, payload_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          issue.id,
          workspaceId,
          issue.title,
          issue.severity,
          issue.status,
          issue.createdAt,
          issue.updatedAt,
          JSON.stringify(issue),
        );
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw createStorageError(`issue ${issue.id} already exists`, "CONFLICT");
        }
        throw error;
      }
      return issue;
    },
    getIssue(workspaceId, issueId) {
      lookups.requireWorkspace(workspaceId);
      return getIssueResponse(workspaceId, issueId);
    },
    updateIssue(workspaceId, issueId, payload) {
      lookups.requireWorkspace(workspaceId);
      const issue = normalizeIssuePayload(workspaceId, structuredClone(payload));
      if (issue.id !== issueId) {
        throw createStorageError("issue.id must match path issueId", "VALIDATION_ERROR");
      }
      lookups.requireIssue(workspaceId, issueId);
      db.prepare(`
        UPDATE issues
        SET title = ?, severity = ?, status = ?, created_at = ?, updated_at = ?, payload_json = ?
        WHERE workspace_id = ? AND id = ?
      `).run(
        issue.title,
        issue.severity,
        issue.status,
        issue.createdAt,
        issue.updatedAt,
        JSON.stringify(issue),
        workspaceId,
        issueId,
      );
      return issue;
    },
    closeoutIssue(workspaceId, issueId, payload) {
      // TECH-01: atomically write ArchiveDocument + ErrorEntry + archived Issue inside a
      // single SQLite BEGIN IMMEDIATE / COMMIT / ROLLBACK transaction.
      //
      // Marker lifecycle on issues.closeout_state (additive, autocommitted):
      //   pending  → set OUTSIDE the transaction so a mid-flight crash leaves the row
      //              flagged for TECH-02 startup-side recovery scan
      //   completed → set INSIDE the transaction at the issue UPDATE step (committed atomically)
      //   failed   → set OUTSIDE the transaction after a caught failure + ROLLBACK so the
      //              flag survives the rolled-back txn
      lookups.requireWorkspace(workspaceId);
      assertObject(payload, "closeout payload must be an object");
      assertObject(payload.archive, "closeout.archive must be an object");
      assertObject(payload.errorEntry, "closeout.errorEntry must be an object");
      assertObject(payload.issue, "closeout.issue must be an object");

      const archive = normalizeArchivePayload(workspaceId, structuredClone(payload.archive));
      const errorEntry = normalizeErrorEntryPayload(workspaceId, structuredClone(payload.errorEntry));
      const issue = normalizeIssuePayload(workspaceId, structuredClone(payload.issue));

      if (issue.id !== issueId) {
        throw createStorageError("closeout.issue.id must match path issueId", "VALIDATION_ERROR");
      }
      if (archive.issueId !== issueId) {
        throw createStorageError(
          "closeout.archive.issueId must match path issueId",
          "VALIDATION_ERROR",
        );
      }
      if (errorEntry.sourceIssueId !== issueId) {
        throw createStorageError(
          "closeout.errorEntry.sourceIssueId must match path issueId",
          "VALIDATION_ERROR",
        );
      }
      if (issue.status !== "archived") {
        throw createStorageError("closeout.issue.status must be archived", "VALIDATION_ERROR");
      }

      // Confirm the target issue exists before touching any state. Throws NOT_FOUND if missing.
      lookups.requireIssue(workspaceId, issueId);

      // Pre-step (autocommit): mark the issue closeout_state = 'pending'.
      db.prepare(
        `UPDATE issues SET closeout_state = 'pending' WHERE workspace_id = ? AND id = ?`,
      ).run(workspaceId, issueId);

      try {
        db.exec("BEGIN IMMEDIATE");

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

        try {
          db.prepare(`
            INSERT INTO error_entries (
              id, workspace_id, source_issue_id, error_code, category, created_at, updated_at, payload_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            errorEntry.id,
            workspaceId,
            errorEntry.sourceIssueId,
            errorEntry.errorCode,
            errorEntry.category,
            errorEntry.createdAt,
            errorEntry.updatedAt,
            JSON.stringify(errorEntry),
          );
        } catch (error) {
          if (isUniqueConstraintError(error)) {
            throw createStorageError(`error entry conflict for ${errorEntry.id}`, "CONFLICT");
          }
          throw error;
        }

        db.prepare(`
          UPDATE issues
          SET title = ?, severity = ?, status = ?, created_at = ?, updated_at = ?, payload_json = ?, closeout_state = 'completed'
          WHERE workspace_id = ? AND id = ?
        `).run(
          issue.title,
          issue.severity,
          issue.status,
          issue.createdAt,
          issue.updatedAt,
          JSON.stringify(issue),
          workspaceId,
          issueId,
        );

        db.exec("COMMIT");
      } catch (error) {
        try {
          db.exec("ROLLBACK");
        } catch {
          // ROLLBACK can fail if no transaction is active.
        }
        try {
          db.prepare(
            `UPDATE issues SET closeout_state = 'failed' WHERE workspace_id = ? AND id = ?`,
          ).run(workspaceId, issueId);
        } catch {
          // If even this autocommit fails, closeout_state stays 'pending' and TECH-02
          // recovery scan will pick it up — losing 'failed' here is non-fatal.
        }
        throw error;
      }

      return {
        archive,
        errorEntry,
        issue: { ...issue, closeoutState: "completed" },
      };
    },
  };
}
