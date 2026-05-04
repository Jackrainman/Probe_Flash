// apps/server/scripts/verify-helpers.mjs
// 共享 verify 脚本工具（server 侧 .mjs 版本），与 apps/desktop/scripts/verify-helpers.mts 行为对齐。
// 任务：TECH-04-VERIFY-HELPERS（夜跑还债，纯本地）。
//
// 提供：
//   - createReporter(tag) → { fail, assert, assertEqual }
//   - startMockServer(handler) → Promise<{ baseUrl, close }>
//   - createTempDir(prefix) → { path, cleanup }，进程退出自动 best-effort rmSync recursive force。
//   - createTempDb(prefix, fileName?) → { path, dbPath, db, cleanup }
//
// 边界与桌面侧一致：不引入 fixture 集中化、不挂额外 SIGINT/SIGTERM handler。

import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { deepStrictEqual } from "node:assert";

export function createReporter(tag) {
  function fail(reason, detail) {
    console.error(`[${tag}] FAIL: ${reason}`);
    if (detail !== undefined) {
      console.error(JSON.stringify(detail, null, 2));
    }
    process.exit(1);
  }

  function assert(condition, reason, detail) {
    if (!condition) {
      fail(reason, detail);
    }
  }

  function assertEqual(actual, expected, message) {
    try {
      deepStrictEqual(actual, expected);
    } catch {
      fail(message ?? "assertEqual mismatch", { actual, expected });
    }
  }

  return { fail, assert, assertEqual };
}

export async function startMockServer(handler) {
  const server = createServer(handler);
  await new Promise((resolvePromise, rejectPromise) => {
    const handleError = (error) => {
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
    throw new Error(
      `[verify-helpers] startMockServer expected TCP address, got: ${JSON.stringify(address)}`,
    );
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolvePromise, rejectPromise) => {
        server.close((error) => (error ? rejectPromise(error) : resolvePromise()));
      }),
  };
}

const tempDirsPendingCleanup = new Set();
let exitHookRegistered = false;

function ensureExitHook() {
  if (exitHookRegistered) return;
  exitHookRegistered = true;
  process.on("exit", () => {
    for (const dir of tempDirsPendingCleanup) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // best-effort
      }
    }
    tempDirsPendingCleanup.clear();
  });
}

export function createTempDir(prefix) {
  ensureExitHook();
  const normalized = prefix.endsWith("-") ? prefix : `${prefix}-`;
  const path = mkdtempSync(join(tmpdir(), normalized));
  tempDirsPendingCleanup.add(path);
  return {
    path,
    cleanup() {
      tempDirsPendingCleanup.delete(path);
      try {
        rmSync(path, { recursive: true, force: true });
      } catch {
        // best-effort
      }
    },
  };
}

export function createTempDb(prefix, fileName = "probeflash.sqlite") {
  const tempDir = createTempDir(prefix);
  const dbPath = join(tempDir.path, fileName);
  const db = new DatabaseSync(dbPath);
  return {
    path: tempDir.path,
    dbPath,
    db,
    cleanup() {
      try {
        db.close();
      } catch {
        // 已被脚本主动 close
      }
      tempDir.cleanup();
    },
  };
}
