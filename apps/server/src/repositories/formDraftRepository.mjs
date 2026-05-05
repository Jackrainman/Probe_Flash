// apps/server/src/repositories/formDraftRepository.mjs
// TECH-08: per-(workspace, formKind, itemId) form draft repository.

export function createFormDraftRepository(store) {
  return {
    get: (workspaceId, formKind, itemId) => store.getFormDraft(workspaceId, formKind, itemId),
    save: (workspaceId, formKind, itemId, payload) =>
      store.saveFormDraft(workspaceId, formKind, itemId, payload),
    delete: (workspaceId, formKind, itemId) => store.deleteFormDraft(workspaceId, formKind, itemId),
  };
}
