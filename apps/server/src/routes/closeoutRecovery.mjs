// apps/server/src/routes/closeoutRecovery.mjs
// TECH-09: TECH-02 closeout recovery surface — list pending/failed markers and
// idempotently clear them.

import { ok } from "../http/responses.mjs";

export const closeoutRecoveryRoutes = [
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/closeout-recovery$/,
    handle({ res, match, store }) {
      ok(res, { items: store.listCloseoutRecovery(decodeURIComponent(match[1])) });
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/workspaces\/([^/]+)\/closeout-recovery\/([^/]+)\/clear$/,
    handle({ res, match, store }) {
      ok(
        res,
        store.clearCloseoutState(
          decodeURIComponent(match[1]),
          decodeURIComponent(match[2]),
        ),
      );
    },
  },
];
