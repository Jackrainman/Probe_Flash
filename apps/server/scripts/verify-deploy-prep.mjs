import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createReporter } from "./verify-helpers.mjs";

const { fail } = createReporter("S3-SERVER-DEPLOY-PREP verify");

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const deployRoot = resolve(serverRoot, "deploy");

const requiredFiles = [
  "README.md",
  "install-layout.md",
  "update-rollback-runbook.md",
  "env.example",
  "probeflash.service.template",
];

function readDeployFile(fileName) {
  const filePath = resolve(deployRoot, fileName);
  if (!existsSync(filePath)) {
    fail(`missing deploy file ${fileName}`, { filePath });
  }
  return readFileSync(filePath, "utf8");
}

function assertContains(fileName, content, expected) {
  if (!content.includes(expected)) {
    fail(`${fileName} should contain ${expected}`);
  }
}

function assertNotContains(fileName, content, forbidden) {
  if (content.includes(forbidden)) {
    fail(`${fileName} must not contain ${forbidden}`);
  }
}

const contents = Object.fromEntries(requiredFiles.map((fileName) => [fileName, readDeployFile(fileName)]));
const env = Object.fromEntries(
  contents["env.example"]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);

const expectedEnv = {
  PROBEFLASH_HOST: "0.0.0.0",
  PROBEFLASH_PORT: "4100",
  PROBEFLASH_STATIC_DIR: "/home/hurricane/probeflash/current/dist",
  PROBEFLASH_DB_PATH: "/home/hurricane/probeflash/shared/data/probeflash.sqlite",
  PROBEFLASH_LOG_DIR: "/home/hurricane/probeflash/shared/logs",
  PROBEFLASH_WORKSPACE_ID: "workspace-26-r1",
  PROBEFLASH_WORKSPACE_NAME: "26年 R1",
};

for (const [key, expectedValue] of Object.entries(expectedEnv)) {
  if (env[key] !== expectedValue) {
    fail(`env.example should set ${key}`, { expected: expectedValue, actual: env[key] });
  }
}

const service = contents["probeflash.service.template"];
const requiredServiceLines = [
  "Description=ProbeFlash LAN web/API server",
  "Use only after release tarball no-sudo verification under /home/hurricane/probeflash succeeds",
  "User=hurricane",
  "Group=hurricane",
  "WorkingDirectory=/home/hurricane/probeflash/current/apps/server",
  "EnvironmentFile=/home/hurricane/probeflash/shared/env/probeflash.env",
  "ExecStart=/home/hurricane/probeflash/runtime/node/bin/node src/server.mjs",
  "Restart=always",
  "RestartSec=3s",
  "NoNewPrivileges=true",
  "PrivateTmp=true",
  "ProtectSystem=full",
  "ReadWritePaths=/home/hurricane/probeflash/shared/data /home/hurricane/probeflash/shared/logs /home/hurricane/probeflash/shared/env",
];

for (const line of requiredServiceLines) {
  assertContains("probeflash.service.template", service, line);
}

assertNotContains("probeflash.service.template", service, "/usr/bin/node");
assertNotContains("probeflash.service.template", service, "WorkingDirectory=/opt/probeflash");
assertNotContains("probeflash.service.template", service, "EnvironmentFile=/opt/probeflash");
assertNotContains("probeflash.service.template", service, "ExecStart=/opt/probeflash");
assertNotContains("probeflash.service.template", service, "ProtectHome=true");

const allDocs = `${contents["README.md"]}\n${contents["install-layout.md"]}\n${contents["update-rollback-runbook.md"]}`;
for (const expected of [
  "/home/hurricane/probeflash/current",
  "/home/hurricane/probeflash/releases/",
  "/home/hurricane/probeflash/releases/v0.2.0",
  "/home/hurricane/probeflash/shared/data",
  "/home/hurricane/probeflash/shared/logs",
  "/home/hurricane/probeflash/shared/env",
  "/home/hurricane/probeflash/runtime/node",
  "/home/hurricane/probeflash/runtime/node/bin/node",
  "/home/hurricane/probeflash/shared/data/probeflash.sqlite",
  "/home/hurricane/probeflash/current/dist",
  "PROBEFLASH_STATIC_DIR",
  "single port `4100`",
  "Browser entry: `http://192.168.2.2:4100/`",
  "4100",
  "4173",
  "0.0.0.0",
  "127.0.0.1",
  "192.168.2.2",
  "Node 24",
  "node:sqlite",
  "no-sudo",
  "release tarball first",
  "probeflash-web-v0.2.0.tar.gz",
  "probeflash-server-v0.2.0.tar.gz",
  "probeflash-dev-tools-v0.2.0.tar.gz",
  "SHA256SUMS.txt",
  "git pull",
  "not required for no-sudo verify",
  "later / formal install / optional hardening",
  "/opt/probeflash",
  "update-rollback-runbook.md",
  "ln -sfn /home/hurricane/probeflash/releases/<new-version> /home/hurricane/probeflash/current",
  "ln -sfn /home/hurricane/probeflash/releases/<previous-version> /home/hurricane/probeflash/current",
  "GET http://127.0.0.1:4100/api/health",
  "GET http://127.0.0.1:4100/api/version",
  "GET http://127.0.0.1:4100/",
  "GET http://192.168.2.2:4100/",
  "shared/data/probeflash.sqlite",
  "If SHA256 verification fails, do not unpack or run the release.",
  "If rollback also fails, stop and require user intervention.",
]) {
  assertContains("deploy docs", allDocs, expected);
}

for (const forbidden of [
  "PROBEFLASH_PORT=80",
  "ExecStart=/usr/bin/node",
  "Recommended root: `/opt/probeflash/`",
  "server `git pull` as the formal server deployment path",
  "copy source for `/opt/probeflash/shared/env/probeflash.env`",
  "Create `/opt/probeflash/{releases,shared/{data,logs,env},runtime}`",
]) {
  assertNotContains("deploy docs", allDocs, forbidden);
}

console.log("[S3-SERVER-DEPLOY-PREP verify] PASS: deploy files exist and are readable");
console.log("[S3-SERVER-DEPLOY-PREP verify] PASS: env.example exposes the expected user-dir LAN deployment defaults");
console.log("[S3-SERVER-DEPLOY-PREP verify] PASS: systemd template is later-authorized and points to the user-dir layout");
console.log("[S3-SERVER-DEPLOY-PREP verify] PASS: docs prefer release tarball user-dir deployment before later /opt hardening");
