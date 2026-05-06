// apps/server/scripts/verify-server-closeout-atomicity.mjs
// 任务：TECH-01-CLOSEOUT-ATOMICITY-DESIGN（夜跑还债，纯本地）。
//
// 目标：保证 server 侧 closeout 路径把 ArchiveDocument + ErrorEntry + 标 Issue=archived
// 三步写入打包成 SQLite BEGIN IMMEDIATE / COMMIT / ROLLBACK 单事务，并通过 issues.closeout_state
// 标记位记录 pending / completed / failed 状态供 TECH-02 启动扫描使用。
//
// 该脚本不依赖真实服务器、不调用任何远端，仅在临时 sqlite + tempdir 内启动 startProbeFlashServer
// 并对新的 POST /api/workspaces/:wid/issues/:iid/closeout 路由做 happy-path、validation-fail
// rollback、conflict-fail rollback 三类断言。
//
// 设计边界：
//   - 只用临时 db 路径（createTempDir）。
//   - 不动 systemd / 真实服务器 / 4100 端口（默认 startProbeFlashServer port=0 不可设，覆盖 host+port 走随机）。
//   - 验证完毕主动 close 服务器并 cleanup tempdir。

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { startProbeFlashServer } from "../src/server.mjs";
import { createReporter, createTempDir } from "./verify-helpers.mjs";
import {
  makeArchiveFixture,
  makeErrorEntryFixture,
  makeIssueFixture,
  makeRepoSnapshot,
} from "./fixtures/verify-fixtures.mjs";

const WORKSPACE_ID = "workspace-26-r1";
const NOW = "2026-04-28T09:00:00+08:00";

const { fail, assert, assertEqual } = createReporter("SERVER-CLOSEOUT-ATOMICITY verify");

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

function repoSnapshot() {
  return makeRepoSnapshot({
    now: NOW,
    overrides: {
      changedFiles: [{ path: "apps/server/src/database.mjs", status: "modified" }],
      recentCommits: [
        {
          hash: "abcdef0",
          author: "ProbeFlash Verify",
          message: "closeout atomicity verify",
          timestamp: NOW,
        },
      ],
    },
  });
}

function issueFixture(id, overrides = {}) {
  return makeIssueFixture({
    id,
    workspaceId: WORKSPACE_ID,
    now: NOW,
    repoSnapshot: repoSnapshot(),
    overrides: {
      title: `Closeout atomicity verify ${id}`,
      rawInput: "atomicity verify",
      normalizedSummary: "atomicity verify",
      symptomSummary: "verify",
      ...overrides,
    },
  });
}

function archiveFixture(issueId, fileName, overrides = {}) {
  return makeArchiveFixture({
    issueId,
    workspaceId: WORKSPACE_ID,
    fileName,
    now: NOW,
    overrides: {
      markdownContent: "# Closeout atomicity verify\n",
      generatedBy: "manual",
      ...overrides,
    },
  });
}

function errorEntryFixture(id, issueId, errorCode, archiveFilePath, overrides = {}) {
  return makeErrorEntryFixture({
    id,
    sourceIssueId: issueId,
    workspaceId: WORKSPACE_ID,
    errorCode,
    archiveFilePath,
    now: NOW,
    overrides: {
      title: `Closeout atomicity verify entry ${id}`,
      symptom: "verify symptom",
      rootCause: "verify root cause",
      resolution: "verify resolution",
      prevention: "Run closeout atomicity verify regularly.",
      ...overrides,
    },
  });
}

function buildClosePayload({ archive, errorEntry, archivedIssue }) {
  return { archive, errorEntry, issue: archivedIssue };
}

function archivedIssue(baseIssue) {
  return { ...baseIssue, status: "archived", updatedAt: NOW };
}

const workdir = createTempDir("probeflash-server-closeout-atomicity");
const dbPath = join(workdir.path, "probeflash.sqlite");

