# Backlog

> 一行一候选；状态字段：`current` / `pending` / `night-safe` / `day-only` / `blocked` / `decision-needed` / `manual-review`。完整长期路线见 `roadmap.md`，当前唯一任务见 `now.md`，长期决策见 `decisions.md`。已完成的不留在此处，看 `git log` 与 `now.md` 最近完成。

## 认领规则
1. 每次只认领一个原子任务，未 commit 不进入下一任务。
2. 默认从首个"依赖已满足、未完成"的任务认领；不发散自找事。
3. 夜跑只能从 night-safe 池认领；命中 SSH/sudo/systemd/真实数据/真实服务器/API key 立即停。
4. blocked / decision-needed 任务不自动认领。

## 近期 P0（部署可用 + 数据安全 + 可观测）
- DATA-01-SQLITE-BACKUP-SERVER-PATH-VERIFY · current · day-only
- DATA-03-RESTORE-DRY-RUN-SERVER-PATH-VERIFY · pending · day-only · 依赖 DATA-01
- DATA-02-JSON-EXPORT-HARDEN · night-safe · P0
- DEP-09-LOGS-DIAGNOSTICS-BUNDLE · night-safe · P1

## UI gate 链（必须停在人工 review）
- UI-GATE-06-MANUAL-QUICK-ISSUE-LAYOUT-REVIEW · manual-review · day-only · 等用户人工检查桌面/移动端观感后才允许下一轮 UI polish

## Night-safe pool（可夜跑）
- AIREADY-02-PROMPT-SCHEMA-VERSIONING · P1
- AIREADY-03-GOLDEN-DRAFT-FIXTURES · P1
- AIREADY-06-DRAFT-DIFF · P1
- AIREADY-07-APPLY-SAFETY · P1
- AIREADY-08-MOCK-PROVIDER · P1
- AIREADY-09-NO-API-KEY-UX · P1
- AIREADY-10-PROMPT-PREVIEW-EXPORT · P1
- CODECTX-01-BUNDLE-CLI · P1
- CODECTX-02-SECRETS-PROTECTION · P1
- CODECTX-03-BUNDLE-SCHEMA-FIXTURES · P1
- CODECTX-04-ATTACH-BUNDLE-TO-ISSUE · P1
- CODECTX-05-BUNDLE-VIEWER · P1
- CODECTX-06-BUNDLE-SIZE-ERROR-HANDLING · P1
- CORE-07-ARCHIVE-FILTERS · P1
- CORE-08-ERROR-ENTRY-TAGS · P1
- CORE-09-DEMO-SEED-IMPORT · P2
- TECH-01-CLOSEOUT-ATOMICITY-DESIGN · P2
- TECH-02-CLOSEOUT-ATOMICITY-RECOVERY · P2
- TECH-03-WORKSPACEID-CONSISTENCY-LATER · P2
- TECH-04-VERIFY-HELPERS · P2
- TECH-05-VERIFY-TMP-CLEANUP · P2
- TECH-06-SMOKE-FIXTURE-CONSOLIDATION · P2
- TECH-08-HTTP-REPOSITORY-SPLIT · P2
- TECH-09-SERVER-ROUTE-SPLIT · P2
- TECH-10-DATABASE-MODULE-SPLIT · P2

## Day-only / 需要用户在线
- DATA-01-SQLITE-BACKUP-SERVER-PATH-VERIFY（同近期 P0）
- DATA-03-RESTORE-DRY-RUN-SERVER-PATH-VERIFY（同近期 P0）
- UI-GATE-06-MANUAL-QUICK-ISSUE-LAYOUT-REVIEW（同 UI gate 链）

## Blocked by external
- DEP-08-RELEASE-UPDATE-ROLLBACK-VERIFY · 等真实服务器测试 release
- REALAI-05-SUMMARIZE-RECORDS · 等 REALAI-09 真实 key smoke
- REALAI-06-SUGGEST-PREVENTION · 同上
- REALAI-07-USER-REVIEW-BEFORE-APPLY · 同上
- REALAI-08-AI-DRAFT-AUDIT-METADATA · 同上
- REALAI-09-REAL-PROVIDER-OPT-IN-SMOKE · 等用户本地 source DeepSeek env
- CODECTX-07-AI-ANALYZE-EXPLICIT-BUNDLE · 等真实 AI 通路 + bundle CLI

## Decision-needed
- DATA-06-BACKUP-RETENTION-POLICY · 备份保留策略
- DATA-07-RESTORE-APPLY-RUNBOOK · 真实恢复人工 runbook
- SEARCH-05-ERROR-CODE-TAXONOMY · 错误码分类法
- SEARCH-06-TAG-HYGIENE-MERGE · 标签合并/治理
- CODECTX-08-REPO-CONNECTOR-LATER-ALLOWLIST · repo connector allowlist
- CODECTX-09-CONNECTOR-AUDIT-DENYLIST · connector audit denylist
- 长期：权限系统、多队伍协作、RAG/embedding、硬件日志自动接入

## Post-0.3 / Hermes registry（不进入当前窗口）
- AI-DRAFT-DEEPSEEK-SCHEMA-GUARD · P1 · DeepSeek closeout draft schema guard + mismatch fallback verify
- HERMES-EXPERIMENT-BOOTSTRAP · P2 · `experiment/hermes-post-0.3` 实验接管说明与边界登记

## 当前不做
- 不在 UI-GATE-06 通过前执行下一轮 UI polish。
- 不把 AI-ready 当真实 AI 已接入；不把规划写成完成。
- 不做 RAG / embedding / 权限系统 / 多租户 / Electron / preload / fs / IPC。
- 不让 server 默认扫仓库；不读密钥文件。
- 不在夜跑模式执行真实服务器、SSH、sudo、systemd、API key、外部账号或删除/迁移真实数据任务。
