---
name: atomic-task
description: 读真实状态 → 选唯一原子任务 → 执行 → 验证 → 同步 now.md → 单任务 commit → STOP；不自动顺推。合并自原 planning + task-execution + task-verification 三视角。
---

## when to use
- 一轮新工作开始；上下文重置后；上一任务 commit 完成后。
- 发现 `now.md` 与仓库实际脱节时（先修 `now.md` 再继续）。

## inputs
- 默认必读：`AGENTS.md`、`docs/planning/now.md`、`git status --short`、`git log --oneline -5`、当前任务直接相关代码或专项文档。
- 条件读取：候选池变化 → `backlog.md`；阶段切换 / 长期争议 → `decisions.md`；产品定义改 → `docs/product/产品介绍.md`；对外口径改 → `README.md`；命中 v0.2.0 前历史背景或归档审计 → `docs/archive/`。

## steps
1. 读 `AGENTS.md` / `docs/planning/now.md`，跑 `git status --short` 与 `git log --oneline -5`。
2. 若 `now.md` 与仓库实际脱节（任务已完成 / 阶段已切 / current_task 与代码不一致），**先修 `now.md` 再继续**；不允许在脱节状态下选任务。
3. 按 inputs 的"条件读取"决定是否进 `backlog.md` / `decisions.md` / `docs/product/` / `README.md` / `docs/archive/`；不命中不读。
4. 夜跑 / 无人值守 gate（参见 `AGENTS.md §7`）：若 current_task 或候选任务命中 SSH / sudo / systemd / `/opt` / 80/443 / 真实服务器 / 真实数据 / API key / 外部账号 / 用户拍板，必须停止并写 `now.md.blocked` 字段，**不得**夜跑认领。
5. 选下一任务时只能从依赖已满足、未完成的候选里取首个；不发散自找事；不跳过 frontier 顺序。
6. 仅围绕当前 current_task 修改文件；不混任务、不顺手重构。
7. 架构类任务（storage / repository / closeout / adapter / backend scaffold）必须落到工程接缝（接口 / service / adapter / error model / 后端脚手架），不能停在分析结论。
8. 执行 `AGENTS.md §6 Verify Matrix` 对应那一行的命令组合；exit code != 0 一律失败；docs / planning / skills-only 任务若跳过默认项必须明确写原因。
9. 归档类任务（IssueCard / InvestigationRecord / ErrorEntry / ArchiveDocument）必须做读回验证：文件存在、条目存在、必填字段非空、schema `safeParse` 通过；失败一律视为未完成并创建 repair task。
10. 同步 `now.md`：`current_task` / `frontier` / `blocked` / `night_run` / 最近完成（裁剪到 5 条）；yaml frontmatter 字段必须可被 `python3 -c "import yaml; yaml.safe_load(...)"` 解析。
11. 候选池增删 / 改名 / 重排时同步 `backlog.md`；产生新长期 ADR 时追加 `decisions.md`；产品定义 / 对外口径变化时同步对应文档。
12. Completion gate 三件套自检：(a) 最小验证已通过？(b) `now.md` 已更新？(c) 单任务 commit 已落？三者全齐才能放行。
13. 单任务 commit；commit message 对应单一任务结果；commit 后 `git status --short` 必须为空；不 push 除非用户明确要求。
14. **STOP**。下一任务必须重新进入本 skill 第 1 步，不得自动续推；连续失败两次必须升级人工确认。

## output
```json
{
  "taskId": "string",
  "changedFiles": ["string"],
  "verification": ["命令 + exit code"],
  "completionGate": "open | blocked",
  "commitHash": "string",
  "nowSyncedFields": ["current_task", "frontier", "blocked", "night_run", "recently_completed"],
  "nextStep": "回到本 skill 第 1 步"
}
```

## rules
- 同一时刻只允许一个原子任务处于执行中。
- `now.md.frontier` 不得超过 3 个候选；完整顺序在 `backlog.md`。
- 禁止凭旧计划机械顺推；禁止把"规划中"写成"已完成"；禁止把占位壳说成真实功能。
- 不得跳过 planning sync 或 commit 直接进入下一任务。
- README 不是内部事实源；产品介绍不是当前战况源；archive 不是默认事实源；三者只在职责命中时读取。
- 不读取、搜索、打印、总结或提交真实 API key；真实 provider smoke 由用户本地执行。
- 验证失败不得伪造完成；应创建 repair task 或回退；连续两次修复仍失败必须升级人工确认。
- `completionGate = blocked` 时禁止选下一任务；必须先解决 gate。
- 架构类任务若只有分析结论、没有工程化验证结果，一律视为未完成。
- 不恢复已硬删除的弱化文档；交接状态只写 `now.md`。
