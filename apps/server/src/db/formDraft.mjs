// apps/server/src/db/formDraft.mjs
// TECH-10: per-(workspace, formKind, itemId) form draft ops.

import { assertFormDraftScopePart, normalizeFormDraftPayload } from "./validation.mjs";

export function createFormDraftOps({ db, lookups }) {
  return {
    getFormDraft(workspaceId, formKind, itemId) {
      lookups.requireWorkspace(workspaceId);
      assertFormDraftScopePart(formKind, "formDraft.formKind");
      assertFormDraftScopePart(itemId, "formDraft.itemId");
      const row = db
        .prepare(
          `SELECT workspace_id, form_kind, item_id, payload_json, updated_at
           FROM form_drafts
           WHERE workspace_id = ? AND form_kind = ? AND item_id = ?`,
        )
        .get(workspaceId, formKind, itemId);
      if (!row) return null;
      return {
        workspaceId: row.workspace_id,
        formKind: row.form_kind,
        itemId: row.item_id,
        payloadJson: row.payload_json,
        updatedAt: row.updated_at,
      };
    },
    saveFormDraft(workspaceId, formKind, itemId, payload) {
      lookups.requireWorkspace(workspaceId);
      assertFormDraftScopePart(formKind, "formDraft.formKind");
      assertFormDraftScopePart(itemId, "formDraft.itemId");
      const draft = normalizeFormDraftPayload(workspaceId, formKind, itemId, structuredClone(payload));
      db.prepare(`
        INSERT INTO form_drafts (workspace_id, form_kind, item_id, payload_json, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(workspace_id, form_kind, item_id) DO UPDATE SET
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
      `).run(
        workspaceId,
        formKind,
        itemId,
        draft.payloadJson,
        draft.updatedAt,
      );
      return draft;
    },
    deleteFormDraft(workspaceId, formKind, itemId) {
      lookups.requireWorkspace(workspaceId);
      assertFormDraftScopePart(formKind, "formDraft.formKind");
      assertFormDraftScopePart(itemId, "formDraft.itemId");
      db.prepare(
        `DELETE FROM form_drafts WHERE workspace_id = ? AND form_kind = ? AND item_id = ?`,
      ).run(workspaceId, formKind, itemId);
      return { cleared: true };
    },
  };
}
