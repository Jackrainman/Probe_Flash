import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { startProbeFlashServer } from "../../server/src/server.mjs";
import { buildCloseoutFromIssue, defaultCloseoutOptions } from "../src/domain/closeout.ts";
import { buildIssueCardFromIntake, defaultIntakeOptions } from "../src/domain/issue-intake.ts";
import {
  buildInvestigationRecordFromIntake,
  defaultInvestigationIntakeOptions,
} from "../src/domain/investigation-intake.ts";
import { ErrorEntrySchema, type ErrorEntry } from "../src/domain/schemas/error-entry.ts";
import type { IssueCard } from "../src/domain/schemas/issue-card.ts";
import { createHttpStorageClient, type HttpStorageRequestError } from "../src/storage/http-storage-client.ts";
import {
  checkHttpStorageHealth,
  createHttpStorageRepository,
} from "../src/storage/http-storage-repository.ts";
import type { StorageRepository } from "../src/storage/storage-repository.ts";
import {
  closeoutFailureToFeedback,
  storageWriteErrorToFeedback,
} from "../src/storage/storage-feedback.ts";
import { orchestrateIssueCloseout } from "../src/use-cases/closeout-orchestrator.ts";
import { createTempDir } from "./verify-helpers.mts";

const WORKSPACE_ID = "workspace-26-r1";

