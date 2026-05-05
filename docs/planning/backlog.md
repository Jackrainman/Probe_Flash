# Backlog

> 一行一候选；状态字段：`current` / `pending` / `night-safe` / `day-only` / `blocked` / `decision-needed` / `manual-review`。完整长期路线见 `roadmap.md`，当前唯一任务见 `now.md`，长期决策见 `decisions.md`。已完成的不留在此处，看 `git log` 与 `now.md` 最近完成。

## 认领规则
1. 每次只认领一个原子任务，未 commit 不进入下一任务。
2. 默认从首个"依赖已满足、未完成"的任务认领；不发散自找事。
3. 夜跑只能从 night-safe 池认领；命中 SSH/sudo/systemd/真实数据/真实服务器/API key 立即停。
4. blocked / decision-needed 任务不自动认领。

## P0 — 技术债地基（夜跑纯还债 · night-safe）

| 任务 | 状态 | 依赖 | 具体内容 |
|------|------|------|----------|
| TECH-01-CLOSEOUT-ATOMICITY-DESIGN | done | — | closeout 写 ErrorEntry + ArchiveDocument 包 `BEGIN/COMMIT/ROLLBACK`；加 `closeout_state` 标记位（已落 server `closeoutIssue` + verify-server-closeout-atomicity） |
| TECH-02-CLOSEOUT-ATOMICITY-RECOVERY | done | TECH-01（done） | 启动扫 `closeout_state = pending`；`/api/.../closeout-recovery` GET/POST clear；前端 `CloseoutRecoveryPanel` 解除标记；server `verify-server-closeout-recovery` + desktop `verify-data-closeout-recovery-ux` |
| TECH-08-HTTP-REPOSITORY-SPLIT | done | — | 从 `server.mjs` 抽 `store.*` 调用成 `apps/server/src/repositories/*.mjs`（每 entity 一文件 + index 聚合）；HTTP handler 全部走 `repositories.<entity>.<method>` |
| TECH-09-SERVER-ROUTE-SPLIT | done | TECH-08（done） | 20+ 路由按 entity 拆到 `apps/server/src/routes/<entity>.mjs`；新增 `http/{responses,static,dispatcher}.mjs` + `config.mjs` + `closeoutRecoveryScan.mjs`；server.mjs 从 610 行瘦到 85 行 |
| TECH-10-DATABASE-MODULE-SPLIT | done | — | 1426 行 `database.mjs` 拆成 `apps/server/src/db/{constants,storage-error,validation,schema,lookups,workspace,issue,record,archive,errorEntry,formDraft,closeoutRecovery,search}.mjs`；database.mjs 退化为 89 行的协调器 |
| TECH-03-WORKSPACEID-CONSISTENCY-LATER | done | — | 已审 `apps/server/src/db/*.mjs` 全部 SELECT/UPDATE/DELETE 都按 workspace_id 过滤；新建 `verify-server-workspace-isolation.mjs` 覆盖 list/cross-GET/cross-PUT/cross-closeout/recovery scope/search/form-draft DELETE/orphan-row 7 层 |

**可并行组：**
- Group A（infra 串行）：TECH-04（done） → TECH-05（done） → TECH-06（done）
- Group B（closeout 串行）：TECH-01（done） → TECH-02（done）
- Group C（HTTP arch 串行）：TECH-08（done） → TECH-09（done）
- Group D（独立并行）：TECH-10（done）（DB 拆分，已与 Group C 并行完成）
- 扫尾：TECH-03（done）

夜跑跳过被阻塞的（没依赖前任务的）先做有依赖已完成或没依赖的。

> 整波技术债地基（TECH-01..10）全部完成；下一波继续 P1 AI-ready 任务（白天主线）。

## P1 — AI 草稿流准备（白天主线 · night-safe）

- AIREADY-02-PROMPT-SCHEMA-VERSIONING · P1 · 当前 prompt 升级后旧草稿自动兼容
- AIREADY-08-MOCK-PROVIDER · P1 · 不依赖真实 API 的开发调试工具，mock 响应
- AIREADY-03-GOLDEN-DRAFT-FIXTURES · P1 · 给典型 IssueCard/Record 预埋高质量 AI 草稿示例
- AIREADY-06-DRAFT-DIFF · P1 · 对比新旧草稿差异，辅助决定是否采纳
- AIREADY-07-APPLY-SAFETY · P1 · AI 输出内容保存前做 schema 校验，防脏数据
- AIREADY-09-NO-API-KEY-UX · P1 · 有 key 引导、无 key 接本地规则降级
- AIREADY-10-PROMPT-PREVIEW-EXPORT · P1 · 导出 prompt 模板供手动调试
- CODECTX-01-BUNDLE-CLI · P1 · 命令行打包指定代码文件为 JSON（不依赖 AI，可并行）

