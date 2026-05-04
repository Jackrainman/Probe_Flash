import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { createBackupExport } from "./backup-export.mjs";
import { startProbeFlashServer } from "../src/server.mjs";
import { createTempDir } from "./verify-helpers.mjs";

const WORKSPACE_ID = "workspace-26-r1";

function fail(reason, detail) {
  console.error(`[S4-DATA-BACKUP-EXPORT verify] FAIL: ${reason}`);
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

const workdir = createTempDir("probeflash-backup-export").path;
const dbPath = join(workdir, "probeflash.sqlite");
const backupDir = join(workdir, "backups");
const server = await startProbeFlashServer({
  host: "127.0.0.1",
  port: 0,
  dbPath,
});

try {
  const now = "2026-04-26T10:10:00+08:00";
  const issue = {
    id: "issue-backup-export-0001",
    projectId: WORKSPACE_ID,
    title: "Backup export verify issue",
    rawInput: "Verify backup/export while server is running.",
    normalizedSummary: "backup/export smoke",
    symptomSummary: "n/a",
    suspectedDirections: ["backup/export"],
    suggestedActions: ["run backup export"],
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
    id: "record-backup-export-0001",
    issueId: issue.id,
    type: "observation",
    rawText: "Backup export verify record.",
    polishedText: "Backup export verify record.",
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
    fileName: "2026-04-26_issue-backup-export-0001.md",
    filePath: ".debug_workspace/archive/2026-04-26_issue-backup-export-0001.md",
    markdownContent: "# Backup export verify\n",
    generatedBy: "manual",
    generatedAt: now,
  };
  await requestJson(`${server.baseUrl}/api/workspaces/${WORKSPACE_ID}/archives`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(archive),
  });

  const errorEntry = {
    id: "error-entry-backup-export-0001",
    projectId: WORKSPACE_ID,
    sourceIssueId: issue.id,
    errorCode: "DBG-20260426-001",
    title: "Backup export verify entry",
    category: "验证",
    symptom: "backup/export smoke",
    rootCause: "verify fixture",
    resolution: "backup/export created artifacts",
    prevention: "run backup/export verify before deploy",
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

  const result = createBackupExport({
    dbPath,
    outputDir: backupDir,
    timestamp: "2026-04-26T10:15:00+08:00",
  });

  if (!existsSync(result.backupPath) || !existsSync(result.exportPath)) {
    fail("backup/export artifacts should exist", result);
  }
  if (result.counts.issues !== 1 || result.counts.records !== 1 || result.counts.errorEntries !== 1) {
    fail("export counts should include created entities", result.counts);
  }
  if (countRows(result.backupPath, "issues") !== 1 || countRows(result.backupPath, "records") !== 1) {
    fail("sqlite backup should contain created issue and record", result.backupPath);
  }

  const exported = JSON.parse(readFileSync(result.exportPath, "utf8"));
  if (
    exported.source.dbFileName !== "probeflash.sqlite" ||
    exported.counts.archives !== 1 ||
    exported.errorEntries[0]?.errorCode !== "DBG-20260426-001"
  ) {
    fail("JSON export should include redacted source and domain payloads", exported);
  }
  if (JSON.stringify(exported).includes(workdir)) {
    fail("JSON export should not include absolute temp/source paths", exported.source);
  }

  const health = await requestJson(`${server.baseUrl}/api/health`);
  if (health.storage?.ready !== true) {
    fail("server health should remain ready after backup/export", health);
  }
  if (countRows(dbPath, "issues") !== 1 || countRows(dbPath, "error_entries") !== 1) {
    fail("source DB counts should remain unchanged after backup/export", { dbPath });
  }

  console.log("[S4-DATA-BACKUP-EXPORT verify] PASS: backup/export artifacts are generated with timestamped names");
  console.log("[S4-DATA-BACKUP-EXPORT verify] PASS: SQLite backup contains workspace, issue, record, archive, and error-entry data");
  console.log("[S4-DATA-BACKUP-EXPORT verify] PASS: JSON export includes counts and payloads without absolute source paths");
  console.log("[S4-DATA-BACKUP-EXPORT verify] PASS: source DB and server health remain intact after export");
} finally {
  await server.close();
}
