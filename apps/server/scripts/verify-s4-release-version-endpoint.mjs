import { join } from "node:path";

import { getReleaseMetadata } from "../src/release-metadata.mjs";
import { startProbeFlashServer } from "../src/server.mjs";
import { createTempDir } from "./verify-helpers.mjs";

function fail(reason, detail) {
  console.error(`[S4-RELEASE-VERSION-ENDPOINT verify] FAIL: ${reason}`);
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

const expectedRelease = {
  version: "0.2.0",
  commit: "abc1234deadbeef",
  releaseTag: "v0.2.0",
};

const previousEnv = {
  PROBEFLASH_RELEASE_VERSION: process.env.PROBEFLASH_RELEASE_VERSION,
  PROBEFLASH_RELEASE_COMMIT: process.env.PROBEFLASH_RELEASE_COMMIT,
  PROBEFLASH_COMMIT: process.env.PROBEFLASH_COMMIT,
  PROBEFLASH_RELEASE_TAG: process.env.PROBEFLASH_RELEASE_TAG,
};
for (const key of Object.keys(previousEnv)) {
  delete process.env[key];
}

try {
  const fallbackRelease = getReleaseMetadata();
  if (
    fallbackRelease.version !== "0.3.0" ||
    fallbackRelease.commit !== "unknown" ||
    fallbackRelease.releaseTag !== "v0.3.0"
  ) {
    fail("default release metadata should come from package version without requiring .git", fallbackRelease);
  }
} finally {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

const workdir = createTempDir("probeflash-version").path;
const server = await startProbeFlashServer({
  host: "127.0.0.1",
  port: 0,
  dbPath: join(workdir, "probeflash.local.sqlite"),
  releaseMetadata: expectedRelease,
});

try {
  const versionResult = await readJson(`${server.baseUrl}/api/version`);
  if (!versionResult.response.ok || versionResult.payload.ok !== true) {
    fail("/api/version should return ok=true", versionResult.payload);
  }
  if (JSON.stringify(versionResult.payload.data) !== JSON.stringify(expectedRelease)) {
    fail("/api/version release metadata mismatch", versionResult.payload.data);
  }

  const healthResult = await readJson(`${server.baseUrl}/api/health`);
  if (!healthResult.response.ok || healthResult.payload.ok !== true) {
    fail("/api/health should return ok=true", healthResult.payload);
  }
  if (JSON.stringify(healthResult.payload.data.release) !== JSON.stringify(expectedRelease)) {
    fail("/api/health should include release metadata", healthResult.payload.data.release);
  }
  if (
    healthResult.payload.data.storage?.kind !== "sqlite" ||
    healthResult.payload.data.storage?.ready !== true
  ) {
    fail("/api/health should keep storage readiness details", healthResult.payload.data.storage);
  }
  for (const [key, value] of Object.entries(healthResult.payload.data.release)) {
    if (String(value).includes(".git") || String(value).includes(process.cwd())) {
      fail("release metadata must not expose git internals or local absolute paths", { key, value });
    }
  }

  console.log("[S4-RELEASE-VERSION-ENDPOINT verify] PASS: /api/version returns version, commit and release tag");
  console.log("[S4-RELEASE-VERSION-ENDPOINT verify] PASS: /api/health includes release metadata with sqlite readiness");
  console.log("[S4-RELEASE-VERSION-ENDPOINT verify] PASS: package version fallback works without runtime .git");
  console.log("[S4-RELEASE-VERSION-ENDPOINT verify] PASS: release metadata does not expose git internals or local paths");
} finally {
  await server.close();
}