function fail(reason: string, detail?: unknown): never {
  console.error(`[S3-LOCAL-END-TO-END verify] FAIL: ${reason}`);
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

function isHttpStorageRequestError(error: unknown): error is HttpStorageRequestError {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    typeof (error as { type?: unknown }).type === "string"
  );
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
  assert(address && typeof address !== "string", "mock server should expose TCP address", address);
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

function buildIssueFixture(id: string, title: string, now: string): IssueCard {
  const result = buildIssueCardFromIntake(
    {
      title,
      description: `${title} created by local HTTP SQLite E2E verify.`,
      severity: "high",
    },
    defaultIntakeOptions(now, id),
  );
  assert(result.ok, "failed to build issue fixture", result);
  return result.card;
}

function buildRecordFixture(issueId: string, id: string, now: string) {
  const result = buildInvestigationRecordFromIntake(
    {
      issueId,
      type: "observation",
      note: "Observed boot log stalls after handshake marker.",
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

async function appendRecord(repository: StorageRepository, issueId: string, recordId: string, now: string) {
  const record = buildRecordFixture(issueId, recordId, now);
  const saved = await repository.investigationRecords.append(record);
  assert(saved.ok, "investigation record append should succeed", saved);
  return record;
}

function readCount(db: DatabaseSync, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
  return row.count;
}

async function verifyMainPath(repository: StorageRepository, dbPath: string) {
  const expectedPrevention = "Add the handshake condition to the bring-up checklist.";
  const issue = buildIssueFixture(
    "issue-s3-local-e2e-main-0001",
    "Local HTTP SQLite E2E main path",
    "2026-04-25T10:00:00+08:00",
  );
  await saveIssue(repository, issue);

  const loaded = await repository.issueCards.load(issue.id);
  assert(loaded.ok, "created issue should load through HTTP adapter", loaded);
  assert(loaded.card.projectId === WORKSPACE_ID, "loaded issue should preserve workspace id", loaded.card);

  const listed = await repository.issueCards.list();
  assert(listed.readError === null, "issue list should not report readError", listed.readError);
  assert(
    listed.valid.some((item) => item.id === issue.id),
    "issue list should include created issue",
    listed.valid,
  );

  const record = await appendRecord(
    repository,
    issue.id,
    "record-s3-local-e2e-main-0001",
    "2026-04-25T10:05:00+08:00",
  );
  const records = await repository.investigationRecords.listByIssueId(issue.id);
  assert(records.readError === null, "record list should not report readError", records.readError);
  assert(records.valid.length === 1 && records.valid[0]?.id === record.id, "record should read back", records);

  const closeout = await orchestrateIssueCloseout(
    issue.id,
    {
      category: "bringup",
      rootCause: "Handshake wait condition was never satisfied.",
      resolution: "Initialized the wait condition before boot handshake.",
      prevention: expectedPrevention,
    },
    {
      repository,
      now: () => "2026-04-25T10:20:00+08:00",
      closeoutOptionsOverrides: {
        errorEntryId: "error-entry-s3-local-e2e-main-0001",
        errorCode: "DBG-20260425-201",
        generatedBy: "hybrid",
      },
    },
  );
  assert(closeout.ok, "closeout orchestrator should succeed over HTTP + SQLite", closeout);
  const parsedErrorEntry = ErrorEntrySchema.safeParse(closeout.errorEntry);
  assert(parsedErrorEntry.success, "closeout should generate a schema-valid error entry", parsedErrorEntry);
  assert(
    closeout.errorEntry.prevention === expectedPrevention,
    "closeout error entry should carry prevention text",
    closeout.errorEntry,
  );
  assert(
    closeout.completedWrites.join(",") === "archive_document,error_entry,issue_card",
    "closeout should report all persisted entities",
    closeout.completedWrites,
  );

  const archiveList = await repository.archiveDocuments.list();
  assert(archiveList.readError === null, "archive list should not report readError", archiveList.readError);
  assert(
    archiveList.valid.some((archive) => archive.fileName === closeout.archiveDocument.fileName),
    "archive list should include closeout archive",
    archiveList.valid,
  );

  const errorEntryList = await repository.errorEntries.list();
  assert(
    errorEntryList.readError === null,
    "error entry list should not report readError",
    errorEntryList.readError,
  );
  const savedErrorEntry = errorEntryList.valid.find((entry) => entry.id === closeout.errorEntry.id);
  assert(savedErrorEntry !== undefined, "error entry list should include closeout error entry", errorEntryList.valid);
  assert(
    savedErrorEntry.prevention === expectedPrevention,
    "error entry readback should preserve prevention",
    savedErrorEntry,
  );

  const archivedIssue = await repository.issueCards.load(issue.id);
  assert(archivedIssue.ok, "archived issue should load through HTTP adapter", archivedIssue);
  assert(archivedIssue.card.status === "archived", "issue should be archived after closeout", archivedIssue);

  const db = new DatabaseSync(dbPath);
  try {
    const issueRow = db
      .prepare(`SELECT status, payload_json FROM issues WHERE id = ?`)
      .get(issue.id) as { status: string; payload_json: string } | undefined;
    const recordRow = db
      .prepare(`SELECT payload_json FROM records WHERE id = ?`)
      .get(record.id) as { payload_json: string } | undefined;
    const archiveRow = db
      .prepare(`SELECT issue_id, payload_json FROM archives WHERE file_name = ?`)
      .get(closeout.archiveDocument.fileName) as { issue_id: string; payload_json: string } | undefined;
    const errorEntryRow = db
      .prepare(`SELECT source_issue_id, error_code, payload_json FROM error_entries WHERE id = ?`)
      .get(closeout.errorEntry.id) as
      | { source_issue_id: string; error_code: string; payload_json: string }
      | undefined;

    assert(issueRow?.status === "archived", "sqlite issue row should be archived", issueRow);
    assert(
      (JSON.parse(issueRow.payload_json) as IssueCard).status === "archived",
      "sqlite issue payload should be archived",
      issueRow,
    );
    assert(
      recordRow !== undefined && JSON.parse(recordRow.payload_json).id === record.id,
      "sqlite record payload should be readable",
      recordRow,
    );
    assert(
      archiveRow?.issue_id === issue.id &&
        JSON.parse(archiveRow.payload_json).markdownContent.includes("Observed boot log stalls"),
      "sqlite archive payload should include rendered investigation timeline",
      archiveRow,
    );
    const errorEntryPayload = errorEntryRow ? (JSON.parse(errorEntryRow.payload_json) as ErrorEntry) : null;
    assert(
      errorEntryRow?.source_issue_id === issue.id &&
        errorEntryRow.error_code === "DBG-20260425-201" &&
        errorEntryPayload?.prevention === expectedPrevention,
      "sqlite error entry row should reference archived issue and preserve prevention",
      { errorEntryRow, errorEntryPayload },
    );
  } finally {
    db.close();
  }

  return { issue, record, closeout };
}

async function verifyMissingPreventionValidation(
  repository: StorageRepository,
  dbPath: string,
  main: Awaited<ReturnType<typeof verifyMainPath>>,
) {
  const dbBefore = new DatabaseSync(dbPath);
  const beforeCount = readCount(dbBefore, "error_entries");
  dbBefore.close();

  const { prevention: _omitted, ...entryWithoutPrevention } = main.closeout.errorEntry;
  const invalidEntry = {
    ...entryWithoutPrevention,
    id: "error-entry-s3-local-e2e-missing-prevention-0001",
    errorCode: "DBG-20260425-299",
  } as unknown as ErrorEntry;

  await expectNoLocalStorageFallback("missing prevention error-entry validation", async () => {
    const saved = await repository.errorEntries.save(invalidEntry);
    assert(!saved.ok, "error entry without prevention should fail before HTTP write", saved);
    assert(saved.error.code === "validation_failed", "missing prevention should map to validation_failed", saved);
    assert(
      saved.error.issues.some((issue) => issue.path.join(".") === "prevention"),
      "missing prevention validation should point at prevention",
      saved.error.issues,
    );
    const feedback = storageWriteErrorToFeedback("closeout", "closeout", saved.error);
    assert(
      feedback.connectionState.state === "online",
      "HTTP validation_failed feedback should not display localStorage demo mode",
      feedback,
    );
  });

  const dbAfter = new DatabaseSync(dbPath);
  try {
    assert(
      readCount(dbAfter, "error_entries") === beforeCount,
      "missing prevention should not insert an error entry",
      { beforeCount, afterCount: readCount(dbAfter, "error_entries") },
    );
  } finally {
    dbAfter.close();
  }
}

async function verifyConflictAndValidation(
  repository: StorageRepository,
  serverBaseUrl: string,
  main: Awaited<ReturnType<typeof verifyMainPath>>,
) {
  const duplicateArchive = await repository.archiveDocuments.save(main.closeout.archiveDocument);
  assert(!duplicateArchive.ok, "duplicate archive save should fail", duplicateArchive);
  assert(duplicateArchive.error.code === "conflict", "duplicate archive should map to conflict", duplicateArchive);
  const conflictFeedback = storageWriteErrorToFeedback("closeout", "closeout", duplicateArchive.error);
  assert(
    conflictFeedback.code === "conflict" && conflictFeedback.retryable === false,
    "conflict should become non-retryable storage feedback",
    conflictFeedback,
  );

  await expectNoLocalStorageFallback("remote validation failure", async () => {
    const invalidIssue: IssueCard = {
      ...buildIssueFixture(
        "issue-s3-local-e2e-validation-0001",
        "Local HTTP SQLite E2E validation path",
        "2026-04-25T10:30:00+08:00",
      ),
      projectId: "wrong-workspace",
    };
    const validation = await repository.issueCards.save(invalidIssue);
    assert(!validation.ok, "workspace mismatch should fail", validation);
    assert(
      validation.error.code === "validation_failed",
      "workspace mismatch should map to validation_failed",
      validation,
    );
    const feedback = storageWriteErrorToFeedback("issue_intake", "create_issue", validation.error);
    assert(
      feedback.code === "validation_failed" && feedback.retryable === false,
      "remote validation should become structured feedback",
      feedback,
    );
  });

  const client = createHttpStorageClient({
    baseUrl: `${serverBaseUrl}/api`,
    timeoutMs: 500,
  });
  try {
    await client.request(`/workspaces/${WORKSPACE_ID}/issues`, {
      method: "POST",
      body: "{not-json",
    });
    fail("malformed JSON request should not succeed");
  } catch (error) {
    assert(isHttpStorageRequestError(error), "malformed JSON should throw HttpStorageRequestError", error);
    assert(
      error.type === "http_error" && error.status === 400 && error.code === "BAD_REQUEST",
      "malformed JSON should map to BAD_REQUEST http_error",
      error,
    );
  }
}

async function verifyCloseoutPartialFailure(repository: StorageRepository, dbPath: string) {
  const issue = buildIssueFixture(
    "issue-s3-local-e2e-partial-0001",
    "Local HTTP SQLite E2E partial closeout",
    "2026-04-25T11:00:00+08:00",
  );
  await saveIssue(repository, issue);
  const record = await appendRecord(
    repository,
    issue.id,
    "record-s3-local-e2e-partial-0001",
    "2026-04-25T11:05:00+08:00",
  );
  const closeoutInput = {
    category: "bringup",
    rootCause: "A duplicated error entry blocks the second closeout write.",
    resolution: "Keep the partial write visible for repair.",
    prevention: "Surface completedWrites instead of hiding partial persistence.",
  };
  const closeoutOptions = defaultCloseoutOptions("2026-04-25T11:20:00+08:00", {
    errorEntryId: "error-entry-s3-local-e2e-partial-0001",
    errorCode: "DBG-20260425-202",
    generatedBy: "hybrid",
  });
  const precomputed = buildCloseoutFromIssue(issue, [record], closeoutInput, closeoutOptions);
  assert(precomputed.ok, "precomputed partial closeout artifacts should be valid", precomputed);

  const preexistingErrorEntry = await repository.errorEntries.save(precomputed.errorEntry);
  assert(preexistingErrorEntry.ok, "preexisting error entry should save before partial failure", preexistingErrorEntry);

  const result = await orchestrateIssueCloseout(issue.id, closeoutInput, {
    repository,
    now: () => closeoutOptions.now,
    closeoutOptionsOverrides: {
      errorEntryId: closeoutOptions.errorEntryId,
      errorCode: closeoutOptions.errorCode,
      generatedBy: closeoutOptions.generatedBy,
    },
  });
  assert(!result.ok, "closeout should fail on duplicate error entry", result);
  assert(result.reason === "error_entry_save_failed", "failure should happen at error entry write", result);
  assert(result.error.code === "conflict", "duplicate error entry should surface conflict", result);
  assert(
    result.completedWrites.join(",") === "archive_document",
    "partial closeout should preserve completed archive write",
    result.completedWrites,
  );

  const feedback = closeoutFailureToFeedback(result);
  assert(
    feedback.code === "conflict" && feedback.completedWrites?.join(",") === "archive_document",
    "closeout feedback should preserve completedWrites",
    feedback,
  );

  const loadedAfterFailure = await repository.issueCards.load(issue.id);
  assert(
    loadedAfterFailure.ok && loadedAfterFailure.card.status === "open",
    "issue should remain open when closeout fails before issue update",
    loadedAfterFailure,
  );

  const db = new DatabaseSync(dbPath);
  try {
    const issueRow = db.prepare(`SELECT status FROM issues WHERE id = ?`).get(issue.id) as
      | { status: string }
      | undefined;
    const archiveRow = db
      .prepare(`SELECT issue_id FROM archives WHERE file_name = ?`)
      .get(precomputed.archiveDocument.fileName) as { issue_id: string } | undefined;
    const errorEntryCount = db
      .prepare(`SELECT COUNT(*) AS count FROM error_entries WHERE id = ?`)
      .get(precomputed.errorEntry.id) as { count: number };
    assert(issueRow?.status === "open", "sqlite issue should remain open after partial failure", issueRow);
    assert(
      archiveRow?.issue_id === issue.id,
      "sqlite should retain archive written before partial failure",
      archiveRow,
    );
    assert(
      errorEntryCount.count === 1,
      "sqlite should keep only the preexisting conflicting error entry",
      errorEntryCount,
    );
  } finally {
    db.close();
  }
}

async function verifyServerUnreachable() {
  const issue = buildIssueFixture(
    "issue-s3-local-e2e-unreachable-0001",
    "Local HTTP SQLite E2E unreachable path",
    "2026-04-25T12:00:00+08:00",
  );
  const closedPort = await reserveClosedPort();
  await expectNoLocalStorageFallback("server_unreachable write", async () => {
    const repository = createHttpStorageRepository({
      baseUrl: `http://127.0.0.1:${closedPort}/api`,
      timeoutMs: 100,
    });
    const saved = await repository.issueCards.save(issue);
    assert(!saved.ok, "closed port write should fail", saved);
    assert(saved.error.code === "server_unreachable", "closed port should map to server_unreachable", saved);
    const feedback = storageWriteErrorToFeedback("issue_intake", "create_issue", saved.error);
    assert(
      feedback.code === "server_unreachable" && feedback.connectionState.state === "unreachable",
      "server_unreachable should become unreachable storage feedback",
      feedback,
    );
  });
}

async function verifyTimeout() {
  const timeoutServer = await startMockServer((_req, res) => {
    setTimeout(() => {
      res.writeHead(201, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, data: {} }));
    }, 250);
  });
  try {
    await expectNoLocalStorageFallback("timeout write", async () => {
      const repository = createHttpStorageRepository({
        baseUrl: `${timeoutServer.baseUrl}/api`,
        timeoutMs: 50,
      });
      const saved = await repository.issueCards.save(
        buildIssueFixture(
          "issue-s3-local-e2e-timeout-0001",
          "Local HTTP SQLite E2E timeout path",
          "2026-04-25T12:10:00+08:00",
        ),
      );
      assert(!saved.ok, "slow write should fail", saved);
      assert(saved.error.code === "timeout", "slow write should map to timeout", saved);
      const feedback = storageWriteErrorToFeedback("issue_intake", "create_issue", saved.error);
      assert(
        feedback.code === "timeout" && feedback.connectionState.state === "degraded",
        "timeout should become degraded storage feedback",
        feedback,
      );
    });
  } finally {
    await timeoutServer.close();
  }
}

async function verifyHttpWriteFailure(status: 500 | 503, code: "STORAGE_ERROR" | "SERVICE_UNAVAILABLE") {
  const errorServer = await startMockServer((_req, res) => {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        ok: false,
        error: {
          code,
          message: `${status} storage failure from verify mock`,
          operation: "request",
          retryable: true,
          details: {},
        },
      }),
    );
  });
  try {
    await expectNoLocalStorageFallback(`${status} write`, async () => {
      const repository = createHttpStorageRepository({
        baseUrl: `${errorServer.baseUrl}/api`,
        timeoutMs: 100,
      });
      const saved = await repository.issueCards.save(
        buildIssueFixture(
          `issue-s3-local-e2e-${status}-0001`,
          `Local HTTP SQLite E2E ${status} path`,
          "2026-04-25T12:20:00+08:00",
        ),
      );
      assert(!saved.ok, `${status} write should fail`, saved);
      assert(
        saved.error.code === "unexpected_write_error" && saved.error.connection?.state === "degraded",
        `${status} write should map to degraded write failure`,
        saved,
      );
      const feedback = storageWriteErrorToFeedback("issue_intake", "create_issue", saved.error);
      assert(
        feedback.code === "write_failed" && feedback.connectionState.state === "degraded",
        `${status} write should become degraded storage feedback`,
        feedback,
      );
    });
  } finally {
    await errorServer.close();
  }
}

