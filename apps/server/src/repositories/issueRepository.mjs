// apps/server/src/repositories/issueRepository.mjs
// TECH-08: HTTP-facing issue repository. Delegates to the SQLite store.
// Includes the atomic closeout entry point landed by TECH-01.

export function createIssueRepository(store) {
  return {
    list: (workspaceId, status) => store.listIssues(workspaceId, status),
    get: (workspaceId, issueId) => store.getIssue(workspaceId, issueId),
    create: (workspaceId, payload) => store.createIssue(workspaceId, payload),
    update: (workspaceId, issueId, payload) => store.updateIssue(workspaceId, issueId, payload),
    closeout: (workspaceId, issueId, payload) => store.closeoutIssue(workspaceId, issueId, payload),
  };
}
