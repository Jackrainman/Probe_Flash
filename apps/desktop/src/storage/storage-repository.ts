import type { ArchiveDocument } from "../domain/schemas/archive-document.ts";
import type { ErrorEntry } from "../domain/schemas/error-entry.ts";
import type { InvestigationRecord } from "../domain/schemas/investigation-record.ts";
import type { IssueCard } from "../domain/schemas/issue-card.ts";
import { DEFAULT_WORKSPACE, type Workspace } from "../domain/workspace.ts";
import {
  listArchiveDocuments,
  saveArchiveDocument,
  type ArchiveDocumentListResult,
} from "./archive-document-store.ts";
import {
  listErrorEntries,
  saveErrorEntry,
  type ErrorEntryListResult,
} from "./error-entry-store.ts";
import {
  checkHttpStorageHealth,
  createHttpStorageRepository,
  httpStorageRepository,
  type HttpStorageHealthStatus,
} from "./http-storage-repository.ts";
import {
  formDraftStorageKey,
  getBrowserFormDraftStorage,
  type FormDraftLoadResult,
  type FormDraftRecord,
  type FormDraftScope,
} from "./form-draft-store.ts";
import {
  listInvestigationRecordsByIssueId,
  saveInvestigationRecord,
  type InvestigationRecordListResult,
} from "./investigation-record-store.ts";
import {
  listIssueCards,
  loadIssueCard,
  saveIssueCard,
  type IssueCardListResult,
  type LoadIssueCardResult,
} from "./issue-card-store.ts";
import type {
  StorageErrorConnection,
  StorageReadError,
  StorageWriteError,
  StorageWriteResult,
} from "./storage-result.ts";
import { createReadFailed, createRemoteValidationFailed, createUnexpectedWriteError, storageWriteOk } from "./storage-result.ts";

export type {
  ArchiveDocumentListResult,
  ErrorEntryListResult,
  FormDraftLoadResult,
  FormDraftRecord,
  FormDraftScope,
  InvestigationRecordListResult,
  IssueCardListResult,
  LoadIssueCardResult,
  StorageErrorConnection,
  StorageReadError,
  StorageWriteError,
  StorageWriteResult,
  HttpStorageHealthStatus,
};

export type WorkspaceListInvalidEntry = {
  kind: "validation_error";
  key: string;
  id: string;
  issues: unknown[];
};

export type WorkspaceListResult = {
  valid: Workspace[];
  invalid: WorkspaceListInvalidEntry[];
  readError: StorageReadError | null;
};

export type CreateWorkspaceInput = {
  name: string;
};

export type CreateWorkspaceResult =
  | { ok: true; workspace: Workspace }
  | { ok: false; error: StorageWriteError };

export type StorageSearchResultKind = "issue" | "record" | "archive" | "error_entry";
export type StorageSearchKindFilter = "all" | StorageSearchResultKind;
export type StorageSearchStatusFilter = "all" | IssueCard["status"];

export interface StorageSearchFilters {
  kind?: StorageSearchKindFilter;
  status?: StorageSearchStatusFilter;
  tag?: string;
  from?: string;
  to?: string;
}

export interface NormalizedStorageSearchFilters {
  kind: StorageSearchKindFilter;
  status: StorageSearchStatusFilter;
  tag: string;
  from: string;
  to: string;
}

export interface StorageSearchResultItem {
  kind: StorageSearchResultKind;
  id: string;
  issueId: string;
  title: string;
  matchedFields: string[];
  snippet: string;
  status?: IssueCard["status"];
  recordType?: InvestigationRecord["type"];
  fileName?: string;
  errorCode?: string;
  category?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  generatedAt?: string;
}

export interface StorageSearchResult {
  query: string;
  filters: NormalizedStorageSearchFilters;
  items: StorageSearchResultItem[];
  readError: StorageReadError | null;
}

const LOCAL_DEFAULT_WORKSPACE_TIMESTAMP = "2026-04-23T00:00:00+08:00";

