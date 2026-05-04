// apps/desktop/src/storage/archive-document-store.ts
// S2-A4：ArchiveDocument 本地存储。阶段内仍使用 localStorage，键前缀与其它实体隔离。
// D1-ARCHIVE-PERSIST-INDEX：新增 listArchiveDocuments()，供右侧归档区跨刷新读回累计归档与最近一次摘要。

import type { ZodIssue } from "zod";
import {
  ArchiveDocumentSchema,
  type ArchiveDocument,
} from "../domain/schemas/archive-document.ts";
import {
  ascByString,
  descByString,
  listValidatedEntities,
  loadValidatedEntity,
  persistValidatedEntity,
} from "./local-storage-store-helpers.ts";
import type { StorageReadError, StorageWriteResult } from "./storage-result.ts";

const KEY_PREFIX = "repo-debug:archive-document:";

export type LoadArchiveDocumentError =
  | { kind: "not_found"; fileName: string }
  | { kind: "parse_error"; fileName: string; message: string }
  | { kind: "validation_error"; fileName: string; issues: ZodIssue[] }
  | StorageReadError;

export type LoadArchiveDocumentResult =
  | { ok: true; document: ArchiveDocument }
  | { ok: false; error: LoadArchiveDocumentError };

export type ArchiveDocumentListInvalidEntry =
  | { kind: "parse_error"; key: string; fileName: string; message: string }
  | { kind: "validation_error"; key: string; fileName: string; issues: ZodIssue[] };

export interface ArchiveDocumentListResult {
  valid: ArchiveDocument[];
  invalid: ArchiveDocumentListInvalidEntry[];
  readError: StorageReadError | null;
}

const storageKey = (fileName: string): string => KEY_PREFIX + fileName;

export function saveArchiveDocument(document: ArchiveDocument): StorageWriteResult {
  return persistValidatedEntity({
    entity: "archive_document",
    target: document.fileName,
    key: storageKey(document.fileName),
    value: document,
    schema: ArchiveDocumentSchema,
  });
}

export function loadArchiveDocument(fileName: string): LoadArchiveDocumentResult {
  const result = loadValidatedEntity<ArchiveDocument, "fileName">({
    entity: "archive_document",
    id: fileName,
    idField: "fileName",
    key: storageKey(fileName),
    schema: ArchiveDocumentSchema,
  });
  return result.ok ? { ok: true, document: result.data } : { ok: false, error: result.error };
}

export function listArchiveDocuments(): ArchiveDocumentListResult {
  const result = listValidatedEntities<ArchiveDocument, "fileName">({
    entity: "archive_document",
    prefix: KEY_PREFIX,
    schema: ArchiveDocumentSchema,
    idField: "fileName",
  });
  return {
    valid: [...result.valid].sort(descByString<ArchiveDocument, "generatedAt">("generatedAt")),
    invalid: [...result.invalid].sort(ascByString<ArchiveDocumentListInvalidEntry, "fileName">("fileName")),
    readError: result.readError,
  };
}
