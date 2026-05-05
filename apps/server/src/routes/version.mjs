// apps/server/src/routes/version.mjs
// TECH-09: GET /api/version. Pre-storage gate (no repository access).

import { ok } from "../http/responses.mjs";

export const versionRoutes = [
  {
    method: "GET",
    pattern: /^\/api\/version$/,
    requiresStorage: false,
    handle({ res, releaseMetadata }) {
      ok(res, releaseMetadata);
    },
  },
];
