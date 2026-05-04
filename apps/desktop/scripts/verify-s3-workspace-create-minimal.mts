import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { startProbeFlashServer } from "../../server/src/server.mjs";
import { buildIssueCardFromIntake, defaultIntakeOptions } from "../src/domain/issue-intake.ts";
import {
  buildInvestigationRecordFromIntake,
  defaultInvestigationIntakeOptions,
} from "../src/domain/investigation-intake.ts";
import type { IssueCard } from "../src/domain/schemas/issue-card.ts";
import { createHttpStorageRepository } from "../src/storage/http-storage-repository.ts";
import type { StorageRepository } from "../src/storage/storage-repository.ts";
import { orchestrateIssueCloseout } from "../src/use-cases/closeout-orchestrator.ts";
import { createTempDir } from "./verify-helpers.mts";

const DEFAULT_WORKSPACE_ID = "workspace-26-r1";
const NEW_WORKSPACE_NAME = "舵轮调试";

function fail(reason: string, detail?: unknown): never {
  console.error(`[S3-WORKSPACE-CREATE-MINIMAL verify] FAIL: ${reason}`);
  if (detail !== undefined) {
    console.error(JSON.stringify(detail, null, 2));
  }
  throw new Error(reason);
}

function assert(condition: unknown, reason: string, detail?: unknown): asserts condition {
  if (!condition) {
    fail(reason, detail);
  }
}

function installLocalStorageTrap() {
  const calls: string[] = [];
  const previousDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const trap = {
    get length() {
      calls.push("length");
      return 0;
    },
    clear() {
      calls.push("clear");
    },
    getItem(key: string) {
      calls.push(`getItem:${key}`);
      return null;
    },
    key(index: number) {
      calls.push(`key:${index}`);
      return null;
    },
    removeItem(key: string) {
      calls.push(`removeItem:${key}`);
    },
    setItem(key: string, _value: string) {
      calls.push(`setItem:${key}`);
    },
  };

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: trap,
  });

  return {
    calls,
    restore() {
      if (previousDescriptor) {
        Object.defineProperty(globalThis, "localStorage", previousDescriptor);
        return;
      }
      delete (globalThis as { localStorage?: unknown }).localStorage;
    },
  };
}

async function expectNoLocalStorageFallback<T>(label: string, action: () => Promise<T>): Promise<T> {
  const trap = installLocalStorageTrap();
  try {
    const result = await action();
    assert(trap.calls.length === 0, `${label} should not touch localStorage fallback`, trap.calls);
    return result;
  } finally {
    trap.restore();
  }
}

function buildIssueFixture(id: string, title: string, workspaceId: string, now: string): IssueCard {
  const result = buildIssueCardFromIntake(
    {
      title,
      description: `${title} created by workspace-create verify.`,
      severity: "medium",
    },
    defaultIntakeOptions(now, id, workspaceId),
  );
  assert(result.ok, "failed to build issue fixture", result);
  return result.card;
}

function buildRecordFixture(issueId: string, id: string, now: string) {
  const result = buildInvestigationRecordFromIntake(
    {
      issueId,
      type: "observation",
      note: "新项目下追加的排查记录。",
    },
    defaultInvestigationIntakeOptions(now, id),
  );
  assert(result.ok, "failed to build investigation record fixture", result);
  return result.record;
}

async function saveIssue(repository: StorageRepository, issue: IssueCard) {
  const saved = await repository.issueCards.save(issue);
  assert(saved.ok, "issue save should succeed", saved);
}

const workdir = createTempDir("probeflash-workspace-create").path;
const dbPath = join(workdir, "probeflash.workspace-create.sqlite");
const server = await startProbeFlashServer({
  host: "127.0.0.1",
  port: 0,
  dbPath,
});

