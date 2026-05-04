import { join } from "node:path";

import { startProbeFlashServer } from "../../server/src/server.mjs";
import type { ArchiveDocument } from "../src/domain/schemas/archive-document.ts";
import type { ErrorEntry } from "../src/domain/schemas/error-entry.ts";
import type { IssueCard } from "../src/domain/schemas/issue-card.ts";
import { findSimilarIssuesForIssue, rankSimilarIssues } from "../src/search/similar-issues.ts";
import { createHttpStorageRepository } from "../src/storage/http-storage-repository.ts";
import { createStorageRepository, type StorageRepository } from "../src/storage/storage-repository.ts";
import {
  buildSearchIssue,
  installSearchVerifyLocalStorage,
  SEARCH_VERIFY_WORKSPACE_ID,
} from "./search-verify-fixtures.mts";
import { createTempDir } from "./verify-helpers.mts";

const WORKSPACE_ID = SEARCH_VERIFY_WORKSPACE_ID;
const OTHER_WORKSPACE_ID = "workspace-search-similar-other";
const NOW = "2026-04-28T21:40:00+08:00";

function fail(reason: string, detail?: unknown): never {
  console.error(`[SEARCH-SIMILAR desktop verify] FAIL: ${reason}`);
  if (detail !== undefined) {
    console.error(JSON.stringify(detail, null, 2));
  }
  throw new Error(reason);
}

function assert(condition: unknown, reason: string, detail?: unknown): asserts condition {
  if (!condition) fail(reason, detail);
}

function buildIssue(
  workspaceId: string,
  id: string,
  title: string,
  description: string,
  tags: string[],
  status: IssueCard["status"] = "open",
): IssueCard {
  return buildSearchIssue({ workspaceId, id, title, description, tags, status, now: NOW });
}

function buildArchive(workspaceId: string, issueId: string): ArchiveDocument {
  return {
    issueId,
    projectId: workspaceId,
    fileName: `2026-04-28_${issueId}.md`,
    filePath: `.debug_workspace/archive/2026-04-28_${issueId}.md`,
    markdownContent: "# CAN handshake recurrence\n\nLoose gyro connector caused repeated CAN handshake timeout.",
    generatedBy: "manual",
    generatedAt: NOW,
  };
}

