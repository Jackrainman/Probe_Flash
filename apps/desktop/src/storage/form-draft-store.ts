import type { StorageReadError, StorageWriteResult } from "./storage-result";

export interface FormDraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type FormDraftScope = {
  workspaceId: string;
  formKind: string;
  itemId: string;
};

export type ReadFormDraftResult<T> =
  | { state: "unavailable"; data: null }
  | { state: "empty"; data: null }
  | { state: "invalid"; data: null }
  | { state: "restored"; data: T };

export type FormDraftRecord = FormDraftScope & {
  payloadJson: string;
  updatedAt: string;
};

export type FormDraftLoadResult =
  | { ok: true; draft: FormDraftRecord | null }
  | { ok: false; error: StorageReadError };

export interface FormDraftRepositoryPort {
  load(scope: FormDraftScope): Promise<FormDraftLoadResult>;
  save(record: FormDraftRecord): Promise<StorageWriteResult>;
  clear(scope: FormDraftScope): Promise<StorageWriteResult>;
}

export type PersistedFormDraftSource = "server" | "local" | "none";

export type ReadPersistedFormDraftResult<T> = ReadFormDraftResult<T> & {
  source: PersistedFormDraftSource;
  remoteError?: StorageReadError;
};

export type PersistedFormDraftWriteState = "server" | "local" | "unavailable";

const FORM_DRAFT_KEY_PREFIX = "probeflash:form-draft:";

export function getBrowserFormDraftStorage(): FormDraftStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function formDraftStorageKey(scope: FormDraftScope): string {
  return [
    FORM_DRAFT_KEY_PREFIX,
    encodeURIComponent(scope.workspaceId),
    ":",
    encodeURIComponent(scope.formKind),
    ":",
    encodeURIComponent(scope.itemId),
  ].join("");
}

function parsePayload<T>(
  payload: string | null,
  parse: (value: unknown) => T | null,
): ReadFormDraftResult<T> {
  if (payload === null) return { state: "empty", data: null };
  try {
    const parsed = parse(JSON.parse(payload));
    return parsed === null ? { state: "invalid", data: null } : { state: "restored", data: parsed };
  } catch {
    return { state: "invalid", data: null };
  }
}

export function readFormDraft<T>(
  storage: FormDraftStorage | null,
  scope: FormDraftScope,
  parse: (value: unknown) => T | null,
): ReadFormDraftResult<T> {
  if (storage === null) return { state: "unavailable", data: null };
  try {
    return parsePayload(storage.getItem(formDraftStorageKey(scope)), parse);
  } catch {
    return { state: "invalid", data: null };
  }
}

export function writeFormDraft(
  storage: FormDraftStorage | null,
  scope: FormDraftScope,
  value: unknown,
): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(formDraftStorageKey(scope), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearFormDraft(storage: FormDraftStorage | null, scope: FormDraftScope): boolean {
  if (storage === null) return false;
  try {
    storage.removeItem(formDraftStorageKey(scope));
    return true;
  } catch {
    return false;
  }
}

function readLocalFormDraft<T>(
  storage: FormDraftStorage | null,
  scope: FormDraftScope,
  parse: (value: unknown) => T | null,
  remoteError?: StorageReadError,
): ReadPersistedFormDraftResult<T> {
  const local = readFormDraft(storage, scope, parse);
  return { ...local, source: local.state === "unavailable" ? "none" : "local", remoteError };
}

export async function readPersistedFormDraft<T>(
  repository: FormDraftRepositoryPort,
  storage: FormDraftStorage | null,
  scope: FormDraftScope,
  parse: (value: unknown) => T | null,
): Promise<ReadPersistedFormDraftResult<T>> {
  const remote = await repository.load(scope);
  if (!remote.ok) return readLocalFormDraft(storage, scope, parse, remote.error);
  if (remote.draft === null) return readLocalFormDraft(storage, scope, parse);
  return { ...parsePayload(remote.draft.payloadJson, parse), source: "server" };
}

export async function writePersistedFormDraft(
  repository: FormDraftRepositoryPort,
  storage: FormDraftStorage | null,
  scope: FormDraftScope,
  value: unknown,
): Promise<PersistedFormDraftWriteState> {
  let payloadJson: string;
  try {
    payloadJson = JSON.stringify(value);
  } catch {
    return "unavailable";
  }

  const remote = await repository.save({ ...scope, payloadJson, updatedAt: new Date().toISOString() });
  if (remote.ok) {
    writeFormDraft(storage, scope, value);
    return "server";
  }
  return writeFormDraft(storage, scope, value) ? "local" : "unavailable";
}

export async function clearPersistedFormDraft(
  repository: FormDraftRepositoryPort,
  storage: FormDraftStorage | null,
  scope: FormDraftScope,
): Promise<PersistedFormDraftWriteState> {
  const remote = await repository.clear(scope);
  const localCleared = clearFormDraft(storage, scope);
  if (remote.ok) return "server";
  return localCleared ? "local" : "unavailable";
}
