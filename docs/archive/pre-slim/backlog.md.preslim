# 待办池（Backlog）

> Backlog 只存未开做候选、节奏队列和任务池。路线图任务的完整字段见 `docs/planning/product-roadmap.md`；UI 小阶段任务字段见 `docs/planning/ui-redesign-brief.md`；当前唯一执行窗口见 `docs/planning/current.md`；快速状态索引见 `docs/planning/status.md`，但它不是事实源；机读队列见 `.agent-state/handoff.json`。

## 当前路线
- 当前版本基座：v0.2.x 本地 HTTP + SQLite + release 可部署基座。
- 路线图事实源：`docs/planning/product-roadmap.md`。
- 当前目标：近期 1 周先让部署可用、数据安全、可观测；B 组 night-safe 功能包、第一轮 UI 修补与 `REALAI-DEEPSEEK-CLOSEOUT-DRAFT-MINIMAL` 均已完成。当前不得自动执行下一轮 UI polish 或跳到其它 broad refactor。`SEARCH-01-BASIC-FULL-TEXT-SEARCH`、`SEARCH-02-FILTERS`、`SEARCH-04-TAGS`、`SEARCH-03-ARCHIVE-REVIEW-PAGE`、`SEARCH-07-SIMILAR-ISSUES-LITE`、`SEARCH-08-SEARCH-RESULT-LINKING`、`SEARCH-09-RECURRENCE-PROMPT`、`TECH-DEBT-SEARCH-KB-CLEANUP-LITE`、`UI-REDESIGN-STAGE-BRIEF`、`UI-01-INFORMATION-ARCHITECTURE-REVIEW`、`CORE-02-WORKSPACE-UX-IMPROVEMENTS`、`CORE-03-RECENT-ISSUE-REOPEN`、`CORE-06-CLOSEOUT-PARTIAL-SAVE-HINTS`、`AIREADY-05-DRAFT-HISTORY`、`UI-GATE-01-MANUAL-VISUAL-DIRECTION`、`TECH-07-APP-TSX-MINIMAL-SPLIT` 与 `PROJECT-STATUS-LEDGER-MINIMAL` 已完成，不再留在可认领池；UI 小阶段任务拆分见 `docs/planning/ui-redesign-brief.md`。
- 当前 blocked：真实 DeepSeek provider opt-in smoke（需要用户本地注入 key；AI 不读取密钥文件）。

## 认领规则
1. 每次只认领一个原子任务，完成前必须最小验证、planning sync、单任务 commit。
2. 白天主线优先 `DEP-01-RELEASE-USER-DIR-DEPLOY-VERIFY`，但该任务需要用户确认真实服务器边界。
3. 无服务器授权或夜跑时，只能从 `Night-safe pool` 认领第一个依赖已满足、repo-local、可自动验证、可回滚的任务。
4. 真实 AI 后续任务必须保持 server env key 边界；真实 key smoke 只能由用户本地执行，AI 不读取密钥文件。
5. Code context 先做 explicit bundle，不允许 server 任意扫描仓库路径。
6. 需要产品方向、数据保留、taxonomy、repo connector、权限/RAG 等拍板时，任务保持 `decision-needed`。
7. `docs/planning/status.md` 只用于快速概览，不得替代本文件、`current.md`、`product-roadmap.md` 或 `.agent-state/handoff.json` 做任务认领依据。

## B 组 night-safe 组合规划

> B 组可以一起规划，但仍必须一轮只执行一个原子任务、一次只提交一个 commit。任何任务若触发服务器、SSH、sudo、systemd、API key、真实数据迁移或人工产品拍板，立即停止并转为 blocked / day-only。

| 顺序 | 任务 ID | 类型 | 为什么在 B 组 |
|---|---|---|---|
| B1 | UI-01-INFORMATION-ARCHITECTURE-REVIEW | completed | 已补齐最终信息架构和 `CORE-02` 输入边界；未改 UI 代码。 |
| B2 | CORE-02-WORKSPACE-UX-IMPROVEMENTS | completed | 已改善当前项目身份、创建入口、workspace / issue 空态和错误态；新增对应 verify。 |
| B3 | CORE-03-RECENT-ISSUE-REOPEN | completed | 已支持当前 workspace 最近未归档问题刷新 / 重开恢复；缺失、已归档和 workspace 切换均安全降级。 |
| B4 | CORE-06-CLOSEOUT-PARTIAL-SAVE-HINTS | completed | closeout 失败时已保留输入并提示未归档成功、可重试或先处理 Repair Task。 |
| B5 | AIREADY-05-DRAFT-HISTORY | completed | 规则草稿历史已可审阅和清除；仍不接真实 AI。 |

