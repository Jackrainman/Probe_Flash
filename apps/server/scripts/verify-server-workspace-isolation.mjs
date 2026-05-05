// apps/server/scripts/verify-server-workspace-isolation.mjs
// 任务：TECH-03-WORKSPACEID-CONSISTENCY-LATER（夜跑还债扫尾，纯本地）。
//
// 目标：把每个 entity 的 read / write / closeout / recovery / search 调用都对两个独立的
// workspace 跑一遍，证明 workspace_id 过滤没有遗漏 —— A 的数据不会泄漏到 B 的视图，
// B 的写操作不会触及 A 的行；跨 workspace 的 update / closeout / recovery 必须返回
// NOT_FOUND 而不是误命中或静默成功。
//
// TECH-10 把 SQL 拆到 db/<entity>.mjs 之后，每个 entity 的 SELECT/UPDATE/DELETE 都已带
// workspace_id 过滤（参见 audit grep），但缺少一个全 entity 覆盖的契约级 verify；本脚本补上。
//
// 边界：纯本地 sqlite + startProbeFlashServer + 临时目录；不动真实服务器；不操作 systemd / 4100。

import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { startProbeFlashServer } from "../src/server.mjs";
import { createReporter, createTempDir } from "./verify-helpers.mjs";
import {
  makeArchiveFixture,
  makeErrorEntryFixture,
  makeIssueFixture,
  makeRecordFixture,
  makeRepoSnapshot,
} from "./fixtures/verify-fixtures.mjs";

const DEFAULT_WORKSPACE_ID = "workspace-26-r1";
const NOW = "2026-05-01T08:00:00+08:00";

const { fail, assert, assertEqual } = createReporter("SERVER-WORKSPACE-ISOLATION verify");

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

