import { createServer } from "node:http";
import { createReadStream, mkdirSync } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_WORKSPACE, createProbeFlashDatabase } from "./database.mjs";
import { createRepositories } from "./repositories/index.mjs";
import { generateDeepSeekDraft, getDeepSeekStatus } from "./ai/deepseek-client.mjs";
import {
  buildAiPromptTemplate,
  normalizeAiCloseoutDraftRequest,
} from "./ai/prompt-templates.mjs";
import { getReleaseMetadata } from "./release-metadata.mjs";

const SERVER_SRC_DIR = dirname(fileURLToPath(import.meta.url));
const SERVER_APP_DIR = resolve(SERVER_SRC_DIR, "..");
export const DEFAULT_DB_PATH = resolve(SERVER_APP_DIR, ".runtime", "probeflash.local.sqlite");

const STATIC_CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".webp", "image/webp"],
]);

function json(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function ok(res, data, statusCode = 200) {
  json(res, statusCode, { ok: true, data });
}

function fail(res, statusCode, code, message, operation, retryable, details = {}) {
  json(res, statusCode, { ok: false, error: { code, message, operation, retryable, details } });
}

function text(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8", ...headers });
  res.end(body);
}

function getStaticContentType(filePath) {
  return STATIC_CONTENT_TYPES.get(extname(filePath).toLowerCase()) ?? "application/octet-stream";
}

function isPathInside(parentDir, candidatePath) {
  const relativePath = relative(parentDir, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function decodeStaticPathname(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

async function resolveStaticFile(staticDir, candidatePath) {
  try {
    const fileStat = await stat(candidatePath);
    if (fileStat.isDirectory()) {
      return resolveStaticFile(staticDir, join(candidatePath, "index.html"));
    }
    if (!fileStat.isFile()) return null;
    if (!isPathInside(staticDir, candidatePath)) return null;
    return { filePath: candidatePath, fileStat };
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
    throw error;
  }
}

function sendStaticFile(req, res, filePath, fileStat) {
  res.writeHead(200, {
    "cache-control": "no-cache",
    "content-length": fileStat.size,
    "content-type": getStaticContentType(filePath),
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  const stream = createReadStream(filePath);
  stream.on("error", (error) => {
    if (!res.headersSent) {
      text(res, 500, "static file read failed");
      return;
    }
    res.destroy(error);
  });
  stream.pipe(res);
}

async function serveStaticRequest(req, res, url, staticDir) {
  const method = req.method ?? "GET";
  if (method !== "GET" && method !== "HEAD") {
    return text(res, 405, "method not allowed", { allow: "GET, HEAD" });
  }

  const decodedPathname = decodeStaticPathname(url.pathname);
  if (!decodedPathname || decodedPathname.includes("\0")) {
    return text(res, 400, "bad static path");
  }

  const candidatePath = resolve(staticDir, `.${decodedPathname}`);
  if (!isPathInside(staticDir, candidatePath)) {
    return text(res, 403, "static path is outside configured dist directory");
  }

  const staticFile = await resolveStaticFile(staticDir, candidatePath);
  if (staticFile) {
    sendStaticFile(req, res, staticFile.filePath, staticFile.fileStat);
    return;
  }

  if (!extname(decodedPathname)) {
    const indexFile = await resolveStaticFile(staticDir, resolve(staticDir, "index.html"));
    if (indexFile) {
      sendStaticFile(req, res, indexFile.filePath, indexFile.fileStat);
      return;
    }
  }

  return text(res, 404, "static file not found");
}

const APP_ERROR_TABLE = {
  BAD_REQUEST: [400, "BAD_REQUEST", false],
  NOT_FOUND: [404, "NOT_FOUND", false],
  CONFLICT: [409, "CONFLICT", false],
  VALIDATION_ERROR: [422, "VALIDATION_ERROR", false],
  SERVICE_UNAVAILABLE: [503, "SERVICE_UNAVAILABLE", true],
};

function parseAppError(error) {
  const code = error?.code ?? "STORAGE_ERROR";
  const entry = APP_ERROR_TABLE[code];
  if (entry) return [entry[0], entry[1], error.message, entry[2]];
  return [500, "STORAGE_ERROR", error?.message ?? "unexpected storage error", true];
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) {
    const error = new Error("request body is required");
    error.code = "BAD_REQUEST";
    throw error;
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("request body must be valid JSON");
    error.code = "BAD_REQUEST";
    throw error;
  }
}

function ensureStorageReady(repositories) {
  if (repositories) return;
  const error = new Error("storage is not ready");
  error.code = "SERVICE_UNAVAILABLE";
  throw error;
}

function getConfig(overrides = {}) {
  const dbPath =
    overrides.dbPath ??
    process.env.PROBEFLASH_DB_PATH ??
    DEFAULT_DB_PATH;
  const host = overrides.host ?? process.env.PROBEFLASH_HOST ?? "127.0.0.1";
  const port =
    overrides.port ??
    (process.env.PROBEFLASH_PORT ? Number(process.env.PROBEFLASH_PORT) : 4100);
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
  if (logDir) {
    mkdirSync(logDir, { recursive: true });
  }
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

function serverStatus() {
  return {
    ready: true,
    runtime: "node_http",
    apiBasePath: "/api",
  };
}

function storageInitFailureDetails(releaseMetadata) {
  return {
    release: releaseMetadata,
    server: serverStatus(),
    storage: {
      kind: "sqlite",
      ready: false,
      error: "init_failed",
    },
  };
}

function createRequestHandler({ repositories, storeInitError, staticDir, releaseMetadata }) {
  const param = (match, index) => decodeURIComponent(match[index]);
  return async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const method = req.method ?? "GET";
    const isApiPath = url.pathname === "/api" || url.pathname.startsWith("/api/");

    if (!isApiPath && staticDir) {
      try {
        return await serveStaticRequest(req, res, url, staticDir);
      } catch {
        return text(res, 500, "static serve failed");
      }
    }

    const issueListMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/issues$/);
    const issueDetailMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/issues\/([^/]+)$/);
    const issueCloseoutMatch = url.pathname.match(
      /^\/api\/workspaces\/([^/]+)\/issues\/([^/]+)\/closeout$/,
    );
    const recordListMatch = url.pathname.match(
      /^\/api\/workspaces\/([^/]+)\/issues\/([^/]+)\/records$/,
    );
    const aiStatusMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/ai\/status$/);
    const aiCloseoutDraftMatch = url.pathname.match(
      /^\/api\/workspaces\/([^/]+)\/ai\/closeout-draft$/,
    );
    const searchMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/search$/);
    const archiveListMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/archives$/);
    const archiveDetailMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/archives\/(.+)$/);
    const errorEntryListMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/error-entries$/);
    const errorEntryDetailMatch = url.pathname.match(
      /^\/api\/workspaces\/([^/]+)\/error-entries\/([^/]+)$/,
    );
    const closeoutRecoveryListMatch = url.pathname.match(
      /^\/api\/workspaces\/([^/]+)\/closeout-recovery$/,
    );
    const closeoutRecoveryClearMatch = url.pathname.match(
      /^\/api\/workspaces\/([^/]+)\/closeout-recovery\/([^/]+)\/clear$/,
    );
    const formDraftDetailMatch = url.pathname.match(
      /^\/api\/workspaces\/([^/]+)\/form-drafts\/([^/]+)\/([^/]+)$/,
    );
    const workspaceDetailMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)$/);

    try {
      if (url.pathname === "/api/version" && method === "GET") {
        return ok(res, releaseMetadata);
      }

      if (url.pathname === "/api/health" && method === "GET") {
        if (storeInitError) {
          return json(res, 503, {
            ok: false,
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: storeInitError.message,
              operation: "health",
              retryable: true,
              details: storageInitFailureDetails(releaseMetadata),
            },
          });
        }
        return ok(res, { ...repositories.workspace.health(), server: serverStatus(), release: releaseMetadata });
      }

      ensureStorageReady(repositories);

      if (url.pathname === "/api/workspaces" && method === "GET") {
        return ok(res, { items: repositories.workspace.list() });
      }

      if (url.pathname === "/api/workspaces" && method === "POST") {
        const payload = await readJson(req);
        return ok(res, { workspace: repositories.workspace.create(payload) }, 201);
      }

      if (workspaceDetailMatch && method === "GET") {
        return ok(res, repositories.workspace.get(param(workspaceDetailMatch, 1)));
      }

      if (aiStatusMatch && method === "GET") {
        return ok(res, getDeepSeekStatus());
      }

      if (aiCloseoutDraftMatch && method === "POST") {
        const workspaceId = param(aiCloseoutDraftMatch, 1);
        const payload = await readJson(req);
        const request = normalizeAiCloseoutDraftRequest(payload);
        if (!request.ok) {
          return fail(res, 400, "BAD_REQUEST", request.reason, "ai_closeout_draft", false);
        }
        const prompt = buildAiPromptTemplate({
          task: request.task,
          issue: repositories.issue.get(workspaceId, request.issueId),
          records: repositories.record.list(workspaceId, request.issueId),
          closeoutDraft: request.closeoutDraft,
        });
        const result = await generateDeepSeekDraft({ task: prompt.task, messages: prompt.messages });
        if (!result.ok) {
          return fail(
            res,
            result.statusCode,
            result.error.code,
            result.error.message,
            "ai_closeout_draft",
            result.error.retryable,
            result.error.details,
          );
        }
        return ok(res, { provider: result.provider, model: result.model, task: result.task, output: result.output });
      }

      if (issueListMatch && method === "GET") {
        const workspaceId = param(issueListMatch, 1);
        const status = url.searchParams.get("status") ?? "active";
        return ok(res, { items: repositories.issue.list(workspaceId, status) });
      }

      if (issueListMatch && method === "POST") {
        const workspaceId = param(issueListMatch, 1);
        const payload = await readJson(req);
        return ok(res, repositories.issue.create(workspaceId, payload), 201);
      }

      if (issueDetailMatch && method === "GET") {
        return ok(res, repositories.issue.get(param(issueDetailMatch, 1), param(issueDetailMatch, 2)));
      }

      if (issueDetailMatch && method === "PUT") {
        const payload = await readJson(req);
        return ok(
          res,
          repositories.issue.update(param(issueDetailMatch, 1), param(issueDetailMatch, 2), payload),
        );
      }

      if (issueCloseoutMatch && method === "POST") {
        const payload = await readJson(req);
        return ok(
          res,
          repositories.issue.closeout(
            param(issueCloseoutMatch, 1),
            param(issueCloseoutMatch, 2),
            payload,
          ),
          201,
        );
      }

      if (recordListMatch && method === "GET") {
        return ok(res, {
          items: repositories.record.list(param(recordListMatch, 1), param(recordListMatch, 2)),
        });
      }

      if (recordListMatch && method === "POST") {
        const payload = await readJson(req);
        return ok(
          res,
          repositories.record.create(param(recordListMatch, 1), param(recordListMatch, 2), payload),
          201,
        );
      }

      if (searchMatch && method === "GET") {
        const workspaceId = param(searchMatch, 1);
        return ok(res, repositories.search.query(workspaceId, {
          query: url.searchParams.get("q") ?? "",
          limit: url.searchParams.get("limit") ?? undefined,
          kind: url.searchParams.get("kind") ?? undefined,
          status: url.searchParams.get("status") ?? undefined,
          tag: url.searchParams.get("tag") ?? undefined,
          from: url.searchParams.get("from") ?? undefined,
          to: url.searchParams.get("to") ?? undefined,
        }));
      }

      if (archiveListMatch && method === "GET") {
        return ok(res, { items: repositories.archive.list(param(archiveListMatch, 1)) });
      }

      if (archiveListMatch && method === "POST") {
        const payload = await readJson(req);
        return ok(res, repositories.archive.create(param(archiveListMatch, 1), payload), 201);
      }

      if (archiveDetailMatch && method === "GET") {
        return ok(
          res,
          repositories.archive.get(param(archiveDetailMatch, 1), param(archiveDetailMatch, 2)),
        );
      }

      if (errorEntryListMatch && method === "GET") {
        return ok(res, { items: repositories.errorEntry.list(param(errorEntryListMatch, 1)) });
      }

      if (errorEntryListMatch && method === "POST") {
        const payload = await readJson(req);
        return ok(res, repositories.errorEntry.create(param(errorEntryListMatch, 1), payload), 201);
      }

      if (errorEntryDetailMatch && method === "GET") {
        return ok(
          res,
          repositories.errorEntry.get(param(errorEntryDetailMatch, 1), param(errorEntryDetailMatch, 2)),
        );
      }

      if (closeoutRecoveryListMatch && method === "GET") {
        return ok(res, {
          items: repositories.closeoutRecovery.list(param(closeoutRecoveryListMatch, 1)),
        });
      }

      if (closeoutRecoveryClearMatch && method === "POST") {
        return ok(
          res,
          repositories.closeoutRecovery.clear(
            param(closeoutRecoveryClearMatch, 1),
            param(closeoutRecoveryClearMatch, 2),
          ),
        );
      }

      if (formDraftDetailMatch && method === "GET") {
        return ok(res, {
          draft: repositories.formDraft.get(
            param(formDraftDetailMatch, 1),
            param(formDraftDetailMatch, 2),
            param(formDraftDetailMatch, 3),
          ),
        });
      }

      if (formDraftDetailMatch && method === "PUT") {
        const payload = await readJson(req);
        return ok(res, repositories.formDraft.save(
          param(formDraftDetailMatch, 1),
          param(formDraftDetailMatch, 2),
          param(formDraftDetailMatch, 3),
          payload,
        ));
      }

      if (formDraftDetailMatch && method === "DELETE") {
        return ok(res, repositories.formDraft.delete(
          param(formDraftDetailMatch, 1),
          param(formDraftDetailMatch, 2),
          param(formDraftDetailMatch, 3),
        ));
      }

      return fail(res, 404, "NOT_FOUND", "route not found", "route_lookup", false, {
        method,
        path: url.pathname,
      });
    } catch (error) {
      const [statusCode, code, message, retryable] = parseAppError(error);
      return fail(
        res,
        statusCode,
        code,
        message,
        url.pathname === "/api/health" ? "health" : "request",
        retryable,
      );
    }
  };
}

