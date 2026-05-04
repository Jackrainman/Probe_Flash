import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { startProbeFlashServer } from "../../server/src/server.mjs";
import { buildQuickIssueCardFromLine, defaultIntakeOptions } from "../src/domain/issue-intake.ts";
import {
  clearRecentIssueIdForWorkspace,
  readRecentIssueIdForWorkspace,
  recentIssueStorageKey,
  rememberRecentIssueForReopen,
  resolveRecentIssueReopen,
  type RecentIssueStorage,
} from "../src/storage/recent-issue-reopen.ts";
import { createHttpStorageRepository } from "../src/storage/http-storage-repository.ts";
import { createTempDir } from "./verify-helpers.mts";

const NOW = "2026-04-30T03:00:00+08:00";

class MemoryRecentIssueStorage implements RecentIssueStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function fail(reason: string, detail?: unknown): never {
  console.error(`[CORE-03-RECENT-ISSUE-REOPEN verify] FAIL: ${reason}`);
  if (detail !== undefined) console.error(JSON.stringify(detail, null, 2));
  process.exit(1);
}

function assert(condition: unknown, reason: string, detail?: unknown): asserts condition {
  if (!condition) fail(reason, detail);
}

const appSource = readFileSync(resolve("src/App.tsx"), "utf8");
const issueComponentsSource = readFileSync(
  resolve("src/components/issue/IssueEntryComponents.tsx"),
  "utf8",
);
const uiSource = [appSource, issueComponentsSource].join("\n");
const requiredAppMarkers = [
  'data-testid="recent-issue-reopen-state"',
  "resolveRecentIssueReopen(recentIssueStorage, activeWorkspace.id, result.valid)",
  "rememberRecentIssueForReopen(",
  "刷新后会优先回到这里",
  "已归档，刷新不会自动重开",
];

for (const marker of requiredAppMarkers) {
  if (!uiSource.includes(marker)) fail(`UI source missing recent issue reopen marker: ${marker}`);
}

const workdir = createTempDir("probeflash-core-recent-issue-reopen").path;
const dbPath = join(workdir, "probeflash.core-recent-issue-reopen.sqlite");
const server = await startProbeFlashServer({ host: "127.0.0.1", port: 0, dbPath });

try {
  const baseUrl = `${server.baseUrl}/api`;
  const workspaceRepository = createHttpStorageRepository({ baseUrl, timeoutMs: 800 });
  const workspaceA = await workspaceRepository.workspaces.create({ name: "CORE-03 最近现场 A" });
  const workspaceB = await workspaceRepository.workspaces.create({ name: "CORE-03 最近现场 B" });
  assert(workspaceA.ok, "workspace A should be created", workspaceA);
  assert(workspaceB.ok, "workspace B should be created", workspaceB);

  const repositoryA = createHttpStorageRepository({
    baseUrl,
    timeoutMs: 800,
    workspaceId: workspaceA.workspace.id,
  });
  const repositoryB = createHttpStorageRepository({
    baseUrl,
    timeoutMs: 800,
    workspaceId: workspaceB.workspace.id,
  });

  const openIssueA = buildQuickIssueCardFromLine(
    "最近现场恢复：A 项目未归档问题",
    defaultIntakeOptions(NOW, "issue-core-03-open-a", workspaceA.workspace.id),
  );
  const openIssueB = buildQuickIssueCardFromLine(
    "最近现场恢复：B 项目未归档问题",
    defaultIntakeOptions(NOW, "issue-core-03-open-b", workspaceB.workspace.id),
  );
  const archivedIssueA = buildQuickIssueCardFromLine(
    "最近现场恢复：A 项目已归档问题",
    defaultIntakeOptions(NOW, "issue-core-03-archived-a", workspaceA.workspace.id),
  );
  assert(openIssueA.ok, "open issue A fixture should build", openIssueA);
  assert(openIssueB.ok, "open issue B fixture should build", openIssueB);
  assert(archivedIssueA.ok, "archived issue A fixture should build", archivedIssueA);

  const archivedCardA = { ...archivedIssueA.card, status: "archived" as const };
  assert((await repositoryA.issueCards.save(openIssueA.card)).ok, "open issue A should save");
  assert((await repositoryB.issueCards.save(openIssueB.card)).ok, "open issue B should save");
  assert((await repositoryA.issueCards.save(archivedCardA)).ok, "archived issue A should save");

  const storage = new MemoryRecentIssueStorage();
  const remembered = rememberRecentIssueForReopen(
    storage,
    workspaceA.workspace.id,
    openIssueA.card,
  );
  assert(remembered.state === "recorded", "open issue should be remembered", remembered);

  const listA = await repositoryA.issueCards.list();
  assert(listA.readError === null, "workspace A issue list should load", listA);
  const restoredA = resolveRecentIssueReopen(storage, workspaceA.workspace.id, listA.valid);
  assert(
    restoredA.state.state === "restored" && restoredA.issueIdToOpen === openIssueA.card.id,
    "reload should reopen the remembered unarchived issue in the same workspace",
    restoredA,
  );

  const listB = await repositoryB.issueCards.list();
  assert(listB.readError === null, "workspace B issue list should load", listB);
  const restoredB = resolveRecentIssueReopen(storage, workspaceB.workspace.id, listB.valid);
  assert(
    restoredB.state.state === "none" && restoredB.issueIdToOpen === null,
    "workspace switch should not reopen another workspace's recent issue",
    restoredB,
  );

  storage.setItem(recentIssueStorageKey(workspaceA.workspace.id), "issue-core-03-missing-a");
  const missing = resolveRecentIssueReopen(storage, workspaceA.workspace.id, listA.valid);
  assert(missing.state.state === "missing" && missing.issueIdToOpen === null, "missing issue should degrade safely", missing);
  assert(
    readRecentIssueIdForWorkspace(storage, workspaceA.workspace.id) === null,
    "missing recent issue should be cleared after safe degrade",
  );

  storage.setItem(recentIssueStorageKey(workspaceA.workspace.id), archivedCardA.id);
  const archived = resolveRecentIssueReopen(storage, workspaceA.workspace.id, listA.valid);
  assert(
    archived.state.state === "archived" && archived.issueIdToOpen === null,
    "archived issue should not be reopened",
    archived,
  );
  assert(
    readRecentIssueIdForWorkspace(storage, workspaceA.workspace.id) === null,
    "archived recent issue should be cleared after safe degrade",
  );

  const archivedRemembered = rememberRecentIssueForReopen(storage, workspaceA.workspace.id, archivedCardA);
  assert(
    archivedRemembered.state === "archived" && readRecentIssueIdForWorkspace(storage, workspaceA.workspace.id) === null,
    "remembering an archived issue should clear recent state instead of writing it",
    archivedRemembered,
  );

  assert(clearRecentIssueIdForWorkspace(storage, workspaceB.workspace.id), "explicit clear should succeed");

  console.log("[CORE-03-RECENT-ISSUE-REOPEN verify] PASS: reload restores remembered issue in the same workspace");
  console.log("[CORE-03-RECENT-ISSUE-REOPEN verify] PASS: workspace switch, missing issue and archived issue degrade safely");
} finally {
  await server.close();
}
