import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const SCHEMA_VERSION = 3;
export const CLOSEOUT_STATES = new Set(["pending", "completed", "failed"]);
export const DEFAULT_WORKSPACE = {
  id: "workspace-26-r1",
  name: "26年 R1",
  description: "",
  isDefault: true,
};

const ISSUE_SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const ISSUE_STATUSES = new Set(["open", "investigating", "resolved", "archived", "needs_manual_review"]);
const INVESTIGATION_RECORD_TYPES = new Set([
  "observation",
  "hypothesis",
  "action",
  "result",
  "conclusion",
  "note",
]);
const CHANGED_FILE_STATUSES = new Set(["added", "modified", "deleted", "renamed", "untracked"]);
const ARCHIVE_GENERATED_BY = new Set(["ai", "manual", "hybrid"]);
const ARCHIVE_FILE_NAME_PATTERN = /^\d{4}-\d{2}-\d{2}_[a-z0-9-]+\.md$/;
const ERROR_CODE_PATTERN = /^DBG-\d{8}-\d{3}$/;
const FORM_DRAFT_SCOPE_PATTERN = /^[A-Za-z0-9._:-]+$/;
const DATETIME_WITH_OFFSET_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;

function classifyDbPath(dbPath) {
  const normalized = dbPath.replaceAll("\\", "/");
  if (normalized.includes("/.runtime/")) return "app_runtime";
  if (normalized.includes("/shared/data/")) return "deploy_shared_data";
  if (normalized.includes("/tmp/")) return "temporary";
  return "custom";
}

export function normalizeDefaultWorkspace(overrides = {}) {
  return {
    ...DEFAULT_WORKSPACE,
    ...overrides,
    description: overrides.description ?? DEFAULT_WORKSPACE.description,
    isDefault: true,
  };
}

function createValidationError(message) {
  const error = new Error(message);
  error.code = "VALIDATION_ERROR";
  return error;
}

function assertObject(payload, message) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw createValidationError(message);
  }
}

function assertString(value, fieldName, options = {}) {
  if (typeof value !== "string") {
    throw createValidationError(`${fieldName} must be a string`);
  }
  if (options.allowEmpty !== true && value.trim().length === 0) {
    throw createValidationError(`${fieldName} is required`);
  }
}

function assertBoolean(value, fieldName) {
  if (typeof value !== "boolean") {
    throw createValidationError(`${fieldName} must be a boolean`);
  }
}

function assertEnum(value, fieldName, allowed) {
  assertString(value, fieldName);
  if (!allowed.has(value)) {
    throw createValidationError(`${fieldName} must be one of ${Array.from(allowed).join(", ")}`);
  }
}

function assertArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw createValidationError(`${fieldName} must be an array`);
  }
}

function assertStringArray(value, fieldName) {
  assertArray(value, fieldName);
  value.forEach((item, index) => {
    assertString(item, `${fieldName}[${index}]`, { allowEmpty: true });
  });
}

function normalizeTagList(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const normalized = [];
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const trimmed = tag.trim();
    const key = trimmed.toLocaleLowerCase();
    if (trimmed.length === 0 || seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);
  }
  return normalized;
}

function normalizeTagPayload(value, fieldName) {
  if (value !== undefined) {
    assertStringArray(value, fieldName);
  }
  return normalizeTagList(value);
}

function mergeTags(...tagGroups) {
  return normalizeTagList(tagGroups.flatMap((tags) => (Array.isArray(tags) ? tags : [])));
}

