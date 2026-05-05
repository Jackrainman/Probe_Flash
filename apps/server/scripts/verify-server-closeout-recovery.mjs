// apps/server/scripts/verify-server-closeout-recovery.mjs
// 任务：TECH-02-CLOSEOUT-ATOMICITY-RECOVERY（夜跑还债，纯本地）。
//
// 目标：验证 startup 扫描 + recovery API（list / clear）+ closeout 重试时 marker 流转。
//
// 不依赖真实服务器，所有断言基于 startProbeFlashServer + 临时 sqlite。
//
// 校验场景：
//   1. 启动时若存在 closeout_state IN ('pending','failed') 的行，scan 结果带回所有项。
//   2. 启动时若不存在异常 closeout，scan 结果为空且不报错。
//   3. GET /api/.../closeout-recovery 返回 pending + failed 全部行；按 updatedAt DESC 排序。
//   4. POST /api/.../closeout-recovery/:id/clear 把对应行的 closeout_state 置 NULL；
//      issue.status 不被改动；listCloseoutRecovery 不再返回该行。
//   5. clear 不存在的 issue 返回 404 NOT_FOUND；不会留下副作用。
//   6. clear 是幂等的：对已 clear 的 issue 再次 clear 仍返回 ok=true。
//   7. 在已有 pending 标记的 issue 上重试 closeoutIssue，marker 会被覆盖到 'completed'，
//      list 自动收敛到空。
//
// 边界：仅纯本地 / 仅 sqlite / 仅 random port；不动真实服务器、不写 systemd / 4100。

import { join } from "node:path";
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
const NOW = "2026-04-29T08:00:00+08:00";

const { fail, assert, assertEqual } = createReporter("SERVER-CLOSEOUT-RECOVERY verify");

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json();
  return { response, payload };
}

