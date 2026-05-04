import { join } from "node:path";

import { startProbeFlashServer } from "../../server/src/server.mjs";
import { buildIssueCardFromIntake, defaultIntakeOptions } from "../src/domain/issue-intake.ts";
import {
  buildInvestigationRecordFromIntake,
  defaultInvestigationIntakeOptions,
} from "../src/domain/investigation-intake.ts";
import type { ArchiveDocument } from "../src/domain/schemas/archive-document.ts";
import type { ErrorEntry } from "../src/domain/schemas/error-entry.ts";
import type { IssueCard } from "../src/domain/schemas/issue-card.ts";
import { createHttpStorageRepository } from "../src/storage/http-storage-repository.ts";
import type { StorageRepository, StorageSearchFilters, StorageSearchResult } from "../src/storage/storage-repository.ts";
import { createTempDir } from "./verify-helpers.mts";

const WORKSPACE_ID = "workspace-26-r1";
const OPEN_TIME = "2026-04-25T10:00:00+08:00";
const RESOLVED_TIME = "2026-04-26T11:00:00+08:00";

function fail(reason: string, detail?: unknown): never {
  console.error(`[SEARCH-FILTERS desktop verify] FAIL: ${reason}`);
  if (detail !== undefined) {
    console.error(JSON.stringify(detail, null, 2));
  }
  throw new Error(reason);
}

function assert(condition: unknown, reason: string, detail?: unknown): asserts condition {
  if (!condition) {
    fail(reason, detail);
  }
}

function buildIssue(
  workspaceId: string,
  id: string,
  title: string,
  description: string,
  options: {
    status: IssueCard["status"];
    tags: string[];
    createdAt: string;
    updatedAt?: string;
  },
): IssueCard {
  const result = buildIssueCardFromIntake(
    {
      title,
      description,
      severity: "medium",
    },
    defaultIntakeOptions(options.createdAt, id, workspaceId),
  );
  assert(result.ok, "issue fixture should build", result);
  return {
    ...result.card,
    status: options.status,
    tags: options.tags,
    createdAt: options.createdAt,
    updatedAt: options.updatedAt ?? options.createdAt,
  };
}

function buildRecord(issueId: string, id: string, note: string, createdAt = OPEN_TIME) {
  const result = buildInvestigationRecordFromIntake(
    {
      issueId,
      type: "observation",
      note,
    },
    defaultInvestigationIntakeOptions(createdAt, id),
  );
  assert(result.ok, "record fixture should build", result);
  return result.record;
}

function buildArchive(workspaceId: string, issueId: string): ArchiveDocument {
  return {
    issueId,
    projectId: workspaceId,
    fileName: "2026-04-26_search-filter-resolved.md",
    filePath: ".debug_workspace/archive/2026-04-26_search-filter-resolved.md",
    markdownContent: "# Filter archive\n\nResolved filter sentinel root cause in the thermal path.",
    generatedBy: "manual",
    generatedAt: RESOLVED_TIME,
  };
}

function buildErrorEntry(workspaceId: string, issueId: string, archiveFilePath: string): ErrorEntry {
  return {
    id: "error-entry-search-filter-desktop-0001",
    projectId: workspaceId,
    sourceIssueId: issueId,
    errorCode: "DBG-20260426-502",
    title: "Filter sentinel resolved error entry",
    category: "Thermal",
    symptom: "Filter sentinel recurring thermal drift.",
    rootCause: "Resolved filter sentinel root cause in the thermal path.",
    resolution: "Adjusted sensor calibration and verified stable readings.",
    prevention: "Add thermal sensor calibration to the release checklist.",
    relatedFiles: [],
    relatedCommits: [],
    archiveFilePath,
    createdAt: RESOLVED_TIME,
    updatedAt: RESOLVED_TIME,
  };
}

async function saveIssue(repository: StorageRepository, issue: IssueCard) {
  const saved = await repository.issueCards.save(issue);
  assert(saved.ok, "issue save should succeed", saved);
}

