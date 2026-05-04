// apps/desktop/src/domain/closeout.ts
// S2-A4：把选中的 IssueCard + InvestigationRecord 时间线转成结案归档实体。
// 保持纯函数，浏览器 UI 和 Node 验证脚本负责注入时间、errorCode 与持久化动作。

import type { z } from "zod";
import {
  ArchiveDocumentSchema,
  ArchiveGeneratedBy,
  type ArchiveDocument,
} from "./schemas/archive-document.ts";
import { ErrorEntrySchema, type ErrorEntry } from "./schemas/error-entry.ts";
import { IssueCardSchema, type IssueCard } from "./schemas/issue-card.ts";
import type { InvestigationRecord } from "./schemas/investigation-record.ts";

export type CloseoutGeneratedBy = z.infer<typeof ArchiveGeneratedBy>;

export interface CloseoutInput {
  category: string;
  rootCause: string;
  resolution: string;
  prevention: string;
}

export interface CloseoutOptions {
  now: string;
  errorEntryId: string;
  errorCode: string;
  generatedBy: CloseoutGeneratedBy;
}

export type CloseoutFailure = {
  ok: false;
  reason: string;
  path?: (string | number)[];
};

export type CloseoutSuccess = {
  ok: true;
  archiveDocument: ArchiveDocument;
  errorEntry: ErrorEntry;
  updatedIssueCard: IssueCard;
};

export type CloseoutResult = CloseoutSuccess | CloseoutFailure;

function normalizeInput(input: CloseoutInput): CloseoutInput {
  return {
    category: input.category.trim(),
    rootCause: input.rootCause.trim(),
    resolution: input.resolution.trim(),
    prevention: input.prevention.trim(),
  };
}

function derivePrevention(input: CloseoutInput): string {
  if (input.prevention.length > 0) return input.prevention;
  return `Prevent recurrence by adding this resolution to the debug checklist: ${input.resolution}`;
}

function failureFromIssue(prefix: string, issue: { path: (string | number)[]; message: string }): CloseoutFailure {
  return {
    ok: false,
    reason: `${prefix}: ${issue.path.join(".") || "(root)"}: ${issue.message}`,
    path: issue.path,
  };
}

function datePartFromISO(now: string): string {
  const match = now.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "0000-00-00";
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
}

