// apps/server/src/routes/ai.mjs
// TECH-09: DeepSeek status + closeout-draft passthrough. Talks to repositories.issue
// and repositories.record purely to read context for the prompt template — no
// writes.

import { generateDeepSeekDraft, getDeepSeekStatus } from "../ai/deepseek-client.mjs";
import {
  buildAiPromptTemplate,
  normalizeAiCloseoutDraftRequest,
} from "../ai/prompt-templates.mjs";
import { fail, ok, readJson } from "../http/responses.mjs";

export const aiRoutes = [
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/ai\/status$/,
    handle({ res }) {
      ok(res, getDeepSeekStatus());
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/workspaces\/([^/]+)\/ai\/closeout-draft$/,
    async handle({ req, res, match, repositories }) {
      const workspaceId = decodeURIComponent(match[1]);
      const payload = await readJson(req);
      const request = normalizeAiCloseoutDraftRequest(payload);
      if (!request.ok) {
        return fail(res, 400, "BAD_REQUEST", request.reason, "ai_closeout_draft", false);
      }
      const prompt = buildAiPromptTemplate({
        task: request.task,
        issue: repositories.issue.get(workspaceId, request.issueId),
        records: repositories.record.list(workspaceId, request.issueId),
        closeoutDraft: request.closeoutDraft,
      });
      const result = await generateDeepSeekDraft({ task: prompt.task, messages: prompt.messages });
      if (!result.ok) {
        return fail(
          res,
          result.statusCode,
          result.error.code,
          result.error.message,
          "ai_closeout_draft",
          result.error.retryable,
          result.error.details,
        );
      }
      return ok(res, {
        provider: result.provider,
        model: result.model,
        task: result.task,
        output: result.output,
      });
    },
  },
];