const workdir = createTempDir("probeflash-local-e2e").path;
const dbPath = join(workdir, "probeflash.local-e2e.sqlite");
const server = await startProbeFlashServer({
  host: "127.0.0.1",
  port: 0,
  dbPath,
});

try {
  const repository = createHttpStorageRepository({
    baseUrl: `${server.baseUrl}/api`,
    timeoutMs: 800,
  });
  const health = await checkHttpStorageHealth({
    baseUrl: `${server.baseUrl}/api`,
    timeoutMs: 800,
  });
  assert(health.ok, "local backend health should be ok before E2E", health);

  const main = await expectNoLocalStorageFallback("main HTTP SQLite E2E", async () =>
    verifyMainPath(repository, dbPath),
  );
  await verifyMissingPreventionValidation(repository, dbPath, main);
  await verifyConflictAndValidation(repository, server.baseUrl, main);
  await verifyCloseoutPartialFailure(repository, dbPath);
  await verifyServerUnreachable();
  await verifyTimeout();
  await verifyHttpWriteFailure(500, "STORAGE_ERROR");
  await verifyHttpWriteFailure(503, "SERVICE_UNAVAILABLE");

  const db = new DatabaseSync(dbPath);
  try {
    assert(readCount(db, "issues") === 2, "sqlite should contain main and partial issues only");
    assert(readCount(db, "records") === 2, "sqlite should contain main and partial records only");
    assert(readCount(db, "archives") === 2, "sqlite should contain main and partial archives only");
    assert(readCount(db, "error_entries") === 2, "sqlite should contain main and preexisting error entries only");
  } finally {
    db.close();
  }

  console.log("[S3-LOCAL-END-TO-END verify] PASS: issue -> record -> closeout uses HTTP adapter and SQLite readback");
  console.log("[S3-LOCAL-END-TO-END verify] PASS: archive document, error entry, and archived issue are readable from SQLite");
  console.log("[S3-LOCAL-END-TO-END verify] PASS: error entry prevention is required and validated before HTTP write");
  console.log("[S3-LOCAL-END-TO-END verify] PASS: validation, bad request, conflict, 500, 503, timeout, and server_unreachable fail visibly");
  console.log("[S3-LOCAL-END-TO-END verify] PASS: closeout partial failure preserves completedWrites without localStorage fallback");
} finally {
  await server.close();
}
