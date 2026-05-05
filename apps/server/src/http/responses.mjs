// apps/server/src/http/responses.mjs
// TECH-09: shared HTTP envelope helpers + storage-error → status mapping. Lifted
// out of server.mjs so per-entity route modules under `apps/server/src/routes/`
// can render consistent { ok: true, data } / { ok: false, error } responses
// without re-implementing the bookkeeping.

const APP_ERROR_TABLE = {
  BAD_REQUEST: [400, "BAD_REQUEST", false],
  NOT_FOUND: [404, "NOT_FOUND", false],
  CONFLICT: [409, "CONFLICT", false],
  VALIDATION_ERROR: [422, "VALIDATION_ERROR", false],
  SERVICE_UNAVAILABLE: [503, "SERVICE_UNAVAILABLE", true],
};

export function json(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

export function ok(res, data, statusCode = 200) {
  json(res, statusCode, { ok: true, data });
}

export function fail(res, statusCode, code, message, operation, retryable, details = {}) {
  json(res, statusCode, { ok: false, error: { code, message, operation, retryable, details } });
}

export function text(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8", ...headers });
  res.end(body);
}

export function parseAppError(error) {
  const code = error?.code ?? "STORAGE_ERROR";
  const entry = APP_ERROR_TABLE[code];
  if (entry) return [entry[0], entry[1], error.message, entry[2]];
  return [500, "STORAGE_ERROR", error?.message ?? "unexpected storage error", true];
}

export async function readJson(req) {
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

export function ensureStorageReady(repositories) {
  if (repositories) return;
  const error = new Error("storage is not ready");
  error.code = "SERVICE_UNAVAILABLE";
  throw error;
}

export function serverStatus() {
  return {
    ready: true,
    runtime: "node_http",
    apiBasePath: "/api",
  };
}

export function storageInitFailureDetails(releaseMetadata) {
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
