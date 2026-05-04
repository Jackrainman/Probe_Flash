import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { startProbeFlashServer } from "../../server/src/server.mjs";
import { buildCloseoutFromIssue } from "../src/domain/closeout.ts";
import { buildIssueCardFromIntake, defaultIntakeOptions } from "../src/domain/issue-intake.ts";
import {
  buildInvestigationRecordFromIntake,
  defaultInvestigationIntakeOptions,
} from "../src/domain/investigation-intake.ts";
import { createHttpStorageRepository, checkHttpStorageHealth } from "../src/storage/http-storage-repository.ts";
import {
  healthCheckErrorToFeedback,
  loadIssueCardFailureToFeedback,
  storageReadErrorToFeedback,
  storageWriteErrorToFeedback,
} from "../src/storage/storage-feedback.ts";
import { createTempDir } from "./verify-helpers.mts";

function fail(reason: string, detail?: unknown): never {
  console.error(`[S3-LOCAL-HTTP-STORAGE-ADAPTER verify] FAIL: ${reason}`);
  if (detail !== undefined) {
    console.error(JSON.stringify(detail, null, 2));
  }
  process.exit(1);
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
  if (!address || typeof address === "string") {
    fail("mock server should expose TCP address", address);
  }
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

const workdir = createTempDir("probeflash-http-adapter").path;
const dbPath = join(workdir, "probeflash.http-adapter.sqlite");
const server = await startProbeFlashServer({
  host: "127.0.0.1",
  port: 0,
  dbPath,
});

const repository = createHttpStorageRepository({
  baseUrl: `${server.baseUrl}/api`,
  timeoutMs: 500,
});

try {
  const health = await checkHttpStorageHealth({
    baseUrl: `${server.baseUrl}/api`,
    timeoutMs: 500,
  });
  if (!health.ok) {
    fail("happy path health check should succeed", health);
  }

  const issue = buildIssueCardFromIntake(
    {
      title: "HTTP adapter smoke: UART 启动日志停住",
      description: "验证前端 repository 已切到 HTTP + SQLite。",
      severity: "high",
    },
    defaultIntakeOptions("2026-04-24T09:00:00+08:00", "issue-http-adapter-smoke"),
  );
  if (!issue.ok) {
    fail("failed to build issue fixture", issue);
  }

  const savedIssue = await repository.issueCards.save(issue.card);
  if (!savedIssue.ok) {
    fail("issue save should succeed over HTTP adapter", savedIssue);
  }

  const listedIssues = await repository.issueCards.list();
  if (listedIssues.readError !== null) {
    fail("issue list should not have readError", listedIssues.readError);
  }
  if (!listedIssues.valid.some((item) => item.id === issue.card.id)) {
    fail("issue list should include saved issue", listedIssues.valid);
  }

  const loadedIssue = await repository.issueCards.load(issue.card.id);
  if (!loadedIssue.ok) {
    fail("issue load should succeed over HTTP adapter", loadedIssue);
  }
  if (loadedIssue.card.projectId !== "workspace-26-r1") {
    fail("loaded issue should preserve workspace/projectId compatibility", loadedIssue.card);
  }

  const record = buildInvestigationRecordFromIntake(
    {
      issueId: issue.card.id,
      type: "observation",
      note: "串口日志在握手阶段后无进一步输出。",
    },
    defaultInvestigationIntakeOptions(
      "2026-04-24T09:05:00+08:00",
      "record-http-adapter-smoke",
    ),
  );
  if (!record.ok) {
    fail("failed to build record fixture", record);
  }

  const appendedRecord = await repository.investigationRecords.append(record.record);
  if (!appendedRecord.ok) {
    fail("record append should succeed over HTTP adapter", appendedRecord);
  }

  const listedRecords = await repository.investigationRecords.listByIssueId(issue.card.id);
  if (listedRecords.readError !== null || listedRecords.valid.length !== 1) {
    fail("record list should read back appended record", listedRecords);
  }

  const closeout = buildCloseoutFromIssue(
    loadedIssue.card,
    listedRecords.valid,
    {
      category: "启动",
      rootCause: "上电初始化握手等待条件未满足。",
      resolution: "补齐启动条件后重试，串口日志恢复。",
      prevention: "把握手条件检查加入 bring-up checklist。",
    },
    {
      now: "2026-04-24T09:20:00+08:00",
      errorEntryId: "error-entry-http-adapter-0001",
      errorCode: "DBG-20260424-101",
      generatedBy: "hybrid",
    },
  );
  if (!closeout.ok) {
    fail("failed to build closeout fixture", closeout);
  }

  const savedArchive = await repository.archiveDocuments.save(closeout.archiveDocument);
  if (!savedArchive.ok) {
    fail("archive save should succeed over HTTP adapter", savedArchive);
  }
  const savedErrorEntry = await repository.errorEntries.save(closeout.errorEntry);
  if (!savedErrorEntry.ok) {
    fail("error-entry save should succeed over HTTP adapter", savedErrorEntry);
  }
  const updatedIssue = await repository.issueCards.save(closeout.updatedIssueCard);
  if (!updatedIssue.ok) {
    fail("issue update should succeed over HTTP adapter", updatedIssue);
  }

  const archiveList = await repository.archiveDocuments.list();
  if (archiveList.readError !== null || archiveList.valid.length !== 1) {
    fail("archive list should read back one archive", archiveList);
  }
  const errorEntryList = await repository.errorEntries.list();
  if (errorEntryList.readError !== null || errorEntryList.valid.length !== 1) {
    fail("error-entry list should read back one entry", errorEntryList);
  }

  const archivedIssue = await repository.issueCards.load(issue.card.id);
  if (!archivedIssue.ok || archivedIssue.card.status !== "archived") {
    fail("issue should be read back as archived after PUT", archivedIssue);
  }

  const db = new DatabaseSync(dbPath);
  const issueRow = db
    .prepare(`SELECT status FROM issues WHERE id = ?`)
    .get(issue.card.id) as { status: string } | undefined;
  const recordCount = db.prepare(`SELECT COUNT(*) AS count FROM records`).get() as { count: number };
  const archiveCount = db.prepare(`SELECT COUNT(*) AS count FROM archives`).get() as { count: number };
  const errorEntryCount = db.prepare(`SELECT COUNT(*) AS count FROM error_entries`).get() as { count: number };
  db.close();
  if (!issueRow || issueRow.status !== "archived") {
    fail("sqlite issues table should reflect archived status", issueRow);
  }
  if (recordCount.count !== 1 || archiveCount.count !== 1 || errorEntryCount.count !== 1) {
    fail("sqlite tables should contain one record/archive/error-entry row", {
      recordCount,
      archiveCount,
      errorEntryCount,
    });
  }

  const conflictSave = await repository.archiveDocuments.save(closeout.archiveDocument);
  if (conflictSave.ok || conflictSave.error.code !== "conflict") {
    fail("duplicate archive save should surface conflict", conflictSave);
  }
  const conflictFeedback = storageWriteErrorToFeedback(
    "closeout",
    "closeout",
    conflictSave.error,
  );
  if (
    conflictFeedback.code !== "conflict" ||
    conflictFeedback.retryable !== false ||
    conflictFeedback.connectionState.state !== "online"
  ) {
    fail("conflict should bridge to non-retryable unified feedback", conflictFeedback);
  }

  const missingIssue = await repository.issueCards.load("issue-http-adapter-missing");
  if (missingIssue.ok) {
    fail("missing HTTP issue should not load", missingIssue);
  }
  const missingIssueFeedback = loadIssueCardFailureToFeedback("issue_detail", missingIssue.error);
  if (
    missingIssueFeedback.code !== "not_found" ||
    missingIssueFeedback.connectionState.state !== "online"
  ) {
    fail("HTTP 404 issue load should not display localStorage state", missingIssueFeedback);
  }

  const unreachablePort = await reserveClosedPort();
  const unreachableRepository = createHttpStorageRepository({
    baseUrl: `http://127.0.0.1:${unreachablePort}/api`,
    timeoutMs: 100,
  });
  const unreachableList = await unreachableRepository.issueCards.list();
  if (unreachableList.readError?.code !== "server_unreachable") {
    fail("closed port should map to server_unreachable readError", unreachableList);
  }
  const unreachableFeedback = storageReadErrorToFeedback(
    "issue_list",
    "list_issues",
    unreachableList.readError,
  );
  if (
    unreachableFeedback.code !== "server_unreachable" ||
    unreachableFeedback.connectionState.state !== "unreachable"
  ) {
    fail("server_unreachable readError should bridge to unreachable feedback", unreachableFeedback);
  }

  const timeoutServer = await startMockServer((_req, res) => {
    setTimeout(() => {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, data: { items: [] } }));
    }, 200);
  });
  try {
    const timeoutRepository = createHttpStorageRepository({
      baseUrl: `${timeoutServer.baseUrl}/api`,
      timeoutMs: 50,
    });
    const timeoutList = await timeoutRepository.issueCards.list();
    if (timeoutList.readError?.code !== "timeout") {
      fail("slow server should map to timeout readError", timeoutList);
    }
    const timeoutFeedback = storageReadErrorToFeedback(
      "issue_list",
      "list_issues",
      timeoutList.readError,
    );
    if (timeoutFeedback.code !== "timeout" || timeoutFeedback.connectionState.state !== "degraded") {
      fail("timeout should bridge to degraded timeout feedback", timeoutFeedback);
    }
  } finally {
    await timeoutServer.close();
  }

  const unavailableServer = await startMockServer((req, res) => {
    if (req.url === "/api/health") {
      res.writeHead(503, { "content-type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          ok: false,
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "sqlite warming up",
            operation: "health",
            retryable: true,
            details: {},
          },
        }),
      );
      return;
    }
    res.writeHead(503, { "content-type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        ok: false,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "storage temporarily unavailable",
          operation: "request",
          retryable: true,
          details: {},
        },
      }),
    );
  });
  try {
    const unavailableHealth = await checkHttpStorageHealth({
      baseUrl: `${unavailableServer.baseUrl}/api`,
      timeoutMs: 100,
    });
    if (unavailableHealth.ok) {
      fail("503 health should not be treated as success", unavailableHealth);
    }
    const healthFeedback = healthCheckErrorToFeedback(unavailableHealth.error);
    if (healthFeedback.code !== "read_failed" || healthFeedback.connectionState.state !== "degraded") {
      fail("503 health should bridge to degraded health feedback", healthFeedback);
    }

    const unavailableRepository = createHttpStorageRepository({
      baseUrl: `${unavailableServer.baseUrl}/api`,
      timeoutMs: 100,
    });
    const unavailableWrite = await unavailableRepository.errorEntries.save(closeout.errorEntry);
    if (unavailableWrite.ok || unavailableWrite.error.code !== "unexpected_write_error") {
      fail("503 write should surface as write failure without silent fallback", unavailableWrite);
    }
    const unavailableWriteFeedback = storageWriteErrorToFeedback(
      "closeout",
      "closeout",
      unavailableWrite.error,
    );
    if (
      unavailableWriteFeedback.code !== "write_failed" ||
      unavailableWriteFeedback.connectionState.state !== "degraded"
    ) {
      fail("503 write should bridge to degraded write_failed feedback", unavailableWriteFeedback);
    }
  } finally {
    await unavailableServer.close();
  }

  const viteConfigSource = readFileSync(resolve(process.cwd(), "vite.config.ts"), "utf8");
  if (!viteConfigSource.includes('"/api"') || !viteConfigSource.includes('http://127.0.0.1:4100')) {
    fail("vite.config.ts should expose /api proxy to 127.0.0.1:4100");
  }

  console.log("[S3-LOCAL-HTTP-STORAGE-ADAPTER verify] PASS: HTTP repository happy path writes issue/record/archive/error-entry into SQLite");
  console.log("[S3-LOCAL-HTTP-STORAGE-ADAPTER verify] PASS: workspaceId/projectId compatibility is preserved on HTTP round-trip");
  console.log("[S3-LOCAL-HTTP-STORAGE-ADAPTER verify] PASS: server_unreachable maps to unified unreachable feedback without localStorage fallback");
  console.log("[S3-LOCAL-HTTP-STORAGE-ADAPTER verify] PASS: timeout maps to degraded timeout feedback");
  console.log("[S3-LOCAL-HTTP-STORAGE-ADAPTER verify] PASS: conflict and 503 paths bridge into unified feedback model");
  console.log("[S3-LOCAL-HTTP-STORAGE-ADAPTER verify] PASS: HTTP 404/409 feedback stays in server runtime state");
  console.log("[S3-LOCAL-HTTP-STORAGE-ADAPTER verify] PASS: vite /api proxy is pinned to http://127.0.0.1:4100");
} finally {
  await server.close();
}
