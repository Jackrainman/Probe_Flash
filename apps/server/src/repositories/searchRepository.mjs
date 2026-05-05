// apps/server/src/repositories/searchRepository.mjs
// TECH-08: cross-entity search facade (issue/record/archive/error_entry).

export function createSearchRepository(store) {
  return {
    query: (workspaceId, options) => store.search(workspaceId, options),
  };
}
