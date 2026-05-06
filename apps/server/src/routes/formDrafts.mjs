// apps/server/src/routes/formDrafts.mjs
// TECH-09: per-(workspace, formKind, itemId) form draft routes.

import { ok, readJson } from "../http/responses.mjs";

export const formDraftRoutes = [
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/form-drafts\/([^/]+)\/([^/]+)$/,
    handle({ res, match, store }) {
      ok(res, {
        draft: store.getFormDraft(
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
    async handle({ req, res, match, store }) {
      const payload = await readJson(req);
      ok(
        res,
        store.saveFormDraft(
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
    handle({ res, match, store }) {
      ok(
        res,
        store.deleteFormDraft(
          decodeURIComponent(match[1]),
          decodeURIComponent(match[2]),
          decodeURIComponent(match[3]),
        ),
      );
    },
  },
];
