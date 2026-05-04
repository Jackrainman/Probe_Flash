import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { DEFAULT_DB_PATH, startProbeFlashServer } from "../src/server.mjs";
import { createTempDir } from "./verify-helpers.mjs";

function fail(reason, detail) {
  console.error(`[S3-LOCAL-BACKEND-SCAFFOLD verify] FAIL: ${reason}`);
  if (detail !== undefined) {
    console.error(JSON.stringify(detail, null, 2));
  }
  process.exit(1);
}

const workdir = createTempDir("probeflash-server").path;
const dbPath = join(workdir, "probeflash.local.sqlite");
const expectedDefaultDbPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".runtime",
  "probeflash.local.sqlite",
);

if (DEFAULT_DB_PATH !== expectedDefaultDbPath) {
  fail("default db path should be anchored to apps/server instead of process cwd", {
    DEFAULT_DB_PATH,
    expectedDefaultDbPath,
  });
}

const server = await startProbeFlashServer({
  host: "127.0.0.1",
  port: 0,
  dbPath,
});

try {
  const healthResponse = await fetch(`${server.baseUrl}/api/health`);
  const health = await healthResponse.json();
  if (!healthResponse.ok || health.ok !== true) {
    fail("expected /api/health ok=true", health);
  }
  if (health.data.storage.kind !== "sqlite" || health.data.storage.ready !== true) {
    fail("health should report sqlite ready", health);
  }

  const workspacesResponse = await fetch(`${server.baseUrl}/api/workspaces`);
  const workspaces = await workspacesResponse.json();
  if (!workspacesResponse.ok || workspaces.ok !== true || workspaces.data.items.length !== 1) {
    fail("expected one default workspace", workspaces);
  }
  if (workspaces.data.items[0].id !== "workspace-26-r1") {
    fail("default workspace id mismatch", workspaces.data.items);
  }
  if (workspaces.data.items[0].name !== "26年 R1") {
    fail("default workspace name mismatch", workspaces.data.items);
  }

  const issuePayload = {
    id: "issue-backend-smoke-0001",
    projectId: "workspace-26-r1",
    title: "WSL backend scaffold smoke",
    rawInput: "Created by backend scaffold verify.",
    normalizedSummary: "health + sqlite + issue round-trip",
    symptomSummary: "n/a",
    suspectedDirections: ["backend scaffold"],
    suggestedActions: ["verify /api/health", "verify sqlite write / read"],
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
      capturedAt: "2026-04-23T19:00:00+08:00",
    },
    relatedFiles: [],
    relatedCommits: [],
    relatedHistoricalIssueIds: [],
    createdAt: "2026-04-23T19:00:00+08:00",
    updatedAt: "2026-04-23T19:00:00+08:00",
  };

  const createIssueResponse = await fetch(
    `${server.baseUrl}/api/workspaces/workspace-26-r1/issues`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(issuePayload),
    },
  );
  const createdIssue = await createIssueResponse.json();
  if (createIssueResponse.status !== 201 || createdIssue.ok !== true) {
    fail("issue POST should return 201", createdIssue);
  }
  if (createdIssue.data.id !== issuePayload.id || createdIssue.data.title !== issuePayload.title) {
    fail("created issue payload mismatch", createdIssue.data);
  }

  const loadIssueResponse = await fetch(
    `${server.baseUrl}/api/workspaces/workspace-26-r1/issues/${issuePayload.id}`,
  );
  const loadedIssue = await loadIssueResponse.json();
  if (!loadIssueResponse.ok || loadedIssue.ok !== true) {
    fail("issue GET should succeed", loadedIssue);
  }
  if (loadedIssue.data.id !== issuePayload.id || loadedIssue.data.projectId !== issuePayload.projectId) {
    fail("loaded issue should round-trip stored payload", loadedIssue.data);
  }

  const mismatchResponse = await fetch(
    `${server.baseUrl}/api/workspaces/workspace-26-r1/issues`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...issuePayload,
        id: "issue-backend-smoke-mismatch",
        projectId: "wrong-workspace",
      }),
    },
  );
  const mismatch = await mismatchResponse.json();
  if (mismatchResponse.status !== 422 || mismatch.error?.code !== "VALIDATION_ERROR") {
    fail("workspace/projectId mismatch should return VALIDATION_ERROR", mismatch);
  }

  const db = new DatabaseSync(dbPath);
  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name ASC`)
    .all()
    .map((row) => row.name);
  for (const requiredTable of [
    "schema_meta",
    "workspaces",
    "issues",
    "records",
    "archives",
    "error_entries",
  ]) {
    if (!tables.includes(requiredTable)) {
      fail(`expected sqlite table ${requiredTable} to exist`, tables);
    }
  }
  const issueCount = db.prepare(`SELECT COUNT(*) AS count FROM issues`).get().count;
  if (issueCount !== 1) {
    fail("sqlite issue table should contain one inserted row", { issueCount });
  }
  db.close();

  console.log("[S3-LOCAL-BACKEND-SCAFFOLD verify] PASS: /api/health returns sqlite ready state");
  console.log("[S3-LOCAL-BACKEND-SCAFFOLD verify] PASS: default db path is anchored to apps/server");
  console.log("[S3-LOCAL-BACKEND-SCAFFOLD verify] PASS: default workspace is seeded in SQLite");
  console.log("[S3-LOCAL-BACKEND-SCAFFOLD verify] PASS: issue POST + GET round-trip succeeds");
  console.log("[S3-LOCAL-BACKEND-SCAFFOLD verify] PASS: workspace/projectId mismatch returns VALIDATION_ERROR");
  console.log("[S3-LOCAL-BACKEND-SCAFFOLD verify] PASS: SQLite schema and inserted row are readable from db file");
} finally {
  await server.close();
}

const deployWorkdir = createTempDir("probeflash-server-deploy-env").path;
const deployDbPath = join(deployWorkdir, "custom.sqlite");
const deployLogDir = join(deployWorkdir, "logs");

const previousDeployEnv = {
  PROBEFLASH_HOST: process.env.PROBEFLASH_HOST,
  PROBEFLASH_PORT: process.env.PROBEFLASH_PORT,
  PROBEFLASH_DB_PATH: process.env.PROBEFLASH_DB_PATH,
  PROBEFLASH_LOG_DIR: process.env.PROBEFLASH_LOG_DIR,
  PROBEFLASH_WORKSPACE_ID: process.env.PROBEFLASH_WORKSPACE_ID,
  PROBEFLASH_WORKSPACE_NAME: process.env.PROBEFLASH_WORKSPACE_NAME,
};

process.env.PROBEFLASH_HOST = "127.0.0.1";
process.env.PROBEFLASH_PORT = "0";
process.env.PROBEFLASH_DB_PATH = deployDbPath;
process.env.PROBEFLASH_LOG_DIR = deployLogDir;
process.env.PROBEFLASH_WORKSPACE_ID = "workspace-deploy-smoke";
process.env.PROBEFLASH_WORKSPACE_NAME = "部署验证工作区";

let deployServer;
try {
  deployServer = await startProbeFlashServer();
} finally {
  for (const [key, value] of Object.entries(previousDeployEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

try {
  const deployWorkspacesResponse = await fetch(`${deployServer.baseUrl}/api/workspaces`);
  const deployWorkspaces = await deployWorkspacesResponse.json();
  if (
    !deployWorkspacesResponse.ok ||
    deployWorkspaces.ok !== true ||
    deployWorkspaces.data.items[0]?.id !== "workspace-deploy-smoke" ||
    deployWorkspaces.data.items[0]?.name !== "部署验证工作区"
  ) {
    fail("deploy env workspace override should seed the configured workspace", deployWorkspaces);
  }
  if (!existsSync(deployDbPath) || !existsSync(deployLogDir)) {
    fail("deploy env db path and log dir should be created", { deployDbPath, deployLogDir });
  }
  console.log("[S3-LOCAL-BACKEND-SCAFFOLD verify] PASS: deploy env db/log/workspace values are honored");
} finally {
  await deployServer.close();
}
