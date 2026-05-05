// apps/server/src/db/closeoutRecovery.mjs
// TECH-10: TECH-02 closeout recovery surface — list pending/failed markers and
// idempotently clear them.

export function createCloseoutRecoveryOps({ db, lookups }) {
  return {
    listCloseoutRecovery(workspaceId) {
      lookups.requireWorkspace(workspaceId);
      const rows = db
        .prepare(
          `SELECT id, title, severity, status, created_at, updated_at, closeout_state
           FROM issues
           WHERE workspace_id = ? AND closeout_state IN ('pending', 'failed')
           ORDER BY updated_at DESC, id ASC`,
        )
        .all(workspaceId);
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        severity: row.severity,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        closeoutState: row.closeout_state,
      }));
    },
    clearCloseoutState(workspaceId, issueId) {
      lookups.requireWorkspace(workspaceId);
      lookups.requireIssue(workspaceId, issueId);
      db.prepare(
        `UPDATE issues SET closeout_state = NULL WHERE workspace_id = ? AND id = ?`,
      ).run(workspaceId, issueId);
      return { workspaceId, issueId, closeoutState: null };
    },
  };
}
