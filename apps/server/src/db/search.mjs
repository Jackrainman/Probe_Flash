// apps/server/src/db/search.mjs
// TECH-10: cross-entity search query + all related normalizers/helpers/constants.
// Operates on the SQLite handle but builds its own per-row classifier so the
// per-entity ops modules don't need to know about search-specific shapes.

import { ISSUE_STATUSES } from "./constants.mjs";
import { createStorageError, parsePayload } from "./storage-error.mjs";
import { mergeTags, normalizeTagList } from "./validation.mjs";

const SEARCH_RESULT_LIMIT_DEFAULT = 20;
const SEARCH_RESULT_LIMIT_MAX = 50;
const SEARCH_RESULT_KINDS = new Set(["all", "issue", "record", "archive", "error_entry"]);
const SEARCH_DATE_FILTER_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const ISSUE_SEARCH_FIELDS = [
  ["title", (issue) => issue.title],
  ["rawInput", (issue) => issue.rawInput],
  ["normalizedSummary", (issue) => issue.normalizedSummary],
  ["symptomSummary", (issue) => issue.symptomSummary],
  ["suspectedDirections", (issue) => issue.suspectedDirections],
  ["suggestedActions", (issue) => issue.suggestedActions],
  ["tags", (issue) => issue.tags],
];

const RECORD_SEARCH_FIELDS = [
  ["rawText", (record) => record.rawText],
  ["polishedText", (record) => record.polishedText],
  ["aiExtractedSignals", (record) => record.aiExtractedSignals],
];

const ARCHIVE_SEARCH_FIELDS = [
  ["fileName", (archive) => archive.fileName],
  ["markdownContent", (archive) => archive.markdownContent],
];

const ERROR_ENTRY_SEARCH_FIELDS = [
  ["errorCode", (entry) => entry.errorCode],
  ["title", (entry) => entry.title],
  ["category", (entry) => entry.category],
  ["symptom", (entry) => entry.symptom],
  ["rootCause", (entry) => entry.rootCause],
  ["resolution", (entry) => entry.resolution],
  ["prevention", (entry) => entry.prevention],
];

function normalizeSearchQuery(query) {
  if (typeof query !== "string") {
    throw createStorageError("search query must be a string", "BAD_REQUEST");
  }
  const normalized = query.trim();
  if (normalized.length === 0) {
    throw createStorageError("search query is required", "BAD_REQUEST");
  }
  if (normalized.length > 120) {
    throw createStorageError("search query must be at most 120 characters", "BAD_REQUEST");
  }
  return normalized;
}

function normalizeSearchLimit(limit) {
  if (limit === undefined || limit === null || limit === "") {
    return SEARCH_RESULT_LIMIT_DEFAULT;
  }
  const parsed = Number(limit);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw createStorageError("search limit must be a positive integer", "BAD_REQUEST");
  }
  return Math.min(parsed, SEARCH_RESULT_LIMIT_MAX);
}

function normalizeSearchKind(kind) {
  if (kind === undefined || kind === null || kind === "") {
    return "all";
  }
  if (!SEARCH_RESULT_KINDS.has(kind)) {
    throw createStorageError("search kind must be all, issue, record, archive, or error_entry", "BAD_REQUEST");
  }
  return kind;
}

function normalizeSearchStatus(status) {
  if (status === undefined || status === null || status === "") {
    return "all";
  }
  if (status !== "all" && !ISSUE_STATUSES.has(status)) {
    throw createStorageError("search status must be all or a valid issue status", "BAD_REQUEST");
  }
  return status;
}

function normalizeSearchTag(tag) {
  if (tag === undefined || tag === null) {
    return "";
  }
  if (typeof tag !== "string") {
    throw createStorageError("search tag must be a string", "BAD_REQUEST");
  }
  const normalized = normalizeTagList(tag.split(/[,，]/));
  if (normalized.some((value) => value.length > 40)) {
    throw createStorageError("each search tag must be at most 40 characters", "BAD_REQUEST");
  }
  return normalized.join(",");
}

function searchTagFilterTokens(tag) {
  return normalizeTagList(tag.split(/[,，]/)).map((value) => value.toLocaleLowerCase());
}

