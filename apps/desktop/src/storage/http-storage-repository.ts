import { z, type ZodIssue } from "zod";

import {
  ArchiveDocumentSchema,
  type ArchiveDocument,
} from "../domain/schemas/archive-document.ts";
import { ErrorEntrySchema, type ErrorEntry } from "../domain/schemas/error-entry.ts";
import {
  InvestigationRecordSchema,
  type InvestigationRecord,
} from "../domain/schemas/investigation-record.ts";
import {
  IssueCardSchema,
  IssueSeverity,
  IssueStatus,
  type IssueCard,
} from "../domain/schemas/issue-card.ts";
import { DEFAULT_WORKSPACE_ID, resolveWorkspaceId, type Workspace } from "../domain/workspace.ts";
import type {
  ArchiveDocumentListInvalidEntry,
  ArchiveDocumentListResult,
} from "./archive-document-store.ts";
import type {
  ErrorEntryListInvalidEntry,
  ErrorEntryListResult,
} from "./error-entry-store.ts";
import type {
  InvestigationRecordListInvalidEntry,
  InvestigationRecordListResult,
} from "./investigation-record-store.ts";
import type {
  IssueCardListInvalidEntry,
  IssueCardListResult,
  IssueCardSummary,
  LoadIssueCardResult,
} from "./issue-card-store.ts";
import { createHttpStorageClient, type HttpStorageClientOptions, type HttpStorageRequestError } from "./http-storage-client.ts";
import {
  createConflictWriteError,
  createDegradedConnection,
  createNotFoundReadError,
  createNotFoundWriteError,
  createOnlineConnection,
  createReadFailed,
  createRemoteValidationFailed,
  createServerUnreachableReadError,
  createServerUnreachableWriteError,
  createTimeoutReadError,
  createTimeoutWriteError,
  createUnexpectedWriteError,
  createValidationFailed,
  storageWriteOk,
  type StorageEntity,
  type StorageReadError,
  type StorageWriteError,
  type StorageWriteResult,
} from "./storage-result.ts";
import type {
  CloseoutRecoveryListResult,
  CreateWorkspaceResult,
  FormDraftLoadResult,
  FormDraftRecord,
  FormDraftScope,
  NormalizedStorageSearchFilters,
  StorageRepository,
  StorageSearchFilters,
  StorageSearchResult,
  StorageSearchResultItem,
  WorkspaceListInvalidEntry,
  WorkspaceListResult,
} from "./storage-repository.ts";

const ItemsEnvelopeSchema = z.object({
  items: z.array(z.unknown()),
});

const CloseoutStateSchema = z.enum(["pending", "completed", "failed"]);

const IssueCardSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  severity: IssueSeverity,
  status: IssueStatus,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  closeoutState: CloseoutStateSchema.nullable().optional(),
});

const CloseoutRecoveryItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  severity: IssueSeverity,
  status: IssueStatus,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  closeoutState: z.enum(["pending", "failed"]),
});

const CloseoutRecoveryListResponseSchema = z.object({
  items: z.array(CloseoutRecoveryItemSchema),
});

const CloseoutRecoveryClearResponseSchema = z.object({
  workspaceId: z.string().min(1),
  issueId: z.string().min(1),
  closeoutState: z.null(),
});

const WorkspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  isDefault: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

const WorkspaceCreateResponseSchema = z.object({
  workspace: WorkspaceSchema,
});

const SearchResultItemSchema = z.object({
  kind: z.enum(["issue", "record", "archive", "error_entry"]),
  id: z.string().min(1),
  issueId: z.string().min(1),
  title: z.string().min(1),
  matchedFields: z.array(z.string().min(1)),
  snippet: z.string(),
  status: IssueStatus.optional(),
  recordType: z.string().min(1).optional(),
  fileName: z.string().min(1).optional(),
  errorCode: z.string().min(1).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.string().datetime({ offset: true }).optional(),
  updatedAt: z.string().datetime({ offset: true }).optional(),
  generatedAt: z.string().datetime({ offset: true }).optional(),
});

const SearchFiltersSchema = z.object({
  kind: z.enum(["all", "issue", "record", "archive", "error_entry"]),
  status: z.enum(["all", "open", "investigating", "resolved", "archived", "needs_manual_review"]),
  tag: z.string(),
  from: z.string(),
  to: z.string(),
});

