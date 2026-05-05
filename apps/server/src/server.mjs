// apps/server/src/server.mjs
// Probe_Flash HTTP server entry point.
//
// Layered structure (post TECH-08/09):
//   apps/server/src/server.mjs           ← assembly + listen lifecycle (this file)
//   apps/server/src/config.mjs           ← env/override config resolution
//   apps/server/src/closeoutRecoveryScan ← TECH-02 startup recovery scan
//   apps/server/src/http/dispatcher.mjs  ← per-request /api dispatcher
//   apps/server/src/http/responses.mjs   ← shared envelope helpers
//   apps/server/src/http/static.mjs      ← static asset serving
//   apps/server/src/routes/<entity>.mjs  ← per-entity route descriptors (TECH-09)
//   apps/server/src/repositories/        ← per-entity facades (TECH-08)
//   apps/server/src/database.mjs         ← SQLite store (TECH-10 will split)

import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

import { createProbeFlashDatabase } from "./database.mjs";
import { createRepositories } from "./repositories/index.mjs";
import { getConfig } from "./config.mjs";
import { runCloseoutRecoveryScan } from "./closeoutRecoveryScan.mjs";
import { createRequestHandler } from "./http/dispatcher.mjs";

export { DEFAULT_DB_PATH } from "./config.mjs";

export async function startProbeFlashServer(overrides = {}) {
  const { dbPath, host, port, defaultWorkspace, logDir, staticDir, releaseMetadata } = getConfig(overrides);
  let store = null;
  let storeInitError = null;
  let repositories = null;

  try {
    store = createProbeFlashDatabase(dbPath, { defaultWorkspace });
    repositories = createRepositories(store);
  } catch (error) {
    storeInitError = error instanceof Error ? error : new Error(String(error));
  }

  const closeoutRecoveryScan = runCloseoutRecoveryScan(repositories, defaultWorkspace, overrides);

  const server = createServer(
    createRequestHandler({ repositories, storeInitError, staticDir, releaseMetadata }),
  );

  await new Promise((resolvePromise, rejectPromise) => {
    const handleError = (error) => {
      server.off("listening", handleListening);
      rejectPromise(error);
    };
    const handleListening = () => {
      server.off("error", handleError);
      resolvePromise();
    };
    server.once("error", handleError);
    server.once("listening", handleListening);
    server.listen(port, host);
  });

  const address = server.address();
  const resolvedPort = address && typeof address === "object" && "port" in address ? address.port : port;
  const baseUrl = `http://${host}:${resolvedPort}`;

  return {
    baseUrl,
    dbPath,
    logDir,
    staticDir,
    closeoutRecoveryScan,
    close: async () => {
      await new Promise((resolvePromise, rejectPromise) => {
        server.close((error) => (error ? rejectPromise(error) : resolvePromise()));
      });
      store?.close();
    },
  };
}

const directRun = process.argv[1] === fileURLToPath(import.meta.url);
if (directRun) {
  const server = await startProbeFlashServer();
  console.log(`[probeflash-server] listening on ${server.baseUrl}`);
  console.log(`[probeflash-server] sqlite db ${server.dbPath}`);
  if (server.logDir) console.log(`[probeflash-server] log dir ${server.logDir}`);
  if (server.staticDir) console.log(`[probeflash-server] static dir ${server.staticDir}`);
}