function normalizeSearchDate(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  if (typeof value !== "string" || !SEARCH_DATE_FILTER_PATTERN.test(value)) {
    throw createStorageError(`${fieldName} must be YYYY-MM-DD`, "BAD_REQUEST");
  }
  return value;
}

function normalizeSearchFilters(options) {
  const filters = {
    kind: normalizeSearchKind(options.kind),
    status: normalizeSearchStatus(options.status),
    tag: normalizeSearchTag(options.tag),
    from: normalizeSearchDate(options.from, "search from"),
    to: normalizeSearchDate(options.to, "search to"),
  };
  if (filters.from && filters.to && filters.from > filters.to) {
    throw createStorageError("search from must be before or equal to search to", "BAD_REQUEST");
  }
  return filters;
}

function escapeLikeValue(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function textFromValue(value) {
  if (Array.isArray(value)) {
    return value.map(textFromValue).filter(Boolean).join(" ");
  }
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function compactText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function createSearchSnippet(text, query) {
  const compacted = compactText(text);
  if (compacted.length <= 160) {
    return compacted;
  }
  const normalizedText = compacted.toLocaleLowerCase();
  const normalizedQuery = query.toLocaleLowerCase();
  const matchIndex = normalizedText.indexOf(normalizedQuery);
  const start = matchIndex < 0 ? 0 : Math.max(0, matchIndex - 60);
  const end = Math.min(compacted.length, start + 160);
  return `${start > 0 ? "..." : ""}${compacted.slice(start, end)}${end < compacted.length ? "..." : ""}`;
}

function findMatchedFields(payload, fields, query) {
  const normalizedQuery = query.toLocaleLowerCase();
  const matchedFields = [];
  let snippet = "";
  for (const [name, getter] of fields) {
    const text = textFromValue(getter(payload));
    if (text.toLocaleLowerCase().includes(normalizedQuery)) {
      matchedFields.push(name);
      if (!snippet) {
        snippet = createSearchSnippet(text, query);
      }
    }
  }
  return { matchedFields, snippet };
}

function timestampOfSearchResult(item) {
  return item.updatedAt ?? item.generatedAt ?? item.createdAt ?? "";
}

function datePartOfSearchResult(item) {
  return timestampOfSearchResult(item).slice(0, 10);
}

function matchesSearchFilters(item, filters) {
  if (filters.kind !== "all" && item.kind !== filters.kind) {
    return false;
  }
  if (filters.status !== "all" && item.status !== filters.status) {
    return false;
  }
  if (filters.tag) {
    const requiredTags = searchTagFilterTokens(filters.tag);
    const tags = normalizeTagList(item.tags).map((tag) => tag.toLocaleLowerCase());
    if (!requiredTags.every((requiredTag) => tags.includes(requiredTag))) {
      return false;
    }
  }
  const datePart = datePartOfSearchResult(item);
  if (filters.from && datePart < filters.from) {
    return false;
  }
  if (filters.to && datePart > filters.to) {
    return false;
  }
  return true;
}

function pushSearchResult(items, item, filters) {
  if (matchesSearchFilters(item, filters)) {
    items.push(item);
  }
}

export function createSearchOps({ db, lookups }) {
  return {
    search(workspaceId, options = {}) {
      lookups.requireWorkspace(workspaceId);
      const query = normalizeSearchQuery(options.query);
      const limit = normalizeSearchLimit(options.limit);
      const filters = normalizeSearchFilters(options);
      const likePattern = `%${escapeLikeValue(query)}%`;
      const items = [];

      const issueRows = db
        .prepare(
          `SELECT payload_json FROM issues
           WHERE workspace_id = ? AND payload_json LIKE ? ESCAPE '\\'
           ORDER BY updated_at DESC
           LIMIT ?`,
        )
        .all(workspaceId, likePattern, limit);
      for (const row of issueRows) {
        const issue = parsePayload(row);
        const tags = normalizeTagList(issue.tags);
        const match = findMatchedFields(issue, ISSUE_SEARCH_FIELDS, query);
        if (match.matchedFields.length === 0) continue;
        pushSearchResult(items, {
          kind: "issue",
          id: issue.id,
          issueId: issue.id,
          title: issue.title,
          matchedFields: match.matchedFields,
          snippet: match.snippet,
          status: issue.status,
          tags,
          createdAt: issue.createdAt,
          updatedAt: issue.updatedAt,
        }, filters);
      }

      const recordRows = db
        .prepare(
          `SELECT payload_json FROM records
           WHERE workspace_id = ? AND payload_json LIKE ? ESCAPE '\\'
           ORDER BY created_at DESC
           LIMIT ?`,
        )
        .all(workspaceId, likePattern, limit);
      for (const row of recordRows) {
        const record = parsePayload(row);
        const match = findMatchedFields(record, RECORD_SEARCH_FIELDS, query);
        if (match.matchedFields.length === 0) continue;
        const sourceIssue = lookups.requireIssue(workspaceId, record.issueId);
        const tags = normalizeTagList(sourceIssue.tags);
        pushSearchResult(items, {
          kind: "record",
          id: record.id,
          issueId: record.issueId,
          title: `排查记录：${record.issueId}`,
          matchedFields: match.matchedFields,
          snippet: match.snippet,
          status: sourceIssue.status,
          tags,
          recordType: record.type,
          createdAt: record.createdAt,
        }, filters);
      }

      const archiveRows = db
        .prepare(
          `SELECT archives.payload_json AS payload_json FROM archives
           JOIN issues ON issues.workspace_id = archives.workspace_id AND issues.id = archives.issue_id
           WHERE archives.workspace_id = ?
             AND (archives.payload_json LIKE ? ESCAPE '\\' OR issues.payload_json LIKE ? ESCAPE '\\')
           ORDER BY archives.generated_at DESC
           LIMIT ?`,
        )
        .all(workspaceId, likePattern, likePattern, limit);
      for (const row of archiveRows) {
        const archive = parsePayload(row);
        const sourceIssue = lookups.requireIssue(workspaceId, archive.issueId);
        const tags = normalizeTagList(sourceIssue.tags);
        const match = findMatchedFields(
          { ...archive, tags },
          [...ARCHIVE_SEARCH_FIELDS, ["tags", (payload) => payload.tags]],
          query,
        );
        if (match.matchedFields.length === 0) continue;
        pushSearchResult(items, {
          kind: "archive",
          id: archive.fileName,
          issueId: archive.issueId,
          title: archive.fileName,
          matchedFields: match.matchedFields,
          snippet: match.snippet,
          status: sourceIssue.status,
          tags,
          fileName: archive.fileName,
          generatedAt: archive.generatedAt,
        }, filters);
      }

      const errorEntryRows = db
        .prepare(
          `SELECT error_entries.payload_json AS payload_json FROM error_entries
           JOIN issues ON issues.workspace_id = error_entries.workspace_id AND issues.id = error_entries.source_issue_id
           WHERE error_entries.workspace_id = ?
             AND (error_entries.payload_json LIKE ? ESCAPE '\\' OR issues.payload_json LIKE ? ESCAPE '\\')
           ORDER BY error_entries.updated_at DESC
           LIMIT ?`,
        )
        .all(workspaceId, likePattern, likePattern, limit);
      for (const row of errorEntryRows) {
        const entry = parsePayload(row);
        const sourceIssue = lookups.requireIssue(workspaceId, entry.sourceIssueId);
        const tags = mergeTags(sourceIssue.tags, entry.tags);
        const match = findMatchedFields(
          { ...entry, tags },
          [...ERROR_ENTRY_SEARCH_FIELDS, ["tags", (payload) => payload.tags]],
          query,
        );
        if (match.matchedFields.length === 0) continue;
        pushSearchResult(items, {
          kind: "error_entry",
          id: entry.id,
          issueId: entry.sourceIssueId,
          title: entry.title,
          matchedFields: match.matchedFields,
          snippet: match.snippet,
          status: sourceIssue.status,
          tags,
          errorCode: entry.errorCode,
          category: entry.category,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        }, filters);
      }

      items.sort((a, b) => {
        const left = timestampOfSearchResult(a);
        const right = timestampOfSearchResult(b);
        return left < right ? 1 : left > right ? -1 : a.id.localeCompare(b.id);
      });

      return {
        query,
        filters,
        items: items.slice(0, limit),
      };
    },
  };
}
