import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { startProbeFlashServer } from "../../server/src/server.mjs";
import { buildIssueCardFromIntake, defaultIntakeOptions } from "../src/domain/issue-intake.ts";
import type { ArchiveDocument } from "../src/domain/schemas/archive-document.ts";
import type { ErrorEntry } from "../src/domain/schemas/error-entry.ts";
import type { IssueCard } from "../src/domain/schemas/issue-card.ts";
import { loadArchiveIndex } from "../src/storage/archive-index.ts";
import { createHttpStorageRepository } from "../src/storage/http-storage-repository.ts";
import { createStorageRepository, type StorageRepository } from "../src/storage/storage-repository.ts";
import { createTempDir } from "./verify-helpers.mts";

interface LocalStorageShape {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  key(index: number): string | null;
  readonly length: number;
}

const WORKSPACE_ID = "workspace-archive-review-page";
const OTHER_WORKSPACE_ID = "workspace-archive-review-page-other";
const NOW = "2026-04-27T22:50:00+08:00";

function fail(reason: string, detail?: unknown): never {
  console.error(`[SEARCH-03-ARCHIVE-REVIEW-PAGE verify] FAIL: ${reason}`);
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

function buildIssue(workspaceId: string, id: string): IssueCard {
  const result = buildIssueCardFromIntake(
    {
      title: "Archive review source issue",
      description: "Archive review page should jump back to this source issue.",
      severity: "medium",
      tags: ["Motor", "复盘"],
    },
    defaultIntakeOptions(NOW, id, workspaceId),
  );
  assert(result.ok, "issue fixture should build", result);
  return result.card;
}

function buildArchive(
  workspaceId: string,
  issueId: string,
  fileName: string,
  generatedAt: string,
): ArchiveDocument {
  return {
    issueId,
    projectId: workspaceId,
    fileName,
    filePath: `.debug_workspace/archive/${fileName}`,
    markdownContent: `# Archive Review Sentinel\n\n复盘正文 sentinel for ${issueId}.`,
    generatedBy: "hybrid",
    generatedAt,
  };
}

function buildErrorEntry(
  workspaceId: string,
  issueId: string,
  archiveFilePath: string,
  errorEntryId: string,
): ErrorEntry {
  return {
    id: errorEntryId,
    projectId: workspaceId,
    sourceIssueId: issueId,
    errorCode: "DBG-20260427-703",
    title: "Archive review linked error entry",
    category: "Motor",
    symptom: "Archive review page sentinel symptom.",
    rootCause: "Motor harness moved during vibration.",
    resolution: "Secured the harness and verified the issue did not recur.",
    prevention: "Add harness tug test to pre-run checklist.",
    tags: ["Motor", "Harness"],
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

async function seedRepository(repository: StorageRepository, workspaceId: string, variant = "main") {
  const linkedName = variant === "main" ? "linked" : `${variant}-linked`;
  const unlinkedName = variant === "main" ? "unlinked" : `${variant}-unlinked`;
  const errorEntryId = variant === "main"
    ? "error-entry-archive-review-page-0001"
    : `error-entry-archive-review-page-${variant}-0001`;
  const issue = buildIssue(workspaceId, `issue-archive-review-${variant}-0001`);
  await saveIssue(repository, issue);
  const linkedArchive = buildArchive(
    workspaceId,
    issue.id,
    `2026-04-27_archive-review-${linkedName}.md`,
    NOW,
  );
  await saveArchive(repository, linkedArchive);
  const errorEntry = buildErrorEntry(workspaceId, issue.id, linkedArchive.filePath, errorEntryId);
  await saveErrorEntry(repository, errorEntry);

  const unlinkedIssue = buildIssue(workspaceId, `issue-archive-review-${variant}-unlinked-0001`);
  await saveIssue(repository, unlinkedIssue);
  const unlinkedArchive = buildArchive(
    workspaceId,
    unlinkedIssue.id,
    `2026-04-26_archive-review-${unlinkedName}.md`,
    "2026-04-26T12:00:00+08:00",
  );
  await saveArchive(repository, unlinkedArchive);
  return { issue, linkedArchive, unlinkedIssue, unlinkedArchive, errorEntry };
}

function assertArchiveReviewIndex(
  label: string,
  index: Awaited<ReturnType<typeof loadArchiveIndex>>,
  expectedInvalidCount: number,
  fixture: Awaited<ReturnType<typeof seedRepository>>,
) {
  assert(index.readErrors.length === 0, `${label}: archive index should not have read errors`, index);
  assert(index.invalidCount === expectedInvalidCount, `${label}: invalid count should be surfaced`, index);
  assert(index.items.length === 2, `${label}: archive index should include both valid archives`, index.items);
  assert(
    index.items[0]?.fileName === fixture.linkedArchive.fileName,
    `${label}: newest archive should stay first`,
    index.items.map((item) => item.fileName),
  );
  const linked = index.items.find((item) => item.fileName === fixture.linkedArchive.fileName);
  assert(linked, `${label}: linked archive should be present`, index.items);
  assert(linked.errorCode === "DBG-20260427-703", `${label}: error code should join by source issue`, linked);
  assert(
    linked.errorEntryId === fixture.errorEntry.id,
    `${label}: error entry id should be available for review metadata`,
    linked,
  );
  assert(linked.category === "Motor", `${label}: category should join by source issue`, linked);
  assert(linked.tags.includes("Harness"), `${label}: error-entry tags should be available`, linked);
  assert(
    linked.markdownContent.includes("Archive Review Sentinel"),
    `${label}: markdown content should be available for preview`,
    linked,
  );

  const unlinked = index.items.find((item) => item.fileName === fixture.unlinkedArchive.fileName);
  assert(unlinked, `${label}: unlinked archive should remain visible`, index.items);
  assert(unlinked.errorCode === null && unlinked.errorEntryId === null, `${label}: unlinked archive metadata should be null`, unlinked);
}

function verifySourceMarkers() {
  const appSource = readFileSync(resolve(process.cwd(), "src", "App.tsx"), "utf8");
  const cssSource = readFileSync(resolve(process.cwd(), "src", "App.css"), "utf8");
  const archiveIndexSource = readFileSync(
    resolve(process.cwd(), "src", "storage", "archive-index.ts"),
    "utf8",
  );

  for (const marker of [
    'data-testid="archive-review-page"',
    'data-testid="archive-review-panel"',
    'data-testid="archive-review-select"',
    'data-testid="archive-review-open-issue"',
    'data-testid="archive-review-error-entry-link"',
    'data-testid="archive-review-markdown"',
    "onOpenIssue={(issueId) => {",
    "setActiveIssueId(issueId);",
    "externalSelectedIssueId={activeIssueId}",
    "handleSelect(externalSelectedIssueId)",
  ]) {
    assert(appSource.includes(marker), `App.tsx missing archive review marker: ${marker}`);
  }

  for (const marker of [
    ".archive-review-layout",
    ".archive-review-panel",
    ".archive-review-markdown",
    ".archive-drawer-item-button[data-selected=\"true\"]",
  ]) {
    assert(cssSource.includes(marker), `App.css missing archive review style marker: ${marker}`);
  }

  for (const marker of [
    "errorEntryId: entry.id",
    "markdownContent: doc.markdownContent",
  ]) {
    assert(archiveIndexSource.includes(marker), `archive-index.ts missing marker: ${marker}`);
  }
}

(globalThis as unknown as { window: { localStorage: LocalStorageShape } }).window = {
  localStorage: makeLocalStoragePolyfill(),
};

const localRepository = createStorageRepository({ workspaceId: WORKSPACE_ID });
const localFixture = await seedRepository(localRepository, WORKSPACE_ID);
const otherRepository = createStorageRepository({ workspaceId: OTHER_WORKSPACE_ID });
const localOtherFixture = await seedRepository(otherRepository, OTHER_WORKSPACE_ID, "other");
window.localStorage.setItem("repo-debug:archive-document:broken-archive-review.md", "{not json");
window.localStorage.setItem(
  "repo-debug:error-entry:broken-archive-review",
  JSON.stringify({ id: "broken-archive-review" }),
);
assertArchiveReviewIndex(
  "localStorage fallback",
  await loadArchiveIndex(localRepository, WORKSPACE_ID),
  2,
  localFixture,
);
assertArchiveReviewIndex(
  "localStorage other workspace",
  await loadArchiveIndex(otherRepository, OTHER_WORKSPACE_ID),
  2,
  localOtherFixture,
);

const workdir = createTempDir("probeflash-archive-review-desktop").path;
const dbPath = join(workdir, "probeflash.archive-review.sqlite");
const server = await startProbeFlashServer({ host: "127.0.0.1", port: 0, dbPath });

try {
  const baseUrl = `${server.baseUrl}/api`;
  const bootstrapRepository = createHttpStorageRepository({ baseUrl, workspaceId: WORKSPACE_ID });
  const createdWorkspace = await bootstrapRepository.workspaces.create({ name: "Archive Review Page Verify" });
  assert(createdWorkspace.ok, "HTTP repository: workspace should be created", createdWorkspace);
  const repository = createHttpStorageRepository({
    baseUrl,
    workspaceId: createdWorkspace.workspace.id,
  });
  const fixture = await seedRepository(repository, createdWorkspace.workspace.id);
  const index = await loadArchiveIndex(repository, createdWorkspace.workspace.id);
  assertArchiveReviewIndex("HTTP repository", index, 0, fixture);
  const sourceIssue = await repository.issueCards.load(index.items[0]!.issueId);
  assert(sourceIssue.ok && sourceIssue.card.id === fixture.issue.id, "HTTP repository: source issue should load from review link", sourceIssue);
} finally {
  await server.close();
}

verifySourceMarkers();

console.log("[SEARCH-03-ARCHIVE-REVIEW-PAGE verify] PASS: archive index exposes markdown, source issue and error-entry metadata");
console.log("[SEARCH-03-ARCHIVE-REVIEW-PAGE verify] PASS: review drawer markers and source issue jump wiring are present");
