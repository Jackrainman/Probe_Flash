import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { startProbeFlashServer } from "../src/server.mjs";
import { createTempDir } from "./verify-helpers.mjs";

const WORKSPACE_ID = "workspace-26-r1";
const NOW = "2026-04-26T12:00:00+08:00";

function fail(reason, detail) {
  console.error(`[SERVER-SCHEMA-CONTRACT verify] FAIL: ${reason}`);
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

async function expectValidation(url, init, label) {
  const result = await requestJson(url, init);
  assert(
    result.response.status === 422 &&
      result.payload.ok === false &&
      result.payload.error?.code === "VALIDATION_ERROR" &&
      typeof result.payload.error?.message === "string" &&
      result.payload.error.operation === "request" &&
      result.payload.error.retryable === false &&
      typeof result.payload.error.details === "object",
    `${label} should return structured 422 VALIDATION_ERROR`,
    { status: result.response.status, payload: result.payload },
  );
}

function repoSnapshot(overrides = {}) {
  return {
    branch: "master",
    headCommitHash: "0000000000000000000000000000000000000000",
    headCommitMessage: "verify fixture",
    hasUncommittedChanges: false,
    changedFiles: [
      {
        path: "apps/server/src/database.mjs",
        status: "modified",
      },
    ],
    recentCommits: [
      {
        hash: "3ddb3a6",
        author: "ProbeFlash Verify",
        message: "verify fixture",
        timestamp: NOW,
      },
    ],
    capturedAt: NOW,
    ...overrides,
  };
}

function issueFixture(id, overrides = {}) {
  return {
    id,
    projectId: WORKSPACE_ID,
    title: "Server schema contract issue",
    rawInput: "Verify server write payload validation.",
    normalizedSummary: "server schema contract",
    symptomSummary: "POST should reject frontend-invalid payloads",
    suspectedDirections: ["server validation"],
    suggestedActions: ["tighten normalize payload contract"],
    status: "open",
    severity: "medium",
    tags: ["verify", "schema-contract"],
    repoSnapshot: repoSnapshot(),
    relatedFiles: ["apps/server/src/database.mjs"],
    relatedCommits: [],
    relatedHistoricalIssueIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function recordFixture(id, issueId, overrides = {}) {
  return {
    id,
    issueId,
    type: "observation",
    rawText: "Server accepted a schema-valid record.",
    polishedText: "Server accepted a schema-valid record.",
    aiExtractedSignals: ["schema contract"],
    linkedFiles: ["apps/server/src/database.mjs"],
    linkedCommits: [],
    createdAt: NOW,
    ...overrides,
  };
}

function archiveFixture(fileName, issueId, overrides = {}) {
  return {
    issueId,
    projectId: WORKSPACE_ID,
    fileName,
    filePath: `.debug_workspace/archive/${fileName}`,
    markdownContent: "# Server schema contract\n",
    generatedBy: "manual",
    generatedAt: NOW,
    ...overrides,
  };
}

function errorEntryFixture(id, issueId, errorCode, archiveFilePath, overrides = {}) {
  return {
    id,
    projectId: WORKSPACE_ID,
    sourceIssueId: issueId,
    errorCode,
    title: "Server schema contract error entry",
    category: "server",
    symptom: "frontend-invalid payload accepted by server",
    rootCause: "server-side write contract was too weak",
    resolution: "server now validates write payloads before SQLite insert",
    prevention: "Keep server write verification aligned with frontend schemas.",
    relatedFiles: ["apps/server/src/database.mjs"],
    relatedCommits: [],
    archiveFilePath,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function countRows(dbPath, tableName) {
  const db = new DatabaseSync(dbPath);
  try {
    return db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count;
  } finally {
    db.close();
  }
}

const workdir = createTempDir("probeflash-server-schema-contract").path;
const dbPath = join(workdir, "probeflash.schema-contract.sqlite");
const server = await startProbeFlashServer({
  host: "127.0.0.1",
  port: 0,
  dbPath,
});

try {
  const workspaceBase = `${server.baseUrl}/api/workspaces/${WORKSPACE_ID}`;
  const issuesUrl = `${workspaceBase}/issues`;
  const archivesUrl = `${workspaceBase}/archives`;
  const errorEntriesUrl = `${workspaceBase}/error-entries`;

  const issue = issueFixture("issue-server-schema-contract-0001");
  const createdIssue = await expectOk(issuesUrl, postJson(issue), 201, "valid issue POST");
  assert(createdIssue.id === issue.id, "valid issue should echo created id", createdIssue);

  const loadedIssue = await expectOk(
    `${issuesUrl}/${issue.id}`,
    undefined,
    200,
    "valid issue GET",
  );
  assert(
    loadedIssue.repoSnapshot?.changedFiles?.[0]?.status === "modified",
    "valid issue should round-trip repoSnapshot",
    loadedIssue,
  );

  const record = recordFixture("record-server-schema-contract-0001", issue.id);
  const createdRecord = await expectOk(
    `${issuesUrl}/${issue.id}/records`,
    postJson(record),
    201,
    "valid record POST",
  );
  assert(createdRecord.id === record.id && createdRecord.rawText === record.rawText, "valid record should round-trip", createdRecord);

  const archive = archiveFixture("2026-04-26_server-schema-contract.md", issue.id);
  const createdArchive = await expectOk(archivesUrl, postJson(archive), 201, "valid archive POST");
  assert(createdArchive.fileName === archive.fileName, "valid archive should round-trip", createdArchive);

  const errorEntry = errorEntryFixture(
    "error-entry-server-schema-contract-0001",
    issue.id,
    "DBG-20260426-101",
    archive.filePath,
  );
  const createdErrorEntry = await expectOk(
    errorEntriesUrl,
    postJson(errorEntry),
    201,
    "valid error-entry POST",
  );
  assert(
    createdErrorEntry.errorCode === errorEntry.errorCode && createdErrorEntry.prevention === errorEntry.prevention,
    "valid error entry should round-trip",
    createdErrorEntry,
  );

  await expectValidation(
    issuesUrl,
    postJson(issueFixture("issue-server-schema-invalid-status", { status: "done" })),
    "invalid issue.status",
  );
  await expectValidation(
    issuesUrl,
    postJson(issueFixture("issue-server-schema-invalid-severity", { severity: "urgent" })),
    "invalid issue.severity",
  );
  await expectValidation(
    issuesUrl,
    postJson(issueFixture("issue-server-schema-project-mismatch", { projectId: "wrong-workspace" })),
    "issue projectId/workspaceId mismatch",
  );
  await expectValidation(
    issuesUrl,
    postJson(issueFixture("issue-server-schema-workspace-alias-mismatch", { workspaceId: "wrong-workspace" })),
    "issue workspaceId alias mismatch",
  );
  await expectValidation(
    issuesUrl,
    postJson(issueFixture("issue-server-schema-invalid-datetime", { createdAt: "not-a-date" })),
    "invalid issue datetime",
  );
  const { repoSnapshot: _omittedRepoSnapshot, ...issueWithoutRepoSnapshot } = issueFixture(
    "issue-server-schema-missing-repo-snapshot",
  );
  await expectValidation(issuesUrl, postJson(issueWithoutRepoSnapshot), "missing issue.repoSnapshot");

  await expectValidation(
    `${issuesUrl}/${issue.id}/records`,
    postJson(recordFixture("record-server-schema-invalid-type", issue.id, { type: "status" })),
    "invalid record.type",
  );
  const { rawText: _omittedRawText, ...recordWithoutRawText } = recordFixture(
    "record-server-schema-missing-raw-text",
    issue.id,
  );
  await expectValidation(`${issuesUrl}/${issue.id}/records`, postJson(recordWithoutRawText), "missing record.rawText");
  await expectValidation(
    `${issuesUrl}/${issue.id}/records`,
    postJson(recordFixture("record-server-schema-invalid-datetime", issue.id, { createdAt: "not-a-date" })),
    "invalid record datetime",
  );

  const { generatedBy: _omittedGeneratedBy, ...archiveWithoutGeneratedBy } = archiveFixture(
    "2026-04-26_missing-generated-by.md",
    issue.id,
  );
  await expectValidation(archivesUrl, postJson(archiveWithoutGeneratedBy), "missing archive.generatedBy");
  await expectValidation(
    archivesUrl,
    postJson(archiveFixture("archive-invalid-name.md", issue.id)),
    "invalid archive.fileName",
  );
  await expectValidation(
    archivesUrl,
    postJson(archiveFixture("2026-04-26_invalid-archive-datetime.md", issue.id, { generatedAt: "not-a-date" })),
    "invalid archive datetime",
  );

  await expectValidation(
    errorEntriesUrl,
    postJson(
      errorEntryFixture(
        "error-entry-server-schema-invalid-code",
        issue.id,
        "DBG-SCHEMA-101",
        archive.filePath,
      ),
    ),
    "invalid errorEntry.errorCode",
  );
  await expectValidation(
    errorEntriesUrl,
    postJson(
      errorEntryFixture(
        "error-entry-server-schema-missing-prevention",
        issue.id,
        "DBG-20260426-102",
        archive.filePath,
        { prevention: "  " },
      ),
    ),
    "empty errorEntry.prevention",
  );
  await expectValidation(
    errorEntriesUrl,
    postJson(
      errorEntryFixture(
        "error-entry-server-schema-invalid-datetime",
        issue.id,
        "DBG-20260426-103",
        archive.filePath,
        { updatedAt: "not-a-date" },
      ),
    ),
    "invalid errorEntry datetime",
  );

  assert(countRows(dbPath, "issues") === 1, "invalid issue payloads should not insert rows");
  assert(countRows(dbPath, "records") === 1, "invalid record payloads should not insert rows");
  assert(countRows(dbPath, "archives") === 1, "invalid archive payloads should not insert rows");
  assert(countRows(dbPath, "error_entries") === 1, "invalid error-entry payloads should not insert rows");

  console.log("[SERVER-SCHEMA-CONTRACT verify] PASS: valid issue/record/archive/error-entry payloads write and read back");
  console.log("[SERVER-SCHEMA-CONTRACT verify] PASS: invalid issue status, severity, workspace and datetime return 422");
  console.log("[SERVER-SCHEMA-CONTRACT verify] PASS: missing repoSnapshot and record schema gaps return 422");
  console.log("[SERVER-SCHEMA-CONTRACT verify] PASS: invalid archive required fields and datetime return 422");
  console.log("[SERVER-SCHEMA-CONTRACT verify] PASS: invalid errorCode, prevention and datetime return 422");
} finally {
  await server.close();
}
