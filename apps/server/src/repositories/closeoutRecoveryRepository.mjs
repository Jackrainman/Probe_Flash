// apps/server/src/repositories/closeoutRecoveryRepository.mjs
// TECH-08: TECH-02 closeout recovery surface. Read-only at the data layer; the
// clear method only nulls the marker, never auto-completes a partial closeout.

export function createCloseoutRecoveryRepository(store) {
  return {
    list: (workspaceId) => store.listCloseoutRecovery(workspaceId),
    clear: (workspaceId, issueId) => store.clearCloseoutState(workspaceId, issueId),
  };
}
