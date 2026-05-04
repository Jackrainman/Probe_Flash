---
name: task-verification
description: 完成定义检查 + 读回验证 + completion gate 放行判断；决定当前任务是否允许进入“下一任务选择”。
---

## when to use
- 每个原子任务修改后、commit 前。
- 结案归档流程写盘后。
- `planning` 准备选择下一任务之前（最后一次把关）。

## inputs
```json
{
  "taskId": "string",
  "expectedArtifacts": ["string"],
  "validationChecks": ["string"],
  "toolResults": [
    { "name": "string", "exitCode": "number", "stderr": "string" }
  ]
}
```

## steps
1. 检查工具 exit code，非 0 直接判失败。
2. 检查产物路径存在且可读。
3. 对结构化输出执行 schema 校验（IssueCard / InvestigationRecord / ErrorEntry / ArchiveDocument）。
4. 对归档类任务执行读回验证（文件存在、条目存在、必填字段非空）。
5. 按任务类型检查验证矩阵：
   - 默认核对：`npm run typecheck`、`npm run build`、`npm run verify:all`、`git diff --check`、`verify:handoff`；
   - docs / planning / skills-only：至少核对路径、内容、引用、JSON.parse、`git diff --check`，若涉及 `docs/planning/status.md`，还要核对它未超长、未流水账化、未复制 backlog / product-roadmap 长表且未与 current/handoff 明显冲突；涉及归档移动时核对移动前后引用检查与 archive 读回，若缺少默认项必须有明确理由；
   - `storage / repository / closeout / adapter / backend scaffold`：除默认项外，必须看到任务相关代码级验证与契约级验证结果，并覆盖成功态与失败态。
6. 夜跑 / 无人值守 gate：若任务需要 SSH、sudo、systemd、真实服务器、外部账号、API key、路径 / 权限 / 端口确认、删除 / 迁移数据或产品拍板，验证状态必须是 blocked / needs_manual_review，不允许放行。
7. 执行 completion gate 三件事齐全性检查：
   - 最小验证已通过？
   - planning sync 是否已更新 `docs/planning/current.md` 与 `.agent-state/handoff.json`？
   - 是否已完成单任务 commit？
8. 若任务职责命中过候选池、长期决策、产品定义或对外展示文档，检查对应保留文档是否同步；未命中则不得要求默认更新。
9. 失败时返回 repair actions，明确禁止进入“下一任务选择”。

## output
```json
{
  "taskId": "string",
  "status": "passed|failed|needs_manual_review",
  "completionGate": "open|blocked",
  "failedChecks": ["string"],
  "repairActions": ["string"]
}
```

## rules
- 不得跳过验证步骤。
- 不得把部分成功当作全部成功。
- `completionGate = blocked` 时，禁止 `planning` 选择下一任务。
- 连续失败必须升级人工确认。
- 不得把 README 当作内部事实源；不得把产品介绍当作当前战况源。
- `docs/planning/status.md` 只是快速状态索引；验证时不得把它当最终事实源，也不得允许它膨胀为新上下文石山。
- 架构类任务若只有分析结论、没有工程化验证结果，一律视为未完成。
- 夜跑结束前必须核对：已完成任务、commit、验证结果、未完成任务、阻塞点、下一步最小动作、是否需要用户白天介入。
- archive 不是当前默认事实源；归档后必须读回验证，并确认旧路径引用已修正。