const LOCAL_DEFAULT_WORKSPACE: Workspace = {
  ...DEFAULT_WORKSPACE,
  createdAt: LOCAL_DEFAULT_WORKSPACE_TIMESTAMP,
  updatedAt: LOCAL_DEFAULT_WORKSPACE_TIMESTAMP,
};

const EMPTY_SEARCH_FILTERS: NormalizedStorageSearchFilters = {
  kind: "all",
  status: "all",
  tag: "",
  from: "",
  to: "",
};

function normalizeTagList(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
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

function mergeTags(...tagGroups: unknown[]): string[] {
  return normalizeTagList(tagGroups.flatMap((tags) => (Array.isArray(tags) ? tags : [])));
}

function normalizeSearchTagFilter(tag: string | undefined): string {
  return normalizeTagList((tag ?? "").split(/[,，]/)).join(",");
}

function searchTagFilterTokens(tag: string): string[] {
  return normalizeTagList(tag.split(/[,，]/)).map((value) => value.toLocaleLowerCase());
}

function normalizeStorageSearchFilters(
  filters: StorageSearchFilters = {},
): NormalizedStorageSearchFilters {
  return {
    kind: filters.kind ?? EMPTY_SEARCH_FILTERS.kind,
    status: filters.status ?? EMPTY_SEARCH_FILTERS.status,
    tag: normalizeSearchTagFilter(filters.tag),
    from: filters.from ?? EMPTY_SEARCH_FILTERS.from,
    to: filters.to ?? EMPTY_SEARCH_FILTERS.to,
  };
}

function searchTextFromValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(searchTextFromValue).filter(Boolean).join(" ");
  }
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function compactSearchText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function createLocalSearchSnippet(text: string, query: string): string {
  const compacted = compactSearchText(text);
  if (compacted.length <= 160) {
    return compacted;
  }
  const matchIndex = compacted.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  const start = matchIndex < 0 ? 0 : Math.max(0, matchIndex - 60);
  const end = Math.min(compacted.length, start + 160);
  return `${start > 0 ? "..." : ""}${compacted.slice(start, end)}${end < compacted.length ? "..." : ""}`;
}

function findLocalMatchedFields(
  fields: Array<[string, unknown]>,
  query: string,
): { matchedFields: string[]; snippet: string } {
  const normalizedQuery = query.toLocaleLowerCase();
  const matchedFields: string[] = [];
  let snippet = "";
  for (const [name, value] of fields) {
    const text = searchTextFromValue(value);
    if (text.toLocaleLowerCase().includes(normalizedQuery)) {
      matchedFields.push(name);
      if (!snippet) {
        snippet = createLocalSearchSnippet(text, query);
      }
    }
  }
  return { matchedFields, snippet };
}

function searchTimestamp(item: StorageSearchResultItem): string {
  return item.updatedAt ?? item.generatedAt ?? item.createdAt ?? "";
}

function matchesStorageSearchFilters(
  item: StorageSearchResultItem,
  filters: NormalizedStorageSearchFilters,
): boolean {
  if (filters.kind !== "all" && item.kind !== filters.kind) {
    return false;
  }
  if (filters.status !== "all" && item.status !== filters.status) {
    return false;
  }
  if (filters.tag.length > 0) {
    const requiredTags = searchTagFilterTokens(filters.tag);
    const itemTags = normalizeTagList(item.tags).map((tag) => tag.toLocaleLowerCase());
    if (!requiredTags.every((requiredTag) => itemTags.includes(requiredTag))) {
      return false;
    }
  }
  const datePart = searchTimestamp(item).slice(0, 10);
  if (filters.from && datePart < filters.from) {
    return false;
  }
  if (filters.to && datePart > filters.to) {
    return false;
  }
  return true;
}

function pushLocalSearchResult(
  items: StorageSearchResultItem[],
  item: StorageSearchResultItem,
  filters: NormalizedStorageSearchFilters,
): void {
  if (matchesStorageSearchFilters(item, filters)) {
    items.push(item);
  }
}

