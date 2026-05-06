// apps/server/src/routes/search.mjs
// TECH-09: cross-entity search query route.

import { ok } from "../http/responses.mjs";

export const searchRoutes = [
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/search$/,
    handle({ res, url, match, store }) {
      const workspaceId = decodeURIComponent(match[1]);
      ok(
        res,
        store.search(workspaceId, {
          query: url.searchParams.get("q") ?? "",
          limit: url.searchParams.get("limit") ?? undefined,
          kind: url.searchParams.get("kind") ?? undefined,
          status: url.searchParams.get("status") ?? undefined,
          tag: url.searchParams.get("tag") ?? undefined,
          from: url.searchParams.get("from") ?? undefined,
          to: url.searchParams.get("to") ?? undefined,
        }),
      );
    },
  },
];