function slugify(value: string, fallback: string): string {
  return toSlug(value) || toSlug(fallback) || "issue-archive";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function uniqueTags(values: string[]): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const value of values) {
    const tag = value.trim();
    const key = tag.toLocaleLowerCase();
    if (tag.length === 0 || seen.has(key) || key === "uncategorized") continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

function formatList(values: string[]): string {
  if (values.length === 0) return "- (none)";
  return values.map((value) => `- ${value}`).join("\n");
}

function renderTimeline(records: InvestigationRecord[]): string {
  if (records.length === 0) return "- (no investigation records)";
  return records
    .map((record) => `- ${record.createdAt} [${record.type}] ${record.polishedText}`)
    .join("\n");
}

function renderArchiveMarkdown(
  issueCard: IssueCard,
  records: InvestigationRecord[],
  input: CloseoutInput,
  generatedAt: string,
): string {
  const relatedFiles = unique([
    ...issueCard.relatedFiles,
    ...records.flatMap((record) => record.linkedFiles),
  ]);
  const relatedCommits = unique([
    ...issueCard.relatedCommits,
    ...records.flatMap((record) => record.linkedCommits),
  ]);

  return [
    `# ${issueCard.title}`,
    "",
    "## Summary",
    `- Issue ID: ${issueCard.id}`,
    `- Project ID: ${issueCard.projectId}`,
    `- Severity: ${issueCard.severity}`,
    `- Archived At: ${generatedAt}`,
    "",
    "## Symptom",
    issueCard.symptomSummary || issueCard.normalizedSummary || issueCard.rawInput || "(not recorded)",
    "",
    "## Root Cause",
    input.rootCause,
    "",
    "## Resolution",
    input.resolution,
    "",
    "## Prevention",
    input.prevention || "(not recorded)",
    "",
    "## Investigation Timeline",
    renderTimeline(records),
    "",
    "## Related Files",
    formatList(relatedFiles),
    "",
    "## Related Commits",
    formatList(relatedCommits),
    "",
  ].join("\n");
}

function safeParseOrFailure<T>(
  schema: { safeParse: (value: unknown) => z.SafeParseReturnType<unknown, T> },
  draft: unknown,
  prefix: string,
): { ok: true; data: T } | CloseoutFailure {
  const parsed = schema.safeParse(draft);
  if (parsed.success) return { ok: true, data: parsed.data };
  const first = parsed.error.issues[0];
  return first
    ? failureFromIssue(prefix, first)
    : { ok: false, reason: `${prefix}: schema validation failed` };
}

export function buildCloseoutFromIssue(
  issueCard: IssueCard,
  records: InvestigationRecord[],
  rawInput: CloseoutInput,
  opts: CloseoutOptions,
): CloseoutResult {
  const normalizedInput = normalizeInput(rawInput);

  if (issueCard.status === "archived") {
    return { ok: false, reason: "issue is already archived", path: ["status"] };
  }
  if (normalizedInput.rootCause.length === 0) {
    return { ok: false, reason: "rootCause is required", path: ["rootCause"] };
  }
  if (normalizedInput.resolution.length === 0) {
    return { ok: false, reason: "resolution is required", path: ["resolution"] };
  }

  const input: CloseoutInput = {
    ...normalizedInput,
    prevention: derivePrevention(normalizedInput),
  };

  const sortedRecords = [...records].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
  );
  const datePart = datePartFromISO(opts.now);
  const fileName = `${datePart}_${slugify(issueCard.title, issueCard.id)}.md`;
  const filePath = `.debug_workspace/archive/${fileName}`;
  const symptom =
    issueCard.symptomSummary || issueCard.normalizedSummary || issueCard.rawInput || "";
  const relatedFiles = unique([
    ...issueCard.relatedFiles,
    ...sortedRecords.flatMap((record) => record.linkedFiles),
  ]);
  const relatedCommits = unique([
    ...issueCard.relatedCommits,
    ...sortedRecords.flatMap((record) => record.linkedCommits),
  ]);
  const tags = uniqueTags([...issueCard.tags, input.category]);

  const archiveResult = safeParseOrFailure<ArchiveDocument>(ArchiveDocumentSchema, {
    issueId: issueCard.id,
    projectId: issueCard.projectId,
    fileName,
    filePath,
    markdownContent: renderArchiveMarkdown(issueCard, sortedRecords, input, opts.now),
    generatedBy: opts.generatedBy,
    generatedAt: opts.now,
  }, "archiveDocument");
  if (!archiveResult.ok) return archiveResult;

  const errorEntryResult = safeParseOrFailure<ErrorEntry>(ErrorEntrySchema, {
    id: opts.errorEntryId,
    projectId: issueCard.projectId,
    sourceIssueId: issueCard.id,
    errorCode: opts.errorCode,
    title: issueCard.title,
    category: input.category || "uncategorized",
    symptom,
    rootCause: input.rootCause,
    resolution: input.resolution,
    prevention: input.prevention,
    tags,
    relatedFiles,
    relatedCommits,
    archiveFilePath: archiveResult.data.filePath,
    createdAt: opts.now,
    updatedAt: opts.now,
  }, "errorEntry");
  if (!errorEntryResult.ok) return errorEntryResult;

  const issueCardResult = safeParseOrFailure<IssueCard>(IssueCardSchema, {
    ...issueCard,
    status: "archived",
    updatedAt: opts.now,
  }, "issueCard");
  if (!issueCardResult.ok) return issueCardResult;

  return {
    ok: true,
    archiveDocument: archiveResult.data,
    errorEntry: errorEntryResult.data,
    updatedIssueCard: issueCardResult.data,
  };
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function generateErrorEntryId(): string {
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoRef?.randomUUID) {
    return `error-entry-${cryptoRef.randomUUID()}`;
  }
  return `error-entry-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function generateErrorCode(now: string): string {
  const datePart = datePartFromISO(now).replace(/-/g, "");
  const sequence = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `DBG-${datePart}-${sequence}`;
}

export function defaultCloseoutOptions(
  now: string,
  overrides: Partial<Omit<CloseoutOptions, "now">> = {},
): CloseoutOptions {
  return {
    now,
    errorEntryId: overrides.errorEntryId ?? generateErrorEntryId(),
    errorCode: overrides.errorCode ?? generateErrorCode(now),
    generatedBy: overrides.generatedBy ?? "hybrid",
  };
}
