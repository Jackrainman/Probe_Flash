import { join } from "node:path";

import { startProbeFlashServer } from "../../server/src/server.mjs";
import { buildIssueCardFromIntake, defaultIntakeOptions } from "../src/domain/issue-intake.ts";
import type { ArchiveDocument } from "../src/domain/schemas/archive-document.ts";
import type { ErrorEntry } from "../src/domain/schemas/error-entry.ts";
import type { IssueCard } from "../src/domain/schemas/issue-card.ts";
import { createHttpStorageRepository } from "../src/storage/http-storage-repository.ts";
import { createStorageRepository, type StorageRepository, type StorageSearchResult } from "../src/storage/storage-repository.ts";
import { createTempDir } from "./verify-helpers.mts";

interface LocalStorageShape {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  key(index: number): string | null;
  readonly length: number;
}

const WORKSPACE_ID = "workspace-26-r1";
const OTHER_WORKSPACE_ID = "workspace-search-tags-local-other";
const NOW = "2026-04-27T20:20:00+08:00";

function fail(reason: string, detail?: unknown): never {
  console.error(`[SEARCH-TAGS desktop verify] FAIL: ${reason}`);
  if (detail !== undefined) {
    console.error(JSON.stringify(detail, null, 2));
  }
  throw new Error(reason);
}

function assert(condition: unknown, reason: string, detail?: unknown): asserts condition {
  if (!condition) fail(reason, detail);
}

function makeLocalStoragePolyfill(): LocalStorageShape {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
  };
}

function buildIssue(workspaceId: string, id: string, title: string, description: string, tags: string[]): IssueCard {
  const result = buildIssueCardFromIntake(
    {
      title,
      description,
      severity: "medium",
      tags,
    },
    defaultIntakeOptions(NOW, id, workspaceId),
  );
  assert(result.ok, "issue fixture should build", result);
  return result.card;
}

function buildLegacyIssueWithoutTags(workspaceId: string): Omit<IssueCard, "tags"> {
  const { tags: _tags, ...issue } = buildIssue(
    workspaceId,
    "issue-search-tags-legacy-local-0001",
    "Legacy no tag sentinel",
    "Legacy no tag sentinel should still be searchable without crashing.",
    [],
  );
  return issue;
}

function buildArchive(workspaceId: string, issueId: string): ArchiveDocument {
  return {
    issueId,
    projectId: workspaceId,
    fileName: "2026-04-27_search-tags-desktop.md",
    filePath: ".debug_workspace/archive/2026-04-27_search-tags-desktop.md",
    markdownContent: "# Search tags desktop archive\n\nTag sentinel archive body does not repeat the source labels.",
    generatedBy: "manual",
    generatedAt: NOW,
  };
}