## B 组后 UI / TECH 顺序

- 结论：B 组功能完成后，先进入受控 UI 修复链路；人工 UI gate 已通过，`TECH-07-APP-TSX-MINIMAL-SPLIT`、`UI-MOD-01-PRE-RELAYOUT-COMPONENT-SPLIT`、`UI-RELAYOUT-01-WORKBENCH-FIRST-PASS`、`UI-POLISH-02-COPY-TRIM` 与 `UI-POLISH-03-QUICK-ISSUE-LANDING-LAYOUT` 均已完成。当前必须停在快速建卡 landing 调整后的人工 review / smoke gate。
- 顺序：`UI-GATE-01-MANUAL-VISUAL-DIRECTION` completed -> `TECH-07-APP-TSX-MINIMAL-SPLIT` completed -> `UI-GATE-02-MANUAL-UI-POLISH-AFTER-SPLIT` completed/manual accepted -> `UI-MOD-01-PRE-RELAYOUT-COMPONENT-SPLIT` completed -> `UI-GATE-03-MANUAL-RUN-CHECK-BEFORE-RELAYOUT` completed/user approved -> `UI-RELAYOUT-01-WORKBENCH-FIRST-PASS` completed -> `UI-GATE-04` user-authorized copy trim -> `UI-POLISH-02-COPY-TRIM` completed -> `UI-GATE-05` user-authorized quick issue layout -> `UI-POLISH-03-QUICK-ISSUE-LANDING-LAYOUT` completed -> `UI-GATE-06-MANUAL-QUICK-ISSUE-LAYOUT-REVIEW` current/day-only。
- 暂不优先：`TECH-08-HTTP-REPOSITORY-SPLIT`、`TECH-09-SERVER-ROUTE-SPLIT`、`TECH-10-DATABASE-MODULE-SPLIT`，除非具体 storage / server 任务命中它们。

## 近期 1 周任务（最多 8 个）
目标：部署可用、数据安全、可观测。

| 顺序 | 任务 ID | 类型 | P | 备注 |
|---|---|---|---|---|
| 1 | DEP-01-RELEASE-USER-DIR-DEPLOY-VERIFY | completed | P0 | reboot 验证确认 |
| 2 | DEP-02-STATIC-DIST-SERVER-PATH-VERIFY | completed | P0 | Web UI 4100 正常 |
| 3 | DEP-03-VERSION-ENDPOINT-SERVER-VERIFY | completed | P0 | release v0.3.0 正常 |
| 4 | DEP-04-HEALTH-STATUS-SERVER-VERIFY | completed | P0 | /api/health 正常 |
| 5 | DATA-01-SQLITE-BACKUP-SERVER-PATH-VERIFY | current | P0 | day-only |
| 6 | DATA-03-RESTORE-DRY-RUN-SERVER-PATH-VERIFY | pending | P0 | 依赖 DATA-01 |
| 7 | DEP-07-RELEASE-UPDATE-ROLLBACK-PLAN | completed | P0 | 已完成；release update / rollback runbook 已接入 deploy-prep 静态检查 |
| 8 | DATA-04-INTEGRITY-CHECK | completed | P0 | 已完成；SQLite integrity check CLI 与失败注入 verify 已落地 |

## 近期 2-4 周任务（B 组已展开）
目标：搜索、AI-ready、code context bundle。

| 顺序 | 任务 ID | 类型 | P |
|---|---|---|---|
| 1 | CORE-01-QUICK-ISSUE-CREATE | completed | P1 |
| 2 | CORE-04-RECORD-TIMELINE-POLISH | completed | P1 |
| 3 | CORE-05-CLOSEOUT-UX-POLISH | completed | P1 |
| 4 | SEARCH-01-BASIC-FULL-TEXT-SEARCH | completed | P1 |
| 5 | SEARCH-02-FILTERS | completed | P1 |
| 6 | SEARCH-04-TAGS | completed | P1 |
| 7 | SEARCH-05-ERROR-CODE-TAXONOMY | decision-needed | P1 |
| 8 | SEARCH-07-SIMILAR-ISSUES-LITE | completed | P2 |
| 9 | UI-01-INFORMATION-ARCHITECTURE-REVIEW | completed | P1 |
| 10 | CORE-02-WORKSPACE-UX-IMPROVEMENTS | completed | P1 |
| 11 | CORE-03-RECENT-ISSUE-REOPEN | completed | P2 |
| 12 | CORE-06-CLOSEOUT-PARTIAL-SAVE-HINTS | completed | P2 |
| 13 | AIREADY-05-DRAFT-HISTORY | completed | P1 |
| 14 | AIREADY-06-DRAFT-DIFF | night-safe | P1 |
| 15 | CODECTX-01-BUNDLE-CLI | night-safe | P1 |
| 16 | CODECTX-02-SECRETS-PROTECTION | night-safe | P1 |

