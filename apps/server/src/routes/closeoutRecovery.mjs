// apps/server/src/routes/closeoutRecovery.mjs
// TECH-09: TECH-02 closeout recovery surface — list pending/failed markers and
// idempotently clear them.

import { ok } from "../http/responses.mjs";

export const closeoutRecoveryRoutes = [
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/closeout-recovery$/,
    handle({ res, match, repositories }) {
      ok(res, { items: repositories.closeoutRecovery.list(decodeURIComponent(match[1])) });
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/workspaces\/([^/]+)\/closeout-recovery\/([^/]+)\/clear$/,
    handle({ res, match, repositories }) {
      ok(
        res,
        repositories.closeoutRecovery.clear(
          decodeURIComponent(match[1]),
          decodeURIComponent(match[2]),
        ),
      );
    },
  },
];
