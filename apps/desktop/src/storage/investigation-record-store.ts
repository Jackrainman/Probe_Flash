// apps/desktop/src/storage/investigation-record-store.ts
// S2-A3：InvestigationRecord 本地存储。独立前缀 `repo-debug:investigation-record:<recordId>`,
// 与 `repo-debug:issue-card:` 完全隔离；list 通过 issueId 外键过滤。
// 读盘必走 safeParse，JSON / schema 异常路由到结构化 invalid 桶。

import type { ZodIssue } from "zod";
import {
  InvestigationRecordSchema,
  type InvestigationRecord,
} from "../domain/schemas/investigation-record.ts";
import {
  ascByString,
  listValidatedEntities,
  persistValidatedEntity,
} from "./local-storage-store-helpers.ts";
import type { StorageReadError, StorageWriteResult } from "./storage-result.ts";

const KEY_PREFIX = "repo-debug:investigation-record:";

export type InvestigationRecordListInvalidEntry =
  | { kind: "parse_error"; key: string; id: string; message: string }
  | { kind: "validation_error"; key: string; id: string; issues: ZodIssue[] };

export interface InvestigationRecordListResult {
  valid: InvestigationRecord[];
  invalid: InvestigationRecordListInvalidEntry[];
  readError: StorageReadError | null;
}

const storageKey = (id: string): string => KEY_PREFIX + id;

export function saveInvestigationRecord(record: InvestigationRecord): StorageWriteResult {
  return persistValidatedEntity({
    entity: "investigation_record",
    target: record.id,
    key: storageKey(record.id),
    value: record,
    schema: InvestigationRecordSchema,
  });
}

export function listInvestigationRecordsByIssueId(
  issueId: string,
): InvestigationRecordListResult {
  const result = listValidatedEntities<InvestigationRecord>({
    entity: "investigation_record",
    prefix: KEY_PREFIX,
    schema: InvestigationRecordSchema,
    filter: (record) => record.issueId === issueId,
  });
  return {
    valid: [...result.valid].sort(ascByString<InvestigationRecord, "createdAt">("createdAt")),
    invalid: result.invalid,
    readError: result.readError,
  };
}
