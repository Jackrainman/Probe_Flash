// apps/server/src/routes/workspaces.mjs
// TECH-09: workspace CRUD routes.

import { ok, readJson } from "../http/responses.mjs";

export const workspaceRoutes = [
  {
    method: "GET",
    pattern: /^\/api\/workspaces$/,
    handle({ res, store }) {
      ok(res, { items: store.listWorkspaces() });
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/workspaces$/,
    async handle({ req, res, store }) {
      const payload = await readJson(req);
      ok(res, { workspace: store.createWorkspace(payload) }, 201);
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)$/,
    handle({ res, match, store }) {
      ok(res, store.getWorkspace(decodeURIComponent(match[1])));
    },
  },
];