async function appendRecord(repository: StorageRepository, issueId: string, recordId: string, note: string) {
  const saved = await repository.investigationRecords.append(buildRecord(issueId, recordId, note));
  assert(saved.ok, "record append should succeed", saved);
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
  filters: StorageSearchFilters = {},
): Promise<StorageSearchResult> {
  const result = await repository.search.query(query, filters);
  assert(result.readError === null, `search ${query} should not return readError`, result.readError);
  return result;
}

function hasKind(result: StorageSearchResult, kind: string, text: string): boolean {
  return result.items.some(
    (item) =>
      item.kind === kind &&
      JSON.stringify(item).toLocaleLowerCase().includes(text.toLocaleLowerCase()),
  );
}

function resultDatePart(item: StorageSearchResult["items"][number]): string {
  return (item.updatedAt ?? item.generatedAt ?? item.createdAt ?? "").slice(0, 10);
}

function hasTag(item: StorageSearchResult["items"][number], tag: string): boolean {
  return item.tags?.some((candidate) => candidate.toLocaleLowerCase() === tag.toLocaleLowerCase()) ?? false;
}

const workdir = createTempDir("probeflash-search-filters-desktop").path;
const dbPath = join(workdir, "probeflash.search-filters.sqlite");
const server = await startProbeFlashServer({ host: "127.0.0.1", port: 0, dbPath });