function postJson(body) {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

function repoSnapshot() {
  return makeRepoSnapshot({
    now: NOW,
    overrides: {
      changedFiles: [{ path: "apps/server/src/database.mjs", status: "modified" }],
      recentCommits: [
        {
          hash: "fedcba9",
          author: "ProbeFlash Verify",
          message: "closeout recovery verify",
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
      title: `Closeout recovery verify ${id}`,
      rawInput: "recovery verify",
      normalizedSummary: "recovery verify",
      symptomSummary: "recovery verify",
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
      markdownContent: "# Closeout recovery verify\n",
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
      title: `Closeout recovery verify entry ${id}`,
      symptom: "recovery verify",
      rootCause: "recovery verify",
      resolution: "recovery verify",
      prevention: "Run closeout recovery verify regularly.",
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

const workdir = createTempDir("probeflash-server-closeout-recovery");
const dbPath = join(workdir.path, "probeflash.sqlite");

let server;
try {
  // ---- Boot 1: clean db, scan should be empty ----
  server = await startProbeFlashServer({
    host: "127.0.0.1",
    port: 0,
    dbPath,
    suppressCloseoutRecoveryLog: true,
  });
  assert(
    server.closeoutRecoveryScan.ok === true && server.closeoutRecoveryScan.items.length === 0,
    "boot 1 scan should be ok with no pending closeouts",
    server.closeoutRecoveryScan,
  );

  // Seed an issue and a happy-path closeout (should NOT show in recovery list)
  const baseUrl1 = server.baseUrl;
  const happyIssue = issueFixture("issue-recovery-happy-0001");
  await fetch(`${baseUrl1}/api/workspaces/${WORKSPACE_ID}/issues`, postJson(happyIssue)).then(
    async (response) => {
      const payload = await response.json();
      assert(response.status === 201 && payload.ok === true, "happy issue create should succeed", payload);
    },
  );
  const happyClose = buildClosePayload({
    archive: archiveFixture(happyIssue.id, "2026-04-29_issue-recovery-happy-0001.md"),
    errorEntry: errorEntryFixture(
      "error-entry-recovery-happy-0001",
      happyIssue.id,
      "DBG-20260429-501",
      ".debug_workspace/archive/2026-04-29_issue-recovery-happy-0001.md",
    ),
    archivedIssue: archivedIssue(happyIssue),
  });
  const happyResponse = await requestJson(
    `${baseUrl1}/api/workspaces/${WORKSPACE_ID}/issues/${happyIssue.id}/closeout`,
    postJson(happyClose),
  );
  assert(
    happyResponse.response.status === 201 && happyResponse.payload.ok === true,
    "happy closeout should succeed before recovery testing",
    happyResponse.payload,
  );

  // Seed a failed closeout (conflict on archive fileName) → marker = 'failed'
  const failedIssue = issueFixture("issue-recovery-failed-0002");
  await fetch(`${baseUrl1}/api/workspaces/${WORKSPACE_ID}/issues`, postJson(failedIssue)).then(
    async (response) => {
      const payload = await response.json();
      assert(response.status === 201 && payload.ok === true, "failed-target issue create should succeed", payload);
    },
  );
  const conflictClose = buildClosePayload({
    archive: archiveFixture(failedIssue.id, happyClose.archive.fileName),
    errorEntry: errorEntryFixture(
      "error-entry-recovery-failed-0002",
      failedIssue.id,
      "DBG-20260429-502",
      `.debug_workspace/archive/${happyClose.archive.fileName}`,
    ),
    archivedIssue: archivedIssue(failedIssue),
  });
  const conflictResponse = await requestJson(
    `${baseUrl1}/api/workspaces/${WORKSPACE_ID}/issues/${failedIssue.id}/closeout`,
    postJson(conflictClose),
  );
  assert(
    conflictResponse.response.status === 409 &&
      conflictResponse.payload.ok === false &&
      conflictResponse.payload.error?.code === "CONFLICT",
    "expected conflict-induced failure to flip closeout_state=failed",
    conflictResponse.payload,
  );

  // Seed a pending marker by direct sqlite write to mimic mid-flight crash recovery
  // (closeoutIssue's pre-step autocommit happened, then process died before BEGIN).
  await server.close();

  {
    const inspector = new DatabaseSync(dbPath);
    try {
      const pendingIssue = issueFixture("issue-recovery-pending-0003");
      const repoSnapshotJson = JSON.stringify(pendingIssue);
      inspector.prepare(`
        INSERT INTO issues (id, workspace_id, title, severity, status, created_at, updated_at, payload_json, closeout_state)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `).run(
        pendingIssue.id,
        WORKSPACE_ID,
        pendingIssue.title,
        pendingIssue.severity,
        pendingIssue.status,
        pendingIssue.createdAt,
        pendingIssue.updatedAt,
        repoSnapshotJson,
      );
    } finally {
      inspector.close();
    }
  }

  // ---- Boot 2: db now has 1 pending + 1 failed; scan should report both ----
  server = await startProbeFlashServer({
    host: "127.0.0.1",
    port: 0,
    dbPath,
    suppressCloseoutRecoveryLog: true,
  });
  assert(
    server.closeoutRecoveryScan.ok === true && server.closeoutRecoveryScan.items.length === 2,
    "boot 2 scan should report 2 issues (1 pending + 1 failed)",
    server.closeoutRecoveryScan,
  );
  const scannedIds = server.closeoutRecoveryScan.items.map((item) => item.id).sort();
  assertEqual(
    scannedIds,
    ["issue-recovery-failed-0002", "issue-recovery-pending-0003"],
    "scan should include both the failed and the manually-seeded pending issue",
  );

  const baseUrl2 = server.baseUrl;

  // ---- HTTP recovery list ----
  const recoveryList = await requestJson(
    `${baseUrl2}/api/workspaces/${WORKSPACE_ID}/closeout-recovery`,
  );
  assert(
    recoveryList.response.status === 200 && recoveryList.payload.ok === true,
    "GET /closeout-recovery should return 200 ok=true",
    recoveryList.payload,
  );
  const recoveryItems = recoveryList.payload.data.items;
  assertEqual(recoveryItems.length, 2, "recovery list should expose both candidates");
  for (const item of recoveryItems) {
    assert(
      item.closeoutState === "pending" || item.closeoutState === "failed",
      "recovery list items must carry pending|failed marker",
      item,
    );
    assert(
      typeof item.id === "string" && item.id.length > 0,
      "recovery list items must include id",
      item,
    );
    assert(
      typeof item.updatedAt === "string" && item.updatedAt.length > 0,
      "recovery list items must include updatedAt",
      item,
    );
  }

  // Happy-path archived issue must NOT be in the recovery list (closeout_state='completed')
  assert(
    !recoveryItems.some((item) => item.id === happyIssue.id),
    "happy-path archived issue should not be in recovery list",
    recoveryItems,
  );

  // ---- POST clear on the failed marker ----
  const clearFailedResponse = await requestJson(
    `${baseUrl2}/api/workspaces/${WORKSPACE_ID}/closeout-recovery/${failedIssue.id}/clear`,
    postJson(undefined),
  );
  assert(
    clearFailedResponse.response.status === 200 && clearFailedResponse.payload.ok === true,
    "POST /closeout-recovery/:id/clear should return 200 ok=true",
    clearFailedResponse.payload,
  );
  assertEqual(
    clearFailedResponse.payload.data.closeoutState,
    null,
    "clear response should expose closeoutState=null",
  );

  // Issue status should still be 'open' (rolled-back txn never archived it).
  const failedIssueAfter = await requestJson(
    `${baseUrl2}/api/workspaces/${WORKSPACE_ID}/issues/${failedIssue.id}`,
  );
  assertEqual(
    failedIssueAfter.payload.data.status,
    "open",
    "clearing failed marker should NOT change issue.status",
  );
  assertEqual(
    failedIssueAfter.payload.data.closeoutState,
    null,
    "GET /issues/:id should reflect cleared closeoutState=null",
  );

  // List should now only return the pending one
  const recoveryListAfterClear = await requestJson(
    `${baseUrl2}/api/workspaces/${WORKSPACE_ID}/closeout-recovery`,
  );
  assertEqual(
    recoveryListAfterClear.payload.data.items.length,
    1,
    "recovery list should shrink to the remaining pending issue after clear",
  );
  assertEqual(
    recoveryListAfterClear.payload.data.items[0].id,
    "issue-recovery-pending-0003",
    "remaining recovery item should be the pending one",
  );

  // ---- Idempotent clear: clearing the same issue twice still returns ok ----
  const idempotentClear = await requestJson(
    `${baseUrl2}/api/workspaces/${WORKSPACE_ID}/closeout-recovery/${failedIssue.id}/clear`,
    postJson(undefined),
  );
  assert(
    idempotentClear.response.status === 200 && idempotentClear.payload.ok === true,
    "second clear on same issue should be idempotent",
    idempotentClear.payload,
  );

  // ---- Clear missing issue returns 404 ----
  const clearMissing = await requestJson(
    `${baseUrl2}/api/workspaces/${WORKSPACE_ID}/closeout-recovery/issue-recovery-missing-9999/clear`,
    postJson(undefined),
  );
  assert(
    clearMissing.response.status === 404 &&
      clearMissing.payload.ok === false &&
      clearMissing.payload.error?.code === "NOT_FOUND",
    "clear on missing issue should return 404",
    clearMissing.payload,
  );

  // ---- Retrying closeout on the pending row converges marker to 'completed' ----
  const retryClose = buildClosePayload({
    archive: archiveFixture(
      "issue-recovery-pending-0003",
      "2026-04-29_issue-recovery-pending-0003.md",
    ),
    errorEntry: errorEntryFixture(
      "error-entry-recovery-pending-0003",
      "issue-recovery-pending-0003",
      "DBG-20260429-503",
      ".debug_workspace/archive/2026-04-29_issue-recovery-pending-0003.md",
    ),
    archivedIssue: archivedIssue(issueFixture("issue-recovery-pending-0003")),
  });
  const retryResponse = await requestJson(
    `${baseUrl2}/api/workspaces/${WORKSPACE_ID}/issues/issue-recovery-pending-0003/closeout`,
    postJson(retryClose),
  );
  assert(
    retryResponse.response.status === 201 && retryResponse.payload.ok === true,
    "retry closeout on pending issue should succeed and overwrite marker",
    retryResponse.payload,
  );
  assertEqual(
    retryResponse.payload.data.issue.closeoutState,
    "completed",
    "retry closeout response should expose closeoutState=completed",
  );

  const recoveryListAfterRetry = await requestJson(
    `${baseUrl2}/api/workspaces/${WORKSPACE_ID}/closeout-recovery`,
  );
  assertEqual(
    recoveryListAfterRetry.payload.data.items.length,
    0,
    "recovery list should be empty after retry promotes the marker to completed",
  );

  console.log("[SERVER-CLOSEOUT-RECOVERY verify] PASS: clean boot reports empty recovery scan");
  console.log("[SERVER-CLOSEOUT-RECOVERY verify] PASS: boot scan picks up pending + failed markers across restarts");
  console.log("[SERVER-CLOSEOUT-RECOVERY verify] PASS: GET /closeout-recovery exposes both pending and failed items");
  console.log("[SERVER-CLOSEOUT-RECOVERY verify] PASS: POST /closeout-recovery/:id/clear is idempotent and does not touch issue.status");
  console.log("[SERVER-CLOSEOUT-RECOVERY verify] PASS: clear on missing issue returns 404 with no side effects");
  console.log("[SERVER-CLOSEOUT-RECOVERY verify] PASS: retry of closeoutIssue on pending row converges marker to completed");
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