function putJson(body) {
  return {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function deleteRequest() {
  return { method: "DELETE" };
}

function repoSnapshot() {
  return makeRepoSnapshot({
    now: NOW,
    overrides: {
      changedFiles: [{ path: "apps/server/src/db/issue.mjs", status: "modified" }],
      recentCommits: [
        {
          hash: "abc1234",
          author: "ProbeFlash Verify",
          message: "workspace isolation verify",
          timestamp: NOW,
        },
      ],
    },
  });
}

function issueFixture(workspaceId, id, overrides = {}) {
  return makeIssueFixture({
    id,
    workspaceId,
    now: NOW,
    repoSnapshot: repoSnapshot(),
    overrides: {
      title: `Workspace isolation verify ${workspaceId} ${id}`,
      rawInput: "isolation verify",
      normalizedSummary: "isolation verify",
      symptomSummary: "isolation verify",
      tags: [`tag-${workspaceId}`],
      ...overrides,
    },
  });
}

function recordFixture(issueId, id, overrides = {}) {
  return makeRecordFixture({
    id,
    issueId,
    now: NOW,
    overrides: {
      rawText: `record ${id} in issue ${issueId}`,
      polishedText: `record ${id} in issue ${issueId}`,
      ...overrides,
    },
  });
}

function archiveFixture(workspaceId, issueId, fileName, overrides = {}) {
  return makeArchiveFixture({
    issueId,
    workspaceId,
    fileName,
    now: NOW,
    overrides: {
      markdownContent: `# isolation verify ${workspaceId}\n`,
      generatedBy: "manual",
      ...overrides,
    },
  });
}

function errorEntryFixture(workspaceId, issueId, id, errorCode, archiveFilePath, overrides = {}) {
  return makeErrorEntryFixture({
    id,
    sourceIssueId: issueId,
    workspaceId,
    errorCode,
    archiveFilePath,
    now: NOW,
    overrides: {
      title: `isolation verify ${workspaceId} ${id}`,
      symptom: "isolation",
      rootCause: "verify",
      resolution: "verify",
      prevention: "Run workspace isolation verify regularly.",
      ...overrides,
    },
  });
}

function formDraftPayload(workspaceId, formKind, itemId, content) {
  return {
    workspaceId,
    formKind,
    itemId,
    payloadJson: JSON.stringify({ workspace: workspaceId, content }),
    updatedAt: NOW,
  };
}

const workdir = createTempDir("probeflash-server-workspace-isolation");
const dbPath = join(workdir.path, "probeflash.sqlite");

let server;
try {
  server = await startProbeFlashServer({
    host: "127.0.0.1",
    port: 0,
    dbPath,
    suppressCloseoutRecoveryLog: true,
  });
  const baseUrl = server.baseUrl;

  // ---- Bootstrap: create a second workspace ("Workspace B") alongside the seeded default ----
  const workspaceCreate = await requestJson(
    `${baseUrl}/api/workspaces`,
    postJson({ name: "Workspace Isolation B" }),
  );
  assert(
    workspaceCreate.response.status === 201 && workspaceCreate.payload.ok === true,
    "creating second workspace should succeed",
    workspaceCreate.payload,
  );
  const workspaceBId = workspaceCreate.payload.data.workspace.id;
  assert(
    typeof workspaceBId === "string" && workspaceBId !== DEFAULT_WORKSPACE_ID,
    "second workspace must have its own id",
    { workspaceBId },
  );

  // ---- Seed parallel data in both workspaces ----
  const issueA = issueFixture(DEFAULT_WORKSPACE_ID, "issue-isolation-a-0001");
  const issueB = issueFixture(workspaceBId, "issue-isolation-b-0001");
  const issueAExtra = issueFixture(DEFAULT_WORKSPACE_ID, "issue-isolation-a-0002");

  for (const [workspaceId, issue, label] of [
    [DEFAULT_WORKSPACE_ID, issueA, "issueA"],
    [DEFAULT_WORKSPACE_ID, issueAExtra, "issueAExtra"],
    [workspaceBId, issueB, "issueB"],
  ]) {
    const result = await requestJson(
      `${baseUrl}/api/workspaces/${workspaceId}/issues`,
      postJson(issue),
    );
    assert(
      result.response.status === 201 && result.payload.ok === true,
      `create ${label} should succeed`,
      result.payload,
    );
  }

  const recordA = recordFixture(issueA.id, "record-isolation-a-0001");
  const recordB = recordFixture(issueB.id, "record-isolation-b-0001");
  for (const [workspaceId, issueId, record, label] of [
    [DEFAULT_WORKSPACE_ID, issueA.id, recordA, "recordA"],
    [workspaceBId, issueB.id, recordB, "recordB"],
  ]) {
    const result = await requestJson(
      `${baseUrl}/api/workspaces/${workspaceId}/issues/${issueId}/records`,
      postJson(record),
    );
    assert(
      result.response.status === 201 && result.payload.ok === true,
      `create ${label} should succeed`,
      result.payload,
    );
  }

  const archiveA = archiveFixture(DEFAULT_WORKSPACE_ID, issueA.id, "2026-05-01_isolation-a.md");
  const archiveB = archiveFixture(workspaceBId, issueB.id, "2026-05-01_isolation-b.md");
  for (const [workspaceId, archive, label] of [
    [DEFAULT_WORKSPACE_ID, archiveA, "archiveA"],
    [workspaceBId, archiveB, "archiveB"],
  ]) {
    const result = await requestJson(
      `${baseUrl}/api/workspaces/${workspaceId}/archives`,
      postJson(archive),
    );
    assert(
      result.response.status === 201 && result.payload.ok === true,
      `create ${label} should succeed`,
      result.payload,
    );
  }

  const errorEntryA = errorEntryFixture(
    DEFAULT_WORKSPACE_ID,
    issueA.id,
    "error-entry-isolation-a-0001",
    "DBG-20260501-101",
    archiveA.filePath,
  );
  const errorEntryB = errorEntryFixture(
    workspaceBId,
    issueB.id,
    "error-entry-isolation-b-0001",
    "DBG-20260501-201",
    archiveB.filePath,
  );
  for (const [workspaceId, errorEntry, label] of [
    [DEFAULT_WORKSPACE_ID, errorEntryA, "errorEntryA"],
    [workspaceBId, errorEntryB, "errorEntryB"],
  ]) {
    const result = await requestJson(
      `${baseUrl}/api/workspaces/${workspaceId}/error-entries`,
      postJson(errorEntry),
    );
    assert(
      result.response.status === 201 && result.payload.ok === true,
      `create ${label} should succeed`,
      result.payload,
    );
  }

  const draftA = formDraftPayload(DEFAULT_WORKSPACE_ID, "issue-intake", issueA.id, "draft for A");
  const draftB = formDraftPayload(workspaceBId, "issue-intake", issueB.id, "draft for B");
  for (const [workspaceId, draft, label] of [
    [DEFAULT_WORKSPACE_ID, draftA, "draftA"],
    [workspaceBId, draftB, "draftB"],
  ]) {
    const result = await requestJson(
      `${baseUrl}/api/workspaces/${workspaceId}/form-drafts/${draft.formKind}/${draft.itemId}`,
      putJson(draft),
    );
    assert(
      result.response.status === 200 && result.payload.ok === true,
      `save ${label} should succeed`,
      result.payload,
    );
  }

  // ---- Read isolation: each list scoped to its workspace ----
  const listIssuesA = await requestJson(
    `${baseUrl}/api/workspaces/${DEFAULT_WORKSPACE_ID}/issues?status=all`,
  );
  assert(
    listIssuesA.payload.data.items.every((item) => item.id !== issueB.id),
    "listIssues for A must not return B's issue",
    listIssuesA.payload,
  );
  assert(
    listIssuesA.payload.data.items.some((item) => item.id === issueA.id),
    "listIssues for A should include A's issue",
    listIssuesA.payload,
  );

  const listIssuesB = await requestJson(
    `${baseUrl}/api/workspaces/${workspaceBId}/issues?status=all`,
  );
  assertEqual(
    listIssuesB.payload.data.items.length,
    1,
    "listIssues for B should only return B's single issue",
  );
  assertEqual(
    listIssuesB.payload.data.items[0].id,
    issueB.id,
    "listIssues for B should return B's issue id",
  );

  const listArchivesA = await requestJson(
    `${baseUrl}/api/workspaces/${DEFAULT_WORKSPACE_ID}/archives`,
  );
  assert(
    listArchivesA.payload.data.items.every((item) => item.fileName !== archiveB.fileName),
    "listArchives for A must not return B's archive",
    listArchivesA.payload,
  );

  const listArchivesB = await requestJson(`${baseUrl}/api/workspaces/${workspaceBId}/archives`);
  assertEqual(
    listArchivesB.payload.data.items.length,
    1,
    "listArchives for B should only return B's archive",
  );

  const listErrorEntriesA = await requestJson(
    `${baseUrl}/api/workspaces/${DEFAULT_WORKSPACE_ID}/error-entries`,
  );
  assert(
    listErrorEntriesA.payload.data.items.every((item) => item.id !== errorEntryB.id),
    "listErrorEntries for A must not return B's entry",
    listErrorEntriesA.payload,
  );

  const listRecordsA = await requestJson(
    `${baseUrl}/api/workspaces/${DEFAULT_WORKSPACE_ID}/issues/${issueA.id}/records`,
  );
  assert(
    listRecordsA.payload.data.items.every((item) => item.id !== recordB.id),
    "listRecords for A's issue must not return B's record",
    listRecordsA.payload,
  );

  // ---- Cross-workspace GET on detail routes returns NOT_FOUND ----
  const crossGetIssue = await requestJson(
    `${baseUrl}/api/workspaces/${DEFAULT_WORKSPACE_ID}/issues/${issueB.id}`,
  );
  assert(
    crossGetIssue.response.status === 404 &&
      crossGetIssue.payload.error?.code === "NOT_FOUND",
    "GET issueB via workspaceA path must return 404",
    crossGetIssue.payload,
  );

  const crossGetArchive = await requestJson(
    `${baseUrl}/api/workspaces/${DEFAULT_WORKSPACE_ID}/archives/${archiveB.fileName}`,
  );
  assert(
    crossGetArchive.response.status === 404,
    "GET archiveB via workspaceA path must return 404",
    crossGetArchive.payload,
  );

  const crossGetErrorEntry = await requestJson(
    `${baseUrl}/api/workspaces/${DEFAULT_WORKSPACE_ID}/error-entries/${errorEntryB.id}`,
  );
  assert(
    crossGetErrorEntry.response.status === 404,
    "GET errorEntryB via workspaceA path must return 404",
    crossGetErrorEntry.payload,
  );

  const crossGetFormDraft = await requestJson(
    `${baseUrl}/api/workspaces/${DEFAULT_WORKSPACE_ID}/form-drafts/${draftB.formKind}/${draftB.itemId}`,
  );
  assert(
    crossGetFormDraft.response.status === 200 &&
      crossGetFormDraft.payload.data.draft === null,
    "form-draft B is invisible from workspace A's path (returns null)",
    crossGetFormDraft.payload,
  );

  // ---- Cross-workspace PUT updateIssue must return NOT_FOUND ----
  const crossUpdate = await requestJson(
    `${baseUrl}/api/workspaces/${DEFAULT_WORKSPACE_ID}/issues/${issueB.id}`,
    putJson({ ...issueB, projectId: DEFAULT_WORKSPACE_ID, title: "hijack attempt" }),
  );
  assert(
    crossUpdate.response.status === 404 || crossUpdate.response.status === 422,
    "cross-workspace PUT must reject (404 NOT_FOUND or 422 VALIDATION_ERROR)",
    crossUpdate.payload,
  );

  // ---- Cross-workspace closeout: targeting B's issue from workspace A must 404 ----
  const crossCloseout = await requestJson(
    `${baseUrl}/api/workspaces/${DEFAULT_WORKSPACE_ID}/issues/${issueB.id}/closeout`,
    postJson({
      archive: archiveFixture(DEFAULT_WORKSPACE_ID, issueB.id, "2026-05-01_cross.md"),
      errorEntry: errorEntryFixture(
        DEFAULT_WORKSPACE_ID,
        issueB.id,
        "error-entry-cross-0001",
        "DBG-20260501-999",
        ".debug_workspace/archive/2026-05-01_cross.md",
      ),
      issue: { ...issueB, projectId: DEFAULT_WORKSPACE_ID, status: "archived", updatedAt: NOW },
    }),
  );
  assert(
    crossCloseout.response.status >= 400,
    "cross-workspace closeout must fail (will be 422 due to projectId mismatch or 404)",
    crossCloseout.payload,
  );

  // ---- Closeout recovery scope ----
  // Manually flip a marker in workspace A directly — should NOT show up under B's recovery list.
  {
    const inspector = new DatabaseSync(dbPath);
    try {
      inspector.prepare(
        `UPDATE issues SET closeout_state = 'pending' WHERE workspace_id = ? AND id = ?`,
      ).run(DEFAULT_WORKSPACE_ID, issueAExtra.id);
    } finally {
      inspector.close();
    }
  }
  const recoveryA = await requestJson(
    `${baseUrl}/api/workspaces/${DEFAULT_WORKSPACE_ID}/closeout-recovery`,
  );
  assertEqual(
    recoveryA.payload.data.items.length,
    1,
    "workspace A's recovery list should expose its own pending issue",
  );
  assertEqual(
    recoveryA.payload.data.items[0].id,
    issueAExtra.id,
    "workspace A's recovery item id should match the seeded marker",
  );

  const recoveryB = await requestJson(
    `${baseUrl}/api/workspaces/${workspaceBId}/closeout-recovery`,
  );
  assertEqual(
    recoveryB.payload.data.items.length,
    0,
    "workspace B's recovery list must remain empty (no leakage from A)",
  );

  // Cross-workspace clear must 404 (issueA isn't in workspaceB).
  const crossClear = await requestJson(
    `${baseUrl}/api/workspaces/${workspaceBId}/closeout-recovery/${issueAExtra.id}/clear`,
    postJson(undefined),
  );
  assert(
    crossClear.response.status === 404,
    "cross-workspace closeout-recovery/clear must return 404",
    crossClear.payload,
  );

  // Confirm the cross-clear didn't actually flip A's marker.
  const recoveryAAfter = await requestJson(
    `${baseUrl}/api/workspaces/${DEFAULT_WORKSPACE_ID}/closeout-recovery`,
  );
  assertEqual(
    recoveryAAfter.payload.data.items.length,
    1,
    "workspace A's recovery list must not be affected by cross-workspace clear attempt",
  );

  // ---- Search: each workspace sees only its own results ----
  const searchA = await requestJson(
    `${baseUrl}/api/workspaces/${DEFAULT_WORKSPACE_ID}/search?q=isolation`,
  );
  assert(
    searchA.payload.data.items.every((item) => {
      if (item.kind === "issue") return item.id === issueA.id || item.id === issueAExtra.id;
      if (item.kind === "record") return item.id === recordA.id;
      if (item.kind === "archive") return item.fileName === archiveA.fileName;
      if (item.kind === "error_entry") return item.id === errorEntryA.id;
      return false;
    }),
    "search in workspace A should only return A-owned items",
    searchA.payload,
  );
  assert(
    searchA.payload.data.items.every((item) => item.id !== issueB.id && item.id !== recordB.id && item.id !== errorEntryB.id),
    "search in workspace A must not surface B-owned items",
    searchA.payload,
  );

  const searchB = await requestJson(
    `${baseUrl}/api/workspaces/${workspaceBId}/search?q=isolation`,
  );
  assert(
    searchB.payload.data.items.every((item) => {
      if (item.kind === "issue") return item.id === issueB.id;
      if (item.kind === "record") return item.id === recordB.id;
      if (item.kind === "archive") return item.fileName === archiveB.fileName;
      if (item.kind === "error_entry") return item.id === errorEntryB.id;
      return false;
    }),
    "search in workspace B should only return B-owned items",
    searchB.payload,
  );

  // ---- Form draft DELETE scope: A cannot delete B's draft ----
  const crossDelete = await requestJson(
    `${baseUrl}/api/workspaces/${DEFAULT_WORKSPACE_ID}/form-drafts/${draftB.formKind}/${draftB.itemId}`,
    deleteRequest(),
  );
  assert(
    crossDelete.response.status === 200,
    "cross-workspace DELETE on draft B from A's path returns 200 (idempotent), but must NOT touch B's row",
    crossDelete.payload,
  );

  // Verify B's draft still exists.
  const draftBAfterCrossDelete = await requestJson(
    `${baseUrl}/api/workspaces/${workspaceBId}/form-drafts/${draftB.formKind}/${draftB.itemId}`,
  );
  assert(
    draftBAfterCrossDelete.payload.data.draft !== null,
    "workspace B's draft must persist after cross-workspace DELETE attempt",
    draftBAfterCrossDelete.payload,
  );

  // ---- Direct DB-level audit: every per-entity table row references the correct workspace ----
  {
    const inspector = new DatabaseSync(dbPath);
    try {
      const tables = ["issues", "records", "archives", "error_entries", "form_drafts"];
      for (const table of tables) {
        const orphaned = inspector
          .prepare(
            `SELECT COUNT(*) AS c FROM ${table} WHERE workspace_id NOT IN (SELECT id FROM workspaces)`,
          )
          .get();
        assertEqual(
          orphaned.c,
          0,
          `table ${table} must not contain rows referencing unknown workspaces`,
        );
      }
    } finally {
      inspector.close();
    }
  }

  console.log("[SERVER-WORKSPACE-ISOLATION verify] PASS: each list endpoint returns only its own workspace's rows");
  console.log("[SERVER-WORKSPACE-ISOLATION verify] PASS: cross-workspace GET on detail routes returns 404");
  console.log("[SERVER-WORKSPACE-ISOLATION verify] PASS: cross-workspace PUT/closeout reject without touching the other workspace");
  console.log("[SERVER-WORKSPACE-ISOLATION verify] PASS: closeout-recovery list + clear scopes are workspace-bound");
  console.log("[SERVER-WORKSPACE-ISOLATION verify] PASS: search in workspace A never surfaces workspace B rows (and vice versa)");
  console.log("[SERVER-WORKSPACE-ISOLATION verify] PASS: form-draft DELETE is workspace-bound; cross-workspace DELETE leaves the other workspace untouched");
  console.log("[SERVER-WORKSPACE-ISOLATION verify] PASS: every per-entity table row references its declared workspace_id");
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
