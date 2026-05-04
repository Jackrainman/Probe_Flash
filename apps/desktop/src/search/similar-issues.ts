import type { ArchiveDocument } from "../domain/schemas/archive-document.ts";
import type { ErrorEntry } from "../domain/schemas/error-entry.ts";
import type { IssueCard } from "../domain/schemas/issue-card.ts";
import type { StorageReadError } from "../storage/storage-result.ts";
import type { StorageRepository } from "../storage/storage-repository.ts";

export interface SimilarIssueMatch {
  issueId: string;
  title: string;
  status: IssueCard["status"];
  tags: string[];
  score: number;
  reasons: string[];
  matchedTags: string[];
  matchedKeywords: string[];
  matchedRootCauseTerms: string[];
  matchedResolutionTerms: string[];
  errorCode?: string;
  rootCauseSummary?: string;
  resolutionSummary?: string;
  archiveFileName?: string;
  updatedAt: string;
}

export interface SimilarIssuesResult {
  currentIssueId: string;
  items: SimilarIssueMatch[];
  readError: StorageReadError | null;
}

export interface RankSimilarIssuesInput {
  currentIssue: IssueCard;
  issues: IssueCard[];
  errorEntries?: ErrorEntry[];
  archives?: ArchiveDocument[];
  limit?: number;
  minScore?: number;
}

const DEFAULT_LIMIT = 4;
const DEFAULT_MIN_SCORE = 4;

const TOKEN_PATTERN = /[\p{L}\p{N}][\p{L}\p{N}_-]*/gu;

const STOP_WORDS = new Set([
  "and",
  "the",
  "with",
  "from",
  "should",
  "issue",
  "error",
  "failure",
  "problem",
  "debug",
  "verify",
  "sentinel",
  "search",
  "tag",
  "tags",
  "问题",
  "现象",
  "排查",
  "验证",
  "错误",
  "失败",
  "历史",
]);

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function normalizeTagList(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const trimmed = tag.trim();
    const key = normalizeText(trimmed);
    if (trimmed.length === 0 || seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);
  }
  return normalized;
}

function addTokens(tokens: Set<string>, value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach((item) => addTokens(tokens, item));
    return;
  }
  if (typeof value !== "string") return;
  for (const match of value.matchAll(TOKEN_PATTERN)) {
    const token = normalizeText(match[0]);
    if (token.length < 2 || STOP_WORDS.has(token)) continue;
    tokens.add(token);
  }
}

function tokenSet(values: unknown[]): Set<string> {
  const tokens = new Set<string>();
  values.forEach((value) => addTokens(tokens, value));
  return tokens;
}

function intersectOrdered(left: string[], right: Set<string>, limit: number): string[] {
  const matches: string[] = [];
  const seen = new Set<string>();
  for (const value of left) {
    const key = normalizeText(value);
    if (!right.has(key) || seen.has(key)) continue;
    seen.add(key);
    matches.push(value);
    if (matches.length >= limit) break;
  }
  return matches;
}

function intersectTokens(left: Set<string>, right: Set<string>, limit: number): string[] {
  const matches: string[] = [];
  for (const token of left) {
    if (!right.has(token)) continue;
    matches.push(token);
    if (matches.length >= limit) break;
  }
  return matches;
}

function compactSummary(value: string | undefined, limit = 96): string | undefined {
  const compacted = value?.replace(/\s+/g, " ").trim();
  if (!compacted) return undefined;
  return compacted.length <= limit ? compacted : `${compacted.slice(0, limit)}...`;
}

function issueTokens(issue: IssueCard): Set<string> {
  return tokenSet([
    issue.title,
    issue.rawInput,
    issue.normalizedSummary,
    issue.symptomSummary,
    issue.suspectedDirections,
    issue.suggestedActions,
    issue.tags,
  ]);
}

function groupByIssueId<T extends { sourceIssueId?: string; issueId?: string }>(items: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const issueId = item.sourceIssueId ?? item.issueId;
    if (!issueId) continue;
    const bucket = grouped.get(issueId) ?? [];
    bucket.push(item);
    grouped.set(issueId, bucket);
  }
  return grouped;
}

function isHistoricalIssue(
  issue: IssueCard,
  errorEntries: ErrorEntry[],
  archives: ArchiveDocument[],
): boolean {
  return (
    issue.status === "archived" ||
    issue.status === "resolved" ||
    errorEntries.length > 0 ||
    archives.length > 0
  );
}

function buildReasons(match: Omit<SimilarIssueMatch, "reasons">): string[] {
  const reasons: string[] = [];
  const labels: Array<[keyof typeof match, string]> = [
    ["matchedTags", "标签重合"],
    ["matchedKeywords", "关键词重合"],
    ["matchedRootCauseTerms", "根因术语重合"],
    ["matchedResolutionTerms", "处理方式术语重合"],
  ];
  for (const [key, prefix] of labels) {
    const list = match[key] as string[];
    if (list.length > 0) reasons.push(`${prefix}：${list.join("、")}`);
  }
  if (match.errorCode) reasons.push(`已有错误表：${match.errorCode}`);
  return reasons;
}

