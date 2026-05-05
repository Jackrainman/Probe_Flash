// apps/server/src/routes/formDrafts.mjs
// TECH-09: per-(workspace, formKind, itemId) form draft routes.

import { ok, readJson } from "../http/responses.mjs";

export const formDraftRoutes = [
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/form-drafts\/([^/]+)\/([^/]+)$/,
    handle({ res, match, repositories }) {
      ok(res, {
        draft: repositories.formDraft.get(
          decodeURIComponent(match[1]),
          decodeURIComponent(match[2]),
          decodeURIComponent(match[3]),
        ),
      });
    },
  },
  {
    method: "PUT",
    pattern: /^\/api\/workspaces\/([^/]+)\/form-drafts\/([^/]+)\/([^/]+)$/,
    async handle({ req, res, match, repositories }) {
      const payload = await readJson(req);
      ok(
        res,
        repositories.formDraft.save(
          decodeURIComponent(match[1]),
          decodeURIComponent(match[2]),
          decodeURIComponent(match[3]),
          payload,
        ),
      );
    },
  },
  {
    method: "DELETE",
    pattern: /^\/api\/workspaces\/([^/]+)\/form-drafts\/([^/]+)\/([^/]+)$/,
    handle({ res, match, repositories }) {
      ok(
        res,
        repositories.formDraft.delete(
          decodeURIComponent(match[1]),
          decodeURIComponent(match[2]),
          decodeURIComponent(match[3]),
        ),
      );
    },
  },
];