const SearchResponseSchema = z.object({
  query: z.string(),
  filters: SearchFiltersSchema.optional(),
  items: z.array(SearchResultItemSchema),
});

const FormDraftRecordSchema = z.object({
  workspaceId: z.string().min(1),
  formKind: z.string().min(1),
  itemId: z.string().min(1),
  payloadJson: z.string(),
  updatedAt: z.string().datetime({ offset: true }),
});

const FormDraftLoadResponseSchema = z.object({
  draft: FormDraftRecordSchema.nullable(),
});

const ReleaseMetadataSchema = z.object({
  version: z.string().min(1),
  commit: z.string().min(1),
  releaseTag: z.string().min(1),
});

const ServerStatusSchema = z.object({
  ready: z.boolean(),
  runtime: z.string().min(1).optional(),
  apiBasePath: z.string().min(1).optional(),
});

const StorageStatusSchema = z.object({
  kind: z.string().min(1),
  ready: z.boolean(),
  dbPathClass: z.string().min(1).optional(),
  dbFileName: z.string().min(1).optional(),
});

const WorkspaceSeedSchema = z.object({
  defaultWorkspaceId: z.string().min(1),
  defaultWorkspaceName: z.string().min(1),
  seeded: z.boolean(),
});

const HealthResponseSchema = z.object({
  status: z.string().min(1),
  serverTime: z.string().datetime({ offset: true }).optional(),
  server: ServerStatusSchema.optional(),
  storage: StorageStatusSchema.optional(),
  workspace: WorkspaceSeedSchema.optional(),
  release: ReleaseMetadataSchema.optional(),
});

export interface HttpStorageRepositoryOptions extends HttpStorageClientOptions {
  workspaceId?: string;
}

export type HttpStorageHealthCheckResult =
  | { ok: true; checkedAt: string; status: HttpStorageHealthStatus }
  | { ok: false; error: StorageReadError };

export interface HttpStorageHealthStatus {
  checkedAt: string;
  serverReady: boolean;
  storageReady: boolean;
  storageKind: string;
  dbPathClass?: string;
  dbFileName?: string;
  defaultWorkspaceId?: string;
  defaultWorkspaceName?: string;
  releaseVersion?: string;
  releaseTag?: string;
}

function workspaceBasePath(workspaceId: string): string {
  return `/workspaces/${encodeURIComponent(workspaceId)}`;
}

function formDraftPath(basePath: string, scope: FormDraftScope): string {
  return `${basePath}/form-drafts/${encodeURIComponent(scope.formKind)}/${encodeURIComponent(scope.itemId)}`;
}

function normalizeSearchFilters(filters: StorageSearchFilters = {}): NormalizedStorageSearchFilters {
  return {
    kind: filters.kind ?? "all",
    status: filters.status ?? "all",
    tag: normalizeSearchTagFilter(filters.tag),
    from: filters.from ?? "",
    to: filters.to ?? "",
  };
}

function normalizeSearchTagFilter(tag: string | undefined): string {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const value of (tag ?? "").split(/[,，]/)) {
    const trimmed = value.trim();
    const key = trimmed.toLocaleLowerCase();
    if (trimmed.length === 0 || seen.has(key)) continue;
    seen.add(key);
    tags.push(trimmed);
  }
  return tags.join(",");
}

function appendSearchFilters(params: URLSearchParams, filters: NormalizedStorageSearchFilters) {
  if (filters.kind !== "all") params.set("kind", filters.kind);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
}

function dataValidationReadError(
  entity: StorageEntity,
  target: string,
  message: string,
): StorageReadError {
  const checkedAt = new Date().toISOString();
  return createReadFailed(entity, target, message, createDegradedConnection(message, checkedAt));
}

function isRequestError(error: unknown): error is HttpStorageRequestError {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    typeof (error as { type?: unknown }).type === "string"
  );
}

