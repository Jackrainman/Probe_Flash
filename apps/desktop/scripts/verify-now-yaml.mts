// apps/desktop/scripts/verify-now-yaml.mts
// 替代原 verify-handoff-json.mts。文档瘦身后 .agent-state/handoff.json 已归档到
// docs/archive/pre-slim/agent-state/handoff.json，机读字段下沉到
// docs/planning/now.md 顶部的 ```yaml ... ``` 块。
//
// 本脚本的职责：把 AGENTS §6 Verify Matrix 里的"now.md yaml 可解析"做成可复用命令，
// 顺带做最小结构校验，避免每次夜跑用 `node -e` 手跑或依赖 python+pyyaml。
//
// 只做最小校验，不引入 yaml 依赖：
//   - now.md 存在、可读
//   - 文件含一个 ```yaml ... ``` 代码块
//   - 块内必须包含 mode: / stage: / current_task: / frontier: 顶层 key
//   - current_task 行必须有非空字符串值
//   - frontier 之后必须至少一行 "- xxx" 列表项
//
// 不检查语义（mode 枚举值、frontier 上限 3 个、blocked 字段等），那是 atomic-task
// skill 与人类 review 的职责，不是结构校验的职责。
//
// 运行方式：
//   cd apps/desktop && node --experimental-strip-types scripts/verify-now-yaml.mts
//   或：cd apps/desktop && npm run verify:now-yaml

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createReporter } from "./verify-helpers.mts";

const { fail } = createReporter("verify-now-yaml");
const NOW_PATH = resolve(process.cwd(), "..", "..", "docs", "planning", "now.md");

let raw: string;
try {
  raw = readFileSync(NOW_PATH, "utf8");
} catch (err) {
  fail(
    `cannot read ${NOW_PATH}. Run this script from apps/desktop/ or fix the path.`,
    err instanceof Error ? err.message : err,
  );
}

const yamlMatch = raw.match(/```yaml\n([\s\S]*?)\n```/);
if (!yamlMatch) {
  fail("no ```yaml ... ``` block found in now.md");
}

const block = yamlMatch![1];

const REQUIRED_KEYS = ["mode", "stage", "current_task", "frontier"] as const;
for (const key of REQUIRED_KEYS) {
  const re = new RegExp(`^${key}\\s*:`, "m");
  if (!re.test(block)) {
    fail(`required top-level key "${key}" missing in yaml block`);
  }
}

const currentTaskMatch = block.match(/^current_task\s*:\s*(.+?)\s*$/m);
if (!currentTaskMatch || currentTaskMatch[1].length === 0) {
  fail("current_task missing a non-empty value");
}
const currentTask = currentTaskMatch[1].trim();

const modeMatch = block.match(/^mode\s*:\s*(.+?)\s*$/m);
const mode = modeMatch ? modeMatch[1].trim() : "(unknown)";

const stageMatch = block.match(/^stage\s*:\s*(.+?)\s*$/m);
const stage = stageMatch ? stageMatch[1].trim() : "(unknown)";

// frontier: must be followed by at least one "- xxx" list line
const frontierBlockMatch = block.match(/^frontier\s*:\s*\n((?:\s*-\s+.+\n?)+)/m);
if (!frontierBlockMatch) {
  fail("frontier list is empty or malformed (need at least one `- xxx` entry)");
}
const frontierLines = frontierBlockMatch![1]
  .split("\n")
  .filter((l) => /^\s*-\s+/.test(l));

console.log(`[verify-now-yaml] PASS: ${NOW_PATH} has parseable yaml block`);
console.log(
  `[verify-now-yaml] PASS: mode=${mode}, stage=${stage}, current_task=${currentTask}`,
);
console.log(`[verify-now-yaml] PASS: frontier_entries=${frontierLines.length}`);
