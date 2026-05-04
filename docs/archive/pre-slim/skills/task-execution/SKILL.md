---
name: task-execution
description: 执行由 planning 选定的唯一原子任务，完成文件修改、最小验证、交接更新和单任务提交；禁止在 commit 后机械进入下一任务。
---

## when to use
- 已经从 `planning` 明确了当前**唯一**原子任务。
- 需要把任务从“计划”落地为“文件变更 + 最小验证 + 交接更新 + commit”。

## inputs
```json
{
  "taskId": "string",
  "taskGoal": "string",
  "filesToChange": ["string"],
  "definitionOfDone": ["string"]
}
```

## steps
1. 确认 `docs/planning/current.md` 中的“当前唯一主线原子任务”与 `taskId` 一致；不一致时回到 `planning`。
2. 开始修改前，先从 `current.md` / `handoff.json` / `backlog.md` / `product-roadmap.md` 读出该任务的：目标、直接输入边界、不做项、工程化验证、完成定义；`status.md` 只能做概览，若缺字段，先补 planning。
3. 若处于夜跑 / 无人值守模式，先做 safety gate：只允许 repo-local、可自动验证、可回滚任务；若任务需要 SSH、sudo、systemd、真实服务器、外部账号、API key、路径 / 权限 / 端口确认、删除 / 迁移数据或产品拍板，必须停止并写清 handoff。
4. 仅围绕当前原子任务修改文件，不混入其他任务改动，不做顺手重构。
5. 若任务属于 `storage / repository / closeout / adapter / backend scaffold` 等架构类改动，必须落地为**可执行工程接缝**（接口、service/use-case、error model、adapter、后端脚手架等），不能只停在分析结论。
6. 执行最小验证：
   - 默认：`cd apps/desktop && npm run typecheck`、`npm run build`、`npm run verify:all`、`git diff --check`、`cd apps/desktop && npm run verify:handoff`；
   - docs / planning / skills-only 任务：至少做路径/内容/引用/JSON/`git diff --check` 验证；涉及归档移动时必须做移动前后引用检查与读回验证；若未跑默认项，必须明确写原因；
   - 架构/代码任务：除默认项外，还要补任务相关代码级验证与契约级验证，且覆盖成功态与失败态。
7. 更新 `docs/planning/current.md` 与 `.agent-state/handoff.json`；二者是 planning sync 必更文件。
8. 仅在职责命中时更新其他保留文档：
   - 当前前沿窗口或候选池变化时，更新 `docs/planning/backlog.md`。
   - 状态索引需要反映本轮变化时，更新 `docs/planning/status.md`；只覆盖当前状态，不追加流水账。
   - 长期规则、技术拍板或阶段级决策变化时，更新 `docs/planning/decisions.md`。
   - 产品定义、用户场景、领域模型或领域语言变化时，更新 `docs/product/产品介绍.md`。
   - 对外展示、快速开始、比赛/演示口径变化时，更新 `README.md`。
9. 执行一次 commit，message 对应单一任务结果。
10. 本 skill 到此结束；**不得**自动进入下一任务。下一任务必须由 `planning` 重新读取仓库后选择。

## Night Run / Unattended Mode
- 允许任务：docs / planning 整理、handoff 对齐、本地代码功能、本地 verify 脚本、单元测试 / smoke 脚本、backup / export 本地功能、AI-ready UI / prompt schema、code context bundle CLI、小型局部重构。
- 禁止任务：SSH 到服务器写入、sudo、systemd、写 `/opt`、操作 80/443、真实服务器部署、GitHub release / tag 删除、数据库 destructive migration、删除用户数据、修改真实生产数据、大规模 UI 重构、引入大型框架、需要用户拍板的产品方向、任何无法本地自动验证的任务。
- 停止条件：`git status --short` 不干净且无法归类；typecheck / build / verify 失败且无法在当前边界内修复；需要 SSH / sudo / systemd / 外部账号 / API key；需要用户确认路径、权限、端口、账号或密钥；涉及真实服务器；涉及删除 / 迁移数据；planning 与代码冲突且无法判断谁 stale；任务边界不清；连续两次修复验证仍失败；命令出现权限错误、网络错误或端口冲突但无法确定原因。
- 提交规则：每个原子任务单独 commit；提交前必须验证；提交后 `git status --short` 必须为空；不 push；不改 tag / release；不进入下一任务前留下脏工作区。
- 输出要求：夜跑结束必须输出已完成任务、每个任务 commit、验证结果、未完成任务、阻塞点、下一步最小动作、是否需要用户白天介入。
- 服务器任务：`S3-SERVER-USER-DIR-DEPLOY-VERIFY` 与任何真实服务器 / systemd / sudo 任务不能夜跑。

## output
```json
{
  "taskId": "string",
  "changedFiles": ["string"],
  "verification": ["string"],
  "commitMessage": "string",
  "commitHash": "string",
  "nextStep": "回到 planning skill 重新读取仓库并选择下一唯一任务"
}
```

## rules
- 未 commit 前不得进入下一个任务。
- commit 完成后也不得自动顺推，必须回到 `planning`。
- 遇到验证失败不得伪造完成状态；应创建修复任务或回退。
- 不得静默忽略工具错误和写盘失败。
- 不得恢复已硬删除的弱化文档；交接状态只写入 current 与机读 handoff。
- docs-only 任务若跳过默认验证，必须在汇报或交接中明确说明原因；不得默认省略。
- `docs/planning/status.md` 不得变成任务定义、长路线图或历史日志；任务执行依据仍是 current/backlog/product-roadmap/handoff。
- archive 只存历史输入；移动文档必须优先 move，不删除，并修正旧路径引用。