function mapRequestErrorToReadError(
  entity: StorageEntity,
  target: string,
  error: HttpStorageRequestError,
): StorageReadError {
  switch (error.type) {
    case "server_unreachable":
      return createServerUnreachableReadError(entity, target, error.message, error.checkedAt);
    case "timeout":
      return createTimeoutReadError(entity, target, error.message, error.checkedAt);
    case "http_error":
      if (error.status === 404 || error.code === "NOT_FOUND") {
        return createNotFoundReadError(
          entity,
          target,
          error.message,
          createOnlineConnection(error.checkedAt),
        );
      }
      return createReadFailed(
        entity,
        target,
        error.message,
        error.status >= 500 || error.code === "SERVICE_UNAVAILABLE"
          ? createDegradedConnection(error.message, error.checkedAt)
          : createOnlineConnection(error.checkedAt),
      );
    case "invalid_envelope":
      return createReadFailed(
        entity,
        target,
        error.message,
        createDegradedConnection(error.message, error.checkedAt),
      );
  }
}

function mapRequestErrorToWriteError(
  entity: StorageEntity,
  target: string,
  error: HttpStorageRequestError,
): StorageWriteError {
  switch (error.type) {
    case "server_unreachable":
      return createServerUnreachableWriteError(entity, target, error.message, error.checkedAt);
    case "timeout":
      return createTimeoutWriteError(entity, target, error.message, error.checkedAt);
    case "http_error":
      if (
        error.status === 400 ||
        error.status === 422 ||
        error.code === "BAD_REQUEST" ||
        error.code === "VALIDATION_ERROR"
      ) {
        return createRemoteValidationFailed(
          entity,
          target,
          error.message,
          createOnlineConnection(error.checkedAt),
        );
      }
      if (error.status === 409 || error.code === "CONFLICT") {
        return createConflictWriteError(entity, target, error.message, createOnlineConnection(error.checkedAt));
      }
      if (error.status === 404 || error.code === "NOT_FOUND") {
        return createNotFoundWriteError(entity, target, error.message, createOnlineConnection(error.checkedAt));
      }
      return createUnexpectedWriteError(
        entity,
        target,
        error.message,
        error.status >= 500 || error.code === "SERVICE_UNAVAILABLE"
          ? createDegradedConnection(error.message, error.checkedAt)
          : createOnlineConnection(error.checkedAt),
      );
    case "invalid_envelope":
      return createUnexpectedWriteError(
        entity,
        target,
        error.message,
        createDegradedConnection(error.message, error.checkedAt),
      );
  }
}

function createValidationInvalidEntry<T extends { kind: string }>(
  factory: (issues: ZodIssue[], index: number) => T,
  result: z.SafeParseError<unknown>,
  index: number,
): T {
  return factory(result.error.issues, index);
}

function normalizeIssueCardListInvalidEntry(
  issues: ZodIssue[],
  index: number,
): IssueCardListInvalidEntry {
  return {
    kind: "validation_error",
    key: `http:issues:${index}`,
    id: `invalid-http-issue-${index}`,
    issues,
  };
}

function normalizeWorkspaceListInvalidEntry(
  issues: ZodIssue[],
  index: number,
): WorkspaceListInvalidEntry {
  return {
    kind: "validation_error",
    key: `http:workspaces:${index}`,
    id: `invalid-http-workspace-${index}`,
    issues,
  };
}

function normalizeRecordListInvalidEntry(
  issues: ZodIssue[],
  index: number,
): InvestigationRecordListInvalidEntry {
  return {
    kind: "validation_error",
    key: `http:records:${index}`,
    id: `invalid-http-record-${index}`,
    issues,
  };
}

function normalizeArchiveListInvalidEntry(
  issues: ZodIssue[],
  index: number,
): ArchiveDocumentListInvalidEntry {
  return {
    kind: "validation_error",
    key: `http:archives:${index}`,
    fileName: `invalid-http-archive-${index}`,
    issues,
  };
}

function normalizeErrorEntryListInvalidEntry(
  issues: ZodIssue[],
  index: number,
): ErrorEntryListInvalidEntry {
  return {
    kind: "validation_error",
    key: `http:error-entries:${index}`,
    id: `invalid-http-error-entry-${index}`,
    issues,
  };
}

