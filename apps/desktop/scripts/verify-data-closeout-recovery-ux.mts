// apps/desktop/scripts/verify-data-closeout-recovery-ux.mts
// 任务：TECH-02-CLOSEOUT-ATOMICITY-RECOVERY（夜跑还债，纯本地）。
//
// 验证 desktop closeoutRecovery 链路：
//   1. createHttpStorageRepository().closeoutRecovery.list() 走 GET
//      /api/.../closeout-recovery；返回的 items 带 closeoutState (pending|failed)。
//   2. closeoutRecovery.clear(issueId) 走 POST /closeout-recovery/:id/clear；
//      清掉 marker 后 list() 收敛。
//   3. App.tsx + CloseoutRecoveryPanel.tsx 暴露必要的 data-testid 标记，
//      让 UI 不再静默吞掉 pending/failed。
//
// 边界：纯本地 sqlite + startProbeFlashServer；不操作真实服务器；不读密钥；不写 systemd。

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { startProbeFlashServer } from "../../server/src/server.mjs";
import { createHttpStorageRepository } from "../src/storage/http-storage-repository.ts";
import type { IssueCard } from "../src/domain/schemas/issue-card.ts";
import { buildIssueCardFromIntake, defaultIntakeOptions } from "../src/domain/issue-intake.ts";
import { createReporter, createTempDir } from "./verify-helpers.mts";

const WORKSPACE_ID = "workspace-26-r1";
const NOW = "2026-04-30T10:00:00+08:00";

const { fail, assert, assertEqual } = createReporter("DATA-CLOSEOUT-RECOVERY-UX verify");

function buildIssue(id: string, title: string): IssueCard {
  const result = buildIssueCardFromIntake(
    {
      title,
      description: `${title} created by closeout recovery UX verify.`,
      severity: "high",
    },
    defaultIntakeOptions(NOW, id),
  );
  if (!result.ok) fail("issue fixture build failed", result);
  return result.card;
}

function seedPendingMarker(dbPath: string, issue: IssueCard) {
  const inspector = new DatabaseSync(dbPath);
  try {
    inspector.prepare(`
      INSERT INTO issues (id, workspace_id, title, severity, status, created_at, updated_at, payload_json, closeout_state)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      issue.id,
      WORKSPACE_ID,
      issue.title,
      issue.severity,
      issue.status,
      issue.createdAt,
      issue.updatedAt,
      JSON.stringify(issue),
    );
  } finally {
    inspector.close();
  }
}

const workdir = createTempDir("probeflash-data-closeout-recovery-ux");
const dbPath = join(workdir.path, "probeflash.sqlite");

let server: Awaited<ReturnType<typeof startProbeFlashServer>> | null = null;
try {
  // First boot: seed schema by initializing the server briefly.
  server = await startProbeFlashServer({
    host: "127.0.0.1",
    port: 0,
    dbPath,
    suppressCloseoutRecoveryLog: true,
  });
  await server.close();
  server = null;

  // Inject a pending marker by direct sqlite write to mimic recovery candidate.
  const pendingIssue = buildIssue("issue-recovery-ux-0001", "Closeout recovery UX pending");
  seedPendingMarker(dbPath, pendingIssue);

  // Second boot: server now has a pending closeout candidate.
  server = await startProbeFlashServer({
    host: "127.0.0.1",
    port: 0,
    dbPath,
    suppressCloseoutRecoveryLog: true,
  });
  assert(
    server.closeoutRecoveryScan.ok && server.closeoutRecoveryScan.items.length === 1,
    "boot scan should expose the seeded pending marker",
    server.closeoutRecoveryScan,
  );

  const repository = createHttpStorageRepository({ baseUrl: `${server.baseUrl}/api`, workspaceId: WORKSPACE_ID });

  // ---- list() ----
  const listResult = await repository.closeoutRecovery.list();
  assertEqual(listResult.readError, null, "closeoutRecovery.list() should not surface readError on happy server");
  assertEqual(listResult.items.length, 1, "closeoutRecovery.list() should expose the seeded pending issue");
  const item = listResult.items[0];
  assertEqual(item.id, pendingIssue.id, "list item id should match seeded issue");
  assertEqual(item.closeoutState, "pending", "list item closeoutState should be pending");
  assert(typeof item.title === "string" && item.title.length > 0, "list item should include title", item);
  assert(typeof item.updatedAt === "string" && item.updatedAt.length > 0, "list item should include updatedAt", item);

  // ---- clear() ----
  const clearResult = await repository.closeoutRecovery.clear(pendingIssue.id);
  assert(clearResult.ok === true, "closeoutRecovery.clear() should succeed", clearResult);

  const listAfterClear = await repository.closeoutRecovery.list();
  assertEqual(
    listAfterClear.items.length,
    0,
    "closeoutRecovery.list() should be empty after clearing the marker",
  );
  assertEqual(listAfterClear.readError, null, "list() after clear should not surface readError");

  // ---- clear() on missing issue surfaces a recoverable error result ----
  const missingClear = await repository.closeoutRecovery.clear("issue-recovery-ux-missing-9999");
  assert(
    missingClear.ok === false,
    "clear() on missing issue should fail (not_found)",
    missingClear,
  );

  // ---- UI markers in App.tsx + CloseoutRecoveryPanel.tsx ----
  const appPath = resolve(process.cwd(), "src", "App.tsx");
  const appSource = readFileSync(appPath, "utf8");
  assert(
    appSource.includes("CloseoutRecoveryPanel"),
    "App.tsx should import and render CloseoutRecoveryPanel",
  );
  assert(
    appSource.includes("refreshCloseoutRecovery"),
    "App.tsx should call refreshCloseoutRecovery to wire state",
  );
  assert(
    appSource.includes("handleClearCloseoutRecovery"),
    "App.tsx should expose handleClearCloseoutRecovery handler",
  );

  const panelPath = resolve(process.cwd(), "src", "components", "closeout", "CloseoutRecoveryPanel.tsx");
  const panelSource = readFileSync(panelPath, "utf8");
  for (const marker of [
    'data-testid="closeout-recovery-panel"',
    'data-testid="closeout-recovery-list"',
    'data-testid="closeout-recovery-item"',
    'data-testid="closeout-recovery-clear-button"',
    'data-testid="closeout-recovery-refresh"',
    'data-testid="closeout-recovery-summary"',
    'data-testid="closeout-recovery-item-state"',
  ]) {
    assert(panelSource.includes(marker), `panel should expose ${marker}`);
  }
  assert(
    panelSource.includes("解除标记"),
    "panel should expose a manual 解除标记 (clear marker) action label",
  );
  assert(
    !panelSource.includes("auto-clear") && !panelSource.includes("自动解除"),
    "panel must not auto-clear markers (manual review only)",
  );

  console.log("[DATA-CLOSEOUT-RECOVERY-UX verify] PASS: HTTP closeoutRecovery.list returns server pending markers");
  console.log("[DATA-CLOSEOUT-RECOVERY-UX verify] PASS: HTTP closeoutRecovery.clear converges list to empty");
  console.log("[DATA-CLOSEOUT-RECOVERY-UX verify] PASS: clear on missing issue surfaces a structured failure");
  console.log("[DATA-CLOSEOUT-RECOVERY-UX verify] PASS: App.tsx wires CloseoutRecoveryPanel state + handlers");
  console.log("[DATA-CLOSEOUT-RECOVERY-UX verify] PASS: CloseoutRecoveryPanel exposes data-testid markers + manual clear action");
} catch (error) {
  fail("verify run threw unexpectedly", { error: (error as Error)?.message ?? String(error), stack: (error as Error)?.stack });
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
