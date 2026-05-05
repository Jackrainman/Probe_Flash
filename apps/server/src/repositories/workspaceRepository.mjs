// apps/server/src/repositories/workspaceRepository.mjs
// TECH-08: thin Repository layer between HTTP handler and the SQLite-backed store.
// Owns workspace + health entry points so server.mjs can talk to a per-entity API
// instead of reaching into store.* directly.
//
// Boundary (TECH-08): no business logic added here; methods 1:1 delegate to the
// store. Renaming/restructuring of store internals is TECH-10's job.

export function createWorkspaceRepository(store) {
  return {
    health: () => store.health(),
    list: () => store.listWorkspaces(),
    get: (workspaceId) => store.getWorkspace(workspaceId),
    create: (payload) => store.createWorkspace(payload),
  };
}
