import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { startProbeFlashServer } from "../../server/src/server.mjs";
import { buildCloseoutFromIssue, defaultCloseoutOptions } from "../src/domain/closeout.ts";
import { buildIssueCardFromIntake, defaultIntakeOptions } from "../src/domain/issue-intake.ts";
import {
  buildInvestigationRecordFromIntake,
  defaultInvestigationIntakeOptions,
} from "../src/domain/investigation-intake.ts";
import type { InvestigationRecord } from "../src/domain/schemas/investigation-record.ts";
import type { IssueCard } from "../src/domain/schemas/issue-card.ts";
import { createHttpStorageRepository } from "../src/storage/http-storage-repository.ts";
import { createTempDir } from "./verify-helpers.mts";
import type { StorageRepository } from "../src/storage/storage-repository.ts";
import { closeoutFailureToFeedback, formatStorageFeedbackError } from "../src/storage/storage-feedback.ts";
import { createUnexpectedWriteError } from "../src/storage/storage-result.ts";
import { orchestrateIssueCloseout } from "../src/use-cases/closeout-orchestrator.ts";

const WORKSPACE_ID = "workspace-26-r1";

function fail(reason: string, detail?: unknown): never {
  console.error(`[DATA-05-PARTIAL-CLOSEOUT-RECOVERY verify] FAIL: ${reason}`);
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

function buildIssueFixture(id: string, title: string, now: string): IssueCard {
  const result = buildIssueCardFromIntake(
    {
      title,
      description: `${title} created by DATA-05 partial closeout verify.`,
      severity: "high",
    },
    defaultIntakeOptions(now, id),
  );
  assert(result.ok, "failed to build issue fixture", result);
  return result.card;
}

function buildRecordFixture(issueId: string, id: string, now: string): InvestigationRecord {
  const result = buildInvestigationRecordFromIntake(
    {
      issueId,
      type: "observation",
      note: "Observed failure injection while validating partial closeout recovery.",
    },
    defaultInvestigationIntakeOptions(now, id),
  );
  assert(result.ok, "failed to build record fixture", result);
  return result.record;
}

async function seedCloseoutFixture(
  repository: StorageRepository,
  suffix: string,
  errorCode: string,
) {
  const issue = buildIssueFixture(
    `issue-data-05-${suffix}`,
    `DATA-05 ${suffix} partial closeout`,
    "2026-04-27T17:00:00+08:00",
  );
  const savedIssue = await repository.issueCards.save(issue);
  assert(savedIssue.ok, "issue fixture should save", savedIssue);

  const record = buildRecordFixture(
    issue.id,
    `record-data-05-${suffix}`,
    "2026-04-27T17:05:00+08:00",
  );
  const savedRecord = await repository.investigationRecords.append(record);
  assert(savedRecord.ok, "record fixture should save", savedRecord);

  const input = {
    category: "data-safety",
    rootCause: `${suffix} failure injection should stay visible`,
    resolution: "Do not mark the issue archived unless all closeout writes finish.",
    prevention: "Block completion gates on partial closeout writes.",
  };
  const options = defaultCloseoutOptions("2026-04-27T17:20:00+08:00", {
    errorEntryId: `error-entry-data-05-${suffix}`,
    errorCode,
    generatedBy: "hybrid",
  });
  const precomputed = buildCloseoutFromIssue(issue, [record], input, options);
  assert(precomputed.ok, "precomputed closeout artifacts should be valid", precomputed);

  return { issue, record, input, options, precomputed };
}

function readCloseoutState(
  dbPath: string,
  issueId: string,
  archiveFileName: string,
  errorEntryId: string,
) {
  const db = new DatabaseSync(dbPath);
  try {
    const issueRow = db
      .prepare(`SELECT status, payload_json FROM issues WHERE id = ?`)
      .get(issueId) as { status: string; payload_json: string } | undefined;
    const archiveCount = db
      .prepare(`SELECT COUNT(*) AS count FROM archives WHERE issue_id = ? AND file_name = ?`)
      .get(issueId, archiveFileName) as { count: number };
    const errorEntryCount = db
      .prepare(`SELECT COUNT(*) AS count FROM error_entries WHERE source_issue_id = ? AND id = ?`)
      .get(issueId, errorEntryId) as { count: number };
    return {
      issueStatus: issueRow?.status,
      issuePayloadStatus: issueRow ? (JSON.parse(issueRow.payload_json) as IssueCard).status : undefined,
      archiveCount: archiveCount.count,
      errorEntryCount: errorEntryCount.count,
    };
  } finally {
    db.close();
  }
}

async function assertIssueOpen(repository: StorageRepository, issueId: string, label: string) {
  const loaded = await repository.issueCards.load(issueId);
  assert(loaded.ok, `${label}: issue should remain readable`, loaded);
  assert(loaded.card.status === "open", `${label}: issue should remain open`, loaded.card);
}

function assertFailureFeedback(
  result: Awaited<ReturnType<typeof orchestrateIssueCloseout>>,
  expectedCompletedWrites: string[],
  label: string,
) {
  assert(!result.ok, `${label}: closeout should fail`, result);
  const feedback = closeoutFailureToFeedback(result);
  assert(
    (feedback.completedWrites ?? []).join(",") === expectedCompletedWrites.join(","),
    `${label}: feedback should preserve completedWrites`,
    feedback,
  );
  const formatted = formatStorageFeedbackError(feedback);
  if (expectedCompletedWrites.length > 0) {
    assert(formatted.includes("已完成"), `${label}: formatted feedback should mention completed writes`, formatted);
  }
}

function closeoutOverrides(options: ReturnType<typeof defaultCloseoutOptions>) {
  return {
    errorEntryId: options.errorEntryId,
    errorCode: options.errorCode,
    generatedBy: options.generatedBy,
  };
}

async function verifyArchiveWriteFailure(repository: StorageRepository, dbPath: string) {
  const fixture = await seedCloseoutFixture(repository, "archive-failure", "DBG-20260427-051");
  const preexistingArchive = await repository.archiveDocuments.save(fixture.precomputed.archiveDocument);
  assert(preexistingArchive.ok, "archive conflict fixture should save before closeout", preexistingArchive);

  const before = readCloseoutState(
    dbPath,
    fixture.issue.id,
    fixture.precomputed.archiveDocument.fileName,
    fixture.precomputed.errorEntry.id,
  );
  const result = await orchestrateIssueCloseout(fixture.issue.id, fixture.input, {
    repository,
    now: () => fixture.options.now,
    closeoutOptionsOverrides: closeoutOverrides(fixture.options),
  });

  assert(!result.ok, "archive failure should fail closeout", result);
  assert(result.reason === "archive_save_failed", "failure should happen at archive write", result);
  assert(result.completedWrites.length === 0, "archive failure should report no completed writes", result);
  assertFailureFeedback(result, [], "archive failure");
  await assertIssueOpen(repository, fixture.issue.id, "archive failure");

  const after = readCloseoutState(
    dbPath,
    fixture.issue.id,
    fixture.precomputed.archiveDocument.fileName,
    fixture.precomputed.errorEntry.id,
  );
  assert(JSON.stringify(after) === JSON.stringify(before), "archive failure should not change closeout state", {
    before,
    after,
  });
}

async function verifyErrorEntryWriteFailure(repository: StorageRepository, dbPath: string) {
  const fixture = await seedCloseoutFixture(repository, "error-entry-failure", "DBG-20260427-052");
  const preexistingErrorEntry = await repository.errorEntries.save(fixture.precomputed.errorEntry);
  assert(preexistingErrorEntry.ok, "error-entry conflict fixture should save before closeout", preexistingErrorEntry);

  const result = await orchestrateIssueCloseout(fixture.issue.id, fixture.input, {
    repository,
    now: () => fixture.options.now,
    closeoutOptionsOverrides: closeoutOverrides(fixture.options),
  });

  assert(!result.ok, "error-entry failure should fail closeout", result);
  assert(result.reason === "error_entry_save_failed", "failure should happen at error-entry write", result);
  assert(result.completedWrites.join(",") === "archive_document", "error-entry failure should report archive only", result);
  assertFailureFeedback(result, ["archive_document"], "error-entry failure");
  await assertIssueOpen(repository, fixture.issue.id, "error-entry failure");

  const after = readCloseoutState(
    dbPath,
    fixture.issue.id,
    fixture.precomputed.archiveDocument.fileName,
    fixture.precomputed.errorEntry.id,
  );
  assert(
    after.issueStatus === "open" &&
      after.issuePayloadStatus === "open" &&
      after.archiveCount === 1 &&
      after.errorEntryCount === 1,
    "error-entry failure should retain archive, keep one conflicting error entry, and leave issue open",
    after,
  );
}

async function verifyIssueStatusWriteFailure(repository: StorageRepository, dbPath: string) {
  const fixture = await seedCloseoutFixture(repository, "issue-status-failure", "DBG-20260427-053");
  const failingRepository: StorageRepository = {
    ...repository,
    issueCards: {
      ...repository.issueCards,
      async save(card) {
        if (card.id === fixture.issue.id && card.status === "archived") {
          return {
            ok: false,
            error: createUnexpectedWriteError(
              "issue_card",
              fixture.issue.id,
              "forced issue status write failure",
            ),
          };
        }
        return repository.issueCards.save(card);
      },
    },
  };

  const result = await orchestrateIssueCloseout(fixture.issue.id, fixture.input, {
    repository: failingRepository,
    now: () => fixture.options.now,
    closeoutOptionsOverrides: closeoutOverrides(fixture.options),
  });

  assert(!result.ok, "issue status failure should fail closeout", result);
  assert(result.reason === "issue_card_save_failed", "failure should happen at issue status write", result);
  assert(
    result.completedWrites.join(",") === "archive_document,error_entry",
    "issue status failure should report archive and error-entry writes",
    result,
  );
  assertFailureFeedback(result, ["archive_document", "error_entry"], "issue status failure");
  await assertIssueOpen(repository, fixture.issue.id, "issue status failure");

  const after = readCloseoutState(
    dbPath,
    fixture.issue.id,
    fixture.precomputed.archiveDocument.fileName,
    fixture.precomputed.errorEntry.id,
  );
  assert(
    after.issueStatus === "open" &&
      after.issuePayloadStatus === "open" &&
      after.archiveCount === 1 &&
      after.errorEntryCount === 1,
    "issue status failure should keep archive/error-entry visible while issue remains open",
    after,
  );

  const retry = await orchestrateIssueCloseout(fixture.issue.id, fixture.input, {
    repository,
    now: () => fixture.options.now,
    closeoutOptionsOverrides: closeoutOverrides(fixture.options),
  });
  assert(!retry.ok, "retry with same closeout IDs should be blocked until repair", retry);
  assert(retry.reason === "archive_save_failed", "retry should stop on existing archive instead of marking archived", retry);
  await assertIssueOpen(repository, fixture.issue.id, "issue status retry");
}

const workdir = createTempDir("probeflash-data-05-partial-closeout").path;
const dbPath = join(workdir, "probeflash.partial-closeout.sqlite");
const server = await startProbeFlashServer({
  host: "127.0.0.1",
  port: 0,
  dbPath,
});

try {
  const repository = createHttpStorageRepository({
    baseUrl: `${server.baseUrl}/api`,
    workspaceId: WORKSPACE_ID,
    timeoutMs: 800,
  });

  await verifyArchiveWriteFailure(repository, dbPath);
  await verifyErrorEntryWriteFailure(repository, dbPath);
  await verifyIssueStatusWriteFailure(repository, dbPath);

  console.log("[DATA-05-PARTIAL-CLOSEOUT-RECOVERY verify] PASS: archive write failure leaves issue open and reports no completed writes");
  console.log("[DATA-05-PARTIAL-CLOSEOUT-RECOVERY verify] PASS: error-entry write failure keeps archive visible and leaves issue open");
  console.log("[DATA-05-PARTIAL-CLOSEOUT-RECOVERY verify] PASS: issue status write failure keeps archive/error-entry visible and blocks false archived state");
} finally {
  await server.close();
}
