import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { startProbeFlashServer } from "../../server/src/server.mjs";
import {
  clearPersistedFormDraft,
  formDraftStorageKey,
  readPersistedFormDraft,
  type FormDraftStorage,
  writePersistedFormDraft,
} from "../src/storage/form-draft-store.ts";
import { createHttpStorageRepository } from "../src/storage/http-storage-repository.ts";
import { createTempDir } from "./verify-helpers.mts";

type QuickIssueDraft = {
  line: string;
  severity: "low" | "medium" | "high" | "critical";
  tagsInput: string;
};

class MemoryDraftStorage implements FormDraftStorage {
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
  console.error(`[CORE-WORKFLOW-FORM-DRAFTS verify] FAIL: ${reason}`);
  if (detail !== undefined) console.error(JSON.stringify(detail, null, 2));
  process.exit(1);
}

function assert(condition: boolean, reason: string, detail?: unknown): void {
  if (!condition) fail(reason, detail);
}

function parseQuickIssueDraft(value: unknown): QuickIssueDraft | null {
  if (typeof value !== "object" || value === null) return null;
  const draft = value as Partial<Record<keyof QuickIssueDraft, unknown>>;
  if (
    typeof draft.line !== "string" ||
    typeof draft.tagsInput !== "string" ||
    !["low", "medium", "high", "critical"].includes(String(draft.severity))
  ) {
    return null;
  }
  return {
    line: draft.line,
    severity: draft.severity as QuickIssueDraft["severity"],
    tagsInput: draft.tagsInput,
  };
}

async function startMockServer(
  handler: (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => void,
) {
  const server = createServer(handler);
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const handleError = (error: Error) => {
      server.off("listening", handleListening);
      rejectPromise(error);
    };
    const handleListening = () => {
      server.off("error", handleError);
      resolvePromise();
    };
    server.once("error", handleError);
    server.once("listening", handleListening);
    server.listen(0, "127.0.0.1");
  });
  const address = server.address();
  if (!address || typeof address === "string") fail("mock server should expose TCP address", address);
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolvePromise, rejectPromise) => {
        server.close((error) => (error ? rejectPromise(error) : resolvePromise()));
      });
    },
  };
}

async function reserveClosedPort(): Promise<number> {
  const reserved = await startMockServer((_req, res) => {
    res.writeHead(204).end();
  });
  const port = Number(new URL(reserved.baseUrl).port);
  await reserved.close();
  return port;
}

function readFormDraftRowCount(dbPath: string, workspaceId?: string): number {
  const db = new DatabaseSync(dbPath);
  try {
    if (workspaceId) {
      return db
        .prepare(`SELECT COUNT(*) AS count FROM form_drafts WHERE workspace_id = ?`)
        .get(workspaceId).count as number;
    }
    return db.prepare(`SELECT COUNT(*) AS count FROM form_drafts`).get().count as number;
  } finally {
    db.close();
  }
}

const workdir = createTempDir("probeflash-form-drafts").path;
const dbPath = join(workdir, "probeflash.form-drafts.sqlite");
const server = await startProbeFlashServer({
  host: "127.0.0.1",
  port: 0,
  dbPath,
});

