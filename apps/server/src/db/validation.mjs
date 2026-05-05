// apps/server/src/db/validation.mjs
// TECH-10: payload normalizers + assertion helpers. Imported by per-entity
// ops modules (and by closeoutIssue which has to validate three payloads
// inside its transaction). No SQLite dependency.

import {
  ARCHIVE_FILE_NAME_PATTERN,
  ARCHIVE_GENERATED_BY,
  CHANGED_FILE_STATUSES,
  DATETIME_WITH_OFFSET_PATTERN,
  ERROR_CODE_PATTERN,
  FORM_DRAFT_SCOPE_PATTERN,
  INVESTIGATION_RECORD_TYPES,
  ISSUE_SEVERITIES,
  ISSUE_STATUSES,
} from "./constants.mjs";
import { createValidationError } from "./storage-error.mjs";

export function assertObject(payload, message) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw createValidationError(message);
  }
}

export function assertString(value, fieldName, options = {}) {
  if (typeof value !== "string") {
    throw createValidationError(`${fieldName} must be a string`);
  }
  if (options.allowEmpty !== true && value.trim().length === 0) {
    throw createValidationError(`${fieldName} is required`);
  }
}

export function assertBoolean(value, fieldName) {
  if (typeof value !== "boolean") {
    throw createValidationError(`${fieldName} must be a boolean`);
  }
}

export function assertEnum(value, fieldName, allowed) {
  assertString(value, fieldName);
  if (!allowed.has(value)) {
    throw createValidationError(`${fieldName} must be one of ${Array.from(allowed).join(", ")}`);
  }
}

export function assertArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw createValidationError(`${fieldName} must be an array`);
  }
}

export function assertStringArray(value, fieldName) {
  assertArray(value, fieldName);
  value.forEach((item, index) => {
    assertString(item, `${fieldName}[${index}]`, { allowEmpty: true });
  });
}

export function normalizeTagList(tags) {
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

export function normalizeTagPayload(value, fieldName) {
  if (value !== undefined) {
    assertStringArray(value, fieldName);
  }
  return normalizeTagList(value);
}

export function mergeTags(...tagGroups) {
  return normalizeTagList(tagGroups.flatMap((tags) => (Array.isArray(tags) ? tags : [])));
}

export function assertDatetime(value, fieldName) {
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

export function assertWorkspaceAlias(workspaceId, payload, entityName) {
  if (payload.workspaceId === undefined) return;
  assertString(payload.workspaceId, `${entityName}.workspaceId`);
  if (payload.workspaceId !== workspaceId) {
    throw createValidationError(`${entityName}.workspaceId must match workspaceId`);
  }
}

export function assertProjectIdMatchesWorkspace(workspaceId, payload, entityName) {
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

export function assertRepoSnapshot(value, fieldName) {
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

export function normalizeWorkspacePayload(payload) {
  assertObject(payload, "workspace payload must be an object");
  assertString(payload.name, "workspace.name");
  const name = payload.name.trim();
  if (name.length > 80) {
    throw createValidationError("workspace.name must be at most 80 characters");
  }
  return { name };
}

export function normalizeIssuePayload(workspaceId, payload) {
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

export function normalizeRecordPayload(workspaceId, issueId, payload) {
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

export function normalizeArchivePayload(workspaceId, payload) {
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

export function normalizeErrorEntryPayload(workspaceId, payload) {
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

export function assertFormDraftScopePart(value, fieldName) {
  assertString(value, fieldName);
  if (value.length > 160) {
    throw createValidationError(`${fieldName} must be at most 160 characters`);
  }
  if (!FORM_DRAFT_SCOPE_PATTERN.test(value)) {
    throw createValidationError(`${fieldName} contains unsupported characters`);
  }
}

export function normalizeFormDraftPayload(workspaceId, formKind, itemId, payload) {
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
