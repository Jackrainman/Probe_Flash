// apps/server/src/routes/archives.mjs
// TECH-09: archive document list/get/create. The detail pattern intentionally accepts
// arbitrary suffix characters (.+) because archive file names contain dots (e.g.
// 2026-04-28_issue-foo.md).

import { ok, readJson } from "../http/responses.mjs";

export const archiveRoutes = [
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/archives$/,
    handle({ res, match, repositories }) {
      ok(res, { items: repositories.archive.list(decodeURIComponent(match[1])) });
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/workspaces\/([^/]+)\/archives$/,
    async handle({ req, res, match, repositories }) {
      const payload = await readJson(req);
      ok(res, repositories.archive.create(decodeURIComponent(match[1]), payload), 201);
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/archives\/(.+)$/,
    handle({ res, match, repositories }) {
      ok(
        res,
        repositories.archive.get(decodeURIComponent(match[1]), decodeURIComponent(match[2])),
      );
    },
  },
];
