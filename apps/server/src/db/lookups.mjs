// apps/server/src/db/lookups.mjs
// TECH-10: shared row lookups + entity existence guards used across multiple
// per-entity ops modules.

import { createStorageError, parsePayload } from "./storage-error.mjs";

export function createLookups(db) {
  function getWorkspaceRow(workspaceId) {
    return db
      .prepare(
        `SELECT id, name, description, is_default, created_at, updated_at FROM workspaces WHERE id = ?`,
      )
      .get(workspaceId);
  }

  function workspaceFromRow(row) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isDefault: row.is_default === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function requireWorkspace(workspaceId) {
    const row = getWorkspaceRow(workspaceId);
    if (!row) {
      throw createStorageError(`workspace ${workspaceId} not found`, "NOT_FOUND");
    }
    return workspaceFromRow(row);
  }

  function readIssueRow(workspaceId, issueId) {
    return db
      .prepare(
        `SELECT id, workspace_id, payload_json, closeout_state FROM issues WHERE workspace_id = ? AND id = ?`,
      )
      .get(workspaceId, issueId);
  }

  function requireIssue(workspaceId, issueId) {
    const row = readIssueRow(workspaceId, issueId);
    if (!row) {
      throw createStorageError(`issue ${issueId} not found`, "NOT_FOUND");
    }
    return parsePayload(row);
  }

  return {
    getWorkspaceRow,
    workspaceFromRow,
    requireWorkspace,
    readIssueRow,
    requireIssue,
  };
}
