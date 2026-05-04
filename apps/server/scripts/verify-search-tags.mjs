import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { startProbeFlashServer } from "../src/server.mjs";
import { createTempDir } from "./verify-helpers.mjs";

const WORKSPACE_ID = "workspace-26-r1";
const NOW = "2026-04-27T20:10:00+08:00";

function fail(reason, detail) {
  console.error(`[SEARCH-TAGS server verify] FAIL: ${reason}`);
  if (detail !== undefined) {
    console.error(JSON.stringify(detail, null, 2));
  }
  process.exit(1);
}

function assert(condition, reason, detail) {
  if (!condition) fail(reason, detail);
}

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json();
  return { response, payload };
}

function postJson(body) {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function expectOk(url, init, statusCode, label) {
  const result = await requestJson(url, init);
  assert(
    result.response.status === statusCode && result.payload.ok === true,
    `${label} should return ${statusCode} ok=true`,
    result.payload,
  );
  return result.payload.data;
}

function repoSnapshot(workspaceId) {
  return {
    branch: "master",
    headCommitHash: "0000000000000000000000000000000000000000",
    headCommitMessage: `search tags verify fixture ${workspaceId}`,
    hasUncommittedChanges: false,
    changedFiles: [],
    recentCommits: [],
    capturedAt: NOW,
  };
}

function issueFixture(workspaceId, id, title, description, tags) {
  return {
    id,
    projectId: workspaceId,
    title,
    rawInput: description,
    normalizedSummary: description,
    symptomSummary: description,
    suspectedDirections: ["tag verify"],
    suggestedActions: ["search by tag"],
    status: "open",
    severity: "medium",
    tags,
    repoSnapshot: repoSnapshot(workspaceId),
    relatedFiles: [],
    relatedCommits: [],
    relatedHistoricalIssueIds: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function legacyIssueWithoutTags(workspaceId) {
  const { tags: _tags, ...issue } = issueFixture(
    workspaceId,
    "issue-search-tags-legacy-0001",
    "Legacy no tag sentinel",
    "Legacy no tag sentinel should still be searchable without crashing.",
    [],
  );
  return issue;
}

function archiveFixture(workspaceId, issueId) {
  return {
    issueId,
    projectId: workspaceId,
    fileName: "2026-04-27_search-tags-gyro.md",
    filePath: ".debug_workspace/archive/2026-04-27_search-tags-gyro.md",
    markdownContent: "# Search tags archive\n\nTag sentinel archive body does not repeat the source labels.",
    generatedBy: "manual",
    generatedAt: NOW,
  };
}

function errorEntryFixture(workspaceId, issueId, archiveFilePath) {
  return {
    id: "error-entry-search-tags-0001",
    projectId: workspaceId,
    sourceIssueId: issueId,
    errorCode: "DBG-20260427-601",
    title: "Tag sentinel error entry",
    category: "Gyro",
    symptom: "Tag sentinel issue recurred during bring-up.",
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

async function createWorkspace(baseUrl, name) {
  const data = await expectOk(`${baseUrl}/api/workspaces`, postJson({ name }), 201, "workspace create");
  assert(data.workspace?.id, "workspace create should return id", data);
  return data.workspace.id;
}

async function createIssue(baseUrl, workspaceId, issue) {
  return expectOk(
    `${baseUrl}/api/workspaces/${encodeURIComponent(workspaceId)}/issues`,
    postJson(issue),
    201,
    `issue create ${issue.id}`,
  );
}

async function createArchive(baseUrl, workspaceId, archive) {
  return expectOk(
    `${baseUrl}/api/workspaces/${encodeURIComponent(workspaceId)}/archives`,
    postJson(archive),
    201,
    `archive create ${archive.fileName}`,
  );
}

async function createErrorEntry(baseUrl, workspaceId, entry) {
  return expectOk(
    `${baseUrl}/api/workspaces/${encodeURIComponent(workspaceId)}/error-entries`,
    postJson(entry),
    201,
    `error entry create ${entry.id}`,
  );
}

function buildSearchUrl(baseUrl, workspaceId, query, filters = {}) {
  const url = new URL(`${baseUrl}/api/workspaces/${encodeURIComponent(workspaceId)}/search`);
  url.searchParams.set("q", query);
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function search(baseUrl, workspaceId, query, filters = {}) {
  return expectOk(buildSearchUrl(baseUrl, workspaceId, query, filters).toString(), undefined, 200, `search ${query}`);
}

function hasKind(data, kind, text) {
  return data.items.some(
    (item) => item.kind === kind && JSON.stringify(item).toLocaleLowerCase().includes(text.toLocaleLowerCase()),
  );
}

function hasTag(item, tag) {
  return item.tags?.some((candidate) => candidate.toLocaleLowerCase() === tag.toLocaleLowerCase()) ?? false;
}

function insertLegacyIssueRow(dbPath, workspaceId) {
  const issue = legacyIssueWithoutTags(workspaceId);
  const db = new DatabaseSync(dbPath);
  try {
    db.prepare(`
      INSERT INTO issues (id, workspace_id, title, severity, status, created_at, updated_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      issue.id,
      workspaceId,
      issue.title,
      issue.severity,
      issue.status,
      issue.createdAt,
      issue.updatedAt,
      JSON.stringify(issue),
    );
  } finally {
    db.close();
  }
}

const workdir = createTempDir("probeflash-search-tags-server").path;
const dbPath = join(workdir, "probeflash.search-tags.sqlite");
const server = await startProbeFlashServer({ host: "127.0.0.1", port: 0, dbPath });

try {
  const taggedIssue = issueFixture(
    WORKSPACE_ID,
    "issue-search-tags-gyro-0001",
    "Tag sentinel gyro dropout",
    "Tag sentinel default workspace source issue.",
    ["Gyro", "CAN"],
  );
  await createIssue(server.baseUrl, WORKSPACE_ID, taggedIssue);
  const archive = archiveFixture(WORKSPACE_ID, taggedIssue.id);
  await createArchive(server.baseUrl, WORKSPACE_ID, archive);
  await createErrorEntry(server.baseUrl, WORKSPACE_ID, errorEntryFixture(WORKSPACE_ID, taggedIssue.id, archive.filePath));

  const otherWorkspaceId = await createWorkspace(server.baseUrl, "Search Tags Isolation Workspace");
  await createIssue(
    server.baseUrl,
    otherWorkspaceId,
    issueFixture(
      otherWorkspaceId,
      "issue-search-tags-other-0001",
      "Other workspace gyro leakage sentinel",
      "Other workspace tag sentinel must not leak.",
      ["Gyro", "Power"],
    ),
  );
  insertLegacyIssueRow(dbPath, WORKSPACE_ID);

  const tagQueryResults = await search(server.baseUrl, WORKSPACE_ID, "Gyro");
  assert(hasKind(tagQueryResults, "issue", taggedIssue.id), "tag query should hit issue tags", tagQueryResults);
  assert(hasKind(tagQueryResults, "archive", archive.fileName), "tag query should hit archive source issue tags", tagQueryResults);
  assert(hasKind(tagQueryResults, "error_entry", "DBG-20260427-601"), "tag query should hit error-entry tags", tagQueryResults);

  const tagFilterResults = await search(server.baseUrl, WORKSPACE_ID, "tag sentinel", { tag: "gyro" });
  assert(tagFilterResults.items.length > 0, "tag filter should return tagged records", tagFilterResults);
  assert(tagFilterResults.items.every((item) => hasTag(item, "Gyro")), "tag filter should be exact and case-insensitive", tagFilterResults);

  const multiTagResults = await search(server.baseUrl, WORKSPACE_ID, "tag sentinel", { tag: "gyro, CAN" });
  assert(multiTagResults.filters.tag === "gyro,CAN", "multi tag filter should be normalized", multiTagResults);
  assert(multiTagResults.items.length > 0, "multi tag filter should return records with all requested tags", multiTagResults);
  assert(
    multiTagResults.items.every((item) => hasTag(item, "Gyro") && hasTag(item, "CAN")),
    "multi tag filter should require every tag",
    multiTagResults,
  );

  const noTagResults = await search(server.baseUrl, WORKSPACE_ID, "tag sentinel", { tag: "Power" });
  assert(noTagResults.items.length === 0, "tag filter with no matching current-workspace record should return empty", noTagResults);

  const isolatedDefault = await search(server.baseUrl, WORKSPACE_ID, "leakage", { tag: "Gyro" });
  assert(isolatedDefault.items.length === 0, "tag search must not leak other workspace results", isolatedDefault);
  const isolatedOther = await search(server.baseUrl, otherWorkspaceId, "leakage", { tag: "Gyro" });
  assert(hasKind(isolatedOther, "issue", "issue-search-tags-other"), "other workspace should find its own tagged issue", isolatedOther);

  const legacyResults = await search(server.baseUrl, WORKSPACE_ID, "legacy no tag sentinel");
  assert(hasKind(legacyResults, "issue", "issue-search-tags-legacy"), "legacy issue without tags should remain searchable", legacyResults);
  const legacyTagResults = await search(server.baseUrl, WORKSPACE_ID, "legacy no tag sentinel", { tag: "Gyro" });
  assert(legacyTagResults.items.length === 0, "legacy issue without tags should not satisfy tag filter", legacyTagResults);
} finally {
  await server.close();
}

console.log("[SEARCH-TAGS server verify] PASS: issue/archive/error-entry tag search works");
console.log("[SEARCH-TAGS server verify] PASS: tag, multi-tag, no-result, and workspace isolation are enforced");
console.log("[SEARCH-TAGS server verify] PASS: legacy rows without tags do not crash search");