let server;
try {
  server = await startProbeFlashServer({ host: "127.0.0.1", port: 0, dbPath });
  const baseUrl = server.baseUrl;

  // ---- Bootstrap: schema sanity (closeout_state column + index) ----
  {
    const inspector = new DatabaseSync(dbPath);
    try {
      const columns = inspector.prepare("PRAGMA table_info('issues')").all();
      const closeoutColumn = columns.find((column) => column.name === "closeout_state");
      assert(
        Boolean(closeoutColumn),
        "issues table should expose closeout_state column",
        { columns: columns.map((c) => c.name) },
      );
      assertEqual(
        closeoutColumn.type,
        "TEXT",
        "issues.closeout_state column should be TEXT",
      );
      const indexes = inspector
        .prepare("SELECT name FROM sqlite_schema WHERE type = 'index' AND tbl_name = 'issues'")
        .all();
      assert(
        indexes.some((row) => row.name === "idx_issues_workspace_closeout_state"),
        "idx_issues_workspace_closeout_state partial index should exist",
        { indexes: indexes.map((row) => row.name) },
      );
      const userVersion = inspector.prepare("PRAGMA user_version").get();
      assert(
        Object.values(userVersion)[0] >= 3,
        "PRAGMA user_version should be >= 3 after closeout_state column lands",
        { userVersion },
      );
    } finally {
      inspector.close();
    }
  }

  // ---- Test 1: happy path — POST /closeout commits all 3 writes atomically ----
  const issueA = issueFixture("issue-closeout-happy-0001");
  await fetch(`${baseUrl}/api/workspaces/${WORKSPACE_ID}/issues`, postJson(issueA)).then(async (response) => {
    const payload = await response.json();
    assert(response.status === 201 && payload.ok === true, "issueA create should succeed", payload);
  });

  const closeoutHappy = buildClosePayload({
    archive: archiveFixture(issueA.id, "2026-04-28_issue-closeout-happy-0001.md"),
    errorEntry: errorEntryFixture(
      "error-entry-closeout-happy-0001",
      issueA.id,
      "DBG-20260428-401",
      `.debug_workspace/archive/2026-04-28_issue-closeout-happy-0001.md`,
    ),
    archivedIssue: archivedIssue(issueA),
  });
  const happy = await requestJson(
    `${baseUrl}/api/workspaces/${WORKSPACE_ID}/issues/${issueA.id}/closeout`,
    postJson(closeoutHappy),
  );
  assert(
    happy.response.status === 201 && happy.payload.ok === true,
    "POST /closeout happy path should return 201 ok=true",
    { status: happy.response.status, payload: happy.payload },
  );
  assertEqual(
    happy.payload.data.issue.closeoutState,
    "completed",
    "closeout response should report closeoutState=completed",
  );
  assertEqual(
    happy.payload.data.issue.status,
    "archived",
    "closeout response should report archived issue status",
  );

  const issueAfterHappy = await requestJson(
    `${baseUrl}/api/workspaces/${WORKSPACE_ID}/issues/${issueA.id}`,
  );
  assert(
    issueAfterHappy.response.status === 200 && issueAfterHappy.payload.ok === true,
    "GET issue after happy closeout should return 200",
    issueAfterHappy.payload,
  );
  assertEqual(
    issueAfterHappy.payload.data.closeoutState,
    "completed",
    "GET /issues/:id should expose closeoutState=completed after closeout",
  );
  assertEqual(
    issueAfterHappy.payload.data.status,
    "archived",
    "GET /issues/:id should expose status=archived after closeout",
  );

  const archivesAfterHappy = await requestJson(
    `${baseUrl}/api/workspaces/${WORKSPACE_ID}/archives`,
  );
  assert(
    archivesAfterHappy.payload.data.items.some((item) => item.fileName === closeoutHappy.archive.fileName),
    "happy archive should be persisted",
    archivesAfterHappy.payload,
  );
  const errorEntriesAfterHappy = await requestJson(
    `${baseUrl}/api/workspaces/${WORKSPACE_ID}/error-entries`,
  );
  assert(
    errorEntriesAfterHappy.payload.data.items.some((item) => item.id === closeoutHappy.errorEntry.id),
    "happy error entry should be persisted",
    errorEntriesAfterHappy.payload,
  );

  const listAfterHappy = await requestJson(
    `${baseUrl}/api/workspaces/${WORKSPACE_ID}/issues?status=archived`,
  );
  const happySummary = listAfterHappy.payload.data.items.find((item) => item.id === issueA.id);
  assert(
    happySummary !== undefined && happySummary.closeoutState === "completed",
    "listIssues should expose closeoutState on archived items",
    listAfterHappy.payload,
  );

  // ---- Test 2: validation failure (bad errorEntry payload) → ROLLBACK + closeout_state=failed ----
  const issueB = issueFixture("issue-closeout-validation-0002");
  await fetch(`${baseUrl}/api/workspaces/${WORKSPACE_ID}/issues`, postJson(issueB)).then(async (response) => {
    const payload = await response.json();
    assert(response.status === 201 && payload.ok === true, "issueB create should succeed", payload);
  });

  const validationCloseout = buildClosePayload({
    archive: archiveFixture(issueB.id, "2026-04-28_issue-closeout-validation-0002.md"),
    errorEntry: errorEntryFixture(
      "error-entry-closeout-validation-0002",
      issueB.id,
      "DBG-20260428-402",
      ".debug_workspace/archive/2026-04-28_issue-closeout-validation-0002.md",
      { prevention: "" }, // empty prevention triggers VALIDATION_ERROR in normalizeErrorEntryPayload
    ),
    archivedIssue: archivedIssue(issueB),
  });
  const validationResult = await requestJson(
    `${baseUrl}/api/workspaces/${WORKSPACE_ID}/issues/${issueB.id}/closeout`,
    postJson(validationCloseout),
  );
  assert(
    validationResult.response.status === 422 &&
      validationResult.payload.ok === false &&
      validationResult.payload.error?.code === "VALIDATION_ERROR",
    "validation-fail closeout should return structured 422",
    {
      status: validationResult.response.status,
      payload: validationResult.payload,
    },
  );

  const issueAfterValidation = await requestJson(
    `${baseUrl}/api/workspaces/${WORKSPACE_ID}/issues/${issueB.id}`,
  );
  assertEqual(
    issueAfterValidation.payload.data.status,
    "open",
    "validation-fail closeout should NOT change issue status",
  );
  // Note: validation throws BEFORE the autocommit 'pending' marker write. closeoutState stays NULL.
  assertEqual(
    issueAfterValidation.payload.data.closeoutState,
    null,
    "pre-mutation validation failures should not flip closeoutState (still null)",
  );

  const archivesAfterValidation = await requestJson(
    `${baseUrl}/api/workspaces/${WORKSPACE_ID}/archives`,
  );
  assert(
    !archivesAfterValidation.payload.data.items.some(
      (item) => item.fileName === validationCloseout.archive.fileName,
    ),
    "validation-fail closeout should NOT leak archive row (rollback)",
    archivesAfterValidation.payload,
  );
  const errorEntriesAfterValidation = await requestJson(
    `${baseUrl}/api/workspaces/${WORKSPACE_ID}/error-entries`,
  );
  assert(
    !errorEntriesAfterValidation.payload.data.items.some(
      (item) => item.id === validationCloseout.errorEntry.id,
    ),
    "validation-fail closeout should NOT leak error entry row (rollback)",
    errorEntriesAfterValidation.payload,
  );

  // ---- Test 3: mid-transaction conflict (duplicate archive fileName) → ROLLBACK + closeout_state=failed ----
  const issueC = issueFixture("issue-closeout-conflict-0003");
  await fetch(`${baseUrl}/api/workspaces/${WORKSPACE_ID}/issues`, postJson(issueC)).then(async (response) => {
    const payload = await response.json();
    assert(response.status === 201 && payload.ok === true, "issueC create should succeed", payload);
  });

  const conflictCloseout = buildClosePayload({
    // Reuse Test-1 archive fileName so INSERT into archives raises UNIQUE inside the txn.
    archive: archiveFixture(issueC.id, closeoutHappy.archive.fileName),
    errorEntry: errorEntryFixture(
      "error-entry-closeout-conflict-0003",
      issueC.id,
      "DBG-20260428-403",
      `.debug_workspace/archive/${closeoutHappy.archive.fileName}`,
    ),
    archivedIssue: archivedIssue(issueC),
  });
  const conflictResult = await requestJson(
    `${baseUrl}/api/workspaces/${WORKSPACE_ID}/issues/${issueC.id}/closeout`,
    postJson(conflictCloseout),
  );
  assert(
    conflictResult.response.status === 409 &&
      conflictResult.payload.ok === false &&
      conflictResult.payload.error?.code === "CONFLICT",
    "conflict closeout should return structured 409",
    {
      status: conflictResult.response.status,
      payload: conflictResult.payload,
    },
  );

  const issueAfterConflict = await requestJson(
    `${baseUrl}/api/workspaces/${WORKSPACE_ID}/issues/${issueC.id}`,
  );
  assertEqual(
    issueAfterConflict.payload.data.status,
    "open",
    "conflict closeout should NOT change issue status (rollback)",
  );
  assertEqual(
    issueAfterConflict.payload.data.closeoutState,
    "failed",
    "conflict closeout should mark closeout_state=failed (autocommit after rollback)",
  );

  // Verify archive UNIQUE constraint hasn't created a duplicate row, and the conflict closeout
  // didn't leak the new error entry.
  {
    const inspector = new DatabaseSync(dbPath);
    try {
      const archiveRows = inspector
        .prepare(
          "SELECT issue_id, file_name FROM archives WHERE workspace_id = ? AND file_name = ?",
        )
        .all(WORKSPACE_ID, closeoutHappy.archive.fileName);
      assertEqual(
        archiveRows.length,
        1,
        "archives table should retain exactly one row for the shared fileName",
      );
      assertEqual(
        archiveRows[0].issue_id,
        issueA.id,
        "the surviving archive row should belong to the happy-path issue (rollback preserved)",
      );
      const conflictErrorEntry = inspector
        .prepare("SELECT id FROM error_entries WHERE id = ?")
        .get(conflictCloseout.errorEntry.id);
      assert(
        conflictErrorEntry === undefined,
        "conflict closeout should NOT leave the error entry row behind",
        conflictErrorEntry,
      );
    } finally {
      inspector.close();
    }
  }

  // ---- Test 4: closeout against an unknown issue id should yield NOT_FOUND, no marker write ----
  const missingResult = await requestJson(
    `${baseUrl}/api/workspaces/${WORKSPACE_ID}/issues/issue-closeout-missing-9999/closeout`,
    postJson(
      buildClosePayload({
        archive: archiveFixture("issue-closeout-missing-9999", "2026-04-28_issue-closeout-missing-9999.md"),
        errorEntry: errorEntryFixture(
          "error-entry-closeout-missing-9999",
          "issue-closeout-missing-9999",
          "DBG-20260428-499",
          ".debug_workspace/archive/2026-04-28_issue-closeout-missing-9999.md",
        ),
        archivedIssue: archivedIssue(issueFixture("issue-closeout-missing-9999")),
      }),
    ),
  );
  assert(
    missingResult.response.status === 404 &&
      missingResult.payload.ok === false &&
      missingResult.payload.error?.code === "NOT_FOUND",
    "closeout against missing issue should return 404 NOT_FOUND",
    {
      status: missingResult.response.status,
      payload: missingResult.payload,
    },
  );

  // ---- Test 5: SIGKILL during a closeout transaction must leave no partial writes ----
  // Reproduces an OS-level kill (no JS / SQLite cleanup runs) by spawning a child that
  // sets the 'pending' marker, opens BEGIN IMMEDIATE, INSERTs an archive row, then dies
  // via SIGKILL before COMMIT. After the child dies we reopen the db from the parent and
  // assert the archive INSERT was rolled back by SQLite (WAL discards uncommitted frames)
  // and the 'pending' marker — autocommitted before the txn — survives.
  //
  // We seed a dedicated issue + close the server first so the child is the lone writer
  // and there's no chance of contention with the still-running HTTP server's connection.
  const crashIssue = issueFixture("issue-closeout-crash-0001");
  const seedCrashIssue = await requestJson(
    `${baseUrl}/api/workspaces/${WORKSPACE_ID}/issues`,
    postJson(crashIssue),
  );
  assert(
    seedCrashIssue.response.status === 201 && seedCrashIssue.payload.ok === true,
    "seed crash-target issue should succeed",
    seedCrashIssue.payload,
  );

  await server.close();
  server = null;

  const crashArchive = archiveFixture(crashIssue.id, "2026-04-28_issue-closeout-crash-0001.md");
  const childScript = join(
    dirname(fileURLToPath(import.meta.url)),
    "internal",
    "closeout-crash-child.mjs",
  );
  const child = spawnSync(process.execPath, [childScript], {
    env: {
      ...process.env,
      PROBEFLASH_CRASH_DB_PATH: dbPath,
      PROBEFLASH_CRASH_WORKSPACE_ID: WORKSPACE_ID,
      PROBEFLASH_CRASH_ISSUE_ID: crashIssue.id,
      PROBEFLASH_CRASH_ARCHIVE_FILE_NAME: crashArchive.fileName,
      PROBEFLASH_CRASH_ARCHIVE_FILE_PATH: crashArchive.filePath,
      PROBEFLASH_CRASH_GENERATED_AT: crashArchive.generatedAt,
      PROBEFLASH_CRASH_ARCHIVE_PAYLOAD_JSON: JSON.stringify(crashArchive),
    },
    encoding: "utf8",
  });
  assert(
    child.signal === "SIGKILL",
    "crash child must terminate via SIGKILL (no graceful cleanup)",
    { signal: child.signal, status: child.status, stdout: child.stdout, stderr: child.stderr },
  );
  assert(
    typeof child.stdout === "string" && child.stdout.includes("READY_TO_CRASH"),
    "crash child must reach the post-INSERT / pre-COMMIT crash point before being killed",
    { stdout: child.stdout, stderr: child.stderr },
  );

  {
    const inspector = new DatabaseSync(dbPath);
    try {
      const archiveRow = inspector
        .prepare(
          `SELECT file_name FROM archives WHERE workspace_id = ? AND issue_id = ?`,
        )
        .get(WORKSPACE_ID, crashIssue.id);
      assertEqual(
        archiveRow,
        undefined,
        "SIGKILL mid-transaction must not leave the archive INSERT visible (WAL must discard uncommitted frames)",
      );

      const markerRow = inspector
        .prepare(
          `SELECT closeout_state FROM issues WHERE workspace_id = ? AND id = ?`,
        )
        .get(WORKSPACE_ID, crashIssue.id);
      assertEqual(
        markerRow?.closeout_state,
        "pending",
        "SIGKILL mid-transaction must leave the autocommitted 'pending' marker intact for TECH-02 recovery",
      );
    } finally {
      inspector.close();
    }
  }

  console.log("[SERVER-CLOSEOUT-ATOMICITY verify] PASS: schema bumps user_version >= 3 + adds closeout_state column + partial index");
  console.log("[SERVER-CLOSEOUT-ATOMICITY verify] PASS: happy path commits archive + error entry + archived issue with closeoutState=completed");
  console.log("[SERVER-CLOSEOUT-ATOMICITY verify] PASS: pre-mutation validation failure rolls back without partial writes or marker churn");
  console.log("[SERVER-CLOSEOUT-ATOMICITY verify] PASS: mid-transaction archive UNIQUE conflict rolls back + flips closeoutState=failed");
  console.log("[SERVER-CLOSEOUT-ATOMICITY verify] PASS: closeout on missing issue returns 404 without marker side-effects");
  console.log("[SERVER-CLOSEOUT-ATOMICITY verify] PASS: SIGKILL mid-transaction discards uncommitted archive INSERT and leaves the pending marker for recovery");
} catch (error) {
  fail("verify run threw unexpectedly", { error: error?.message ?? String(error), stack: error?.stack });
} finally {
  if (server) {
    try {
      await server.close();
    } catch {
      // best-effort
    }
  }
  workdir.cleanup();
}