async function searchLocalStorage(
  query: string,
  filters: StorageSearchFilters = {},
  workspaceId: string = DEFAULT_WORKSPACE.id,
): Promise<StorageSearchResult> {
  const normalizedQuery = query.trim();
  const normalizedFilters = normalizeStorageSearchFilters(filters);
  if (normalizedQuery.length === 0) {
    return { query: normalizedQuery, filters: normalizedFilters, items: [], readError: null };
  }

  const items: StorageSearchResultItem[] = [];
  const issueList = listIssueCards();
  if (issueList.readError !== null) {
    return { query: normalizedQuery, filters: normalizedFilters, items: [], readError: issueList.readError };
  }

  for (const summary of issueList.valid) {
    const loaded = loadIssueCard(summary.id);
    if (!loaded.ok) continue;
    const issue = loaded.card;
    if (issue.projectId !== workspaceId) continue;
    const issueTags = normalizeTagList(issue.tags);
    const issueMatch = findLocalMatchedFields(
      [
        ["title", issue.title],
        ["rawInput", issue.rawInput],
        ["normalizedSummary", issue.normalizedSummary],
        ["symptomSummary", issue.symptomSummary],
        ["suspectedDirections", issue.suspectedDirections],
        ["suggestedActions", issue.suggestedActions],
        ["tags", issueTags],
      ],
      normalizedQuery,
    );
    if (issueMatch.matchedFields.length > 0) {
      pushLocalSearchResult(items, {
        kind: "issue",
        id: issue.id,
        issueId: issue.id,
        title: issue.title,
        matchedFields: issueMatch.matchedFields,
        snippet: issueMatch.snippet,
        status: issue.status,
        tags: issueTags,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
      }, normalizedFilters);
    }

    const records = listInvestigationRecordsByIssueId(issue.id);
    if (records.readError !== null) {
      return { query: normalizedQuery, filters: normalizedFilters, items: [], readError: records.readError };
    }
    for (const record of records.valid) {
      const recordMatch = findLocalMatchedFields(
        [
          ["rawText", record.rawText],
          ["polishedText", record.polishedText],
          ["aiExtractedSignals", record.aiExtractedSignals],
        ],
        normalizedQuery,
      );
      if (recordMatch.matchedFields.length === 0) continue;
      pushLocalSearchResult(items, {
        kind: "record",
        id: record.id,
        issueId: record.issueId,
        title: `排查记录：${record.issueId}`,
        matchedFields: recordMatch.matchedFields,
        snippet: recordMatch.snippet,
        status: issue.status,
        tags: issueTags,
        recordType: record.type,
        createdAt: record.createdAt,
      }, normalizedFilters);
    }
  }

  const archives = listArchiveDocuments();
  if (archives.readError !== null) {
    return { query: normalizedQuery, filters: normalizedFilters, items: [], readError: archives.readError };
  }
  for (const archive of archives.valid) {
    if (archive.projectId !== workspaceId) continue;
    const loaded = loadIssueCard(archive.issueId);
    const sourceIssue = loaded.ok && loaded.card.projectId === workspaceId ? loaded.card : null;
    const tags = mergeTags(sourceIssue?.tags);
    const archiveMatch = findLocalMatchedFields(
      [
        ["fileName", archive.fileName],
        ["markdownContent", archive.markdownContent],
        ["tags", tags],
      ],
      normalizedQuery,
    );
    if (archiveMatch.matchedFields.length === 0) continue;
    pushLocalSearchResult(items, {
      kind: "archive",
      id: archive.fileName,
      issueId: archive.issueId,
      title: archive.fileName,
      matchedFields: archiveMatch.matchedFields,
      snippet: archiveMatch.snippet,
      status: sourceIssue?.status,
      tags,
      fileName: archive.fileName,
      generatedAt: archive.generatedAt,
    }, normalizedFilters);
  }

  const errorEntries = listErrorEntries();
  if (errorEntries.readError !== null) {
    return { query: normalizedQuery, filters: normalizedFilters, items: [], readError: errorEntries.readError };
  }
  for (const entry of errorEntries.valid) {
    if (entry.projectId !== workspaceId) continue;
    const loaded = loadIssueCard(entry.sourceIssueId);
    const sourceIssue = loaded.ok && loaded.card.projectId === workspaceId ? loaded.card : null;
    const tags = mergeTags(sourceIssue?.tags, entry.tags);
    const entryMatch = findLocalMatchedFields(
      [
        ["errorCode", entry.errorCode],
        ["title", entry.title],
        ["category", entry.category],
        ["symptom", entry.symptom],
        ["rootCause", entry.rootCause],
        ["resolution", entry.resolution],
        ["prevention", entry.prevention],
        ["tags", tags],
      ],
      normalizedQuery,
    );
    if (entryMatch.matchedFields.length === 0) continue;
    pushLocalSearchResult(items, {
      kind: "error_entry",
      id: entry.id,
      issueId: entry.sourceIssueId,
      title: entry.title,
      matchedFields: entryMatch.matchedFields,
      snippet: entryMatch.snippet,
      status: sourceIssue?.status,
      tags,
      errorCode: entry.errorCode,
      category: entry.category,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }, normalizedFilters);
  }

  items.sort((a, b) => {
    const left = searchTimestamp(a);
    const right = searchTimestamp(b);
    return left < right ? 1 : left > right ? -1 : a.id.localeCompare(b.id);
  });

  return { query: normalizedQuery, filters: normalizedFilters, items, readError: null };
}