## 中期 1-2 月任务（含 UI gate 顺序）
目标：真实 AI、知识库、架构拆分。

| 顺序 | 任务 ID | 类型 | P |
|---|---|---|---|
| 1 | REALAI-01-PROVIDER-ABSTRACTION | completed | P1 |
| 2 | REALAI-02-SERVER-ENV-API-KEY-BOUNDARY | completed | P1 |
| 3 | REALAI-03-TIMEOUT-ERROR-STATE | completed | P1 |
| 4 | REALAI-04-POLISH-CLOSEOUT | completed | P1 |
| 5 | REALAI-05-SUMMARIZE-RECORDS | blocked | P1 |
| 6 | REALAI-06-SUGGEST-PREVENTION | blocked | P1 |
| 7 | CODECTX-04-ATTACH-BUNDLE-TO-ISSUE | night-safe | P1 |
| 8 | CODECTX-05-BUNDLE-VIEWER | night-safe | P1 |
| 9 | CODECTX-07-AI-ANALYZE-EXPLICIT-BUNDLE | blocked | P2 |
| 10 | SEARCH-03-ARCHIVE-REVIEW-PAGE | completed | P1 |
| 11 | UI-GATE-01-MANUAL-VISUAL-DIRECTION | completed | P1 |
| 12 | TECH-07-APP-TSX-MINIMAL-SPLIT | completed | P1 |
| 13 | UI-GATE-02-MANUAL-UI-POLISH-AFTER-SPLIT | completed | P1 |
| 14 | UI-MOD-01-PRE-RELAYOUT-COMPONENT-SPLIT | completed | P1 |
| 15 | UI-GATE-03-MANUAL-RUN-CHECK-BEFORE-RELAYOUT | completed | P1 |
| 16 | UI-RELAYOUT-01-WORKBENCH-FIRST-PASS | completed | P1 |
| 17 | UI-GATE-04-MANUAL-RELAYOUT-REVIEW | completed/user-authorized-copy-trim | P1 |
| 18 | UI-POLISH-02-COPY-TRIM | completed | P1 |
| 19 | UI-GATE-05-MANUAL-COPY-TRIM-REVIEW | completed/user-authorized-quick-issue-layout | P1 |
| 20 | UI-POLISH-03-QUICK-ISSUE-LANDING-LAYOUT | completed | P1 |
| 21 | UI-GATE-06-MANUAL-QUICK-ISSUE-LAYOUT-REVIEW | current/day-only | P1 |
| 22 | TECH-09-SERVER-ROUTE-SPLIT | night-safe | P2 |

## Post-0.3 / Hermes registry
- `AI-DRAFT-DEEPSEEK-SCHEMA-GUARD`：P1，bug / AI provider schema guard。closeout draft 只有在 task === `polish_closeout` 且字段完整时才显示 DeepSeek source；task mismatch / schema mismatch / 非法 JSON / 字段不完整时必须 fallback 到 rules/local，并新增 mock verify 覆盖 mismatch；live smoke 不进入 `verify:all`。
- `HERMES-EXPERIMENT-BOOTSTRAP`：P2，harness / experiment setup。登记 `experiment/hermes-post-0.3` 的实验接管说明与边界；source of truth 仍是 `AGENTS.md` / planning / handoff；不自动生成永久 skill、不改业务代码；分支创建和 `docs/hermes/BOOTSTRAP.md` 写入是后续手工动作，当前只登记不执行。

## 长期方向
- 团队级多项目知识库与轻量权限。
- 串口日志、CAN 报文、ROS topic、截图 / 照片 / 波形附件接入。
- repo connector allowlist 成熟后，再评估轻量索引、RAG 或 embedding。
- 归档报告 PDF/HTML 导出和周报 / 复盘报告生成。
- 模块级高频故障模式统计与预防清单。
- 更完整的局域网部署体验：反向代理、`.local`、HTTPS、美化域名。