export async function startProbeFlashServer(overrides = {}) {
  const { dbPath, host, port, defaultWorkspace, logDir, staticDir, releaseMetadata } = getConfig(overrides);
  let store = null;
  let storeInitError = null;
  let repositories = null;
  let closeoutRecoveryScanResult = { ok: false, items: [], error: null };

  try {
    store = createProbeFlashDatabase(dbPath, { defaultWorkspace });
    repositories = createRepositories(store);
  } catch (error) {
    storeInitError = error instanceof Error ? error : new Error(String(error));
  }

  // TECH-02: startup-time closeout recovery scan. Pure read; no side-effects on the
  // data layer. Operators see the count + summary right after boot so partial closeouts
  // never silently linger; the GET /closeout-recovery API exposes the full list to the
  // desktop UI which decides how to surface them. Suppressed in test runs by passing
  // overrides.suppressCloseoutRecoveryLog = true.
  if (repositories) {
    try {
      const items = repositories.closeoutRecovery.list(defaultWorkspace.id);
      closeoutRecoveryScanResult = { ok: true, items, error: null };
      if (!overrides.suppressCloseoutRecoveryLog) {
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
    } catch (error) {
      closeoutRecoveryScanResult = {
        ok: false,
        items: [],
        error: error instanceof Error ? error.message : String(error),
      };
      if (!overrides.suppressCloseoutRecoveryLog) {
        console.warn(
          `[probeflash-server] closeout recovery scan failed: ${closeoutRecoveryScanResult.error}`,
        );
      }
    }
  }

  const server = createServer(createRequestHandler({ repositories, storeInitError, staticDir, releaseMetadata }));

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
  const resolvedPort =
    address && typeof address === "object" && "port" in address ? address.port : port;
  const baseUrl = `http://${host}:${resolvedPort}`;

  return {
    baseUrl,
    dbPath,
    logDir,
    staticDir,
    closeoutRecoveryScan: closeoutRecoveryScanResult,
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
  if (server.logDir) {
    console.log(`[probeflash-server] log dir ${server.logDir}`);
  }
  if (server.staticDir) {
    console.log(`[probeflash-server] static dir ${server.staticDir}`);
  }
}
