import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { createBackupExport } from "./backup-export.mjs";
import { restoreDryRun } from "./restore-dry-run.mjs";
import { startProbeFlashServer } from "../src/server.mjs";
import { createTempDir } from "./verify-helpers.mjs";

const WORKSPACE_ID = "workspace-26-r1";

function fail(reason, detail) {
  console.error(`[S4-DATA-RESTORE-DRY-RUN verify] FAIL: ${reason}`);
  if (detail !== undefined) {
    console.error(JSON.stringify(detail, null, 2));
  }
  process.exit(1);
}

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json();
  if (!response.ok || payload.ok !== true) {
    fail(`request failed: ${url}`, payload);
  }
  return payload.data;
}

function countRows(dbPath, tableName) {
  const db = new DatabaseSync(dbPath);
  try {
    return db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count;
  } finally {
    db.close();
  }
}

function expectThrow(fn, expectedMessage) {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(expectedMessage)) {
      return;
    }
    fail("unexpected error message", { message, expectedMessage });
  }
  fail("expected restore dry-run failure", { expectedMessage });
}

const workdir = createTempDir("probeflash-restore-dry-run").path;
const dbPath = join(workdir, "probeflash.sqlite");
const backupDir = join(workdir, "backups");
const restoreTmpDir = join(workdir, "restore-temp");
const server = await startProbeFlashServer({
  host: "127.0.0.1",
  port: 0,
  dbPath,
});

try {
  const now = "2026-04-26T10:40:00+08:00";
  const issue = {
    id: "issue-restore-dry-run-0001",
    projectId: WORKSPACE_ID,
    title: "Restore dry-run verify issue",
    rawInput: "Verify restore dry-run from a SQLite backup.",
    normalizedSummary: "restore dry-run smoke",
    symptomSummary: "n/a",
    suspectedDirections: ["restore dry-run"],
    suggestedActions: ["restore backup into temporary DB"],
    status: "open",
    severity: "medium",
    tags: ["verify"],
    repoSnapshot: {
      branch: "master",
      headCommitHash: "0000000000000000000000000000000000000000",
      headCommitMessage: "verify fixture",
      hasUncommittedChanges: false,
      changedFiles: [],
      recentCommits: [],
      capturedAt: now,
    },
    relatedFiles: [],
    relatedCommits: [],
    relatedHistoricalIssueIds: [],
    createdAt: now,
    updatedAt: now,
  };

  await requestJson(`${server.baseUrl}/api/workspaces/${WORKSPACE_ID}/issues`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(issue),
  });

  const record = {
    id: "record-restore-dry-run-0001",
    issueId: issue.id,
    type: "observation",
    rawText: "Restore dry-run verify record.",
    polishedText: "Restore dry-run verify record.",
    aiExtractedSignals: [],
    linkedFiles: [],
    linkedCommits: [],
    createdAt: now,
  };
  await requestJson(`${server.baseUrl}/api/workspaces/${WORKSPACE_ID}/issues/${issue.id}/records`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(record),
  });

  const archive = {
    issueId: issue.id,
    projectId: WORKSPACE_ID,
    fileName: "2026-04-26_issue-restore-dry-run-0001.md",
    filePath: ".debug_workspace/archive/2026-04-26_issue-restore-dry-run-0001.md",
    markdownContent: "# Restore dry-run verify\n",
    generatedBy: "manual",
    generatedAt: now,
  };
  await requestJson(`${server.baseUrl}/api/workspaces/${WORKSPACE_ID}/archives`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(archive),
  });

  const errorEntry = {
    id: "error-entry-restore-dry-run-0001",
    projectId: WORKSPACE_ID,
    sourceIssueId: issue.id,
    errorCode: "DBG-20260426-002",
    title: "Restore dry-run verify entry",
    category: "验证",
    symptom: "restore dry-run smoke",
    rootCause: "verify fixture",
    resolution: "restored backup into temporary DB",
    prevention: "run restore dry-run before deploy changes",
    archiveFilePath: archive.filePath,
    relatedFiles: [],
    relatedCommits: [],
    createdAt: now,
    updatedAt: now,
  };
  await requestJson(`${server.baseUrl}/api/workspaces/${WORKSPACE_ID}/error-entries`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(errorEntry),
  });

  const sourceCountsBefore = {
    issues: countRows(dbPath, "issues"),
    records: countRows(dbPath, "records"),
    archives: countRows(dbPath, "archives"),
    errorEntries: countRows(dbPath, "error_entries"),
  };
  const backup = createBackupExport({
    dbPath,
    outputDir: backupDir,
    timestamp: "2026-04-26T10:45:00+08:00",
  });

  const result = restoreDryRun({
    backupPath: backup.backupPath,
    jsonExportPath: backup.exportPath,
    tmpDir: restoreTmpDir,
    requireDomainData: true,
  });

  if (existsSync(result.tempDbPath)) {
    fail("temporary restored DB should be removed by default", result);
  }
  if (result.backupUnchanged !== true || result.jsonExportMatched !== true) {
    fail("restore dry-run should leave backup unchanged and match export counts", result);
  }
  if (
    result.counts.workspaces !== 1 ||
    result.counts.issues !== 1 ||
    result.counts.records !== 1 ||
    result.counts.archives !== 1 ||
    result.counts.errorEntries !== 1
  ) {
    fail("restore dry-run should read back all key entity counts", result.counts);
  }
  if (
    result.samples.workspaceId !== WORKSPACE_ID ||
    result.samples.issueId !== issue.id ||
    result.samples.recordId !== record.id ||
    result.samples.archiveFileName !== archive.fileName ||
    result.samples.errorEntryId !== errorEntry.id
  ) {
    fail("restore dry-run should read back expected sample IDs", result.samples);
  }

  const sourceCountsAfter = {
    issues: countRows(dbPath, "issues"),
    records: countRows(dbPath, "records"),
    archives: countRows(dbPath, "archives"),
    errorEntries: countRows(dbPath, "error_entries"),
  };
  if (JSON.stringify(sourceCountsAfter) !== JSON.stringify(sourceCountsBefore)) {
    fail("source DB counts should remain unchanged after restore dry-run", {
      sourceCountsBefore,
      sourceCountsAfter,
    });
  }

  const badExportPath = join(workdir, "bad-export-counts.json");
  const badExport = JSON.parse(readFileSync(backup.exportPath, "utf8"));
  badExport.counts.issues += 1;
  writeFileSync(badExportPath, `${JSON.stringify(badExport, null, 2)}\n`, "utf8");
  expectThrow(
    () => restoreDryRun({ backupPath: backup.backupPath, jsonExportPath: badExportPath }),
    "does not match json export",
  );

  const health = await requestJson(`${server.baseUrl}/api/health`);
  if (health.storage?.ready !== true) {
    fail("server health should remain ready after restore dry-run", health);
  }

  console.log("[S4-DATA-RESTORE-DRY-RUN verify] PASS: backup restores into a temporary DB only");
  console.log("[S4-DATA-RESTORE-DRY-RUN verify] PASS: workspace, issue, record, archive, and error-entry are read back");
  console.log("[S4-DATA-RESTORE-DRY-RUN verify] PASS: JSON export counts are checked and mismatches fail");
  console.log("[S4-DATA-RESTORE-DRY-RUN verify] PASS: source DB and server health remain unchanged");
} finally {
  await server.close();
}
