// apps/server/src/repositories/errorEntryRepository.mjs
// TECH-08: error entry (DBG-*) repository.

export function createErrorEntryRepository(store) {
  return {
    list: (workspaceId) => store.listErrorEntries(workspaceId),
    get: (workspaceId, entryId) => store.getErrorEntry(workspaceId, entryId),
    create: (workspaceId, payload) => store.createErrorEntry(workspaceId, payload),
  };
}