function assertDatetime(value, fieldName) {
  assertString(value, fieldName);
  const match = DATETIME_WITH_OFFSET_PATTERN.exec(value);
  if (!match) {
    throw createValidationError(`${fieldName} must be an ISO datetime with timezone offset`);
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetText, offsetHourText, offsetMinuteText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = offsetHourText === undefined ? 0 : Number(offsetHourText);
  const offsetMinute = offsetMinuteText === undefined ? 0 : Number(offsetMinuteText);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  const validDate =
    calendar.getUTCFullYear() === year &&
    calendar.getUTCMonth() === month - 1 &&
    calendar.getUTCDate() === day;
  const validTime =
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 59 &&
    offsetHour >= 0 &&
    offsetHour <= 23 &&
    offsetMinute >= 0 &&
    offsetMinute <= 59;
  if (!validDate || !validTime || Number.isNaN(Date.parse(value))) {
    throw createValidationError(`${fieldName} must be a valid ISO datetime with timezone offset`);
  }
  if (offsetText !== "Z" && (offsetHourText === undefined || offsetMinuteText === undefined)) {
    throw createValidationError(`${fieldName} must include timezone offset`);
  }
}

function assertWorkspaceAlias(workspaceId, payload, entityName) {
  if (payload.workspaceId === undefined) return;
  assertString(payload.workspaceId, `${entityName}.workspaceId`);
  if (payload.workspaceId !== workspaceId) {
    throw createValidationError(`${entityName}.workspaceId must match workspaceId`);
  }
}

function assertProjectIdMatchesWorkspace(workspaceId, payload, entityName) {
  assertString(payload.projectId, `${entityName}.projectId`);
  if (payload.projectId !== workspaceId) {
    throw createValidationError(`${entityName}.projectId must match workspaceId`);
  }
  assertWorkspaceAlias(workspaceId, payload, entityName);
}

function assertChangedFile(value, fieldName) {
  assertObject(value, `${fieldName} must be an object`);
  assertString(value.path, `${fieldName}.path`);
  assertEnum(value.status, `${fieldName}.status`, CHANGED_FILE_STATUSES);
}

function assertRecentCommit(value, fieldName) {
  assertObject(value, `${fieldName} must be an object`);
  assertString(value.hash, `${fieldName}.hash`);
  assertString(value.author, `${fieldName}.author`, { allowEmpty: true });
  assertString(value.message, `${fieldName}.message`, { allowEmpty: true });
  assertDatetime(value.timestamp, `${fieldName}.timestamp`);
}

function assertRepoSnapshot(value, fieldName) {
  assertObject(value, `${fieldName} must be an object`);
  assertString(value.branch, `${fieldName}.branch`);
  assertString(value.headCommitHash, `${fieldName}.headCommitHash`);
  assertString(value.headCommitMessage, `${fieldName}.headCommitMessage`, { allowEmpty: true });
  assertBoolean(value.hasUncommittedChanges, `${fieldName}.hasUncommittedChanges`);
  assertArray(value.changedFiles, `${fieldName}.changedFiles`);
  value.changedFiles.forEach((item, index) => {
    assertChangedFile(item, `${fieldName}.changedFiles[${index}]`);
  });
  assertArray(value.recentCommits, `${fieldName}.recentCommits`);
  value.recentCommits.forEach((item, index) => {
    assertRecentCommit(item, `${fieldName}.recentCommits[${index}]`);
  });
  assertDatetime(value.capturedAt, `${fieldName}.capturedAt`);
}

function normalizeWorkspacePayload(payload) {
  assertObject(payload, "workspace payload must be an object");
  assertString(payload.name, "workspace.name");
  const name = payload.name.trim();
  if (name.length > 80) {
    const error = new Error("workspace.name must be at most 80 characters");
    error.code = "VALIDATION_ERROR";
    throw error;
  }
  return { name };
}

function slugifyWorkspaceName(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
  return slug.length > 0 ? slug : "project";
}

function generateWorkspaceId(name) {
  const timestamp = Date.now().toString(36);
  const shortId = randomUUID().replaceAll("-", "").slice(0, 8);
  return `workspace-${slugifyWorkspaceName(name)}-${timestamp}-${shortId}`;
}

function isUniqueConstraintError(error) {
  return error && typeof error === "object" && String(error.message).includes("UNIQUE");
}

function normalizeIssuePayload(workspaceId, payload) {
  assertObject(payload, "issue payload must be an object");
  assertString(payload.id, "issue.id");
  assertProjectIdMatchesWorkspace(workspaceId, payload, "issue");
  assertString(payload.title, "issue.title");
  assertString(payload.rawInput, "issue.rawInput", { allowEmpty: true });
  assertString(payload.normalizedSummary, "issue.normalizedSummary", { allowEmpty: true });
  assertString(payload.symptomSummary, "issue.symptomSummary", { allowEmpty: true });
  assertStringArray(payload.suspectedDirections, "issue.suspectedDirections");
  assertStringArray(payload.suggestedActions, "issue.suggestedActions");
  assertEnum(payload.status, "issue.status", ISSUE_STATUSES);
  assertEnum(payload.severity, "issue.severity", ISSUE_SEVERITIES);
  const tags = normalizeTagPayload(payload.tags, "issue.tags");
  assertRepoSnapshot(payload.repoSnapshot, "issue.repoSnapshot");
  assertStringArray(payload.relatedFiles, "issue.relatedFiles");
  assertStringArray(payload.relatedCommits, "issue.relatedCommits");
  assertStringArray(payload.relatedHistoricalIssueIds, "issue.relatedHistoricalIssueIds");
  assertDatetime(payload.createdAt, "issue.createdAt");
  assertDatetime(payload.updatedAt, "issue.updatedAt");

  return {
    ...payload,
    tags,
  };
}

function normalizeRecordPayload(workspaceId, issueId, payload) {
  assertObject(payload, "record payload must be an object");
  assertString(payload.id, "record.id");
  assertString(payload.issueId, "record.issueId");
  assertWorkspaceAlias(workspaceId, payload, "record");
  if (payload.projectId !== undefined) {
    assertProjectIdMatchesWorkspace(workspaceId, payload, "record");
  }
  assertEnum(payload.type, "record.type", INVESTIGATION_RECORD_TYPES);
  assertString(payload.rawText, "record.rawText", { allowEmpty: true });
  assertString(payload.polishedText, "record.polishedText", { allowEmpty: true });
  assertStringArray(payload.aiExtractedSignals, "record.aiExtractedSignals");
  assertStringArray(payload.linkedFiles, "record.linkedFiles");
  assertStringArray(payload.linkedCommits, "record.linkedCommits");
  assertDatetime(payload.createdAt, "record.createdAt");
  if (payload.issueId !== issueId) {
    throw createValidationError("record.issueId must match path issueId");
  }
  return {
    ...payload,
    workspaceId,
  };
}

function normalizeArchivePayload(workspaceId, payload) {
  assertObject(payload, "archive payload must be an object");
  assertString(payload.issueId, "archive.issueId");
  assertProjectIdMatchesWorkspace(workspaceId, payload, "archive");
  assertString(payload.fileName, "archive.fileName");
  if (!ARCHIVE_FILE_NAME_PATTERN.test(payload.fileName)) {
    throw createValidationError("archive.fileName must match YYYY-MM-DD_<slug>.md");
  }
  assertString(payload.filePath, "archive.filePath");
  assertString(payload.markdownContent, "archive.markdownContent", { allowEmpty: true });
  assertEnum(payload.generatedBy, "archive.generatedBy", ARCHIVE_GENERATED_BY);
  assertDatetime(payload.generatedAt, "archive.generatedAt");
  return payload;
}

function normalizeErrorEntryPayload(workspaceId, payload) {
  assertObject(payload, "errorEntry payload must be an object");
  assertString(payload.id, "errorEntry.id");
  assertProjectIdMatchesWorkspace(workspaceId, payload, "errorEntry");
  assertString(payload.sourceIssueId, "errorEntry.sourceIssueId");
  assertString(payload.errorCode, "errorEntry.errorCode");
  if (!ERROR_CODE_PATTERN.test(payload.errorCode)) {
    throw createValidationError("errorEntry.errorCode must match DBG-YYYYMMDD-NNN");
  }
  assertString(payload.title, "errorEntry.title");
  assertString(payload.category, "errorEntry.category", { allowEmpty: true });
  assertString(payload.symptom, "errorEntry.symptom", { allowEmpty: true });
  assertString(payload.rootCause, "errorEntry.rootCause", { allowEmpty: true });
  assertString(payload.resolution, "errorEntry.resolution", { allowEmpty: true });
  assertString(payload.prevention, "errorEntry.prevention");
  const tags = normalizeTagPayload(payload.tags, "errorEntry.tags");
  assertStringArray(payload.relatedFiles, "errorEntry.relatedFiles");
  assertStringArray(payload.relatedCommits, "errorEntry.relatedCommits");
  assertString(payload.archiveFilePath, "errorEntry.archiveFilePath");
  assertDatetime(payload.createdAt, "errorEntry.createdAt");
  assertDatetime(payload.updatedAt, "errorEntry.updatedAt");
  return {
    ...payload,
    tags,
  };
}

function assertFormDraftScopePart(value, fieldName) {
  assertString(value, fieldName);
  if (value.length > 160) {
    throw createValidationError(`${fieldName} must be at most 160 characters`);
  }
  if (!FORM_DRAFT_SCOPE_PATTERN.test(value)) {
    throw createValidationError(`${fieldName} contains unsupported characters`);
  }
}

function normalizeFormDraftPayload(workspaceId, formKind, itemId, payload) {
  assertObject(payload, "formDraft payload must be an object");
  assertString(payload.workspaceId, "formDraft.workspaceId");
  if (payload.workspaceId !== workspaceId) {
    throw createValidationError("formDraft.workspaceId must match workspaceId");
  }
  assertString(payload.formKind, "formDraft.formKind");
  assertString(payload.itemId, "formDraft.itemId");
  if (payload.formKind !== formKind || payload.itemId !== itemId) {
    throw createValidationError("formDraft scope must match path");
  }
  assertFormDraftScopePart(payload.formKind, "formDraft.formKind");
  assertFormDraftScopePart(payload.itemId, "formDraft.itemId");
  assertString(payload.payloadJson, "formDraft.payloadJson", { allowEmpty: true });
  try {
    JSON.parse(payload.payloadJson);
  } catch {
    throw createValidationError("formDraft.payloadJson must be valid JSON");
  }
  assertDatetime(payload.updatedAt, "formDraft.updatedAt");
  return {
    workspaceId,
    formKind,
    itemId,
    payloadJson: payload.payloadJson,
    updatedAt: payload.updatedAt,
  };
}

function parsePayload(row) {
  return JSON.parse(row.payload_json);
}

function createStorageError(message, code = "STORAGE_ERROR") {
  const error = new Error(message);
  error.code = code;
  return error;
}

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

export function createProbeFlashDatabase(dbPath, options = {}) {
  const defaultWorkspace = normalizeDefaultWorkspace(options.defaultWorkspace);
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA user_version = ${SCHEMA_VERSION};

    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_single_default
    ON workspaces (is_default)
    WHERE is_default = 1;

    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      title TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      closeout_state TEXT,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_issues_workspace_status_created
    ON issues (workspace_id, status, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_issues_workspace_closeout_state
    ON issues (workspace_id, closeout_state)
    WHERE closeout_state IS NOT NULL;

    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      issue_id TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT,
      FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_records_issue_created
    ON records (issue_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS archives (
      workspace_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      issue_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (workspace_id, file_name),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT,
      FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_archives_workspace_generated
    ON archives (workspace_id, generated_at DESC);

    CREATE TABLE IF NOT EXISTS error_entries (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      source_issue_id TEXT NOT NULL,
      error_code TEXT NOT NULL,
      category TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT,
      FOREIGN KEY (source_issue_id) REFERENCES issues(id) ON DELETE RESTRICT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_error_entries_workspace_error_code
    ON error_entries (workspace_id, error_code);

    CREATE TABLE IF NOT EXISTS form_drafts (
      workspace_id TEXT NOT NULL,
      form_kind TEXT NOT NULL,
      item_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (workspace_id, form_kind, item_id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_form_drafts_workspace_updated
    ON form_drafts (workspace_id, updated_at DESC);
  `);

  // Idempotent additive migration: pre-existing dbs (created before SCHEMA_VERSION 3)
  // need closeout_state column added. CREATE TABLE IF NOT EXISTS won't add columns
  // to an existing table, so we inspect via PRAGMA table_info and ALTER TABLE if missing.
  const issueColumns = db.prepare(`PRAGMA table_info('issues')`).all();
  if (!issueColumns.some((column) => column.name === "closeout_state")) {
    db.exec(`ALTER TABLE issues ADD COLUMN closeout_state TEXT`);
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_issues_workspace_closeout_state
       ON issues (workspace_id, closeout_state)
       WHERE closeout_state IS NOT NULL`,
    );
  }

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO schema_meta (key, value, updated_at)
    VALUES ('schema_version', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(String(SCHEMA_VERSION), now);

  db.prepare(`
    UPDATE workspaces
    SET is_default = 0, updated_at = ?
    WHERE id <> ? AND is_default = 1
  `).run(now, defaultWorkspace.id);

  db.prepare(`
    INSERT INTO workspaces (id, name, description, is_default, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      is_default = 1,
      updated_at = excluded.updated_at
  `).run(
    defaultWorkspace.id,
    defaultWorkspace.name,
    defaultWorkspace.description,
    now,
    now,
  );

  function getWorkspace(workspaceId) {
    return db
      .prepare(
        `SELECT id, name, description, is_default, created_at, updated_at FROM workspaces WHERE id = ?`,
      )
      .get(workspaceId);
  }

  function requireWorkspace(workspaceId) {
    const row = getWorkspace(workspaceId);
    if (!row) {
      throw createStorageError(`workspace ${workspaceId} not found`, "NOT_FOUND");
    }
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isDefault: row.is_default === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function readIssueRow(workspaceId, issueId) {
    return db
      .prepare(
        `SELECT id, workspace_id, payload_json, closeout_state FROM issues WHERE workspace_id = ? AND id = ?`,
      )
      .get(workspaceId, issueId);
  }

  function requireIssue(workspaceId, issueId) {
    const row = readIssueRow(workspaceId, issueId);
    if (!row) {
      throw createStorageError(`issue ${issueId} not found`, "NOT_FOUND");
    }
    return parsePayload(row);
  }

  function getIssueResponse(workspaceId, issueId) {
    const row = readIssueRow(workspaceId, issueId);
    if (!row) {
      throw createStorageError(`issue ${issueId} not found`, "NOT_FOUND");
    }
    return { ...parsePayload(row), closeoutState: row.closeout_state ?? null };
  }

  return {
    dbPath,
    close() {
      db.close();
    },
    health() {
      const workspace = requireWorkspace(defaultWorkspace.id);
      return {
        status: "ok",
        serverTime: new Date().toISOString(),
        schemaVersion: SCHEMA_VERSION,
        storage: {
          kind: "sqlite",
          ready: true,
          dbPathClass: classifyDbPath(dbPath),
          dbFileName: basename(dbPath),
        },
        workspace: {
          defaultWorkspaceId: workspace.id,
          defaultWorkspaceName: workspace.name,
          seeded: true,
        },
      };
    },
    search(workspaceId, options = {}) {
      requireWorkspace(workspaceId);
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
        const sourceIssue = requireIssue(workspaceId, record.issueId);
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
        const sourceIssue = requireIssue(workspaceId, archive.issueId);
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
        const sourceIssue = requireIssue(workspaceId, entry.sourceIssueId);
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
    listWorkspaces() {
      const rows = db
        .prepare(
          `SELECT id, name, description, is_default, created_at, updated_at
           FROM workspaces
           ORDER BY is_default DESC, name ASC`,
        )
        .all();
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        isDefault: row.is_default === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },
    getWorkspace(workspaceId) {
      return requireWorkspace(workspaceId);
    },
    createWorkspace(payload) {
      const workspace = normalizeWorkspacePayload(structuredClone(payload));
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const id = generateWorkspaceId(workspace.name);
        const now = new Date().toISOString();
        try {
          db.prepare(`
            INSERT INTO workspaces (id, name, description, is_default, created_at, updated_at)
            VALUES (?, ?, '', 0, ?, ?)
          `).run(id, workspace.name, now, now);
          return requireWorkspace(id);
        } catch (error) {
          if (isUniqueConstraintError(error)) {
            continue;
          }
          throw error;
        }
      }
      throw createStorageError("workspace id conflict after retries", "CONFLICT");
    },
    listIssues(workspaceId, statusFilter = "active") {
      requireWorkspace(workspaceId);
      let sql = `
        SELECT id, title, severity, status, created_at, updated_at, closeout_state
        FROM issues
        WHERE workspace_id = ?
      `;
      if (statusFilter === "active") {
        sql += ` AND status <> 'archived'`;
      } else if (statusFilter === "archived") {
        sql += ` AND status = 'archived'`;
      }
      sql += ` ORDER BY created_at DESC`;
      const rows = db.prepare(sql).all(workspaceId);
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        severity: row.severity,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        closeoutState: row.closeout_state ?? null,
      }));
    },
    createIssue(workspaceId, payload) {
      requireWorkspace(workspaceId);
      const issue = normalizeIssuePayload(workspaceId, structuredClone(payload));
      try {
        db.prepare(`
          INSERT INTO issues (id, workspace_id, title, severity, status, created_at, updated_at, payload_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          issue.id,
          workspaceId,
          issue.title,
          issue.severity,
          issue.status,
          issue.createdAt,
          issue.updatedAt,
          JSON.stringify(issue),
        );
      } catch (error) {
        if (error && typeof error === "object" && String(error.message).includes("UNIQUE")) {
          throw createStorageError(`issue ${issue.id} already exists`, "CONFLICT");
        }
        throw error;
      }
      return issue;
    },
    getIssue(workspaceId, issueId) {
      requireWorkspace(workspaceId);
      return getIssueResponse(workspaceId, issueId);
    },
    updateIssue(workspaceId, issueId, payload) {
      requireWorkspace(workspaceId);
      const issue = normalizeIssuePayload(workspaceId, structuredClone(payload));
      if (issue.id !== issueId) {
        throw createStorageError("issue.id must match path issueId", "VALIDATION_ERROR");
      }
      requireIssue(workspaceId, issueId);
      db.prepare(`
        UPDATE issues
        SET title = ?, severity = ?, status = ?, created_at = ?, updated_at = ?, payload_json = ?
        WHERE workspace_id = ? AND id = ?
      `).run(
        issue.title,
        issue.severity,
        issue.status,
        issue.createdAt,
        issue.updatedAt,
        JSON.stringify(issue),
        workspaceId,
        issueId,
      );
      return issue;
    },
    closeoutIssue(workspaceId, issueId, payload) {
      // TECH-01: atomically write ArchiveDocument + ErrorEntry + archived Issue inside a
      // single SQLite BEGIN IMMEDIATE / COMMIT / ROLLBACK transaction.
      //
      // Marker lifecycle on issues.closeout_state (additive, autocommitted):
      //   pending  → set OUTSIDE the transaction so a mid-flight crash leaves the row
      //              flagged for TECH-02 startup-side recovery scan
      //   completed → set INSIDE the transaction at the issue UPDATE step (committed atomically)
      //   failed   → set OUTSIDE the transaction after a caught failure + ROLLBACK so the
      //              flag survives the rolled-back txn
      requireWorkspace(workspaceId);
      assertObject(payload, "closeout payload must be an object");
      assertObject(payload.archive, "closeout.archive must be an object");
      assertObject(payload.errorEntry, "closeout.errorEntry must be an object");
      assertObject(payload.issue, "closeout.issue must be an object");

      const archive = normalizeArchivePayload(workspaceId, structuredClone(payload.archive));
      const errorEntry = normalizeErrorEntryPayload(workspaceId, structuredClone(payload.errorEntry));
      const issue = normalizeIssuePayload(workspaceId, structuredClone(payload.issue));

      if (issue.id !== issueId) {
        throw createStorageError("closeout.issue.id must match path issueId", "VALIDATION_ERROR");
      }
      if (archive.issueId !== issueId) {
        throw createStorageError(
          "closeout.archive.issueId must match path issueId",
          "VALIDATION_ERROR",
        );
      }
      if (errorEntry.sourceIssueId !== issueId) {
        throw createStorageError(
          "closeout.errorEntry.sourceIssueId must match path issueId",
          "VALIDATION_ERROR",
        );
      }
      if (issue.status !== "archived") {
        throw createStorageError("closeout.issue.status must be archived", "VALIDATION_ERROR");
      }

      // Confirm the target issue exists before touching any state. Throws NOT_FOUND if missing.
      requireIssue(workspaceId, issueId);

      // Pre-step (autocommit): mark the issue closeout_state = 'pending'. This must land on
      // disk OUTSIDE the upcoming transaction so that a crash mid-transaction leaves a
      // recoverable signal for TECH-02 (the rollback-on-recovery would otherwise erase any
      // marker written inside the transaction).
      db.prepare(
        `UPDATE issues SET closeout_state = 'pending' WHERE workspace_id = ? AND id = ?`,
      ).run(workspaceId, issueId);

      try {
        db.exec("BEGIN IMMEDIATE");

        try {
          db.prepare(`
            INSERT INTO archives (workspace_id, file_name, issue_id, file_path, generated_at, payload_json)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            workspaceId,
            archive.fileName,
            archive.issueId,
            archive.filePath,
            archive.generatedAt,
            JSON.stringify(archive),
          );
        } catch (error) {
          if (isUniqueConstraintError(error)) {
            throw createStorageError(`archive ${archive.fileName} already exists`, "CONFLICT");
          }
          throw error;
        }

        try {
          db.prepare(`
            INSERT INTO error_entries (
              id, workspace_id, source_issue_id, error_code, category, created_at, updated_at, payload_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            errorEntry.id,
            workspaceId,
            errorEntry.sourceIssueId,
            errorEntry.errorCode,
            errorEntry.category,
            errorEntry.createdAt,
            errorEntry.updatedAt,
            JSON.stringify(errorEntry),
          );
        } catch (error) {
          if (isUniqueConstraintError(error)) {
            throw createStorageError(`error entry conflict for ${errorEntry.id}`, "CONFLICT");
          }
          throw error;
        }

        db.prepare(`
          UPDATE issues
          SET title = ?, severity = ?, status = ?, created_at = ?, updated_at = ?, payload_json = ?, closeout_state = 'completed'
          WHERE workspace_id = ? AND id = ?
        `).run(
          issue.title,
          issue.severity,
          issue.status,
          issue.createdAt,
          issue.updatedAt,
          JSON.stringify(issue),
          workspaceId,
          issueId,
        );

        db.exec("COMMIT");
      } catch (error) {
        try {
          db.exec("ROLLBACK");
        } catch {
          // ROLLBACK can fail if no transaction is active (e.g. BEGIN itself failed).
          // In that case the autocommitted 'pending' marker still needs to be promoted
          // to 'failed' below; suppress secondary rollback errors.
        }
        try {
          db.prepare(
            `UPDATE issues SET closeout_state = 'failed' WHERE workspace_id = ? AND id = ?`,
          ).run(workspaceId, issueId);
        } catch {
          // If even this autocommit fails, closeout_state stays 'pending' and TECH-02
          // recovery scan will pick it up — losing 'failed' here is non-fatal.
        }
        throw error;
      }

      return {
        archive,
        errorEntry,
        issue: { ...issue, closeoutState: "completed" },
      };
    },
    listRecords(workspaceId, issueId) {
      requireWorkspace(workspaceId);
      requireIssue(workspaceId, issueId);
      const rows = db
        .prepare(
          `SELECT payload_json FROM records WHERE workspace_id = ? AND issue_id = ? ORDER BY created_at ASC`,
        )
        .all(workspaceId, issueId);
      return rows.map(parsePayload);
    },
    createRecord(workspaceId, issueId, payload) {
      requireWorkspace(workspaceId);
      requireIssue(workspaceId, issueId);
      const record = normalizeRecordPayload(workspaceId, issueId, structuredClone(payload));
      try {
        db.prepare(`
          INSERT INTO records (id, workspace_id, issue_id, type, created_at, payload_json)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          record.id,
          workspaceId,
          issueId,
          record.type,
          record.createdAt,
          JSON.stringify(record),
        );
      } catch (error) {
        if (error && typeof error === "object" && String(error.message).includes("UNIQUE")) {
          throw createStorageError(`record ${record.id} already exists`, "CONFLICT");
        }
        throw error;
      }
      return record;
    },
    listArchives(workspaceId) {
      requireWorkspace(workspaceId);
      const rows = db
        .prepare(
          `SELECT payload_json FROM archives WHERE workspace_id = ? ORDER BY generated_at DESC`,
        )
        .all(workspaceId);
      return rows.map(parsePayload);
    },
    createArchive(workspaceId, payload) {
      requireWorkspace(workspaceId);
      const archive = normalizeArchivePayload(workspaceId, structuredClone(payload));
      requireIssue(workspaceId, archive.issueId);
      try {
        db.prepare(`
          INSERT INTO archives (workspace_id, file_name, issue_id, file_path, generated_at, payload_json)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          workspaceId,
          archive.fileName,
          archive.issueId,
          archive.filePath,
          archive.generatedAt,
          JSON.stringify(archive),
        );
      } catch (error) {
        if (error && typeof error === "object" && String(error.message).includes("UNIQUE")) {
          throw createStorageError(`archive ${archive.fileName} already exists`, "CONFLICT");
        }
        throw error;
      }
      return archive;
    },
    getArchive(workspaceId, fileName) {
      requireWorkspace(workspaceId);
      const row = db
        .prepare(
          `SELECT payload_json FROM archives WHERE workspace_id = ? AND file_name = ?`,
        )
        .get(workspaceId, fileName);
      if (!row) {
        throw createStorageError(`archive ${fileName} not found`, "NOT_FOUND");
      }
      return parsePayload(row);
    },
    listErrorEntries(workspaceId) {
      requireWorkspace(workspaceId);
      const rows = db
        .prepare(
          `SELECT payload_json FROM error_entries WHERE workspace_id = ? ORDER BY created_at DESC`,
        )
        .all(workspaceId);
      return rows.map(parsePayload);
    },
    createErrorEntry(workspaceId, payload) {
      requireWorkspace(workspaceId);
      const entry = normalizeErrorEntryPayload(workspaceId, structuredClone(payload));
      requireIssue(workspaceId, entry.sourceIssueId);
      try {
        db.prepare(`
          INSERT INTO error_entries (
            id, workspace_id, source_issue_id, error_code, category, created_at, updated_at, payload_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          entry.id,
          workspaceId,
          entry.sourceIssueId,
          entry.errorCode,
          entry.category,
          entry.createdAt,
          entry.updatedAt,
          JSON.stringify(entry),
        );
      } catch (error) {
        if (error && typeof error === "object" && String(error.message).includes("UNIQUE")) {
          throw createStorageError(`error entry conflict for ${entry.id}`, "CONFLICT");
        }
        throw error;
      }
      return entry;
    },
    getErrorEntry(workspaceId, entryId) {
      requireWorkspace(workspaceId);
      const row = db
        .prepare(
          `SELECT payload_json FROM error_entries WHERE workspace_id = ? AND id = ?`,
        )
        .get(workspaceId, entryId);
      if (!row) {
        throw createStorageError(`error entry ${entryId} not found`, "NOT_FOUND");
      }
      return parsePayload(row);
    },
    getFormDraft(workspaceId, formKind, itemId) {
      requireWorkspace(workspaceId);
      assertFormDraftScopePart(formKind, "formDraft.formKind");
      assertFormDraftScopePart(itemId, "formDraft.itemId");
      const row = db
        .prepare(
          `SELECT workspace_id, form_kind, item_id, payload_json, updated_at
           FROM form_drafts
           WHERE workspace_id = ? AND form_kind = ? AND item_id = ?`,
        )
        .get(workspaceId, formKind, itemId);
      if (!row) return null;
      return {
        workspaceId: row.workspace_id,
        formKind: row.form_kind,
        itemId: row.item_id,
        payloadJson: row.payload_json,
        updatedAt: row.updated_at,
      };
    },
    saveFormDraft(workspaceId, formKind, itemId, payload) {
      requireWorkspace(workspaceId);
      assertFormDraftScopePart(formKind, "formDraft.formKind");
      assertFormDraftScopePart(itemId, "formDraft.itemId");
      const draft = normalizeFormDraftPayload(workspaceId, formKind, itemId, structuredClone(payload));
      db.prepare(`
        INSERT INTO form_drafts (workspace_id, form_kind, item_id, payload_json, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(workspace_id, form_kind, item_id) DO UPDATE SET
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
      `).run(
        workspaceId,
        formKind,
        itemId,
        draft.payloadJson,
        draft.updatedAt,
      );
      return draft;
    },
    deleteFormDraft(workspaceId, formKind, itemId) {
      requireWorkspace(workspaceId);
      assertFormDraftScopePart(formKind, "formDraft.formKind");
      assertFormDraftScopePart(itemId, "formDraft.itemId");
      db.prepare(
        `DELETE FROM form_drafts WHERE workspace_id = ? AND form_kind = ? AND item_id = ?`,
      ).run(workspaceId, formKind, itemId);
      return { cleared: true };
    },
  };
}