async function performWrite(
  writer: () => Promise<unknown>,
  entity: StorageEntity,
  target: string,
): Promise<StorageWriteResult> {
  try {
    await writer();
    return storageWriteOk();
  } catch (error) {
    if (isRequestError(error)) {
      return { ok: false, error: mapRequestErrorToWriteError(entity, target, error) };
    }
    return { ok: false, error: createUnexpectedWriteError(entity, target, error) };
  }
}

export function createHttpStorageRepository(
  options: HttpStorageRepositoryOptions = {},
): StorageRepository {
  const workspaceId = resolveWorkspaceId(options.workspaceId ?? DEFAULT_WORKSPACE_ID);
  const client = createHttpStorageClient(options);
  const basePath = workspaceBasePath(workspaceId);

  return {
    search: {
      async query(
        rawQuery: string,
        rawFilters: StorageSearchFilters = {},
      ): Promise<StorageSearchResult> {
        const query = rawQuery.trim();
        const filters = normalizeSearchFilters(rawFilters);
        if (query.length === 0) {
          return { query, filters, items: [], readError: null };
        }

        const params = new URLSearchParams({ q: query });
        appendSearchFilters(params, filters);
        const target = `${basePath}/search?${params.toString()}`;
        try {
          const data = await client.request<unknown>(target);
          const parsed = SearchResponseSchema.safeParse(data);
          if (!parsed.success) {
            return {
              query,
              filters,
              items: [],
              readError: dataValidationReadError(
                "issue_card",
                target,
                "search response must contain query and items[]",
              ),
            };
          }
          return {
            query: parsed.data.query,
            filters: parsed.data.filters ?? filters,
            items: parsed.data.items as StorageSearchResultItem[],
            readError: null,
          };
        } catch (error) {
          if (isRequestError(error)) {
            return {
              query,
              filters,
              items: [],
              readError: mapRequestErrorToReadError("issue_card", target, error),
            };
          }
          return {
            query,
            filters,
            items: [],
            readError: createReadFailed("issue_card", target, error),
          };
        }
      },
    },
    workspaces: {
      async list(): Promise<WorkspaceListResult> {
        const target = "/workspaces";
        try {
          const data = await client.request<unknown>(target);
          const envelope = ItemsEnvelopeSchema.safeParse(data);
          if (!envelope.success) {
            return {
              valid: [],
              invalid: [],
              readError: dataValidationReadError(
                "workspace",
                target,
                "workspace list response must contain data.items[]",
              ),
            };
          }
          const valid: Workspace[] = [];
          const invalid: WorkspaceListInvalidEntry[] = [];
          envelope.data.items.forEach((item, index) => {
            const parsed = WorkspaceSchema.safeParse(item);
            if (!parsed.success) {
              invalid.push(
                createValidationInvalidEntry(normalizeWorkspaceListInvalidEntry, parsed, index),
              );
              return;
            }
            valid.push(parsed.data);
          });
          return { valid, invalid, readError: null };
        } catch (error) {
          if (isRequestError(error)) {
            return {
              valid: [],
              invalid: [],
              readError: mapRequestErrorToReadError("workspace", target, error),
            };
          }
          return {
            valid: [],
            invalid: [],
            readError: createReadFailed("workspace", target, error),
          };
        }
      },
      async create(input): Promise<CreateWorkspaceResult> {
        const target = "/workspaces";
        try {
          const data = await client.request<unknown>(target, {
            method: "POST",
            body: JSON.stringify(input),
          });
          const parsed = WorkspaceCreateResponseSchema.safeParse(data);
          if (!parsed.success) {
            return {
              ok: false,
              error: createUnexpectedWriteError(
                "workspace",
                target,
                "workspace create response must contain data.workspace",
                createDegradedConnection(
                  "workspace create response must contain data.workspace",
                  new Date().toISOString(),
                ),
              ),
            };
          }
          return { ok: true, workspace: parsed.data.workspace };
        } catch (error) {
          if (isRequestError(error)) {
            return { ok: false, error: mapRequestErrorToWriteError("workspace", target, error) };
          }
          return { ok: false, error: createUnexpectedWriteError("workspace", target, error) };
        }
      },
    },
    issueCards: {
      async list(): Promise<IssueCardListResult> {
        try {
          const data = await client.request<unknown>(`${basePath}/issues?status=all`);
          const envelope = ItemsEnvelopeSchema.safeParse(data);
          if (!envelope.success) {
            return {
              valid: [],
              invalid: [],
              readError: dataValidationReadError(
                "issue_card",
                `${basePath}/issues?status=all`,
                "issue list response must contain data.items[]",
              ),
            };
          }
          const valid: IssueCardSummary[] = [];
          const invalid: IssueCardListInvalidEntry[] = [];
          envelope.data.items.forEach((item, index) => {
            const parsed = IssueCardSummarySchema.safeParse(item);
            if (!parsed.success) {
              invalid.push(
                createValidationInvalidEntry(normalizeIssueCardListInvalidEntry, parsed, index),
              );
              return;
            }
            valid.push(parsed.data);
          });
          return { valid, invalid, readError: null };
        } catch (error) {
          if (isRequestError(error)) {
            return {
              valid: [],
              invalid: [],
              readError: mapRequestErrorToReadError(
                "issue_card",
                `${basePath}/issues?status=all`,
                error,
              ),
            };
          }
          return {
            valid: [],
            invalid: [],
            readError: createReadFailed("issue_card", `${basePath}/issues?status=all`, error),
          };
        }
      },
      async load(id: string): Promise<LoadIssueCardResult> {
        const target = `${basePath}/issues/${encodeURIComponent(id)}`;
        try {
          const data = await client.request<unknown>(target);
          const parsed = IssueCardSchema.safeParse(data);
          if (!parsed.success) {
            return {
              ok: false,
              error: {
                kind: "validation_error",
                id,
                issues: parsed.error.issues,
              },
            };
          }
          return { ok: true, card: parsed.data };
        } catch (error) {
          if (isRequestError(error)) {
            return {
              ok: false,
              error: mapRequestErrorToReadError("issue_card", id, error),
            };
          }
          return {
            ok: false,
            error: createReadFailed("issue_card", id, error),
          };
        }
      },
      async save(card: IssueCard): Promise<StorageWriteResult> {
        const createResult = await performWrite(
          () =>
            client.request(`${basePath}/issues`, {
              method: "POST",
              body: JSON.stringify(card),
            }),
          "issue_card",
          card.id,
        );
        if (createResult.ok) {
          return createResult;
        }
        if (createResult.error.code !== "conflict") {
          return createResult;
        }
        return performWrite(
          () =>
            client.request(`${basePath}/issues/${encodeURIComponent(card.id)}`, {
              method: "PUT",
              body: JSON.stringify(card),
            }),
          "issue_card",
          card.id,
        );
      },
    },
    investigationRecords: {
      async listByIssueId(issueId: string): Promise<InvestigationRecordListResult> {
        const target = `${basePath}/issues/${encodeURIComponent(issueId)}/records`;
        try {
          const data = await client.request<unknown>(target);
          const envelope = ItemsEnvelopeSchema.safeParse(data);
          if (!envelope.success) {
            return {
              valid: [],
              invalid: [],
              readError: dataValidationReadError(
                "investigation_record",
                target,
                "record list response must contain data.items[]",
              ),
            };
          }
          const valid: InvestigationRecord[] = [];
          const invalid: InvestigationRecordListInvalidEntry[] = [];
          envelope.data.items.forEach((item, index) => {
            const parsed = InvestigationRecordSchema.safeParse(item);
            if (!parsed.success) {
              invalid.push(
                createValidationInvalidEntry(normalizeRecordListInvalidEntry, parsed, index),
              );
              return;
            }
            valid.push(parsed.data);
          });
          return { valid, invalid, readError: null };
        } catch (error) {
          if (isRequestError(error)) {
            return {
              valid: [],
              invalid: [],
              readError: mapRequestErrorToReadError("investigation_record", target, error),
            };
          }
          return {
            valid: [],
            invalid: [],
            readError: createReadFailed("investigation_record", issueId, error),
          };
        }
      },
      async append(record: InvestigationRecord): Promise<StorageWriteResult> {
        return performWrite(
          () =>
            client.request(`${basePath}/issues/${encodeURIComponent(record.issueId)}/records`, {
              method: "POST",
              body: JSON.stringify(record),
            }),
          "investigation_record",
          record.id,
        );
      },
    },
    archiveDocuments: {
      async list(): Promise<ArchiveDocumentListResult> {
        const target = `${basePath}/archives`;
        try {
          const data = await client.request<unknown>(target);
          const envelope = ItemsEnvelopeSchema.safeParse(data);
          if (!envelope.success) {
            return {
              valid: [],
              invalid: [],
              readError: dataValidationReadError(
                "archive_document",
                target,
                "archive list response must contain data.items[]",
              ),
            };
          }
          const valid: ArchiveDocument[] = [];
          const invalid: ArchiveDocumentListInvalidEntry[] = [];
          envelope.data.items.forEach((item, index) => {
            const parsed = ArchiveDocumentSchema.safeParse(item);
            if (!parsed.success) {
              invalid.push(
                createValidationInvalidEntry(normalizeArchiveListInvalidEntry, parsed, index),
              );
              return;
            }
            valid.push(parsed.data);
          });
          return { valid, invalid, readError: null };
        } catch (error) {
          if (isRequestError(error)) {
            return {
              valid: [],
              invalid: [],
              readError: mapRequestErrorToReadError("archive_document", target, error),
            };
          }
          return {
            valid: [],
            invalid: [],
            readError: createReadFailed("archive_document", target, error),
          };
        }
      },
      async save(document: ArchiveDocument): Promise<StorageWriteResult> {
        return performWrite(
          () =>
            client.request(`${basePath}/archives`, {
              method: "POST",
              body: JSON.stringify(document),
            }),
          "archive_document",
          document.fileName,
        );
      },
    },
    errorEntries: {
      async list(): Promise<ErrorEntryListResult> {
        const target = `${basePath}/error-entries`;
        try {
          const data = await client.request<unknown>(target);
          const envelope = ItemsEnvelopeSchema.safeParse(data);
          if (!envelope.success) {
            return {
              valid: [],
              invalid: [],
              readError: dataValidationReadError(
                "error_entry",
                target,
                "error-entry list response must contain data.items[]",
              ),
            };
          }
          const valid: ErrorEntry[] = [];
          const invalid: ErrorEntryListInvalidEntry[] = [];
          envelope.data.items.forEach((item, index) => {
            const parsed = ErrorEntrySchema.safeParse(item);
            if (!parsed.success) {
              invalid.push(
                createValidationInvalidEntry(normalizeErrorEntryListInvalidEntry, parsed, index),
              );
              return;
            }
            valid.push(parsed.data);
          });
          return { valid, invalid, readError: null };
        } catch (error) {
          if (isRequestError(error)) {
            return {
              valid: [],
              invalid: [],
              readError: mapRequestErrorToReadError("error_entry", target, error),
            };
          }
          return {
            valid: [],
            invalid: [],
            readError: createReadFailed("error_entry", target, error),
          };
        }
      },
      async save(entry: ErrorEntry): Promise<StorageWriteResult> {
        const parsed = ErrorEntrySchema.safeParse(entry);
        if (!parsed.success) {
          return {
            ok: false,
            error: createValidationFailed(
              "error_entry",
              entry.id,
              parsed.error.issues,
              createOnlineConnection(new Date().toISOString(), "HTTP write blocked by local schema validation"),
            ),
          };
        }
        return performWrite(
          () =>
            client.request(`${basePath}/error-entries`, {
              method: "POST",
              body: JSON.stringify(parsed.data),
            }),
          "error_entry",
          parsed.data.id,
        );
      },
    },
    formDrafts: {
      async load(scope: FormDraftScope): Promise<FormDraftLoadResult> {
        const target = formDraftPath(basePath, scope);
        try {
          const data = await client.request<unknown>(target);
          const parsed = FormDraftLoadResponseSchema.safeParse(data);
          if (!parsed.success) {
            return {
              ok: false,
              error: dataValidationReadError(
                "form_draft",
                target,
                "form draft response must contain data.draft or null",
              ),
            };
          }
          return { ok: true, draft: parsed.data.draft as FormDraftRecord | null };
        } catch (error) {
          if (isRequestError(error)) {
            return { ok: false, error: mapRequestErrorToReadError("form_draft", target, error) };
          }
          return { ok: false, error: createReadFailed("form_draft", target, error) };
        }
      },
      async save(record: FormDraftRecord): Promise<StorageWriteResult> {
        const target = formDraftPath(basePath, record);
        return performWrite(
          () =>
            client.request(target, {
              method: "PUT",
              body: JSON.stringify(record),
            }),
          "form_draft",
          target,
        );
      },
      async clear(scope: FormDraftScope): Promise<StorageWriteResult> {
        const target = formDraftPath(basePath, scope);
        return performWrite(
          () =>
            client.request(target, {
              method: "DELETE",
            }),
          "form_draft",
          target,
        );
      },
    },
    closeoutRecovery: {
      async list(): Promise<CloseoutRecoveryListResult> {
        const target = `${basePath}/closeout-recovery`;
        try {
          const data = await client.request<unknown>(target);
          const parsed = CloseoutRecoveryListResponseSchema.safeParse(data);
          if (!parsed.success) {
            return {
              items: [],
              readError: dataValidationReadError(
                "issue_card",
                target,
                "closeout-recovery response must contain data.items[]",
              ),
            };
          }
          return { items: parsed.data.items, readError: null };
        } catch (error) {
          if (isRequestError(error)) {
            return {
              items: [],
              readError: mapRequestErrorToReadError("issue_card", target, error),
            };
          }
          return {
            items: [],
            readError: createReadFailed("issue_card", target, error),
          };
        }
      },
      async clear(issueId: string): Promise<StorageWriteResult> {
        const target = `${basePath}/closeout-recovery/${encodeURIComponent(issueId)}/clear`;
        try {
          const data = await client.request<unknown>(target, {
            method: "POST",
            body: JSON.stringify({}),
          });
          const parsed = CloseoutRecoveryClearResponseSchema.safeParse(data);
          if (!parsed.success) {
            return {
              ok: false,
              error: createUnexpectedWriteError(
                "issue_card",
                target,
                "closeout-recovery clear response missing closeoutState=null",
                createDegradedConnection(
                  "closeout-recovery clear response missing closeoutState=null",
                  new Date().toISOString(),
                ),
              ),
            };
          }
          return storageWriteOk();
        } catch (error) {
          if (isRequestError(error)) {
            return { ok: false, error: mapRequestErrorToWriteError("issue_card", target, error) };
          }
          return { ok: false, error: createUnexpectedWriteError("issue_card", target, error) };
        }
      },
    },
  };
}