export interface CloseoutRecoveryItem {
  id: string;
  title: string;
  severity: IssueCard["severity"];
  status: IssueCard["status"];
  createdAt: string;
  updatedAt: string;
  closeoutState: "pending" | "failed";
}

export interface CloseoutRecoveryListResult {
  items: CloseoutRecoveryItem[];
  readError: StorageReadError | null;
}

export interface StorageRepository {
  search: {
    query(query: string, filters?: StorageSearchFilters): Promise<StorageSearchResult>;
  };
  workspaces: {
    list(): Promise<WorkspaceListResult>;
    create(input: CreateWorkspaceInput): Promise<CreateWorkspaceResult>;
  };
  issueCards: {
    list(): Promise<IssueCardListResult>;
    load(id: string): Promise<LoadIssueCardResult>;
    save(card: IssueCard): Promise<StorageWriteResult>;
  };
  investigationRecords: {
    listByIssueId(issueId: string): Promise<InvestigationRecordListResult>;
    append(record: InvestigationRecord): Promise<StorageWriteResult>;
  };
  archiveDocuments: {
    list(): Promise<ArchiveDocumentListResult>;
    save(document: ArchiveDocument): Promise<StorageWriteResult>;
  };
  errorEntries: {
    list(): Promise<ErrorEntryListResult>;
    save(entry: ErrorEntry): Promise<StorageWriteResult>;
  };
  formDrafts: {
    load(scope: FormDraftScope): Promise<FormDraftLoadResult>;
    save(record: FormDraftRecord): Promise<StorageWriteResult>;
    clear(scope: FormDraftScope): Promise<StorageWriteResult>;
  };
  closeoutRecovery: {
    list(): Promise<CloseoutRecoveryListResult>;
    clear(issueId: string): Promise<StorageWriteResult>;
  };
}

