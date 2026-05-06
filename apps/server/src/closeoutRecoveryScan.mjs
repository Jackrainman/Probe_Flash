// apps/server/src/closeoutRecoveryScan.mjs
// TECH-02 startup recovery scan, lifted out of server.mjs so the entry point
// can stay tight (TECH-09). Pure-read; reports counts via console.log so
// operators see partial closeouts as soon as the server boots.
//
// Iterates every workspace returned by store.listWorkspaces() so a
// non-default workspace's pending/failed markers also show up in startup logs.
// Falls back to scanning only the seeded default workspace if listing fails
// (so a transient workspace-list error never silences the more important
// recovery signal).

export function runCloseoutRecoveryScan(store, defaultWorkspace, options = {}) {
  if (!store) {
    return { ok: false, perWorkspace: [], items: [], error: null };
  }

  const log = options.suppressCloseoutRecoveryLog ? () => {} : console.log;
  const warn = options.suppressCloseoutRecoveryLog ? () => {} : console.warn;

  let workspaces;
  try {
    workspaces = store.listWorkspaces();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warn(
      `[probeflash-server] closeout recovery scan: workspace list failed (${message}); falling back to default workspace only`,
    );
    workspaces = [{ id: defaultWorkspace.id, name: defaultWorkspace.name }];
  }

  if (workspaces.length === 0) {
    workspaces = [{ id: defaultWorkspace.id, name: defaultWorkspace.name }];
  }

  const perWorkspace = [];
  const allItems = [];
  let scanOk = true;
  let firstError = null;

  for (const workspace of workspaces) {
    try {
      const items = store.listCloseoutRecovery(workspace.id);
      perWorkspace.push({ workspaceId: workspace.id, ok: true, items, error: null });
      for (const item of items) allItems.push({ workspaceId: workspace.id, ...item });

      if (items.length === 0) {
        log(
          `[probeflash-server] closeout recovery scan: workspace=${workspace.id} no pending or failed closeouts`,
        );
      } else {
        log(
          `[probeflash-server] closeout recovery scan: workspace=${workspace.id} found ${items.length} issue(s) needing review`,
        );
        for (const item of items) {
          log(
            `[probeflash-server]   - issue=${item.id} closeoutState=${item.closeoutState} status=${item.status} updatedAt=${item.updatedAt}`,
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      perWorkspace.push({ workspaceId: workspace.id, ok: false, items: [], error: message });
      scanOk = false;
      firstError ??= message;
      warn(
        `[probeflash-server] closeout recovery scan failed for workspace=${workspace.id}: ${message}`,
      );
    }
  }

  return { ok: scanOk, perWorkspace, items: allItems, error: firstError };
}
