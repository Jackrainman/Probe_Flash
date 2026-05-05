// apps/server/src/config.mjs
// TECH-09: server config resolution. Lifted out of server.mjs so
// startProbeFlashServer can stay focused on lifecycle and routing.

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_WORKSPACE } from "./database.mjs";
import { getReleaseMetadata } from "./release-metadata.mjs";

const SERVER_SRC_DIR = dirname(fileURLToPath(import.meta.url));
const SERVER_APP_DIR = resolve(SERVER_SRC_DIR, "..");
export const DEFAULT_DB_PATH = resolve(SERVER_APP_DIR, ".runtime", "probeflash.local.sqlite");

export function getConfig(overrides = {}) {
  const dbPath = overrides.dbPath ?? process.env.PROBEFLASH_DB_PATH ?? DEFAULT_DB_PATH;
  const host = overrides.host ?? process.env.PROBEFLASH_HOST ?? "127.0.0.1";
  const port =
    overrides.port ?? (process.env.PROBEFLASH_PORT ? Number(process.env.PROBEFLASH_PORT) : 4100);
  const defaultWorkspace = {
    id: overrides.workspaceId ?? process.env.PROBEFLASH_WORKSPACE_ID ?? DEFAULT_WORKSPACE.id,
    name: overrides.workspaceName ?? process.env.PROBEFLASH_WORKSPACE_NAME ?? DEFAULT_WORKSPACE.name,
    description: DEFAULT_WORKSPACE.description,
    isDefault: true,
  };
  const logDir = overrides.logDir ?? process.env.PROBEFLASH_LOG_DIR;
  const staticDirInput = overrides.staticDir ?? process.env.PROBEFLASH_STATIC_DIR;
  const staticDir = staticDirInput ? resolve(staticDirInput) : undefined;
  mkdirSync(dirname(dbPath), { recursive: true });
  if (logDir) mkdirSync(logDir, { recursive: true });
  return {
    dbPath,
    host,
    port,
    defaultWorkspace,
    logDir,
    staticDir,
    releaseMetadata: getReleaseMetadata(overrides.releaseMetadata),
  };
}