try {
  const repository = createHttpStorageRepository({
    baseUrl: `${server.baseUrl}/api`,
    timeoutMs: 500,
  });
  const localMirror = new MemoryDraftStorage();
  const defaultScope = {
    workspaceId: "workspace-26-r1",
    formKind: "quick-issue",
    itemId: "new",
  };
  const defaultDraft: QuickIssueDraft = {
    line: "CAN heartbeat draft should survive refresh",
    severity: "high",
    tagsInput: "CAN, heartbeat",
  };

  const stored = await writePersistedFormDraft(
    repository.formDrafts,
    localMirror,
    defaultScope,
    defaultDraft,
  );
  assert(stored === "server", "available backend should store draft through HTTP + SQLite", stored);
  assert(
    localMirror.getItem(formDraftStorageKey(defaultScope)) !== null,
    "successful backend save should mirror latest draft into localStorage fallback",
  );
  assert(readFormDraftRowCount(dbPath) === 1, "SQLite form_drafts table should contain saved draft");

  const refreshedRepository = createHttpStorageRepository({
    baseUrl: `${server.baseUrl}/api`,
    timeoutMs: 500,
  });
  const refreshed = await readPersistedFormDraft(
    refreshedRepository.formDrafts,
    new MemoryDraftStorage(),
    defaultScope,
    parseQuickIssueDraft,
  );
  assert(
    refreshed.state === "restored" && refreshed.source === "server" && refreshed.data.line === defaultDraft.line,
    "new repository instance should restore draft from backend after refresh",
    refreshed,
  );

  const createdWorkspace = await repository.workspaces.create({ name: "Draft Isolation" });
  assert(createdWorkspace.ok, "verify should create second workspace", createdWorkspace);
  if (!createdWorkspace.ok) fail("second workspace create should be ok");
  const otherRepository = createHttpStorageRepository({
    baseUrl: `${server.baseUrl}/api`,
    timeoutMs: 500,
    workspaceId: createdWorkspace.workspace.id,
  });
  const otherScope = {
    workspaceId: createdWorkspace.workspace.id,
    formKind: "quick-issue",
    itemId: "new",
  };
  const otherDraft: QuickIssueDraft = {
    line: "Power rail draft belongs to workspace B",
    severity: "medium",
    tagsInput: "power",
  };
  const otherStored = await writePersistedFormDraft(
    otherRepository.formDrafts,
    new MemoryDraftStorage(),
    otherScope,
    otherDraft,
  );
  assert(otherStored === "server", "second workspace draft should save to backend", otherStored);
  const defaultAfterIsolation = await readPersistedFormDraft(
    repository.formDrafts,
    new MemoryDraftStorage(),
    defaultScope,
    parseQuickIssueDraft,
  );
  const otherRestored = await readPersistedFormDraft(
    otherRepository.formDrafts,
    new MemoryDraftStorage(),
    otherScope,
    parseQuickIssueDraft,
  );
  assert(
    defaultAfterIsolation.state === "restored" && defaultAfterIsolation.data.line === defaultDraft.line,
    "default workspace draft should not be overwritten by another workspace",
    defaultAfterIsolation,
  );
  assert(
    otherRestored.state === "restored" && otherRestored.data.line === otherDraft.line,
    "second workspace should restore its own draft",
    otherRestored,
  );
  assert(readFormDraftRowCount(dbPath, "workspace-26-r1") === 1, "default workspace should have one draft row");
  assert(readFormDraftRowCount(dbPath, createdWorkspace.workspace.id) === 1, "second workspace should have one draft row");

  const clearState = await clearPersistedFormDraft(repository.formDrafts, localMirror, defaultScope);
  assert(clearState === "server", "submit success cleanup should clear backend draft first", clearState);
  const afterClear = await repository.formDrafts.load(defaultScope);
  assert(afterClear.ok && afterClear.draft === null, "cleared draft should not reload from backend", afterClear);
  assert(
    localMirror.getItem(formDraftStorageKey(defaultScope)) === null,
    "cleared draft should also remove localStorage fallback mirror",
  );

  const closedPort = await reserveClosedPort();
  const unreachableRepository = createHttpStorageRepository({
    baseUrl: `http://127.0.0.1:${closedPort}/api`,
    timeoutMs: 100,
  });
  const fallbackStorage = new MemoryDraftStorage();
  const fallbackScope = {
    workspaceId: "workspace-26-r1",
    formKind: "closeout",
    itemId: "issue-fallback-draft",
  };
  const fallbackDraft = {
    category: "network",
    rootCause: "server temporarily unavailable",
    resolution: "keep editing locally",
    prevention: "retry when backend returns",
  };
  const fallbackStored = await writePersistedFormDraft(
    unreachableRepository.formDrafts,
    fallbackStorage,
    fallbackScope,
    fallbackDraft,
  );
  assert(fallbackStored === "local", "HTTP unavailable save should fall back to localStorage", fallbackStored);
  const fallbackRestored = await readPersistedFormDraft(
    unreachableRepository.formDrafts,
    fallbackStorage,
    fallbackScope,
    (value) => (typeof value === "object" && value !== null ? fallbackDraft : null),
  );
  assert(
    fallbackRestored.state === "restored" && fallbackRestored.source === "local" && fallbackRestored.remoteError !== undefined,
    "HTTP unavailable read should restore local draft and retain remote error boundary",
    fallbackRestored,
  );

  const issueEntrySource = readFileSync(
    resolve(process.cwd(), "src", "components", "issue", "IssueEntryComponents.tsx"),
    "utf8",
  );
  const investigationSource = readFileSync(
    resolve(process.cwd(), "src", "components", "investigation", "InvestigationComponents.tsx"),
    "utf8",
  );
  const closeoutSource = readFileSync(
    resolve(process.cwd(), "src", "components", "closeout", "CloseoutForm.tsx"),
    "utf8",
  );
  const workflowSources = [issueEntrySource, investigationSource, closeoutSource].join("\n");
  for (const expected of [
    "readPersistedFormDraft",
    "writePersistedFormDraft",
    "clearPersistedFormDraft",
    'formKind: "quick-issue"',
    'formKind: "issue-intake"',
    'formKind: "investigation"',
    'formKind: "closeout"',
  ]) {
    assert(workflowSources.includes(expected), `workflow forms should use persisted draft marker: ${expected}`);
  }
  assert(!workflowSources.includes("fetch("), "workflow components should not hard-code fetch for drafts");

  console.log("[CORE-WORKFLOW-FORM-DRAFTS verify] PASS: saves drafts through HTTP + SQLite and restores after refresh");
  console.log("[CORE-WORKFLOW-FORM-DRAFTS verify] PASS: workspace/formKind/itemId scopes isolate drafts");
  console.log("[CORE-WORKFLOW-FORM-DRAFTS verify] PASS: submit cleanup clears backend and local fallback draft");
  console.log("[CORE-WORKFLOW-FORM-DRAFTS verify] PASS: HTTP unavailable path falls back to localStorage");
  console.log("[CORE-WORKFLOW-FORM-DRAFTS verify] PASS: workflow components use repository-backed draft helpers without direct fetch");
} finally {
  await server.close();
}
