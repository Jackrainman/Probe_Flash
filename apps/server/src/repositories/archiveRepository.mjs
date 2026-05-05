// apps/server/src/repositories/archiveRepository.mjs
// TECH-08: archive document repository.

export function createArchiveRepository(store) {
  return {
    list: (workspaceId) => store.listArchives(workspaceId),
    get: (workspaceId, fileName) => store.getArchive(workspaceId, fileName),
    create: (workspaceId, payload) => store.createArchive(workspaceId, payload),
  };
}
