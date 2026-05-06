// apps/server/src/routes/errorEntries.mjs
// TECH-09: error entry list/detail/create (DBG-* records).

import { ok, readJson } from "../http/responses.mjs";

export const errorEntryRoutes = [
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/error-entries$/,
    handle({ res, match, store }) {
      ok(res, { items: store.listErrorEntries(decodeURIComponent(match[1])) });
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/workspaces\/([^/]+)\/error-entries$/,
    async handle({ req, res, match, store }) {
      const payload = await readJson(req);
      ok(res, store.createErrorEntry(decodeURIComponent(match[1]), payload), 201);
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/error-entries\/([^/]+)$/,
    handle({ res, match, store }) {
      ok(
        res,
        store.getErrorEntry(decodeURIComponent(match[1]), decodeURIComponent(match[2])),
      );
    },
  },
];