export function rankSimilarIssues(input: RankSimilarIssuesInput): SimilarIssueMatch[] {
  const limit = input.limit ?? DEFAULT_LIMIT;
  const minScore = input.minScore ?? DEFAULT_MIN_SCORE;
  const errorEntries = input.errorEntries ?? [];
  const archives = input.archives ?? [];
  const errorsByIssueId = groupByIssueId(errorEntries);
  const archivesByIssueId = groupByIssueId(archives);
  const currentTags = normalizeTagList(input.currentIssue.tags);
  const currentTagKeys = new Set(currentTags.map(normalizeText));
  const currentIssueTerms = issueTokens(input.currentIssue);
  const currentErrors = errorsByIssueId.get(input.currentIssue.id) ?? [];
  const currentRootTerms = tokenSet(currentErrors.map((entry) => entry.rootCause));
  const currentResolutionTerms = tokenSet(
    currentErrors.flatMap((entry) => [entry.resolution, entry.prevention]),
  );
  const currentComparisonTerms = new Set([
    ...currentIssueTerms,
    ...currentRootTerms,
    ...currentResolutionTerms,
  ]);

  const matches: SimilarIssueMatch[] = [];

  for (const issue of input.issues) {
    if (issue.id === input.currentIssue.id || issue.projectId !== input.currentIssue.projectId) {
      continue;
    }
    const candidateErrors = errorsByIssueId.get(issue.id) ?? [];
    const candidateArchives = archivesByIssueId.get(issue.id) ?? [];
    if (!isHistoricalIssue(issue, candidateErrors, candidateArchives)) {
      continue;
    }

    const candidateTags = normalizeTagList([
      ...normalizeTagList(issue.tags),
      ...candidateErrors.flatMap((entry) => normalizeTagList(entry.tags)),
    ]);
    const matchedTags = intersectOrdered(candidateTags, currentTagKeys, 6);
    const candidateIssueTerms = tokenSet([
      issue.title,
      issue.rawInput,
      issue.normalizedSummary,
      issue.symptomSummary,
      issue.suspectedDirections,
      issue.suggestedActions,
      issue.tags,
      candidateErrors.flatMap((entry) => [entry.title, entry.category, entry.symptom]),
      candidateArchives.map((archive) => archive.markdownContent),
    ]);
    const candidateRootTerms = tokenSet(candidateErrors.map((entry) => entry.rootCause));
    const candidateResolutionTerms = tokenSet(
      candidateErrors.flatMap((entry) => [entry.resolution, entry.prevention]),
    );
    const matchedKeywords = intersectTokens(currentIssueTerms, candidateIssueTerms, 8);
    const matchedRootCauseTerms = intersectTokens(currentComparisonTerms, candidateRootTerms, 5);
    const matchedResolutionTerms = intersectTokens(currentComparisonTerms, candidateResolutionTerms, 5);
    const firstError = candidateErrors[0];
    const firstArchive = candidateArchives[0];
    const score =
      matchedTags.length * 4 +
      matchedKeywords.length * 2 +
      matchedRootCauseTerms.length * 3 +
      matchedResolutionTerms.length * 2 +
      (firstError ? 1 : 0) +
      (firstArchive ? 1 : 0);
    if (score < minScore) {
      continue;
    }
    const matchWithoutReasons = {
      issueId: issue.id,
      title: issue.title,
      status: issue.status,
      tags: candidateTags,
      score,
      matchedTags,
      matchedKeywords,
      matchedRootCauseTerms,
      matchedResolutionTerms,
      errorCode: firstError?.errorCode,
      rootCauseSummary: compactSummary(firstError?.rootCause),
      resolutionSummary: compactSummary(firstError?.resolution),
      archiveFileName: firstArchive?.fileName,
      updatedAt: issue.updatedAt,
    } satisfies Omit<SimilarIssueMatch, "reasons">;
    matches.push({ ...matchWithoutReasons, reasons: buildReasons(matchWithoutReasons) });
  }

  matches.sort((left, right) => {
    if (left.score !== right.score) return right.score - left.score;
    if (left.updatedAt !== right.updatedAt) return left.updatedAt < right.updatedAt ? 1 : -1;
    return left.issueId.localeCompare(right.issueId);
  });

  return matches.slice(0, limit);
}

export async function findSimilarIssuesForIssue(
  repository: StorageRepository,
  currentIssue: IssueCard,
): Promise<SimilarIssuesResult> {
  const issueList = await repository.issueCards.list();
  if (issueList.readError !== null) {
    return { currentIssueId: currentIssue.id, items: [], readError: issueList.readError };
  }

  const issues: IssueCard[] = [];
  for (const summary of issueList.valid) {
    const loaded = await repository.issueCards.load(summary.id);
    if (loaded.ok) {
      issues.push(loaded.card);
    }
  }

  const archives = await repository.archiveDocuments.list();
  if (archives.readError !== null) {
    return { currentIssueId: currentIssue.id, items: [], readError: archives.readError };
  }

  const errorEntries = await repository.errorEntries.list();
  if (errorEntries.readError !== null) {
    return { currentIssueId: currentIssue.id, items: [], readError: errorEntries.readError };
  }

  return {
    currentIssueId: currentIssue.id,
    items: rankSimilarIssues({
      currentIssue,
      issues: issues.filter((issue) => issue.projectId === currentIssue.projectId),
      archives: archives.valid.filter((archive) => archive.projectId === currentIssue.projectId),
      errorEntries: errorEntries.valid.filter((entry) => entry.projectId === currentIssue.projectId),
    }),
    readError: null,
  };
}
