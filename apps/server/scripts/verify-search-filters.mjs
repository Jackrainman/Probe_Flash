import { join } from "node:path";

import { startProbeFlashServer } from "../src/server.mjs";
import { createTempDir } from "./verify-helpers.mjs";

const WORKSPACE_ID = "workspace-26-r1";
const OPEN_TIME = "2026-04-25T10:00:00+08:00";
const RESOLVED_TIME = "2026-04-26T11:00:00+08:00";

function fail(reason, detail) {
  console.error(`[SEARCH-FILTERS server verify] FAIL: ${reason}`);
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

async function expectBadRequest(url, label) {
  const result = await requestJson(url);
  assert(
    result.response.status === 400 && result.payload.ok === false,
    `${label} should return 400 ok=false`,
    result.payload,
  );
  assert(result.payload.error?.code === "BAD_REQUEST", `${label} should return BAD_REQUEST`, result.payload);
}

function repoSnapshot(workspaceId, capturedAt) {
  return {
    branch: "master",
    headCommitHash: "0000000000000000000000000000000000000000",
    headCommitMessage: `search filter verify fixture ${workspaceId}`,
    hasUncommittedChanges: false,
    changedFiles: [],
    recentCommits: [],
    capturedAt,
  };
}

function issueFixture(workspaceId, id, title, description, options = {}) {
  const createdAt = options.createdAt ?? OPEN_TIME;
  const updatedAt = options.updatedAt ?? createdAt;
  return {
    id,
    projectId: workspaceId,
    title,
    rawInput: description,
    normalizedSummary: description,
    symptomSummary: description,
    suspectedDirections: ["filter sentinel direction"],
    suggestedActions: ["filter sentinel action"],
    status: options.status ?? "open",
    severity: "medium",
    tags: options.tags ?? ["verify", "search"],
    repoSnapshot: repoSnapshot(workspaceId, createdAt),
    relatedFiles: [],
    relatedCommits: [],
    relatedHistoricalIssueIds: [],
    createdAt,
    updatedAt,
  };
}

function recordFixture(id, issueId, note, createdAt = OPEN_TIME) {
  return {
    id,
    issueId,
    type: "observation",
    rawText: note,
    polishedText: note,
    aiExtractedSignals: ["filter sentinel record signal"],
    linkedFiles: [],
    linkedCommits: [],
    createdAt,
  };
}

function archiveFixture(workspaceId, issueId, generatedAt = RESOLVED_TIME) {
  return {
    issueId,
    projectId: workspaceId,
    fileName: "2026-04-26_search-filter-resolved.md",
    filePath: ".debug_workspace/archive/2026-04-26_search-filter-resolved.md",
    markdownContent: "# Filter archive\n\nResolved filter sentinel root cause in the thermal path.",
    generatedBy: "manual",
    generatedAt,
  };
}

function errorEntryFixture(workspaceId, issueId, archiveFilePath, createdAt = RESOLVED_TIME) {
  return {
    id: "error-entry-search-filter-resolved-0001",
    projectId: workspaceId,
    sourceIssueId: issueId,
    errorCode: "DBG-20260426-501",
    title: "Filter sentinel resolved error entry",
    category: "Thermal",
    symptom: "Filter sentinel recurring thermal drift.",
    rootCause: "Resolved filter sentinel root cause in the thermal path.",
    resolution: "Adjusted sensor calibration and verified stable readings.",
    prevention: "Add thermal sensor calibration to the release checklist.",
    relatedFiles: [],
    relatedCommits: [],
    archiveFilePath,
    createdAt,
    updatedAt: createdAt,
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
    (item) =>
      item.kind === kind &&
      JSON.stringify(item).toLocaleLowerCase().includes(text.toLocaleLowerCase()),
  );
}

function resultDatePart(item) {
  return (item.updatedAt ?? item.generatedAt ?? item.createdAt ?? "").slice(0, 10);
}

function hasTag(item, tag) {
  return item.tags?.some((candidate) => candidate.toLocaleLowerCase() === tag.toLocaleLowerCase()) ?? false;
}

const workdir = createTempDir("probeflash-search-filters-server").path;
const dbPath = join(workdir, "probeflash.search-filters.sqlite");
const server = await startProbeFlashServer({ host: "127.0.0.1", port: 0, dbPath });

try {
  const openIssue = issueFixture(
    WORKSPACE_ID,
    "issue-search-filter-open-0001",
    "Open filter sentinel CAN dropout",
    "Filter sentinel open issue should be found by tag and type filters.",
    { status: "open", tags: ["CAN", "Power"], createdAt: OPEN_TIME, updatedAt: OPEN_TIME },
  );
  const resolvedIssue = issueFixture(
    WORKSPACE_ID,
    "issue-search-filter-resolved-0001",
    "Resolved filter sentinel thermal drift",
    "Filter sentinel resolved issue should be found by status and date filters.",
    { status: "resolved", tags: ["Thermal", "Sensor"], createdAt: RESOLVED_TIME, updatedAt: RESOLVED_TIME },
  );
  await createIssue(server.baseUrl, WORKSPACE_ID, openIssue);
  await createIssue(server.baseUrl, WORKSPACE_ID, resolvedIssue);
  await createRecord(
    server.baseUrl,
    WORKSPACE_ID,
    openIssue.id,
    recordFixture("record-search-filter-open-0001", openIssue.id, "Filter sentinel record belongs to the open CAN issue."),
  );
  const archive = archiveFixture(WORKSPACE_ID, resolvedIssue.id);
  await createArchive(server.baseUrl, WORKSPACE_ID, archive);
  await createErrorEntry(
    server.baseUrl,
    WORKSPACE_ID,
    errorEntryFixture(WORKSPACE_ID, resolvedIssue.id, archive.filePath),
  );

  const otherWorkspaceId = await createWorkspace(server.baseUrl, "Search Filter Isolation Workspace");
  await createIssue(
    server.baseUrl,
    otherWorkspaceId,
    issueFixture(
      otherWorkspaceId,
      "issue-search-filter-other-0001",
      "Other workspace filter sentinel leakage",
      "This filtered sentinel must not leak into the default workspace.",
      { status: "open", tags: ["Power"], createdAt: OPEN_TIME, updatedAt: OPEN_TIME },
    ),
  );

  const allResults = await search(server.baseUrl, WORKSPACE_ID, "filter sentinel");
  assert(allResults.filters?.kind === "all", "unfiltered search should return normalized kind=all", allResults);
  assert(hasKind(allResults, "issue", openIssue.id), "unfiltered search should include open issue", allResults);
  assert(hasKind(allResults, "record", "record-search-filter-open"), "unfiltered search should include record", allResults);
  assert(hasKind(allResults, "archive", archive.fileName), "unfiltered search should include archive", allResults);
  assert(hasKind(allResults, "error_entry", "DBG-20260426-501"), "unfiltered search should include error entry", allResults);

  const kindResults = await search(server.baseUrl, WORKSPACE_ID, "filter sentinel", { kind: "record" });
  assert(kindResults.filters.kind === "record", "kind filter should be normalized in response", kindResults);
  assert(kindResults.items.length === 1, "kind=record should only return the matching record", kindResults);
  assert(kindResults.items.every((item) => item.kind === "record"), "kind filter should exclude other result types", kindResults);

  const statusResults = await search(server.baseUrl, WORKSPACE_ID, "filter sentinel", { status: "resolved" });
  assert(statusResults.filters.status === "resolved", "status filter should be normalized in response", statusResults);
  assert(statusResults.items.length > 0, "status=resolved should return source issue matches", statusResults);
  assert(statusResults.items.every((item) => item.status === "resolved"), "status filter should exclude non-resolved source issues", statusResults);
  assert(!statusResults.items.some((item) => item.issueId === openIssue.id), "status filter should remove open source issue results", statusResults);

  const tagResults = await search(server.baseUrl, WORKSPACE_ID, "filter sentinel", { tag: "power" });
  assert(tagResults.filters.tag === "power", "tag filter should be normalized in response", tagResults);
  assert(tagResults.items.length > 0, "tag=power should return tagged source issue matches", tagResults);
  assert(tagResults.items.every((item) => hasTag(item, "power")), "tag filter should be case-insensitive and exact", tagResults);
  assert(!tagResults.items.some((item) => item.issueId === resolvedIssue.id), "tag filter should remove other source issue tags", tagResults);

  const dateResults = await search(server.baseUrl, WORKSPACE_ID, "filter sentinel", {
    from: "2026-04-26",
    to: "2026-04-26",
  });
  assert(dateResults.filters.from === "2026-04-26" && dateResults.filters.to === "2026-04-26", "date filters should be normalized in response", dateResults);
  assert(dateResults.items.length > 0, "date range should return matching day results", dateResults);
  assert(dateResults.items.every((item) => resultDatePart(item) === "2026-04-26"), "date range should keep only 2026-04-26 results", dateResults);

  const combinedResults = await search(server.baseUrl, WORKSPACE_ID, "filter sentinel", {
    kind: "archive",
    status: "resolved",
    tag: "thermal",
    from: "2026-04-26",
    to: "2026-04-26",
  });
  assert(combinedResults.items.length === 1, "combined filters should narrow to one archive", combinedResults);
  assert(combinedResults.items[0].kind === "archive" && combinedResults.items[0].issueId === resolvedIssue.id, "combined filters should keep the resolved archive", combinedResults);

  const isolatedDefault = await search(server.baseUrl, WORKSPACE_ID, "leakage", { tag: "power" });
  assert(isolatedDefault.items.length === 0, "filtered default workspace search must not leak other workspace", isolatedDefault);
  const isolatedOther = await search(server.baseUrl, otherWorkspaceId, "leakage", { tag: "power" });
  assert(hasKind(isolatedOther, "issue", "issue-search-filter-other"), "filtered other workspace should find its own tagged issue", isolatedOther);

  await expectBadRequest(
    buildSearchUrl(server.baseUrl, WORKSPACE_ID, "filter sentinel", { from: "2026-04-27", to: "2026-04-26" }).toString(),
    "invalid date range",
  );
  await expectBadRequest(
    buildSearchUrl(server.baseUrl, WORKSPACE_ID, "filter sentinel", { kind: "invalid" }).toString(),
    "invalid kind",
  );
} finally {
  await server.close();
}

console.log("[SEARCH-FILTERS server verify] PASS: kind, status, tag, and date filters narrow search results");
console.log("[SEARCH-FILTERS server verify] PASS: combined filters and workspace isolation remain enforced");
console.log("[SEARCH-FILTERS server verify] PASS: invalid filter parameters return BAD_REQUEST");
