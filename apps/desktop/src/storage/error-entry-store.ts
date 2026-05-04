// apps/desktop/src/storage/error-entry-store.ts
// S2-A4：ErrorEntry 本地存储。相当于 MVP 阶段的 localStorage error-table 条目。
// D1-ARCHIVE-PERSIST-INDEX：新增 listErrorEntries()，让归档抽屉列表能展示 errorCode / category / 来源问题。

import type { ZodIssue } from "zod";
import { ErrorEntrySchema, type ErrorEntry } from "../domain/schemas/error-entry.ts";
import {
  ascByString,
  descByString,
  listValidatedEntities,
  loadValidatedEntity,
  persistValidatedEntity,
} from "./local-storage-store-helpers.ts";
import type { StorageReadError, StorageWriteResult } from "./storage-result.ts";

const KEY_PREFIX = "repo-debug:error-entry:";

export type LoadErrorEntryError =
  | { kind: "not_found"; id: string }
  | { kind: "parse_error"; id: string; message: string }
  | { kind: "validation_error"; id: string; issues: ZodIssue[] }
  | StorageReadError;

export type LoadErrorEntryResult =
  | { ok: true; entry: ErrorEntry }
  | { ok: false; error: LoadErrorEntryError };

export type ErrorEntryListInvalidEntry =
  | { kind: "parse_error"; key: string; id: string; message: string }
  | { kind: "validation_error"; key: string; id: string; issues: ZodIssue[] };

export interface ErrorEntryListResult {
  valid: ErrorEntry[];
  invalid: ErrorEntryListInvalidEntry[];
  readError: StorageReadError | null;
}

const storageKey = (id: string): string => KEY_PREFIX + id;

export function saveErrorEntry(entry: ErrorEntry): StorageWriteResult {
  return persistValidatedEntity({
    entity: "error_entry",
    target: entry.id,
    key: storageKey(entry.id),
    value: entry,
    schema: ErrorEntrySchema,
  });
}

export function loadErrorEntry(id: string): LoadErrorEntryResult {
  const result = loadValidatedEntity<ErrorEntry>({
    entity: "error_entry",
    id,
    key: storageKey(id),
    schema: ErrorEntrySchema,
  });
  return result.ok ? { ok: true, entry: result.data } : { ok: false, error: result.error };
}

export function listErrorEntries(): ErrorEntryListResult {
  const result = listValidatedEntities<ErrorEntry>({
    entity: "error_entry",
    prefix: KEY_PREFIX,
    schema: ErrorEntrySchema,
  });
  return {
    valid: [...result.valid].sort(descByString<ErrorEntry, "createdAt">("createdAt")),
    invalid: [...result.invalid].sort(ascByString<ErrorEntryListInvalidEntry, "id">("id")),
    readError: result.readError,
  };
}