## Night-safe pool
- CORE-07-ARCHIVE-FILTERS
- CORE-08-ERROR-ENTRY-TAGS
- CORE-09-DEMO-SEED-IMPORT
- AIREADY-02-PROMPT-SCHEMA-VERSIONING
- AIREADY-03-GOLDEN-DRAFT-FIXTURES
- AIREADY-06-DRAFT-DIFF
- AIREADY-07-APPLY-SAFETY
- AIREADY-08-MOCK-PROVIDER
- AIREADY-09-NO-API-KEY-UX
- AIREADY-10-PROMPT-PREVIEW-EXPORT
- CODECTX-01-BUNDLE-CLI
- CODECTX-02-SECRETS-PROTECTION
- CODECTX-03-BUNDLE-SCHEMA-FIXTURES
- CODECTX-04-ATTACH-BUNDLE-TO-ISSUE
- CODECTX-05-BUNDLE-VIEWER
- CODECTX-06-BUNDLE-SIZE-ERROR-HANDLING
- TECH-01-CLOSEOUT-ATOMICITY-DESIGN
- TECH-02-CLOSEOUT-ATOMICITY-RECOVERY
- TECH-03-WORKSPACEID-CONSISTENCY-LATER
- TECH-04-VERIFY-HELPERS
- TECH-05-VERIFY-TMP-CLEANUP
- TECH-06-SMOKE-FIXTURE-CONSOLIDATION
- TECH-08-HTTP-REPOSITORY-SPLIT
- TECH-09-SERVER-ROUTE-SPLIT
- TECH-10-DATABASE-MODULE-SPLIT

## Gated night-safe pool
- 当前没有可自动顺推的 UI 相关 repo-local 任务；`UI-POLISH-03-QUICK-ISSUE-LANDING-LAYOUT` 已完成。
- 当前必须停在 `UI-GATE-06-MANUAL-QUICK-ISSUE-LAYOUT-REVIEW`，不能夜跑越过人工检查门。

## Day-only pool
- DATA-01-SQLITE-BACKUP-SERVER-PATH-VERIFY
- DATA-03-RESTORE-DRY-RUN-SERVER-PATH-VERIFY
- UI-GATE-06-MANUAL-QUICK-ISSUE-LAYOUT-REVIEW

## Blocked by external
- DEP-08-RELEASE-UPDATE-ROLLBACK-VERIFY
- REALAI-05-SUMMARIZE-RECORDS
- REALAI-06-SUGGEST-PREVENTION
- REALAI-07-USER-REVIEW-BEFORE-APPLY
- REALAI-08-AI-DRAFT-AUDIT-METADATA
- REALAI-09-REAL-PROVIDER-OPT-IN-SMOKE
- CODECTX-07-AI-ANALYZE-EXPLICIT-BUNDLE

## Decision-needed
- DATA-06-BACKUP-RETENTION-POLICY
- DATA-07-RESTORE-APPLY-RUNBOOK
- SEARCH-05-ERROR-CODE-TAXONOMY
- SEARCH-06-TAG-HYGIENE-MERGE
- CODECTX-08-REPO-CONNECTOR-LATER-ALLOWLIST
- CODECTX-09-CONNECTOR-AUDIT-DENYLIST
- 长期是否做权限系统、多队伍协作、RAG/embedding、硬件日志自动接入。

## 当前先不做
- 不把真实服务器部署标记为 completed。
- 不在夜跑 / 无人值守模式下执行真实服务器、SSH、sudo、systemd、API key 或外部账号任务。
- 不把 AI-ready 等同于真实 AI 已接入。
- 不让 server 默认扫描任意仓库路径。
- 不引入 RAG / embedding 作为第一步。
- 不做权限系统、账号体系、多租户、复杂协同或公网暴露。
- 不做 Electron / preload / fs / IPC，不把 `.debug_workspace` 文件写盘当作当前主线。
- 不把 `docs/planning/status.md` 变成 backlog 副本、路线图副本或历史流水账。
- 不在 `UI-GATE-06-MANUAL-QUICK-ISSUE-LAYOUT-REVIEW` 人工 review / smoke 通过前执行下一轮 UI polish；不把快速建卡 landing 调整扩展成全量重写。
