// apps/server/src/closeoutRecoveryScan.mjs
// TECH-02 startup recovery scan, lifted out of server.mjs so the entry point
// can stay tight (TECH-09). Pure-read; reports counts via console.log so
// operators see partial closeouts as soon as the server boots.

export function runCloseoutRecoveryScan(repositories, defaultWorkspace, options = {}) {
  if (!repositories) {
    return { ok: false, items: [], error: null };
  }
  try {
    const items = repositories.closeoutRecovery.list(defaultWorkspace.id);
    if (!options.suppressCloseoutRecoveryLog) {
      if (items.length === 0) {
        console.log(
          `[probeflash-server] closeout recovery scan: workspace=${defaultWorkspace.id} no pending or failed closeouts`,
        );
      } else {
        console.log(
          `[probeflash-server] closeout recovery scan: workspace=${defaultWorkspace.id} found ${items.length} issue(s) needing review`,
        );
        for (const item of items) {
          console.log(
            `[probeflash-server]   - issue=${item.id} closeoutState=${item.closeoutState} status=${item.status} updatedAt=${item.updatedAt}`,
          );
        }
      }
    }
    return { ok: true, items, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!options.suppressCloseoutRecoveryLog) {
      console.warn(`[probeflash-server] closeout recovery scan failed: ${message}`);
    }
    return { ok: false, items: [], error: message };
  }
}