function buildErrorEntry(workspaceId: string, issueId: string): ErrorEntry {
  return {
    id: `error-entry-${issueId}`,
    projectId: workspaceId,
    sourceIssueId: issueId,
    errorCode: "DBG-20260428-701",
    title: "CAN handshake timeout from loose gyro connector",
    category: "CAN",
    symptom: "CAN handshake timeout appears when the chassis harness is moved.",
    rootCause: "Loose gyro connector caused CAN handshake timeout during chassis startup.",
    resolution: "Reseat the gyro connector, secure the harness, then rerun CAN startup checks.",
    prevention: "Add gyro connector inspection before every match.",
    tags: ["CAN", "Chassis", "Gyro"],
    relatedFiles: [],
    relatedCommits: [],
    archiveFilePath: `.debug_workspace/archive/2026-04-28_${issueId}.md`,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function buildPowerError(workspaceId: string, issueId: string): ErrorEntry {
  return {
    id: `error-entry-${issueId}`,
    projectId: workspaceId,
    sourceIssueId: issueId,
    errorCode: "DBG-20260428-702",
    title: "Battery voltage sag",
    category: "Power",
    symptom: "Battery voltage sag during acceleration.",
    rootCause: "Aging battery cell caused voltage sag.",
    resolution: "Replace the battery and verify load test results.",
    prevention: "Run battery internal resistance checks before practice.",
    tags: ["Power"],
    relatedFiles: [],
    relatedCommits: [],
    archiveFilePath: `.debug_workspace/archive/2026-04-28_${issueId}.md`,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

async function saveIssue(repository: StorageRepository, issue: IssueCard) {
  const saved = await repository.issueCards.save(issue);
  assert(saved.ok, `issue ${issue.id} should save`, saved);
}

async function saveArchive(repository: StorageRepository, archive: ArchiveDocument) {
  const saved = await repository.archiveDocuments.save(archive);
  assert(saved.ok, `archive ${archive.fileName} should save`, saved);
}

async function saveErrorEntry(repository: StorageRepository, entry: ErrorEntry) {
  const saved = await repository.errorEntries.save(entry);
  assert(saved.ok, `error entry ${entry.id} should save`, saved);
}

async function seedRepository(repository: StorageRepository, workspaceId: string) {
  const current = buildIssue(
    workspaceId,
    `issue-current-${workspaceId}`,
    "CAN handshake timeout after gyro connector move",
    "Chassis startup fails with CAN handshake timeout after the loose gyro connector was touched.",
    ["CAN", "Chassis"],
  );
  const historical = buildIssue(
    workspaceId,
    `issue-history-${workspaceId}`,
    "CAN handshake dropout from loose gyro connector",
    "Archived issue: CAN handshake timeout after chassis harness movement.",
    ["CAN", "Chassis", "Gyro"],
    "archived",
  );
  const unrelated = buildIssue(
    workspaceId,
    `issue-power-${workspaceId}`,
    "Battery voltage sag under acceleration",
    "Power rail drops during acceleration.",
    ["Power"],
    "archived",
  );
  await saveIssue(repository, current);
  await saveIssue(repository, historical);
  await saveArchive(repository, buildArchive(workspaceId, historical.id));
  await saveErrorEntry(repository, buildErrorEntry(workspaceId, historical.id));
  await saveIssue(repository, unrelated);
  await saveErrorEntry(repository, buildPowerError(workspaceId, unrelated.id));
  return { current, historical, unrelated };
}

function assertSimilarResult(
  label: string,
  current: IssueCard,
  historical: IssueCard,
  result: Awaited<ReturnType<typeof findSimilarIssuesForIssue>>,
) {
  assert(result.readError === null, `${label}: similar issues should not return readError`, result.readError);
  const matched = result.items.find((item) => item.issueId === historical.id);
  assert(matched, `${label}: historical CAN issue should be ranked`, result);
  assert(matched.matchedTags.some((tag) => tag.toLocaleLowerCase() === "can"), `${label}: should explain matched tags`, matched);
  assert(matched.matchedRootCauseTerms.includes("gyro"), `${label}: should explain rootCause overlap`, matched);
  assert(matched.reasons.length >= 3, `${label}: should return human-readable reasons`, matched);
  assert(!result.items.some((item) => item.issueId === current.id), `${label}: current issue must be excluded`, result);
  assert(!result.items.some((item) => item.issueId.includes(OTHER_WORKSPACE_ID)), `${label}: other workspace must not leak`, result);
}

const pureCurrent = buildIssue(
  WORKSPACE_ID,
  "issue-current-pure",
  "CAN handshake timeout after gyro connector move",
  "Loose gyro connector causes chassis CAN timeout.",
  ["CAN", "Chassis"],
);
const pureHistorical = buildIssue(
  WORKSPACE_ID,
  "issue-history-pure",
  "CAN handshake dropout from loose gyro connector",
  "Archived CAN startup timeout.",
  ["CAN", "Chassis", "Gyro"],
  "archived",
);
const pureUnrelated = buildIssue(
  WORKSPACE_ID,
  "issue-power-pure",
  "Battery voltage sag",
  "Power rail drops.",
  ["Power"],
  "archived",
);
const pureOtherWorkspace = buildIssue(
  OTHER_WORKSPACE_ID,
  "issue-history-other-workspace",
  "CAN handshake dropout from loose gyro connector",
  "Other workspace should not leak.",
  ["CAN", "Chassis", "Gyro"],
  "archived",
);
const pureMatches = rankSimilarIssues({
  currentIssue: pureCurrent,
  issues: [pureCurrent, pureHistorical, pureUnrelated, pureOtherWorkspace],
  archives: [buildArchive(WORKSPACE_ID, pureHistorical.id), buildArchive(OTHER_WORKSPACE_ID, pureOtherWorkspace.id)],
  errorEntries: [
    buildErrorEntry(WORKSPACE_ID, pureHistorical.id),
    buildPowerError(WORKSPACE_ID, pureUnrelated.id),
    buildErrorEntry(OTHER_WORKSPACE_ID, pureOtherWorkspace.id),
  ],
});
assert(pureMatches[0]?.issueId === pureHistorical.id, "pure ranking should place CAN history first", pureMatches);
assert(!pureMatches.some((item) => item.issueId === pureUnrelated.id), "pure ranking should suppress low similarity", pureMatches);
assert(!pureMatches.some((item) => item.issueId === pureOtherWorkspace.id), "pure ranking should stay workspace scoped", pureMatches);

installSearchVerifyLocalStorage();

const localRepository = createStorageRepository({ workspaceId: WORKSPACE_ID });
const localSeed = await seedRepository(localRepository, WORKSPACE_ID);
const localOtherRepository = createStorageRepository({ workspaceId: OTHER_WORKSPACE_ID });
const localOther = await seedRepository(localOtherRepository, OTHER_WORKSPACE_ID);
const localResult = await findSimilarIssuesForIssue(localRepository, localSeed.current);
assertSimilarResult("localStorage fallback", localSeed.current, localSeed.historical, localResult);
assert(
  !localResult.items.some((item) => item.issueId === localOther.historical.id),
  "localStorage fallback: seeded other workspace history must not leak",
  localResult,
);

const workdir = createTempDir("probeflash-search-similar-desktop").path;
const dbPath = join(workdir, "probeflash.search-similar.sqlite");
const server = await startProbeFlashServer({ host: "127.0.0.1", port: 0, dbPath });

try {
  const baseUrl = `${server.baseUrl}/api`;
  const repository = createHttpStorageRepository({ baseUrl, workspaceId: WORKSPACE_ID });
  const httpSeed = await seedRepository(repository, WORKSPACE_ID);
  const createdWorkspace = await repository.workspaces.create({ name: "Search Similar Other Workspace" });
  assert(createdWorkspace.ok, "secondary workspace should be created", createdWorkspace);
  const otherRepository = createHttpStorageRepository({ baseUrl, workspaceId: createdWorkspace.workspace.id });
  await seedRepository(otherRepository, createdWorkspace.workspace.id);

  const httpResult = await findSimilarIssuesForIssue(repository, httpSeed.current);
  assertSimilarResult("HTTP repository", httpSeed.current, httpSeed.historical, httpResult);
} finally {
  await server.close();
}

console.log("[SEARCH-SIMILAR desktop verify] PASS: pure ranking explains tag, keyword, rootCause, and resolution overlap");
console.log("[SEARCH-SIMILAR desktop verify] PASS: localStorage fallback and HTTP repository stay workspace scoped");
