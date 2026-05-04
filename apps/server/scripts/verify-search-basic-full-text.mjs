import { join } from "node:path";

import { startProbeFlashServer } from "../src/server.mjs";
import { createTempDir } from "./verify-helpers.mjs";
import {
  makeArchiveFixture,
  makeErrorEntryFixture,
  makeIssueFixture,
  makeRecordFixture,
  makeRepoSnapshot,
} from "./fixtures/verify-fixtures.mjs";

const WORKSPACE_ID = "workspace-26-r1";
const NOW = "2026-04-27T18:00:00+08:00";

function fail(reason, detail) {
  console.error(`[SEARCH-BASIC-FULL-TEXT server verify] FAIL: ${reason}`);
  if (detail !== undefined) {
    console.error(JSON.stringify(detail, null, 2));
  }
  process.exit(1);
}

function assert(condition, reason, detail) {
  if (!condition) {
    fail(reason, detail);
  }
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
  return makeRepoSnapshot({
    now: NOW,
    overrides: {
      headCommitMessage: `search verify fixture ${workspaceId}`,
    },
  });
}

function issueFixture(workspaceId, id, title, description) {
  return makeIssueFixture({
    id,
    workspaceId,
    now: NOW,
    repoSnapshot: repoSnapshot(workspaceId),
    overrides: {
      title,
      rawInput: description,
      normalizedSummary: description,
      symptomSummary: description,
      suspectedDirections: ["search verify"],
      suggestedActions: ["search this fixture"],
      tags: ["verify", "search"],
    },
  });
}

function recordFixture(id, issueId, note) {
  return makeRecordFixture({
    id,
    issueId,
    now: NOW,
    overrides: {
      rawText: note,
      polishedText: note,
      aiExtractedSignals: ["oscilloscope ripple"],
    },
  });
}

function archiveFixture(workspaceId, issueId) {
  return makeArchiveFixture({
    issueId,
    workspaceId,
    fileName: "2026-04-27_search-basic-main.md",
    now: NOW,
    overrides: {
      markdownContent: "# Search archive\n\nRoot cause: transceiver termination mismatch caused the dropout.",
    },
  });
}

function errorEntryFixture(workspaceId, issueId, archiveFilePath) {
  return makeErrorEntryFixture({
    id: "error-entry-search-basic-main-0001",
    sourceIssueId: issueId,
    workspaceId,
    errorCode: "DBG-20260427-401",
    archiveFilePath,
    now: NOW,
    overrides: {
      title: "CAN heartbeat dropout search entry",
      category: "CAN",
      symptom: "Heartbeat packet drops during drive enable.",
      rootCause: "transceiver termination mismatch",
      resolution: "Reworked the CAN termination and verified packet stability.",
      prevention: "Add termination resistance check to pre-match checklist.",
    },
  });
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

async function createRecord(baseUrl, workspaceId, issueId, record) {
  return expectOk(
    `${baseUrl}/api/workspaces/${encodeURIComponent(workspaceId)}/issues/${encodeURIComponent(issueId)}/records`,
    postJson(record),
    201,
    `record create ${record.id}`,
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

async function search(baseUrl, workspaceId, query) {
  const url = new URL(`${baseUrl}/api/workspaces/${encodeURIComponent(workspaceId)}/search`);
  url.searchParams.set("q", query);
  return expectOk(url.toString(), undefined, 200, `search ${query}`);
}

function hasKind(data, kind, text) {
  return data.items.some(
    (item) =>
      item.kind === kind &&
      JSON.stringify(item).toLocaleLowerCase().includes(text.toLocaleLowerCase()),
  );
}

const workdir = createTempDir("probeflash-search-basic-server").path;
const dbPath = join(workdir, "probeflash.search.sqlite");
const server = await startProbeFlashServer({ host: "127.0.0.1", port: 0, dbPath });

try {
  const issue = issueFixture(
    WORKSPACE_ID,
    "issue-search-basic-main-0001",
    "Search CAN heartbeat dropout",
    "Default workspace issue description mentions bring-up heartbeat loss.",
  );
  await createIssue(server.baseUrl, WORKSPACE_ID, issue);
  await createRecord(
    server.baseUrl,
    WORKSPACE_ID,
    issue.id,
    recordFixture(
      "record-search-basic-main-0001",
      issue.id,
      "Oscilloscope ripple appears when motor enable toggles.",
    ),
  );
  const archive = archiveFixture(WORKSPACE_ID, issue.id);
  await createArchive(server.baseUrl, WORKSPACE_ID, archive);
  await createErrorEntry(server.baseUrl, WORKSPACE_ID, errorEntryFixture(WORKSPACE_ID, issue.id, archive.filePath));

  const otherWorkspaceId = await createWorkspace(server.baseUrl, "Search Isolation Workspace");
  await createIssue(
    server.baseUrl,
    otherWorkspaceId,
    issueFixture(
      otherWorkspaceId,
      "issue-search-basic-other-0001",
      "Other workspace leakage sentinel",
      "This text must never appear in default workspace search results.",
    ),
  );

  const issueResults = await search(server.baseUrl, WORKSPACE_ID, "CAN heartbeat");
  assert(hasKind(issueResults, "issue", issue.id), "issue title search should hit issue", issueResults);

  const recordResults = await search(server.baseUrl, WORKSPACE_ID, "oscilloscope ripple");
  assert(hasKind(recordResults, "record", "record-search-basic-main"), "record text search should hit record", recordResults);

  const closeoutResults = await search(server.baseUrl, WORKSPACE_ID, "termination mismatch");
  assert(hasKind(closeoutResults, "archive", archive.fileName), "archive markdown search should hit archive", closeoutResults);
  assert(hasKind(closeoutResults, "error_entry", "DBG-20260427-401"), "error-entry search should hit error entry", closeoutResults);

  const emptyResults = await search(server.baseUrl, WORKSPACE_ID, "no-such-search-keyword");
  assert(emptyResults.items.length === 0, "unknown keyword should return no results", emptyResults);

  const isolatedDefaultResults = await search(server.baseUrl, WORKSPACE_ID, "leakage sentinel");
  assert(isolatedDefaultResults.items.length === 0, "default workspace search must not leak other workspace", isolatedDefaultResults);
  const isolatedOtherResults = await search(server.baseUrl, otherWorkspaceId, "leakage sentinel");
  assert(hasKind(isolatedOtherResults, "issue", "issue-search-basic-other"), "other workspace should find its own issue", isolatedOtherResults);
} finally {
  await server.close();
}

console.log("[SEARCH-BASIC-FULL-TEXT server verify] PASS: issue title and description keywords are searchable");
console.log("[SEARCH-BASIC-FULL-TEXT server verify] PASS: records, archives, and error entries are searchable");
console.log("[SEARCH-BASIC-FULL-TEXT server verify] PASS: no-result query returns an empty item list");
console.log("[SEARCH-BASIC-FULL-TEXT server verify] PASS: workspace-scoped search does not leak other workspace data");
