// apps/server/src/routes/issues.mjs
// TECH-09: issue list/detail/update + atomic closeout (TECH-01).

import { ok, readJson } from "../http/responses.mjs";

export const issueRoutes = [
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/issues$/,
    handle({ res, url, match, store }) {
      const workspaceId = decodeURIComponent(match[1]);
      const status = url.searchParams.get("status") ?? "active";
      ok(res, { items: store.listIssues(workspaceId, status) });
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/workspaces\/([^/]+)\/issues$/,
    async handle({ req, res, match, store }) {
      const workspaceId = decodeURIComponent(match[1]);
      const payload = await readJson(req);
      ok(res, store.createIssue(workspaceId, payload), 201);
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/issues\/([^/]+)$/,
    handle({ res, match, store }) {
      ok(
        res,
        store.getIssue(decodeURIComponent(match[1]), decodeURIComponent(match[2])),
      );
    },
  },
  {
    method: "PUT",
    pattern: /^\/api\/workspaces\/([^/]+)\/issues\/([^/]+)$/,
    async handle({ req, res, match, store }) {
      const payload = await readJson(req);
      ok(
        res,
        store.updateIssue(
          decodeURIComponent(match[1]),
          decodeURIComponent(match[2]),
          payload,
        ),
      );
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/workspaces\/([^/]+)\/issues\/([^/]+)\/closeout$/,
    async handle({ req, res, match, store }) {
      const payload = await readJson(req);
      ok(
        res,
        store.closeoutIssue(
          decodeURIComponent(match[1]),
          decodeURIComponent(match[2]),
          payload,
        ),
        201,
      );
    },
  },
];