try {
  const baseUrl = `${server.baseUrl}/api`;
  const workspaceRepository = createHttpStorageRepository({ baseUrl, timeoutMs: 800 });

  const created = await expectNoLocalStorageFallback("workspace create", async () =>
    workspaceRepository.workspaces.create({ name: NEW_WORKSPACE_NAME }),
  );
  assert(created.ok, "POST /api/workspaces should create a workspace", created);
  assert(created.workspace.name === NEW_WORKSPACE_NAME, "created workspace should preserve name", created);
  assert(created.workspace.id.startsWith("workspace-"), "created workspace id should be generated", created);
  assert(created.workspace.id !== DEFAULT_WORKSPACE_ID, "created workspace id should not reuse default id", created);

  const workspaces = await workspaceRepository.workspaces.list();
  assert(workspaces.readError === null, "GET /api/workspaces should not report readError", workspaces);
  assert(
    workspaces.valid.some((workspace) => workspace.id === DEFAULT_WORKSPACE_ID),
    "workspace list should retain default workspace",
    workspaces.valid,
  );
  assert(
    workspaces.valid.some((workspace) => workspace.id === created.workspace.id),
    "workspace list should read back the new workspace",
    workspaces.valid,
  );

  const defaultRepository = createHttpStorageRepository({
    baseUrl,
    timeoutMs: 800,
    workspaceId: DEFAULT_WORKSPACE_ID,
  });
  const newRepository = createHttpStorageRepository({
    baseUrl,
    timeoutMs: 800,
    workspaceId: created.workspace.id,
  });

  const newWorkspaceInitialIssues = await newRepository.issueCards.list();
  assert(
    newWorkspaceInitialIssues.readError === null && newWorkspaceInitialIssues.valid.length === 0,
    "new workspace issue list should start empty",
    newWorkspaceInitialIssues,
  );

  const issueA = buildIssueFixture(
    "issue-workspace-create-a-0001",
    "默认项目问题卡",
    DEFAULT_WORKSPACE_ID,
    "2026-04-25T14:00:00+08:00",
  );
  const issueB = buildIssueFixture(
    "issue-workspace-create-b-0001",
    "舵轮调试问题卡",
    created.workspace.id,
    "2026-04-25T14:05:00+08:00",
  );
  await saveIssue(defaultRepository, issueA);
  await saveIssue(newRepository, issueB);

  const defaultIssues = await defaultRepository.issueCards.list();
  const newIssues = await newRepository.issueCards.list();
  assert(defaultIssues.readError === null, "default workspace issue list should succeed", defaultIssues);
  assert(newIssues.readError === null, "new workspace issue list should succeed", newIssues);
  assert(defaultIssues.valid.some((issue) => issue.id === issueA.id), "default workspace should contain issue A", defaultIssues.valid);
  assert(!defaultIssues.valid.some((issue) => issue.id === issueB.id), "default workspace should not contain issue B", defaultIssues.valid);
  assert(newIssues.valid.some((issue) => issue.id === issueB.id), "new workspace should contain issue B", newIssues.valid);
  assert(!newIssues.valid.some((issue) => issue.id === issueA.id), "new workspace should not contain issue A", newIssues.valid);

  const recordB = buildRecordFixture(
    issueB.id,
    "record-workspace-create-b-0001",
    "2026-04-25T14:10:00+08:00",
  );
  const savedRecordB = await newRepository.investigationRecords.append(recordB);
  assert(savedRecordB.ok, "new workspace record append should succeed", savedRecordB);
  const recordsB = await newRepository.investigationRecords.listByIssueId(issueB.id);
  assert(
    recordsB.readError === null && recordsB.valid.length === 1 && recordsB.valid[0]?.id === recordB.id,
    "new workspace record should read back",
    recordsB,
  );

  const closeout = await orchestrateIssueCloseout(
    issueB.id,
    {
      category: "舵轮",
      rootCause: "转向零点未重新标定。",
      resolution: "重新标定零点后舵轮响应恢复。",
      prevention: "切换调试项目后先确认标定版本。",
    },
    {
      repository: newRepository,
      now: () => "2026-04-25T14:20:00+08:00",
      closeoutOptionsOverrides: {
        errorEntryId: "error-entry-workspace-create-b-0001",
        errorCode: "DBG-20260425-301",
        generatedBy: "hybrid",
      },
    },
  );
  assert(closeout.ok, "closeout in new workspace should succeed", closeout);
  assert(closeout.archiveDocument.projectId === created.workspace.id, "archive should belong to new workspace", closeout.archiveDocument);
  assert(closeout.errorEntry.projectId === created.workspace.id, "error entry should belong to new workspace", closeout.errorEntry);

  const archivesB = await newRepository.archiveDocuments.list();
  const errorEntriesB = await newRepository.errorEntries.list();
  assert(
    archivesB.readError === null && archivesB.valid.some((archive) => archive.fileName === closeout.archiveDocument.fileName),
    "new workspace should list closeout archive",
    archivesB,
  );
  assert(
    errorEntriesB.readError === null && errorEntriesB.valid.some((entry) => entry.id === closeout.errorEntry.id),
    "new workspace should list closeout error entry",
    errorEntriesB,
  );

  const archivesA = await defaultRepository.archiveDocuments.list();
  const errorEntriesA = await defaultRepository.errorEntries.list();
  assert(
    archivesA.readError === null && !archivesA.valid.some((archive) => archive.fileName === closeout.archiveDocument.fileName),
    "default workspace should not list new workspace archive",
    archivesA,
  );
  assert(
    errorEntriesA.readError === null && !errorEntriesA.valid.some((entry) => entry.id === closeout.errorEntry.id),
    "default workspace should not list new workspace error entry",
    errorEntriesA,
  );

  const rawEmptyResponse = await fetch(`${baseUrl}/workspaces`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "   " }),
  });
  const rawEmptyPayload = await rawEmptyResponse.json();
  assert(
    rawEmptyResponse.status === 422 && rawEmptyPayload.ok === false && rawEmptyPayload.error?.code === "VALIDATION_ERROR",
    "backend should reject empty workspace name",
    rawEmptyPayload,
  );

  const failedCreate = await expectNoLocalStorageFallback("empty workspace create failure", async () =>
    workspaceRepository.workspaces.create({ name: "" }),
  );
  assert(!failedCreate.ok, "repository should surface empty workspace create failure", failedCreate);
  assert(failedCreate.error.code === "validation_failed", "empty workspace failure should map to validation_failed", failedCreate);

  const db = new DatabaseSync(dbPath);
  try {
    const workspaceRow = db
      .prepare(`SELECT id, name, is_default FROM workspaces WHERE id = ?`)
      .get(created.workspace.id) as { id: string; name: string; is_default: number } | undefined;
    const archiveRow = db
      .prepare(`SELECT workspace_id, issue_id FROM archives WHERE file_name = ?`)
      .get(closeout.archiveDocument.fileName) as { workspace_id: string; issue_id: string } | undefined;
    const errorEntryRow = db
      .prepare(`SELECT workspace_id, source_issue_id FROM error_entries WHERE id = ?`)
      .get(closeout.errorEntry.id) as { workspace_id: string; source_issue_id: string } | undefined;
    assert(
      workspaceRow?.name === NEW_WORKSPACE_NAME && workspaceRow.is_default === 0,
      "sqlite should persist the new non-default workspace",
      workspaceRow,
    );
    assert(
      archiveRow?.workspace_id === created.workspace.id && archiveRow.issue_id === issueB.id,
      "sqlite archive row should stay in new workspace",
      archiveRow,
    );
    assert(
      errorEntryRow?.workspace_id === created.workspace.id && errorEntryRow.source_issue_id === issueB.id,
      "sqlite error-entry row should stay in new workspace",
      errorEntryRow,
    );
  } finally {
    db.close();
  }

  console.log("[S3-WORKSPACE-CREATE-MINIMAL verify] PASS: backend creates and lists a new workspace");
  console.log("[S3-WORKSPACE-CREATE-MINIMAL verify] PASS: workspace A/B issue lists stay isolated");
  console.log("[S3-WORKSPACE-CREATE-MINIMAL verify] PASS: record append and closeout persist under the selected workspace");
  console.log("[S3-WORKSPACE-CREATE-MINIMAL verify] PASS: empty workspace creation fails without localStorage fallback");
} finally {
  await server.close();
}
