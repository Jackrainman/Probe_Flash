// apps/server/src/routes/health.mjs
// TECH-09: GET /api/health. Special-cases storeInitError so an unreachable DB still
// surfaces a structured 503 instead of falling through to the generic storage gate.

import { json, ok, serverStatus, storageInitFailureDetails } from "../http/responses.mjs";

export const healthRoutes = [
  {
    method: "GET",
    pattern: /^\/api\/health$/,
    requiresStorage: false,
    handle({ res, store, storeInitError, releaseMetadata }) {
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
      return ok(res, {
        ...store.health(),
        server: serverStatus(),
        release: releaseMetadata,
      });
    },
  },
];
