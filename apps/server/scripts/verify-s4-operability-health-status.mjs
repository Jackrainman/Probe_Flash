import { join } from "node:path";

import { startProbeFlashServer } from "../src/server.mjs";
import { createTempDir } from "./verify-helpers.mjs";

function fail(reason, detail) {
  console.error(`[S4-OPERABILITY-HEALTH-STATUS verify] FAIL: ${reason}`);
  if (detail !== undefined) {
    console.error(JSON.stringify(detail, null, 2));
  }
  process.exit(1);
}

async function readJson(url) {
  const response = await fetch(url);
  const payload = await response.json();
  return { response, payload };
}

const workdir = createTempDir("probeflash-operability").path;
const server = await startProbeFlashServer({
  host: "127.0.0.1",
  port: 0,
  dbPath: join(workdir, "probeflash.health.sqlite"),
  releaseMetadata: {
    version: "0.2.0",
    commit: "healthabc123",
    releaseTag: "v0.2.0",
  },
});

try {
  const healthResult = await readJson(`${server.baseUrl}/api/health`);
  if (!healthResult.response.ok || healthResult.payload.ok !== true) {
    fail("/api/health should return ok=true", healthResult.payload);
  }

  const health = healthResult.payload.data;
  if (health.server?.ready !== true || health.server?.runtime !== "node_http") {
    fail("health should report server ready state", health.server);
  }
  if (health.storage?.kind !== "sqlite" || health.storage?.ready !== true) {
    fail("health should report sqlite storage ready state", health.storage);
  }
  if (health.storage.dbPath || !health.storage.dbPathClass || !health.storage.dbFileName) {
    fail("health should redact db path and expose only path class/file name", health.storage);
  }
  if (
    health.workspace?.seeded !== true ||
    health.workspace?.defaultWorkspaceId !== "workspace-26-r1" ||
    health.workspace?.defaultWorkspaceName !== "26年 R1"
  ) {
    fail("health should report seeded default workspace", health.workspace);
  }
  if (health.release?.version !== "0.2.0" || health.release?.releaseTag !== "v0.2.0") {
    fail("health should keep release metadata", health.release);
  }

  console.log("[S4-OPERABILITY-HEALTH-STATUS verify] PASS: /api/health reports server ready state");
  console.log("[S4-OPERABILITY-HEALTH-STATUS verify] PASS: /api/health reports sqlite storage without absolute db path");
  console.log("[S4-OPERABILITY-HEALTH-STATUS verify] PASS: /api/health reports seeded workspace and release metadata");
} finally {
  await server.close();
}

const brokenServer = await startProbeFlashServer({
  host: "127.0.0.1",
  port: 0,
  dbPath: workdir,
  releaseMetadata: {
    version: "0.2.0",
    commit: "healthabc123",
    releaseTag: "v0.2.0",
  },
});

try {
  const brokenHealthResult = await readJson(`${brokenServer.baseUrl}/api/health`);
  if (brokenHealthResult.response.status !== 503 || brokenHealthResult.payload.ok !== false) {
    fail("broken storage health should return 503 ok=false", brokenHealthResult.payload);
  }
  const details = brokenHealthResult.payload.error?.details;
  if (details?.server?.ready !== true || details?.storage?.ready !== false) {
    fail("broken storage health should expose diagnosable server/storage details", details);
  }
  if (details?.release?.releaseTag !== "v0.2.0") {
    fail("broken storage health should retain release metadata", details);
  }
  console.log("[S4-OPERABILITY-HEALTH-STATUS verify] PASS: storage init failure returns 503 with diagnosable details");
} finally {
  await brokenServer.close();
}
