import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { startProbeFlashServer } from "../src/server.mjs";
import { createTempDir } from "./verify-helpers.mjs";

function fail(reason, detail) {
  console.error(`[RELEASE-STATIC-WEB-SERVE verify] FAIL: ${reason}`);
  if (detail !== undefined) {
    console.error(JSON.stringify(detail, null, 2));
  }
  process.exit(1);
}

function assert(condition, reason, detail) {
  if (!condition) {
    fail(reason, detail);
  }
}

async function readText(url) {
  const response = await fetch(url);
  const body = await response.text();
  return { response, body };
}

async function readJson(url) {
  const response = await fetch(url);
  const payload = await response.json();
  return { response, payload };
}

function restoreEnv(previousEnv) {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

const workdir = createTempDir("probeflash-release-static").path;
const staticDir = join(workdir, "dist");
const dbPath = join(workdir, "probeflash.static.sqlite");

mkdirSync(join(staticDir, "assets"), { recursive: true });
writeFileSync(
  join(staticDir, "index.html"),
  `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><title>ProbeFlash Static Verify</title></head>
  <body><div id="root">ProbeFlash release static verify</div></body>
</html>
`,
  "utf8",
);
writeFileSync(
  join(staticDir, "assets", "app.js"),
  "window.__PROBEFLASH_RELEASE_STATIC_VERIFY__ = true;\n",
  "utf8",
);

const previousEnv = {
  PROBEFLASH_HOST: process.env.PROBEFLASH_HOST,
  PROBEFLASH_PORT: process.env.PROBEFLASH_PORT,
  PROBEFLASH_DB_PATH: process.env.PROBEFLASH_DB_PATH,
  PROBEFLASH_STATIC_DIR: process.env.PROBEFLASH_STATIC_DIR,
};

process.env.PROBEFLASH_HOST = "127.0.0.1";
process.env.PROBEFLASH_PORT = "0";
process.env.PROBEFLASH_DB_PATH = dbPath;
process.env.PROBEFLASH_STATIC_DIR = staticDir;

let server;
try {
  server = await startProbeFlashServer();
} finally {
  restoreEnv(previousEnv);
}

try {
  assert(server.staticDir === resolve(staticDir), "server should honor PROBEFLASH_STATIC_DIR", {
    expected: resolve(staticDir),
    actual: server.staticDir,
  });

  const root = await readText(`${server.baseUrl}/`);
  assert(root.response.status === 200, "/ should return 200", root.body);
  assert(
    root.response.headers.get("content-type")?.includes("text/html"),
    "/ should return text/html",
    Object.fromEntries(root.response.headers),
  );
  assert(root.body.includes("ProbeFlash release static verify"), "/ should return index.html", root.body);

  const health = await readJson(`${server.baseUrl}/api/health`);
  assert(
    health.response.status === 200 && health.payload.ok === true,
    "/api/health should still return JSON ok=true",
    health.payload,
  );
  assert(
    health.response.headers.get("content-type")?.includes("application/json"),
    "/api/health should keep JSON content type",
    Object.fromEntries(health.response.headers),
  );

  const spaRoute = await readText(`${server.baseUrl}/issues/issue-static-verify`);
  assert(spaRoute.response.status === 200, "SPA route should return 200", spaRoute.body);
  assert(
    spaRoute.body.includes("ProbeFlash release static verify"),
    "missing SPA route should fall back to index.html",
    spaRoute.body,
  );

  const asset = await readText(`${server.baseUrl}/assets/app.js`);
  assert(asset.response.status === 200, "static asset should return 200", asset.body);
  assert(asset.body.includes("__PROBEFLASH_RELEASE_STATIC_VERIFY__"), "asset content mismatch", asset.body);

  const missingAsset = await readText(`${server.baseUrl}/assets/missing.js`);
  assert(missingAsset.response.status === 404, "missing static asset should return 404", missingAsset.body);

  console.log("[RELEASE-STATIC-WEB-SERVE verify] PASS: / serves index.html from PROBEFLASH_STATIC_DIR");
  console.log("[RELEASE-STATIC-WEB-SERVE verify] PASS: /api/health remains JSON API on the same port");
  console.log("[RELEASE-STATIC-WEB-SERVE verify] PASS: missing SPA route falls back to index.html");
  console.log("[RELEASE-STATIC-WEB-SERVE verify] PASS: missing asset returns 404 instead of SPA fallback");
} finally {
  await server.close();
}

const apiOnlyServer = await startProbeFlashServer({
  host: "127.0.0.1",
  port: 0,
  dbPath: join(workdir, "probeflash.api-only.sqlite"),
});

try {
  const root = await readJson(`${apiOnlyServer.baseUrl}/`);
  assert(
    root.response.status === 404 && root.payload.error?.code === "NOT_FOUND",
    "server without PROBEFLASH_STATIC_DIR should keep API-only 404 behavior",
    root.payload,
  );
  console.log("[RELEASE-STATIC-WEB-SERVE verify] PASS: unset PROBEFLASH_STATIC_DIR keeps API-only behavior");
} finally {
  await apiOnlyServer.close();
}