function createLocalStorageRepository(workspaceId: string = DEFAULT_WORKSPACE.id): StorageRepository {
  return {
    search: {
      async query(query: string, filters: StorageSearchFilters = {}): Promise<StorageSearchResult> {
        try {
          return await searchLocalStorage(query, filters, workspaceId);
        } catch (error) {
          return {
            query: query.trim(),
            filters: normalizeStorageSearchFilters(filters),
            items: [],
            readError: createReadFailed("issue_card", "local_search", error),
          };
        }
      },
    },
    workspaces: {
      async list(): Promise<WorkspaceListResult> {
        return { valid: [LOCAL_DEFAULT_WORKSPACE], invalid: [], readError: null };
      },
      async create(input: CreateWorkspaceInput): Promise<CreateWorkspaceResult> {
        if (input.name.trim().length === 0) {
          return {
            ok: false,
            error: createRemoteValidationFailed(
              "workspace",
              "create_workspace",
              "workspace.name is required",
            ),
          };
        }
        return {
          ok: false,
          error: createUnexpectedWriteError(
            "workspace",
            "create_workspace",
            "creating workspaces requires the HTTP storage adapter",
          ),
        };
      },
    },
    issueCards: {
      async list(): Promise<IssueCardListResult> {
        return listIssueCards();
      },
      async load(id: string): Promise<LoadIssueCardResult> {
        return loadIssueCard(id);
      },
      async save(card: IssueCard): Promise<StorageWriteResult> {
        return saveIssueCard(card);
      },
    },
    investigationRecords: {
      async listByIssueId(issueId: string): Promise<InvestigationRecordListResult> {
        return listInvestigationRecordsByIssueId(issueId);
      },
      async append(record: InvestigationRecord): Promise<StorageWriteResult> {
        return saveInvestigationRecord(record);
      },
    },
    archiveDocuments: {
      async list(): Promise<ArchiveDocumentListResult> {
        return listArchiveDocuments();
      },
      async save(document: ArchiveDocument): Promise<StorageWriteResult> {
        return saveArchiveDocument(document);
      },
    },
    errorEntries: {
      async list(): Promise<ErrorEntryListResult> {
        return listErrorEntries();
      },
      async save(entry: ErrorEntry): Promise<StorageWriteResult> {
        return saveErrorEntry(entry);
      },
    },
    formDrafts: {
      async load(scope: FormDraftScope): Promise<FormDraftLoadResult> {
        const storage = getBrowserFormDraftStorage();
        if (storage === null) return { ok: true, draft: null };
        try {
          const payloadJson = storage.getItem(formDraftStorageKey(scope));
          return {
            ok: true,
            draft: payloadJson === null
              ? null
              : { ...scope, payloadJson, updatedAt: new Date().toISOString() },
          };
        } catch (error) {
          return { ok: false, error: createReadFailed("form_draft", formDraftStorageKey(scope), error) };
        }
      },
      async save(record: FormDraftRecord): Promise<StorageWriteResult> {
        const storage = getBrowserFormDraftStorage();
        if (storage === null) {
          return {
            ok: false,
            error: createUnexpectedWriteError("form_draft", formDraftStorageKey(record), "localStorage is unavailable"),
          };
        }
        try {
          storage.setItem(formDraftStorageKey(record), record.payloadJson);
          return storageWriteOk();
        } catch (error) {
          return { ok: false, error: createUnexpectedWriteError("form_draft", formDraftStorageKey(record), error) };
        }
      },
      async clear(scope: FormDraftScope): Promise<StorageWriteResult> {
        const storage = getBrowserFormDraftStorage();
        if (storage === null) {
          return {
            ok: false,
            error: createUnexpectedWriteError("form_draft", formDraftStorageKey(scope), "localStorage is unavailable"),
          };
        }
        try {
          storage.removeItem(formDraftStorageKey(scope));
          return storageWriteOk();
        } catch (error) {
          return { ok: false, error: createUnexpectedWriteError("form_draft", formDraftStorageKey(scope), error) };
        }
      },
    },
    closeoutRecovery: {
      // localStorage fallback never wrote closeout_state markers (TECH-01/02 are
      // server-only), so the recovery list is always empty. Clear is a no-op so
      // callers can use the same surface uniformly.
      async list(): Promise<CloseoutRecoveryListResult> {
        return { items: [], readError: null };
      },
      async clear(): Promise<StorageWriteResult> {
        return storageWriteOk();
      },
    },
  };
}

export const localStorageStorageRepository: StorageRepository = createLocalStorageRepository();

export type StorageRepositoryRuntime = "http" | "local_storage";

export const STORAGE_REPOSITORY_RUNTIME: StorageRepositoryRuntime =
  typeof document !== "undefined" && typeof window !== "undefined" ? "http" : "local_storage";

export function createStorageRepository(options: { workspaceId?: string } = {}): StorageRepository {
  return STORAGE_REPOSITORY_RUNTIME === "http"
    ? createHttpStorageRepository({ workspaceId: options.workspaceId })
    : createLocalStorageRepository(options.workspaceId ?? DEFAULT_WORKSPACE.id);
}

export const storageRepository: StorageRepository = createStorageRepository();

export { checkHttpStorageHealth, httpStorageRepository };
