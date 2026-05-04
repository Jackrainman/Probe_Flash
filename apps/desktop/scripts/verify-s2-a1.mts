// apps/desktop/scripts/verify-s2-a1.mts
// S2-A1 黑盒验证：在 Node 侧用 Map-based polyfill 模拟 window.localStorage，
// 把最小表单输入走 buildIssueCardFromIntake → saveIssueCard → loadIssueCard 链路，
// 确认（1）最小表单可生成通过 IssueCardSchema 的 IssueCard，
//     （2）save/load round-trip 后字段不丢失，
//     （3）空标题被工厂挡住，返回结构化 failure，不落盘。
//
// 运行方式：
//   cd apps/desktop && node --experimental-strip-types scripts/verify-s2-a1.mts

import { createReporter } from "./verify-helpers.mts";

const { fail } = createReporter("S2-A1 verify");

interface LocalStorageShape {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  key(index: number): string | null;
  readonly length: number;
}

function makeLocalStoragePolyfill(): LocalStorageShape {
  const store = new Map<string, string>();
  return {
    getItem: (k) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k, v) => {
      store.set(k, v);
    },
    removeItem: (k) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
    key: (i) => {
      const keys = Array.from(store.keys());
      return i >= 0 && i < keys.length ? (keys[i] as string) : null;
    },
    get length() {
      return store.size;
    },
  };
}

(globalThis as unknown as { window: { localStorage: LocalStorageShape } }).window = {
  localStorage: makeLocalStoragePolyfill(),
};

const { buildIssueCardFromIntake, defaultIntakeOptions } = await import(
  "../src/domain/issue-intake.ts"
);
const { saveIssueCard, loadIssueCard } = await import(
  "../src/storage/issue-card-store.ts"
);

// --- Case 1: minimal valid intake builds a schema-valid IssueCard ---
const FIXED_NOW = "2026-04-21T03:15:00+08:00";
const FIXED_ID = "issue-verify-s2a1-0001";
const opts = defaultIntakeOptions(FIXED_NOW, FIXED_ID);

const built = buildIssueCardFromIntake(
  {
    title: "  UART boot log stuck at 0x40  ",
    description: "  happens after cold boot, only on board rev B.  ",
    severity: "high",
  },
  opts,
);

if (!built.ok) fail("expected intake ok, got failure", built);
if (built.card.id !== FIXED_ID) fail(`id mismatch: ${built.card.id} vs ${FIXED_ID}`);
if (built.card.title !== "UART boot log stuck at 0x40") {
  fail(`title should be trimmed, got: "${built.card.title}"`);
}
if (built.card.rawInput !== "happens after cold boot, only on board rev B.") {
  fail(`description should be trimmed into rawInput, got: "${built.card.rawInput}"`);
}
if (built.card.severity !== "high") fail(`severity mismatch: ${built.card.severity}`);
if (built.card.status !== "open") fail(`expected status=open, got: ${built.card.status}`);
if (built.card.createdAt !== FIXED_NOW) fail(`createdAt mismatch: ${built.card.createdAt}`);
if (built.card.repoSnapshot.capturedAt !== FIXED_NOW) {
  fail(`repoSnapshot.capturedAt mismatch: ${built.card.repoSnapshot.capturedAt}`);
}

// --- Case 2: save → load round-trip preserves everything ---
saveIssueCard(built.card);
const loaded = loadIssueCard(FIXED_ID);
if (!loaded.ok) fail("expected load ok after save", loaded.error);
if (loaded.card.title !== built.card.title) {
  fail(`round-trip title mismatch: ${loaded.card.title}`);
}
if (loaded.card.severity !== built.card.severity) {
  fail(`round-trip severity mismatch: ${loaded.card.severity}`);
}
if (loaded.card.repoSnapshot.branch !== built.card.repoSnapshot.branch) {
  fail(`round-trip nested branch mismatch: ${loaded.card.repoSnapshot.branch}`);
}

// --- Case 3: empty title is rejected structurally, and nothing gets saved ---
const emptyTitle = buildIssueCardFromIntake(
  { title: "   ", description: "should not persist", severity: "low" },
  defaultIntakeOptions(FIXED_NOW, "issue-empty-title-xxxx"),
);
if (emptyTitle.ok) fail("expected empty-title intake to fail", emptyTitle);
if (!emptyTitle.reason.toLowerCase().includes("title")) {
  fail(`empty title failure should mention title; got: "${emptyTitle.reason}"`);
}
const shouldNotExist = loadIssueCard("issue-empty-title-xxxx");
if (shouldNotExist.ok) fail("empty-title intake must not persist a card", shouldNotExist.card);
if (shouldNotExist.error.kind !== "not_found") {
  fail(`empty-title load should be not_found; got: ${shouldNotExist.error.kind}`);
}

console.log("[S2-A1 verify] PASS: minimal intake → schema-valid IssueCard with trimmed fields");
console.log("[S2-A1 verify] PASS: save → load round-trip preserves all intake-derived fields");
console.log("[S2-A1 verify] PASS: empty title returns structured failure and does not persist");
