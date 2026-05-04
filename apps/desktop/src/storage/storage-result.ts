import type { ZodIssue } from "zod";

export type StorageEntity =
  | "workspace"
  | "issue_card"
  | "investigation_record"
  | "archive_document"
  | "error_entry"
  | "form_draft";

export interface StorageErrorConnection {
  state: "online" | "degraded" | "unreachable";
  reason: string;
  checkedAt: string;
}

export interface StorageReadError {
  kind: "read_failed";
  code: "read_failed" | "server_unreachable" | "timeout" | "not_found";
  entity: StorageEntity;
  target: string;
  message: string;
  connection?: StorageErrorConnection;
}

type WriteErrorBase<Kind extends string> = {
  kind: Kind;
  code: Kind;
  entity: StorageEntity;
  target: string;
  message: string;
  connection?: StorageErrorConnection;
};

export type StorageWriteError =
  | (WriteErrorBase<"validation_failed"> & { issues: ZodIssue[] })
  | WriteErrorBase<"serialize_failed">
  | WriteErrorBase<"unexpected_write_error">
  | (WriteErrorBase<"server_unreachable"> & { connection: StorageErrorConnection })
  | (WriteErrorBase<"timeout"> & { connection: StorageErrorConnection })
  | WriteErrorBase<"conflict">
  | WriteErrorBase<"not_found">;

export type StorageWriteResult = { ok: true } | { ok: false; error: StorageWriteError };

function normalizeErrorMessage(error: unknown, fallback: string): string {
  const candidate = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return candidate.trim().length > 0 ? candidate : fallback;
}

const connection = (
  state: StorageErrorConnection["state"],
  reason: string,
  checkedAt: string,
): StorageErrorConnection => ({ state, reason, checkedAt });

export const createDegradedConnection = (reason: string, checkedAt: string): StorageErrorConnection =>
  connection("degraded", reason, checkedAt);

export const createOnlineConnection = (
  checkedAt: string,
  reason = "server storage responded without localStorage fallback",
): StorageErrorConnection => connection("online", reason, checkedAt);

export const createUnreachableConnection = (
  reason: string,
  checkedAt: string,
): StorageErrorConnection => connection("unreachable", reason, checkedAt);

const readError = (
  code: StorageReadError["code"],
  entity: StorageEntity,
  target: string,
  message: string,
  connection?: StorageErrorConnection,
): StorageReadError => ({ kind: "read_failed", code, entity, target, message, connection });

export const createReadFailed = (
  entity: StorageEntity,
  target: string,
  error: unknown,
  connection?: StorageErrorConnection,
): StorageReadError =>
  readError("read_failed", entity, target, normalizeErrorMessage(error, `${entity} read failed`), connection);

export const createServerUnreachableReadError = (
  entity: StorageEntity,
  target: string,
  reason: string,
  checkedAt: string,
): StorageReadError =>
  readError("server_unreachable", entity, target, reason, createUnreachableConnection(reason, checkedAt));

export const createTimeoutReadError = (
  entity: StorageEntity,
  target: string,
  reason: string,
  checkedAt: string,
): StorageReadError =>
  readError("timeout", entity, target, reason, createDegradedConnection(reason, checkedAt));

export const createNotFoundReadError = (
  entity: StorageEntity,
  target: string,
  reason: string,
  connection?: StorageErrorConnection,
): StorageReadError => readError("not_found", entity, target, reason, connection);

const writeError = <K extends StorageWriteError["kind"]>(
  kind: K,
  entity: StorageEntity,
  target: string,
  message: string,
  connection?: StorageErrorConnection,
): WriteErrorBase<K> => ({ kind, code: kind, entity, target, message, connection });

export const createValidationFailed = (
  entity: StorageEntity,
  target: string,
  issues: ZodIssue[],
  connection?: StorageErrorConnection,
): StorageWriteError => ({
  ...writeError("validation_failed", entity, target, `${entity} schema validation failed before write`, connection),
  issues,
});

export const createRemoteValidationFailed = (
  entity: StorageEntity,
  target: string,
  message: string,
  connection?: StorageErrorConnection,
): StorageWriteError => ({
  ...writeError(
    "validation_failed",
    entity,
    target,
    normalizeErrorMessage(message, `${entity} remote validation failed`),
    connection,
  ),
  issues: [],
});

export const createSerializeFailed = (
  entity: StorageEntity,
  target: string,
  error: unknown,
): StorageWriteError =>
  writeError("serialize_failed", entity, target, normalizeErrorMessage(error, `${entity} serialization failed`));

export const createUnexpectedWriteError = (
  entity: StorageEntity,
  target: string,
  error: unknown,
  connection?: StorageErrorConnection,
): StorageWriteError =>
  writeError(
    "unexpected_write_error",
    entity,
    target,
    normalizeErrorMessage(error, `${entity} write failed`),
    connection,
  );

export const createServerUnreachableWriteError = (
  entity: StorageEntity,
  target: string,
  reason: string,
  checkedAt: string,
): StorageWriteError => ({
  ...writeError("server_unreachable", entity, target, reason),
  connection: createUnreachableConnection(reason, checkedAt),
});

export const createTimeoutWriteError = (
  entity: StorageEntity,
  target: string,
  reason: string,
  checkedAt: string,
): StorageWriteError => ({
  ...writeError("timeout", entity, target, reason),
  connection: createDegradedConnection(reason, checkedAt),
});

export const createConflictWriteError = (
  entity: StorageEntity,
  target: string,
  reason: string,
  connection?: StorageErrorConnection,
): StorageWriteError => writeError("conflict", entity, target, reason, connection);

export const createNotFoundWriteError = (
  entity: StorageEntity,
  target: string,
  reason: string,
  connection?: StorageErrorConnection,
): StorageWriteError => writeError("not_found", entity, target, reason, connection);

export const storageWriteOk = (): StorageWriteResult => ({ ok: true });