try {
  const baseUrl = `${server.baseUrl}/api`;
  const repository = createHttpStorageRepository({ baseUrl, workspaceId: WORKSPACE_ID });
  const openIssue = buildIssue(
    WORKSPACE_ID,
    "issue-search-filter-desktop-open-0001",
    "Open filter sentinel CAN dropout",
    "Filter sentinel open issue should be found by tag and type filters.",
    { status: "open", tags: ["CAN", "Power"], createdAt: OPEN_TIME },
  );
  const resolvedIssue = buildIssue(
    WORKSPACE_ID,
    "issue-search-filter-desktop-resolved-0001",
    "Resolved filter sentinel thermal drift",
    "Filter sentinel resolved issue should be found by status and date filters.",
    { status: "resolved", tags: ["Thermal", "Sensor"], createdAt: RESOLVED_TIME },
  );
  await saveIssue(repository, openIssue);
  await saveIssue(repository, resolvedIssue);
  await appendRecord(
    repository,
    openIssue.id,
    "record-search-filter-desktop-open-0001",
    "Filter sentinel record belongs to the open CAN issue.",
  );
  const archive = buildArchive(WORKSPACE_ID, resolvedIssue.id);
  await saveArchive(repository, archive);
  await saveErrorEntry(repository, buildErrorEntry(WORKSPACE_ID, resolvedIssue.id, archive.filePath));

  const createdWorkspace = await repository.workspaces.create({ name: "Search Filter Isolation Workspace" });
  assert(createdWorkspace.ok, "secondary workspace should be created", createdWorkspace);
  const otherRepository = createHttpStorageRepository({
    baseUrl,
    workspaceId: createdWorkspace.workspace.id,
  });
  await saveIssue(
    otherRepository,
    buildIssue(
      createdWorkspace.workspace.id,
      "issue-search-filter-desktop-other-0001",
      "Other workspace filter sentinel leakage",
      "This filtered sentinel must not leak into the default workspace.",
      { status: "open", tags: ["Power"], createdAt: OPEN_TIME },
    ),
  );

  const allResults = await expectSearch(repository, "filter sentinel");
  assert(allResults.filters.kind === "all", "repository search should return normalized kind=all", allResults);
  assert(hasKind(allResults, "issue", openIssue.id), "repository search should include issue matches", allResults);
  assert(hasKind(allResults, "record", "record-search-filter-desktop-open"), "repository search should include record matches", allResults);
  assert(hasKind(allResults, "archive", archive.fileName), "repository search should include archive matches", allResults);
  assert(hasKind(allResults, "error_entry", "DBG-20260426-502"), "repository search should include error-entry matches", allResults);

  const kindResults = await expectSearch(repository, "filter sentinel", { kind: "archive" });
  assert(kindResults.filters.kind === "archive", "repository should preserve normalized kind filter", kindResults);
  assert(kindResults.items.length === 1 && kindResults.items[0].kind === "archive", "kind=archive should only return the archive", kindResults);

  const statusResults = await expectSearch(repository, "filter sentinel", { status: "resolved" });
  assert(statusResults.filters.status === "resolved", "repository should preserve normalized status filter", statusResults);
  assert(statusResults.items.length > 0, "status=resolved should return matches", statusResults);
  assert(statusResults.items.every((item) => item.status === "resolved"), "status filter should exclude non-resolved source issues", statusResults);
  assert(!statusResults.items.some((item) => item.issueId === openIssue.id), "status filter should remove open source issue results", statusResults);

  const tagResults = await expectSearch(repository, "filter sentinel", { tag: "power" });
  assert(tagResults.filters.tag === "power", "repository should preserve normalized tag filter", tagResults);
  assert(tagResults.items.length > 0, "tag=power should return matches", tagResults);
  assert(tagResults.items.every((item) => hasTag(item, "power")), "tag filter should be case-insensitive and exact", tagResults);
  assert(!tagResults.items.some((item) => item.issueId === resolvedIssue.id), "tag filter should remove other source issue tags", tagResults);

  const dateResults = await expectSearch(repository, "filter sentinel", {
    from: "2026-04-26",
    to: "2026-04-26",
  });
  assert(dateResults.filters.from === "2026-04-26" && dateResults.filters.to === "2026-04-26", "repository should preserve date filters", dateResults);
  assert(dateResults.items.length > 0, "date range should return matching day results", dateResults);
  assert(dateResults.items.every((item) => resultDatePart(item) === "2026-04-26"), "date range should keep only matching day results", dateResults);

  const combinedResults = await expectSearch(repository, "filter sentinel", {
    kind: "archive",
    status: "resolved",
    tag: "thermal",
    from: "2026-04-26",
    to: "2026-04-26",
  });
  assert(combinedResults.items.length === 1, "combined filters should narrow to one archive", combinedResults);
  assert(combinedResults.items[0].kind === "archive" && combinedResults.items[0].issueId === resolvedIssue.id, "combined filters should keep the resolved archive", combinedResults);

  const defaultIsolation = await expectSearch(repository, "leakage", { tag: "power" });
  assert(defaultIsolation.items.length === 0, "filtered default workspace search must not leak other workspace", defaultIsolation);
  const otherIsolation = await expectSearch(otherRepository, "leakage", { tag: "power" });
  assert(hasKind(otherIsolation, "issue", "issue-search-filter-desktop-other"), "filtered other workspace should search its own data", otherIsolation);

  const blankQuery = await expectSearch(repository, "   ", { kind: "record", tag: " CAN " });
  assert(
    blankQuery.items.length === 0 && blankQuery.query === "" && blankQuery.filters.kind === "record" && blankQuery.filters.tag === "CAN",
    "blank query should be handled client-side while preserving normalized filters",
    blankQuery,
  );

  const invalidKind = await repository.search.query("filter sentinel", {
    kind: "invalid" as unknown as StorageSearchFilters["kind"],
  });
  assert(invalidKind.readError !== null, "invalid server filter should surface as repository readError", invalidKind);
} finally {
  await server.close();
}

console.log("[SEARCH-FILTERS desktop verify] PASS: HTTP repository applies kind, status, tag, date, and combined filters");
console.log("[SEARCH-FILTERS desktop verify] PASS: filtered repository search remains workspace-scoped");
console.log("[SEARCH-FILTERS desktop verify] PASS: blank query preserves filters and invalid filters surface readError");
