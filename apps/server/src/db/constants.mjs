// apps/server/src/db/constants.mjs
// TECH-10: shared enum sets + literal patterns + schema/workspace constants. No
// runtime SQLite dependency, so safe to import from validation modules and
// per-entity ops alike.

export const SCHEMA_VERSION = 3;

export const CLOSEOUT_STATES = new Set(["pending", "completed", "failed"]);

export const DEFAULT_WORKSPACE = {
  id: "workspace-26-r1",
  name: "26年 R1",
  description: "",
  isDefault: true,
};

export const ISSUE_SEVERITIES = new Set(["low", "medium", "high", "critical"]);

export const ISSUE_STATUSES = new Set([
  "open",
  "investigating",
  "resolved",
  "archived",
  "needs_manual_review",
]);

export const INVESTIGATION_RECORD_TYPES = new Set([
  "observation",
  "hypothesis",
  "action",
  "result",
  "conclusion",
  "note",
]);

export const CHANGED_FILE_STATUSES = new Set([
  "added",
  "modified",
  "deleted",
  "renamed",
  "untracked",
]);

export const ARCHIVE_GENERATED_BY = new Set(["ai", "manual", "hybrid"]);

export const ARCHIVE_FILE_NAME_PATTERN = /^\d{4}-\d{2}-\d{2}_[a-z0-9-]+\.md$/;

export const ERROR_CODE_PATTERN = /^DBG-\d{8}-\d{3}$/;

export const FORM_DRAFT_SCOPE_PATTERN = /^[A-Za-z0-9._:-]+$/;

export const DATETIME_WITH_OFFSET_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;

export function normalizeDefaultWorkspace(overrides = {}) {
  return {
    ...DEFAULT_WORKSPACE,
    ...overrides,
    description: overrides.description ?? DEFAULT_WORKSPACE.description,
    isDefault: true,
  };
}
