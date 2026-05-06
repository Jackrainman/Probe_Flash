// apps/server/src/routes/archives.mjs
// TECH-09: archive document list/get/create. The detail pattern intentionally accepts
// arbitrary suffix characters (.+) because archive file names contain dots (e.g.
// 2026-04-28_issue-foo.md).

import { ok, readJson } from "../http/responses.mjs";

export const archiveRoutes = [
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/archives$/,
    handle({ res, match, store }) {
      ok(res, { items: store.listArchives(decodeURIComponent(match[1])) });
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/workspaces\/([^/]+)\/archives$/,
    async handle({ req, res, match, store }) {
      const payload = await readJson(req);
      ok(res, store.createArchive(decodeURIComponent(match[1]), payload), 201);
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/archives\/(.+)$/,
    handle({ res, match, store }) {
      ok(
        res,
        store.getArchive(decodeURIComponent(match[1]), decodeURIComponent(match[2])),
      );
    },
  },
];