export async function checkHttpStorageHealth(
  options: HttpStorageRepositoryOptions = {},
): Promise<HttpStorageHealthCheckResult> {
  const client = createHttpStorageClient(options);
  try {
    const data = await client.request<unknown>("/health");
    const parsed = HealthResponseSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        error: dataValidationReadError(
          "issue_card",
          "/health",
          "health response must include status/storage/serverTime payload",
        ),
      };
    }
    const checkedAt = parsed.data.serverTime ?? new Date().toISOString();
    const storageReady = parsed.data.storage?.ready === true;
    if (!storageReady) {
      return {
        ok: false,
        error: createReadFailed(
          "issue_card",
          "/health",
          "server storage is not ready",
          createDegradedConnection("server storage is not ready", checkedAt),
        ),
      };
    }
    return {
      ok: true,
      checkedAt,
      status: {
        checkedAt,
        serverReady: parsed.data.server?.ready ?? true,
        storageReady,
        storageKind: parsed.data.storage?.kind ?? "unknown",
        dbPathClass: parsed.data.storage?.dbPathClass,
        dbFileName: parsed.data.storage?.dbFileName,
        defaultWorkspaceId: parsed.data.workspace?.defaultWorkspaceId,
        defaultWorkspaceName: parsed.data.workspace?.defaultWorkspaceName,
        releaseVersion: parsed.data.release?.version,
        releaseTag: parsed.data.release?.releaseTag,
      },
    };
  } catch (error) {
    if (isRequestError(error)) {
      return {
        ok: false,
        error: mapRequestErrorToReadError("issue_card", "/health", error),
      };
    }
    return {
      ok: false,
      error: createReadFailed("issue_card", "/health", error),
    };
  }
}

export const httpStorageRepository = createHttpStorageRepository();
