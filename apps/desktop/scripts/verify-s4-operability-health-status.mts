import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { startProbeFlashServer } from "../../server/src/server.mjs";
import { checkHttpStorageHealth } from "../src/storage/http-storage-repository.ts";
import { createTempDir } from "./verify-helpers.mts";

function fail(reason: string, detail?: unknown): never {
  console.error(`[S4-OPERABILITY-HEALTH-STATUS desktop verify] FAIL: ${reason}`);
  if (detail !== undefined) {
    console.error(JSON.stringify(detail, null, 2));
  }
  process.exit(1);
}

async function startMockServer(
  handler: (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => void,
) {
  const server = createServer(handler);
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const handleError = (error: Error) => {
      server.off("listening", handleListening);
      rejectPromise(error);
    };
    const handleListening = () => {
      server.off("error", handleError);
      resolvePromise();
    };
    server.once("error", handleError);
    server.once("listening", handleListening);
    server.listen(0, "127.0.0.1");
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    fail("mock server should expose TCP address", address);
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolvePromise, rejectPromise) => {
        server.close((error) => (error ? rejectPromise(error) : resolvePromise()));
      });
    },
  };
}

const workdir = createTempDir("probeflash-desktop-health").path;
const server = await startProbeFlashServer({
  host: "127.0.0.1",
  port: 0,
  dbPath: join(workdir, "probeflash.health.sqlite"),
  releaseMetadata: {
    version: "0.2.0",
    commit: "desktophealth123",
    releaseTag: "v0.2.0",
  },
});

try {
  const health = await checkHttpStorageHealth({
    baseUrl: `${server.baseUrl}/api`,
    timeoutMs: 500,
  });
  if (!health.ok) {
    fail("health check should parse operability payload", health);
  }
  if (
    health.status.serverReady !== true ||
    health.status.storageReady !== true ||
    health.status.storageKind !== "sqlite" ||
    !health.status.dbPathClass ||
    health.status.defaultWorkspaceName !== "26年 R1" ||
    health.status.releaseTag !== "v0.2.0"
  ) {
    fail("health check should expose server/storage/workspace/release status", health.status);
  }
} finally {
  await server.close();
}

const degraded = await startMockServer((_req, res) => {
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({
    ok: true,
    data: {
      status: "degraded",
      serverTime: "2026-04-26T02:20:00+08:00",
      server: { ready: true, runtime: "node_http", apiBasePath: "/api" },
      storage: { kind: "sqlite", ready: false, dbPathClass: "temporary" },
    },
  }));
});

try {
  const health = await checkHttpStorageHealth({
    baseUrl: `${degraded.baseUrl}/api`,
    timeoutMs: 500,
  });
  if (health.ok || health.error.connection?.state !== "degraded") {
    fail("storage ready=false should map to degraded health feedback", health);
  }
} finally {
  await degraded.close();
}

const appSource = readFileSync(resolve(process.cwd(), "src", "App.tsx"), "utf8");
if (!appSource.includes('data-testid="storage-health-detail"')) {
  fail("App.tsx should render a storage-health-detail summary");
}
for (const expectedText of ["服务就绪", "版本="]) {
  if (!appSource.includes(expectedText)) {
    fail(`storage health detail should include ${expectedText}`);
  }
}

console.log("[S4-OPERABILITY-HEALTH-STATUS desktop verify] PASS: health parser exposes server/storage/workspace/release status");
console.log("[S4-OPERABILITY-HEALTH-STATUS desktop verify] PASS: storage ready=false maps to degraded feedback");
console.log("[S4-OPERABILITY-HEALTH-STATUS desktop verify] PASS: App banner includes readable health detail summary");
