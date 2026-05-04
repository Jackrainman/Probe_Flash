import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { createBackupExport } from "./backup-export.mjs";
import { startProbeFlashServer } from "../src/server.mjs";
import { createTempDir } from "./verify-helpers.mjs";

const WORKSPACE_ID = "workspace-26-r1";

function fail(reason, detail) {
  console.error(`[DATA-02-JSON-EXPORT-HARDEN verify] FAIL: ${reason}`);
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

function assert(condition, reason, detail) {
  if (!condition) {
    fail(reason, detail);
  }
}

function assertCollectionCount(exported, key) {
  assert(Array.isArray(exported[key]), `${key} should be an array`, exported[key]);
  assert(exported[key].length === exported.counts[key], `${key} length should match export counts`, {
    arrayLength: exported[key].length,
    count: exported.counts[key],
  });
}

const workdir = createTempDir("probeflash-json-export-harden").path;
const dbPath = join(workdir, "probeflash.sqlite");
const backupDir = join(workdir, "backups");
const server = await startProbeFlashServer({
  host: "127.0.0.1",
  port: 0,
  dbPath,
});

try {
  const now = "2026-04-27T16:10:00+08:00";
  const issue = {
    id: "issue-json-export-harden-0001",
    projectId: WORKSPACE_ID,
    title: "JSON export harden verify issue",
    rawInput:
      "Authorization: Bearer should-not-leak-bearer and api_key=should-not-leak-api-key at /home/rainman/projects/probeflash/.env",
    normalizedSummary: "json export harden smoke",
    symptomSummary: "token should not leak in export",
    suspectedDirections: ["json export hardening"],
    suggestedActions: ["review exported JSON"],
    status: "open",
    severity: "medium",
    tags: ["verify"],
    repoSnapshot: {
      branch: "master",
      headCommitHash: "0000000000000000000000000000000000000000",
      headCommitMessage: "verify fixture",
      hasUncommittedChanges: true,
      changedFiles: [{ path: "/home/rainman/projects/probeflash/apps/server/src/server.mjs", status: "modified" }],
      recentCommits: [],
      capturedAt: now,
    },
    relatedFiles: ["/opt/probeflash/shared/env/probeflash.env"],
    relatedCommits: [],
    relatedHistoricalIssueIds: [],
    secretToken: "should-not-leak-field-token",
    nestedConfig: { apiKey: "should-not-leak-nested-api-key" },
    createdAt: now,
    updatedAt: now,
  };

  await requestJson(`${server.baseUrl}/api/workspaces/${WORKSPACE_ID}/issues`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(issue),
  });

  const record = {
    id: "record-json-export-harden-0001",
    issueId: issue.id,
    type: "observation",
    rawText: "password=should-not-leak-password and C:\\Users\\rainman\\probeflash\\secret.txt",
    polishedText: "token=should-not-leak-polished-token should be redacted",
    aiExtractedSignals: [],
    linkedFiles: ["/tmp/probeflash/token.txt"],
    linkedCommits: [],
    clientSecret: "should-not-leak-client-secret",
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
    fileName: "2026-04-27_issue-json-export-harden-0001.md",
    filePath: "/home/rainman/.debug_workspace/archive/2026-04-27_issue-json-export-harden-0001.md",
    markdownContent: "# JSON export harden\napi_key=should-not-leak-markdown-key\n",
    generatedBy: "manual",
    privateKey: "should-not-leak-private-key",
    generatedAt: now,
  };
  await requestJson(`${server.baseUrl}/api/workspaces/${WORKSPACE_ID}/archives`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(archive),
  });

  const errorEntry = {
    id: "error-entry-json-export-harden-0001",
    projectId: WORKSPACE_ID,
    sourceIssueId: issue.id,
    errorCode: "DBG-20260427-001",
    title: "JSON export harden verify entry",
    category: "verification",
    symptom: "json export smoke",
    rootCause: "fixture secret should be redacted",
    resolution: "export redaction runs before writing JSON",
    prevention: "verify export before migration",
    archiveFilePath: archive.filePath,
    relatedFiles: ["/var/lib/probeflash/probeflash.sqlite"],
    relatedCommits: [],
    accessToken: "should-not-leak-access-token",
    createdAt: now,
    updatedAt: now,
  };
  await requestJson(`${server.baseUrl}/api/workspaces/${WORKSPACE_ID}/error-entries`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(errorEntry),
  });

  const sourceCountsBefore = {
    workspaces: countRows(dbPath, "workspaces"),
    issues: countRows(dbPath, "issues"),
    records: countRows(dbPath, "records"),
    archives: countRows(dbPath, "archives"),
    errorEntries: countRows(dbPath, "error_entries"),
  };

  const result = createBackupExport({
    dbPath,
    outputDir: backupDir,
    timestamp: "2026-04-27T16:15:00+08:00",
  });

  assert(existsSync(result.exportPath), "JSON export artifact should exist", result);
  const exported = JSON.parse(readFileSync(result.exportPath, "utf8"));
  const exportText = JSON.stringify(exported);

  assert(exported.format === "probeflash-json-export", "export should declare stable format", exported.format);
  assert(exported.formatVersion === 1, "export should declare format version", exported.formatVersion);
  assert(exported.source?.kind === "sqlite", "export source should declare sqlite kind", exported.source);
  assert(exported.source?.dbFileName === "probeflash.sqlite", "export source should expose only db file name", exported.source);
  assert(exported.source?.dbPathClass === "temporary", "export source should classify path without leaking it", exported.source);
  assert(exported.redaction?.enabled === true, "export should declare redaction policy", exported.redaction);
  assert(JSON.stringify(exported.counts) === JSON.stringify(sourceCountsBefore), "export counts should match source DB", {
    exported: exported.counts,
    source: sourceCountsBefore,
  });
  for (const key of ["workspaces", "issues", "records", "archives", "errorEntries"]) {
    assertCollectionCount(exported, key);
  }

  assert(exported.issues[0]?.id === issue.id, "export should retain issue identity", exported.issues[0]);
  assert(exported.errorEntries[0]?.errorCode === errorEntry.errorCode, "export should retain error code", exported.errorEntries[0]);
  assert(exportText.includes("<redacted>"), "export should include redaction marker", exported.redaction);
  assert(exportText.includes("<redacted-path>"), "export should include path redaction marker", exported.redaction);
  assert(exported.issues[0]?.secretToken === "<redacted>", "sensitive object keys should be redacted", exported.issues[0]);
  assert(exported.issues[0]?.nestedConfig?.apiKey === "<redacted>", "nested sensitive keys should be redacted", exported.issues[0]);
  assert(
    exported.issues[0]?.repoSnapshot?.changedFiles?.[0]?.path === "<redacted-path>",
    "absolute repo paths should be redacted",
    exported.issues[0]?.repoSnapshot,
  );

  for (const leaked of [
    workdir,
    "should-not-leak",
    "/home/rainman",
    "/opt/probeflash",
    "/var/lib/probeflash",
    "/tmp/probeflash",
    "C:\\Users\\rainman",
  ]) {
    assert(!exportText.includes(leaked), "export should not leak secrets or sensitive paths", { leaked });
  }

  const sourceCountsAfter = {
    workspaces: countRows(dbPath, "workspaces"),
    issues: countRows(dbPath, "issues"),
    records: countRows(dbPath, "records"),
    archives: countRows(dbPath, "archives"),
    errorEntries: countRows(dbPath, "error_entries"),
  };
  assert(JSON.stringify(sourceCountsAfter) === JSON.stringify(sourceCountsBefore), "source DB should remain unchanged", {
    sourceCountsBefore,
    sourceCountsAfter,
  });

  const health = await requestJson(`${server.baseUrl}/api/health`);
  assert(health.storage?.ready === true, "server health should remain ready after export", health);

  console.log("[DATA-02-JSON-EXPORT-HARDEN verify] PASS: export declares format, version, source class, and redaction policy");
  console.log("[DATA-02-JSON-EXPORT-HARDEN verify] PASS: counts match source DB rows and exported collections");
  console.log("[DATA-02-JSON-EXPORT-HARDEN verify] PASS: secrets and absolute paths are redacted from payload JSON");
  console.log("[DATA-02-JSON-EXPORT-HARDEN verify] PASS: source DB and server health remain unchanged");
} finally {
  await server.close();
}