## P2 — 真实 AI 辅助（AIREADY 完成后 · day-only）

- REALAI-09-REAL-PROVIDER-OPT-IN-SMOKE · pending · day-only · 等用户 source env + AIREADY P1 完成
- REALAI-05-SUMMARIZE-RECORDS · pending · day-only · 依赖 REALAI-09
- REALAI-06-SUGGEST-PREVENTION · pending · day-only · 同上
- REALAI-07-USER-REVIEW-BEFORE-APPLY · pending · day-only · 同上
- REALAI-08-AI-DRAFT-AUDIT-METADATA · pending · day-only · 同上

## P3 — 代码上下文分析（REALAI 完成后）

- CODECTX-02-SECRETS-PROTECTION · P3 · night-safe · 打包时自动排除 `.env`、key 文件
- CODECTX-03-BUNDLE-SCHEMA-FIXTURES · P3 · night-safe · bundle 结构测试用例
- CODECTX-04-ATTACH-BUNDLE-TO-ISSUE · P3 · night-safe · UI 中关联/查看 bundle
- CODECTX-05-BUNDLE-VIEWER · P3 · night-safe · 页面内查看已打包代码内容
- CODECTX-06-BUNDLE-SIZE-ERROR-HANDLING · P3 · night-safe · 超阈值时提示精简或分批

## P4 — 核心调试流程（插空做）

- UI-GATE-06-MANUAL-QUICK-ISSUE-LAYOUT-REVIEW · manual-review · day-only · 等用户人工检查桌面/移动端观感
- CORE-07-ARCHIVE-FILTERS · P4 · night-safe · 按时间/标签/状态筛选归档
- CORE-08-ERROR-ENTRY-TAGS · P4 · night-safe · ErrorEntry 加自定义标签（可顺便做 tag manager）
- CORE-09-DEMO-SEED-IMPORT · P4 · night-safe · 一键导入示例 IssueCard/Record

## P5 — 搜索与知识库（插空做）

- SEARCH-06-TAG-HYGIENE-MERGE · P5 · night-safe · 最小方案：list API + merge API；后续 AI 辅助归并建议

## P6 — 数据安全（推后）

- DATA-01-SQLITE-BACKUP-SERVER-PATH-VERIFY · low-priority · day-only
- DATA-03-RESTORE-DRY-RUN-SERVER-PATH-VERIFY · low-priority · day-only · 依赖 DATA-01
- DATA-02-JSON-EXPORT-HARDEN · low-priority · night-safe
- DEP-09-LOGS-DIAGNOSTICS-BUNDLE · low-priority · night-safe

## P7 — 部署与运维（已稳定）

- DEP-08-RELEASE-UPDATE-ROLLBACK-VERIFY · blocked · 等真实服务器测试 release

## Blocked by external

- REALAI-05~09 全部 REALAI 任务 · 等用户 source DeepSeek env + AIREADY P1 完成
- CODECTX-07-AI-ANALYZE-EXPLICIT-BUNDLE · 等 REALAI 通路 + bundle CLI
- DEP-08-RELEASE-UPDATE-ROLLBACK-VERIFY · 等真实服务器测试 release

## Decision-needed

- DATA-06-BACKUP-RETENTION-POLICY · 备份保留策略
- DATA-07-RESTORE-APPLY-RUNBOOK · 真实恢复人工 runbook
- SEARCH-05-ERROR-CODE-TAXONOMY · 错误码分类法（Tag 方案够用可跳过）
- 长期：权限系统、多队伍协作、RAG/embedding、硬件日志自动接入

## Post-0.3 / Hermes registry（不进入当前窗口）

- AI-DRAFT-DEEPSEEK-SCHEMA-GUARD · P1 · DeepSeek closeout draft schema guard + mismatch fallback verify
- HERMES-EXPERIMENT-BOOTSTRAP · P2 · `experiment/hermes-post-0.3` 实验接管说明与边界登记（搁置）

## 当前不做

- 不在 UI-GATE-06 通过前执行下一轮 UI polish。
- 不把 AI-ready 当真实 AI 已接入；不把规划写成完成。
- 不做 RAG / embedding / 权限系统 / 多租户 / Electron / preload / fs / IPC。
- 不让 server 默认扫仓库；不读密钥文件。
- 不在夜跑模式执行真实服务器、SSH、sudo、systemd、API key、外部账号或删除/迁移真实数据任务。
- 不执行 CODECTX-08/09（repo connector 白/黑名单——当前无自动扫描功能，已删除）。

(End of file - total 90 lines)