function buildErrorEntry(workspaceId: string, issueId: string, archiveFilePath: string): ErrorEntry {
  return {
    id: "error-entry-search-tags-desktop-0001",
    projectId: workspaceId,
    sourceIssueId: issueId,
    errorCode: "DBG-20260427-602",
    title: "Tag sentinel desktop error entry",
    category: "Gyro",
    symptom: "Tag sentinel desktop issue recurred during bring-up.",
    rootCause: "Loose gyro cable caused intermittent readings.",
    resolution: "Reworked the connector and verified stable telemetry.",
    prevention: "Add gyro connector inspection to the pre-match checklist.",
    tags: ["Gyro", "Connector"],
    relatedFiles: [],
    relatedCommits: [],
    archiveFilePath,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

async function saveIssue(repository: StorageRepository, issue: IssueCard) {
  const saved = await repository.issueCards.save(issue);
  assert(saved.ok, "issue save should succeed", saved);
}

async function saveArchive(repository: StorageRepository, archive: ArchiveDocument) {
  const saved = await repository.archiveDocuments.save(archive);
  assert(saved.ok, "archive save should succeed", saved);
}

async function saveErrorEntry(repository: StorageRepository, entry: ErrorEntry) {
  const saved = await repository.errorEntries.save(entry);
  assert(saved.ok, "error entry save should succeed", saved);
}

async function expectSearch(
  repository: StorageRepository,
  query: string,
  filters: Parameters<StorageRepository["search"]["query"]>[1] = {},
): Promise<StorageSearchResult> {
  const result = await repository.search.query(query, filters);
  assert(result.readError === null, `search ${query} should not return readError`, result.readError);
  return result;
}

function hasKind(result: StorageSearchResult, kind: string, text: string): boolean {
  return result.items.some(
    (item) => item.kind === kind && JSON.stringify(item).toLocaleLowerCase().includes(text.toLocaleLowerCase()),
  );
}

function hasTag(item: StorageSearchResult["items"][number], tag: string): boolean {
  return item.tags?.some((candidate) => candidate.toLocaleLowerCase() === tag.toLocaleLowerCase()) ?? false;
}

function insertLegacyIssueWithoutTags() {
  window.localStorage.setItem(
    "repo-debug:issue-card:issue-search-tags-legacy-local-0001",
    JSON.stringify(buildLegacyIssueWithoutTags(WORKSPACE_ID)),
  );
}

async function seedRepository(repository: StorageRepository, workspaceId: string) {
  const issue = buildIssue(
    workspaceId,
    `issue-search-tags-${workspaceId}-0001`,
    "Tag sentinel gyro dropout",
    "Tag sentinel source issue for desktop repository verify.",
    ["Gyro", "CAN"],
  );
  await saveIssue(repository, issue);
  const archive = buildArchive(workspaceId, issue.id);
  await saveArchive(repository, archive);
  await saveErrorEntry(repository, buildErrorEntry(workspaceId, issue.id, archive.filePath));
  return { issue, archive };
}

async function verifyRepositoryTags(repository: StorageRepository, label: string) {
  const tagQueryResults = await expectSearch(repository, "Gyro");
  assert(hasKind(tagQueryResults, "issue", "issue-search-tags"), `${label}: tag query should hit issue tags`, tagQueryResults);
  assert(hasKind(tagQueryResults, "archive", "search-tags-desktop"), `${label}: tag query should hit archive source issue tags`, tagQueryResults);
  assert(hasKind(tagQueryResults, "error_entry", "DBG-20260427-602"), `${label}: tag query should hit error-entry tags`, tagQueryResults);

  const tagFilterResults = await expectSearch(repository, "tag sentinel", { tag: "gyro" });
  assert(tagFilterResults.items.length > 0, `${label}: tag filter should return records`, tagFilterResults);
  assert(tagFilterResults.items.every((item) => hasTag(item, "Gyro")), `${label}: tag filter should be exact`, tagFilterResults);

  const multiTagResults = await expectSearch(repository, "tag sentinel", { tag: "gyro, CAN" });
  assert(multiTagResults.filters.tag === "gyro,CAN", `${label}: multi tag filter should normalize`, multiTagResults);
  assert(multiTagResults.items.length > 0, `${label}: multi tag filter should return matches`, multiTagResults);
  assert(
    multiTagResults.items.every((item) => hasTag(item, "Gyro") && hasTag(item, "CAN")),
    `${label}: multi tag filter should require all tags`,
    multiTagResults,
  );

  const noTagResults = await expectSearch(repository, "tag sentinel", { tag: "Power" });
  assert(noTagResults.items.length === 0, `${label}: no-result tag filter should be empty`, noTagResults);
}

(globalThis as unknown as { window: { localStorage: LocalStorageShape } }).window = {
  localStorage: makeLocalStoragePolyfill(),
};

const localRepository = createStorageRepository({ workspaceId: WORKSPACE_ID });
await seedRepository(localRepository, WORKSPACE_ID);
const localOtherRepository = createStorageRepository({ workspaceId: OTHER_WORKSPACE_ID });
await saveIssue(
  localOtherRepository,
  buildIssue(
    OTHER_WORKSPACE_ID,
    "issue-search-tags-local-other-0001",
    "Other workspace gyro leakage sentinel",
    "Other workspace tag sentinel must not leak.",
    ["Gyro", "Power"],
  ),
);
insertLegacyIssueWithoutTags();
await verifyRepositoryTags(localRepository, "localStorage fallback");

const localIsolation = await expectSearch(localRepository, "leakage", { tag: "Gyro" });
assert(localIsolation.items.length === 0, "localStorage fallback: tag search should stay workspace-scoped", localIsolation);
const localOtherIsolation = await expectSearch(localOtherRepository, "leakage", { tag: "Gyro" });
assert(hasKind(localOtherIsolation, "issue", "issue-search-tags-local-other"), "localStorage fallback: other workspace should find its own issue", localOtherIsolation);
const localLegacy = await expectSearch(localRepository, "legacy no tag sentinel");
assert(hasKind(localLegacy, "issue", "issue-search-tags-legacy-local"), "localStorage fallback: legacy issue without tags should remain searchable", localLegacy);

const workdir = createTempDir("probeflash-search-tags-desktop").path;
const dbPath = join(workdir, "probeflash.search-tags.sqlite");
const server = await startProbeFlashServer({ host: "127.0.0.1", port: 0, dbPath });

try {
  const baseUrl = `${server.baseUrl}/api`;
  const repository = createHttpStorageRepository({ baseUrl, workspaceId: WORKSPACE_ID });
  await seedRepository(repository, WORKSPACE_ID);
  const createdWorkspace = await repository.workspaces.create({ name: "Search Tags HTTP Isolation Workspace" });
  assert(createdWorkspace.ok, "secondary workspace should be created", createdWorkspace);
  const otherRepository = createHttpStorageRepository({ baseUrl, workspaceId: createdWorkspace.workspace.id });
  await saveIssue(
    otherRepository,
    buildIssue(
      createdWorkspace.workspace.id,
      "issue-search-tags-http-other-0001",
      "Other workspace gyro leakage sentinel",
      "Other workspace tag sentinel must not leak over HTTP.",
      ["Gyro", "Power"],
    ),
  );

  await verifyRepositoryTags(repository, "HTTP repository");
  const httpIsolation = await expectSearch(repository, "leakage", { tag: "Gyro" });
  assert(httpIsolation.items.length === 0, "HTTP repository: tag search should stay workspace-scoped", httpIsolation);
  const httpOtherIsolation = await expectSearch(otherRepository, "leakage", { tag: "Gyro" });
  assert(hasKind(httpOtherIsolation, "issue", "issue-search-tags-http-other"), "HTTP repository: other workspace should find its own issue", httpOtherIsolation);
} finally {
  await server.close();
}

console.log("[SEARCH-TAGS desktop verify] PASS: localStorage fallback and HTTP repository tag search agree");
console.log("[SEARCH-TAGS desktop verify] PASS: tag, multi-tag, no-result, workspace isolation, and legacy missing tags are covered");
