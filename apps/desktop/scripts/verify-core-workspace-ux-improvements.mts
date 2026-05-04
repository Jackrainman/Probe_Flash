import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { startProbeFlashServer } from "../../server/src/server.mjs";
import { buildQuickIssueCardFromLine, defaultIntakeOptions } from "../src/domain/issue-intake.ts";
import { DEFAULT_WORKSPACE_ID } from "../src/domain/workspace.ts";
import { createHttpStorageRepository } from "../src/storage/http-storage-repository.ts";
import { createTempDir } from "./verify-helpers.mts";

const WORKSPACE_NAME = "CORE-02 工作区 UX";
const NOW = "2026-04-30T02:20:00+08:00";

function fail(reason: string, detail?: unknown): never {
  console.error(`[CORE-02-WORKSPACE-UX verify] FAIL: ${reason}`);
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
const cssSource = readFileSync(resolve("src/App.css"), "utf8");

const requiredAppMarkers = [
  'data-testid="project-context-summary"',
  'data-testid="workspace-list-state"',
  'data-testid="workspace-list-error"',
  'data-testid="workspace-list-empty"',
  'data-testid="issue-list-empty"',
  'data-testid="issue-list-error"',
  "当前数据归属",
  "创建新项目（创建后自动切换）",
  "暂无未归档问题卡",
];

for (const marker of requiredAppMarkers) {
  if (!uiSource.includes(marker)) fail(`UI source missing workspace UX marker: ${marker}`);
}

for (const selector of [
  ".project-context-summary",
  ".project-current-note",
  ".project-state-warning",
  ".project-state-empty",
  ".issue-list-error",
]) {
  if (!cssSource.includes(selector)) fail(`App.css missing workspace UX selector: ${selector}`);
}

const workdir = createTempDir("probeflash-core-workspace-ux").path;
const dbPath = join(workdir, "probeflash.core-workspace-ux.sqlite");
const server = await startProbeFlashServer({ host: "127.0.0.1", port: 0, dbPath });

try {
  const baseUrl = `${server.baseUrl}/api`;
  const workspaceRepository = createHttpStorageRepository({ baseUrl, timeoutMs: 800 });
  const created = await workspaceRepository.workspaces.create({ name: WORKSPACE_NAME });
  assert(created.ok, "workspace create should succeed", created);
  assert(created.workspace.name === WORKSPACE_NAME, "created workspace should preserve the display name", created);

  const workspaces = await workspaceRepository.workspaces.list();
  assert(workspaces.readError === null, "workspace list should not report readError", workspaces);
  assert(
    workspaces.valid.some((workspace) => workspace.id === created.workspace.id),
    "workspace list should include the newly created workspace",
    workspaces.valid,
  );

  const selectedRepository = createHttpStorageRepository({
    baseUrl,
    timeoutMs: 800,
    workspaceId: created.workspace.id,
  });
  const selectedInitialIssues = await selectedRepository.issueCards.list();
  assert(
    selectedInitialIssues.readError === null && selectedInitialIssues.valid.length === 0,
    "newly selected workspace should start with an empty issue list",
    selectedInitialIssues,
  );

  const issueResult = buildQuickIssueCardFromLine(
    "工作区 UX 验证问题卡",
    defaultIntakeOptions(NOW, "issue-core-workspace-ux-0001", created.workspace.id),
  );
  assert(issueResult.ok, "workspace UX issue fixture should build", issueResult);
  const saved = await selectedRepository.issueCards.save(issueResult.card);
  assert(saved.ok, "selected workspace issue should save", saved);

  const selectedIssues = await selectedRepository.issueCards.list();
  assert(
    selectedIssues.readError === null && selectedIssues.valid.some((issue) => issue.id === issueResult.card.id),
    "selected workspace should list its own issue after switching",
    selectedIssues,
  );

  const defaultRepository = createHttpStorageRepository({
    baseUrl,
    timeoutMs: 800,
    workspaceId: DEFAULT_WORKSPACE_ID,
  });
  const defaultIssues = await defaultRepository.issueCards.list();
  assert(defaultIssues.readError === null, "default workspace issue list should succeed", defaultIssues);
  assert(
    !defaultIssues.valid.some((issue) => issue.id === issueResult.card.id),
    "switching workspace should keep issue lists isolated",
    defaultIssues,
  );

  const emptyCreate = await workspaceRepository.workspaces.create({ name: "   " });
  assert(!emptyCreate.ok, "empty workspace create should surface a validation failure", emptyCreate);

  console.log("[CORE-02-WORKSPACE-UX verify] PASS: workspace create/list and selected workspace readback work");
  console.log("[CORE-02-WORKSPACE-UX verify] PASS: new workspace starts empty and stays isolated after switch");
  console.log("[CORE-02-WORKSPACE-UX verify] PASS: workspace empty/error UI markers are present");
} finally {
  await server.close();
}
