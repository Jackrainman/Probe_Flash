// apps/server/src/routes/records.mjs
// TECH-09: investigation record list/append.

import { ok, readJson } from "../http/responses.mjs";

export const recordRoutes = [
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/issues\/([^/]+)\/records$/,
    handle({ res, match, repositories }) {
      ok(res, {
        items: repositories.record.list(
          decodeURIComponent(match[1]),
          decodeURIComponent(match[2]),
        ),
      });
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/workspaces\/([^/]+)\/issues\/([^/]+)\/records$/,
    async handle({ req, res, match, repositories }) {
      const payload = await readJson(req);
      ok(
        res,
        repositories.record.create(
          decodeURIComponent(match[1]),
          decodeURIComponent(match[2]),
          payload,
        ),
        201,
      );
    },
  },
];
