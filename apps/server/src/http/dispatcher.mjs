// apps/server/src/http/dispatcher.mjs
// TECH-09: per-request /api dispatcher. Walks the apiRoutes registry, applies
// the storage-ready gate when needed, and falls back to a structured 404 when
// no route matches.

import { apiRoutes } from "../routes/index.mjs";
import { ensureStorageReady, fail, parseAppError, text } from "./responses.mjs";
import { serveStaticRequest } from "./static.mjs";

export function createRequestHandler({ store, storeInitError, staticDir, releaseMetadata }) {
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

    try {
      for (const route of apiRoutes) {
        if (route.method !== method) continue;
        const match = url.pathname.match(route.pattern);
        if (!match) continue;
        if (route.requiresStorage !== false) {
          ensureStorageReady(store);
        }
        return await route.handle({
          req,
          res,
          url,
          match,
          store,
          releaseMetadata,
          storeInitError,
        });
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
