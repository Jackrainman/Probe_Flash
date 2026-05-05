// apps/server/src/routes/workspaces.mjs
// TECH-09: workspace CRUD routes.

import { ok, readJson } from "../http/responses.mjs";

export const workspaceRoutes = [
  {
    method: "GET",
    pattern: /^\/api\/workspaces$/,
    handle({ res, repositories }) {
      ok(res, { items: repositories.workspace.list() });
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/workspaces$/,
    async handle({ req, res, repositories }) {
      const payload = await readJson(req);
      ok(res, { workspace: repositories.workspace.create(payload) }, 201);
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)$/,
    handle({ res, match, repositories }) {
      ok(res, repositories.workspace.get(decodeURIComponent(match[1])));
    },
  },
];
