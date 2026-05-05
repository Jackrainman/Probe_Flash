// apps/server/src/db/workspace.mjs
// TECH-10: workspace ops (list / get / create) + slug+id generation helpers.

import { randomUUID } from "node:crypto";

import { createStorageError, isUniqueConstraintError } from "./storage-error.mjs";
import { normalizeWorkspacePayload } from "./validation.mjs";

function slugifyWorkspaceName(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
  return slug.length > 0 ? slug : "project";
}

function generateWorkspaceId(name) {
  const timestamp = Date.now().toString(36);
  const shortId = randomUUID().replaceAll("-", "").slice(0, 8);
  return `workspace-${slugifyWorkspaceName(name)}-${timestamp}-${shortId}`;
}

export function createWorkspaceOps({ db, lookups }) {
  return {
    listWorkspaces() {
      const rows = db
        .prepare(
          `SELECT id, name, description, is_default, created_at, updated_at
           FROM workspaces
           ORDER BY is_default DESC, name ASC`,
        )
        .all();
      return rows.map((row) => lookups.workspaceFromRow(row));
    },
    getWorkspace(workspaceId) {
      return lookups.requireWorkspace(workspaceId);
    },
    createWorkspace(payload) {
      const workspace = normalizeWorkspacePayload(structuredClone(payload));
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const id = generateWorkspaceId(workspace.name);
        const now = new Date().toISOString();
        try {
          db.prepare(`
            INSERT INTO workspaces (id, name, description, is_default, created_at, updated_at)
            VALUES (?, ?, '', 0, ?, ?)
          `).run(id, workspace.name, now, now);
          return lookups.requireWorkspace(id);
        } catch (error) {
          if (isUniqueConstraintError(error)) {
            continue;
          }
          throw error;
        }
      }
      throw createStorageError("workspace id conflict after retries", "CONFLICT");
    },
  };
}
