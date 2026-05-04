// apps/desktop/scripts/verify-helpers.mts
// 共享 verify 脚本工具，提取自 50 个 verify 脚本中的重复模板。
// 任务：TECH-04-VERIFY-HELPERS（夜跑还债，纯本地）。
//
// 提供：
//   - createReporter(tag) → { fail, assert, assertEqual }
//       fail(reason, detail?) 复刻原本各脚本里 `[<tag>] FAIL: ${reason}` + JSON detail + process.exit(1) 的写法；
//       assert(condition, reason, detail?) 是 fail 的 boolean wrapper；
//       assertEqual(actual, expected, message?) 用 deepStrictEqual，相等校验失败时调用 fail。
//   - startMockServer(handler) → Promise<{ baseUrl, close }>
//       node:http loopback (127.0.0.1:0) 监听一个最小 handler，给 storage adapter / health check 等做契约 mock。
//   - createTempDir(prefix) → { path, cleanup }
//       mkdtempSync 在 os.tmpdir() 下开一个独立目录；进程退出（含 process.exit）自动 rmSync recursive force。
//   - createTempDb(prefix, fileName?) → { path, dbPath, db, cleanup }
//       在 createTempDir 之上叠一个 node:sqlite DatabaseSync 实例，cleanup 时先 db.close 再删目录。
//
// 使用样例：
//   import { createReporter, createTempDir } from "./verify-helpers.mts";
//   const { fail, assert, assertEqual } = createReporter("S2-A1 verify");
//   const tmp = createTempDir("probeflash-form-drafts");
//
// 设计边界（TECH-04 不做）：
//   - 不做 fixture 集中化（TECH-06）。
//   - 不做架构层级抽象、不依赖业务 schema。
//   - SIGINT/SIGTERM 不挂额外 handler；只挂 process.on("exit") 同步清理，
//     与现状一致（原本 mkdtempSync 完全不清理，此处只是补强为 best-effort）。

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { deepStrictEqual } from "node:assert";

export interface VerifyReporter {
  fail(reason: string, detail?: unknown): never;
  assert(condition: unknown, reason: string, detail?: unknown): asserts condition;
  assertEqual<T>(actual: T, expected: T, message?: string): void;
}

export function createReporter(tag: string): VerifyReporter {
  function fail(reason: string, detail?: unknown): never {
    console.error(`[${tag}] FAIL: ${reason}`);
    if (detail !== undefined) {
      console.error(JSON.stringify(detail, null, 2));
    }
    process.exit(1);
  }

  function assert(condition: unknown, reason: string, detail?: unknown): asserts condition {
    if (!condition) {
      fail(reason, detail);
    }
  }

  function assertEqual<T>(actual: T, expected: T, message?: string): void {
    try {
      deepStrictEqual(actual, expected);
    } catch {
      fail(message ?? "assertEqual mismatch", { actual, expected });
    }
  }

  return { fail, assert, assertEqual };
}

export interface MockServerHandle {
  baseUrl: string;
  close(): Promise<void>;
}

export async function startMockServer(
  handler: (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => void,
): Promise<MockServerHandle> {
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
    throw new Error(
      `[verify-helpers] startMockServer expected TCP address, got: ${JSON.stringify(address)}`,
    );
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolvePromise, rejectPromise) => {
        server.close((error) => (error ? rejectPromise(error) : resolvePromise()));
      }),
  };
}

const tempDirsPendingCleanup = new Set<string>();
let exitHookRegistered = false;

function ensureExitHook(): void {
  if (exitHookRegistered) return;
  exitHookRegistered = true;
  process.on("exit", () => {
    for (const dir of tempDirsPendingCleanup) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // best-effort：dir 可能已被显式 cleanup，或被 verify 脚本自己删掉。
      }
    }
    tempDirsPendingCleanup.clear();
  });
}

export interface TempDirHandle {
  path: string;
  cleanup(): void;
}

export function createTempDir(prefix: string): TempDirHandle {
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

export interface TempDbHandle extends TempDirHandle {
  dbPath: string;
  db: DatabaseSync;
}

export function createTempDb(
  prefix: string,
  fileName: string = "probeflash.sqlite",
): TempDbHandle {
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
        // 已被脚本主动 close；best-effort。
      }
      tempDir.cleanup();
    },
  };
}
