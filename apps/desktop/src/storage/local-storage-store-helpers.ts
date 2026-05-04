import type { ZodIssue, ZodTypeAny } from "zod";
import { localStorageAdapter } from "./local-storage-adapter.ts";
import {
  createReadFailed,
  createSerializeFailed,
  createUnexpectedWriteError,
  createValidationFailed,
  storageWriteOk,
  type StorageEntity,
  type StorageReadError,
  type StorageWriteResult,
} from "./storage-result.ts";

const messageOf = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

const idFromKey = (key: string, prefix: string): string =>
  key.startsWith(prefix) ? key.slice(prefix.length) : key;

export function persistValidatedEntity<T>({
  entity,
  target,
  key,
  value,
  schema,
}: {
  entity: StorageEntity;
  target: string;
  key: string;
  value: T;
  schema: ZodTypeAny;
}): StorageWriteResult {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: createValidationFailed(entity, target, parsed.error.issues) };
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(parsed.data);
  } catch (error) {
    return { ok: false, error: createSerializeFailed(entity, target, error) };
  }
  try {
    localStorageAdapter.setItem(key, serialized);
  } catch (error) {
    return { ok: false, error: createUnexpectedWriteError(entity, target, error) };
  }
  return storageWriteOk();
}

type IdEntry<IdField extends string> = { [K in IdField]: string };

export type LoadValidatedFailure<IdField extends string = "id"> =
  | (IdEntry<IdField> & { kind: "not_found" })
  | (IdEntry<IdField> & { kind: "parse_error"; message: string })
  | (IdEntry<IdField> & { kind: "validation_error"; issues: ZodIssue[] })
  | StorageReadError;

export type LoadValidatedResult<T, IdField extends string = "id"> =
  | { ok: true; data: T }
  | { ok: false; error: LoadValidatedFailure<IdField> };

export type ValidatedListInvalid<IdField extends string = "id"> =
  | (IdEntry<IdField> & { kind: "parse_error"; key: string; message: string })
  | (IdEntry<IdField> & { kind: "validation_error"; key: string; issues: ZodIssue[] });

export interface ValidatedListResult<T, IdField extends string = "id"> {
  valid: T[];
  invalid: ValidatedListInvalid<IdField>[];
  readError: StorageReadError | null;
}

export function loadValidatedEntity<T, IdField extends string = "id">({
  entity,
  id,
  key,
  schema,
  idField = "id" as IdField,
}: {
  entity: StorageEntity;
  id: string;
  key: string;
  schema: ZodTypeAny;
  idField?: IdField;
}): LoadValidatedResult<T, IdField> {
  const idEntry = { [idField]: id } as IdEntry<IdField>;
  let raw: string | null;
  try {
    raw = localStorageAdapter.getItem(key);
  } catch (error) {
    return { ok: false, error: createReadFailed(entity, id, error) };
  }
  if (raw === null) {
    return { ok: false, error: { ...idEntry, kind: "not_found" } };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ok: false, error: { ...idEntry, kind: "parse_error", message: messageOf(err) } };
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: { ...idEntry, kind: "validation_error", issues: result.error.issues } };
  }
  return { ok: true, data: result.data as T };
}

export function listValidatedEntities<T, IdField extends string = "id">({
  entity,
  prefix,
  schema,
  idField = "id" as IdField,
  filter,
}: {
  entity: StorageEntity;
  prefix: string;
  schema: ZodTypeAny;
  idField?: IdField;
  filter?: (data: T) => boolean;
}): ValidatedListResult<T, IdField> {
  const valid: T[] = [];
  const invalid: ValidatedListInvalid<IdField>[] = [];
  let keys: string[];
  try {
    keys = localStorageAdapter.listKeys(prefix);
  } catch (error) {
    return { valid, invalid, readError: createReadFailed(entity, prefix, error) };
  }
  for (const key of keys) {
    const idEntry = { [idField]: idFromKey(key, prefix) } as IdEntry<IdField>;
    let raw: string | null;
    try {
      raw = localStorageAdapter.getItem(key);
    } catch (error) {
      return { valid, invalid, readError: createReadFailed(entity, key, error) };
    }
    if (raw === null) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      invalid.push({ ...idEntry, kind: "parse_error", key, message: messageOf(err) });
      continue;
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      invalid.push({ ...idEntry, kind: "validation_error", key, issues: result.error.issues });
      continue;
    }
    const data = result.data as T;
    if (filter && !filter(data)) continue;
    valid.push(data);
  }
  return { valid, invalid, readError: null };
}

const compareStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
export const ascByString = <T, K extends keyof T>(key: K) =>
  (a: T, b: T): number => compareStr(String(a[key]), String(b[key]));
export const descByString = <T, K extends keyof T>(key: K) =>
  (a: T, b: T): number => compareStr(String(b[key]), String(a[key]));
