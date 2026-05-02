# 当前执行面板（Current）

> 本文件只维护当前阶段目标、前沿任务窗口、唯一主线原子任务与下一任务选择规则。快速状态索引见 `docs/planning/status.md`，但它不是最终事实源；完整产品路线图见 `docs/planning/product-roadmap.md`；候选池与节奏见 `docs/planning/backlog.md`；机读状态见 `.agent-state/handoff.json`。v0.2.0 前历史专项输入已归档到 `docs/archive/v0.2-closeout/`，默认不读。

## 当前阶段
- 阶段：**R1：长期产品路线图执行启动**。
- 当前模式：`server_storage_migration`（保留服务器部署安全边界）。
- 阶段目标：**v0.3.0 已发布**（59 commits since v0.2.0），包含 DeepSeek AI 草稿接入、搜索能力套件、workflow 表单持久化、服务器备份/恢复/诊断、release 部署准备。已知 DeepSeek AI 草稿存在 `output.task` 类型校验边界问题（代码侧已分析，fix plan 已制定），不影响本地规则降级路径。post-0.3 / Hermes 备案项 `AI-DRAFT-DEEPSEEK-SCHEMA-GUARD` 与 `HERMES-EXPERIMENT-BOOTSTRAP` 已登记到 planning / handoff，但当前不进入执行窗口。近期 P0 仍关注 **部署可用、数据安全、可观测**。
- 路线图事实源：`docs/planning/product-roadmap.md`。
- 最近已完成：`CORE-CLOSEOUT-CONTINUATION-UX`、追记入口 UI hotfix、`CORE-FORM-DRAFT-SERVER-PERSISTENCE`，已完成 workflow 表单 localStorage 草稿保存 / 恢复 / 清除、已归档问题卡取消归档后回到 investigating 且保留 ArchiveDocument / ErrorEntry 历史、DeepSeek closeout prompt 改为 server-side 基于 issue/records 构造、问题卡详情页只保留一个“排查追记”卡片并默认收起字段、保留草稿提示；追记表单与结案表单兄弟 key 已拆分命名空间，浏览器 DOM 验证连续切换问题卡后追记表单数量保持 1；未读取或提交真实 key，未做真实 provider smoke，未自动写库。

## 当前真实状态
- 已完成：本地 HTTP + SQLite 主链路、workspace 创建 / 切换、workspace UX improvements、recent issue reopen、closeout failure input preservation hints、AI-ready draft history、issue / record / closeout / archive / error-entry 主路径、basic full-text search、search filters、search tags、archive review page、similar issues lite、search result linking、recurrence prompt、search / KB verify fixture cleanup、UI redesign stage brief、UI information architecture review、App.tsx minimal split、UI pre-relayout component split、UI relayout first pass、quick issue create、record timeline polish、closeout UX polish、closeout continuation UX、investigation append collapsed entry hotfix 与 sibling key namespace fix、form draft server persistence（四类表单草稿 HTTP + SQLite 持久化 + localStorage fallback）、`ErrorEntry.prevention` 非空修复、release tarball 部署规划、server 同端口服务 `dist` + `/api`、AI-ready prompt templates、rule-based closeout draft panel、DeepSeek closeout draft minimal integration、server schema contract、HTTP feedback contract、restore dry-run、SQLite integrity check、JSON export hardening、partial closeout recovery verify、repair task generation、diagnostics bundle、night-run 安全规则、v0.2 历史文档归档、lightweight project status ledger、refactor necessity audit。
- 技术债审计：`docs/planning/refactor-assessment.md` 仍作为 TECH-07 背景输入；`SEARCH-07` 与 `UI-GATE-01` 已完成，当前没有必须先做的 broad refactor gate；大文件和重复逻辑存在但不阻塞 DEP-01 / TECH-07。
- UI 改造状态：`docs/planning/ui-redesign-brief.md` 已完成信息架构审查与 `UI-GATE-01` 人工确认记录，`TECH-07` 最小支撑拆分、`UI-MOD-01` 行为保持模块化拆分、`UI-RELAYOUT-01` 第一轮工作台重排、`UI-POLISH-02-COPY-TRIM` 文案瘦身和 `UI-POLISH-03-QUICK-ISSUE-LANDING-LAYOUT` 均已完成。当前必须停止在 `UI-GATE-06-MANUAL-QUICK-ISSUE-LAYOUT-REVIEW`，等待用户人工检查桌面端和移动端观感，不得自动进入下一轮 UI polish。
- 仍 blocked：真实 DeepSeek provider opt-in smoke（需要用户本地创建 env 并启动 server；AI 不读取 key）。
- 服务器安全边界仍有效：不 sudo、不写 `/opt`、不抢 80、不升级系统 Node、不影响 filebrowser / vnt-cli / docker / Portainer；release 部署优先 `/home/hurricane/probeflash` + 独立 Node runtime + 4100。
- AI 安全边界仍有效：DeepSeek closeout 草稿最小链路已完成；API key 只来自 server env，AI 不读取密钥文件，不把 key 写入代码 / Git / 日志；AI 只返回草稿，不直接写库。
- Code context 安全边界仍有效：先做用户显式生成的 bundle；server 不任意扫描仓库；repo connector 只作为后续 decision-needed 项。
- release notes 里的 post-0.3 / Hermes 备案项 `AI-DRAFT-DEEPSEEK-SCHEMA-GUARD`、`HERMES-EXPERIMENT-BOOTSTRAP` 已补入 backlog / handoff；当前不进入执行窗口，也不影响 DEP-01 / UI-GATE-06。

## 8 条产品主线
1. Deployment / Operability：服务器稳定运行、可更新、可诊断。
2. Data Safety：数据不丢、可备份、可恢复。
3. Core Debug Workflow：现场记录和结案更快、更顺。
4. Search / Knowledge Base：历史问题能找回、能复用。
5. AI-ready Workflow：先把 AI 草稿流和 prompt schema 做稳，不依赖真实 API。
6. Real AI Assistance：真实 AI 帮助优化措辞、总结排查、建议预防。
7. Code Context Analysis：AI 能基于用户显式提供的代码上下文分析问题。
8. Technical Debt / Architecture：避免越跑越石山。

## 已完成服务器部署验证（DEP-01 ~ DEP-06）
- **DEP-01-RELEASE-USER-DIR-DEPLOY-VERIFY** ✅ 已完成（reboot 后验证确认）。
- **DEP-02-STATIC-DIST-SERVER-PATH-VERIFY** ✅ 已完成（Web UI 在 4100 正常服务）。
- **DEP-03-VERSION-ENDPOINT-SERVER-VERIFY** ✅ 已完成（release v0.3.0 正常返回）。
- **DEP-04-HEALTH-STATUS-SERVER-VERIFY** ✅ 已完成（`/api/health` 正常返回）。
- **DEP-05/06-SYSTEMD-AUTOSTART** ✅ 已完成（`probeflash.service` enabled，reboot 后自动恢复并 active）。
- 部署结果确认：`/home/hurricane/probeflash/releases/v0.3.0`、独立 Node runtime、4100 端口、`shared/data/probeflash.sqlite`、filebrowser 80 端口不受影响。

## 已完成 repo-local UI 改造任务（不能继续顺推 UI polish）
- **UI-RELAYOUT-01-WORKBENCH-FIRST-PASS**
  - 目标：完成第一轮 UI 层级重排，让 ProbeFlash 主界面更像清晰的问题工作台。
  - 当前状态：`completed`；repo-local；已完成并进入人工 review / smoke gate。
  - 已完成：QuickIssue landing 替代默认完整建卡大表单；快速建卡新增 severity 选择并默认 / reset 为 `medium`；workbench 形成 Issue rail / Issue main flow / Knowledge Assist supporting rail；recurrence、related、similar、search 统一进入 Knowledge Assist；旧编号文案已删除。
  - 明确未做：未改 schema、repository contract、HTTP API、server、真实 AI、RAG / embedding、Electron / fs / IPC、dashboard / console / new app；未改变 closeout/search/record 业务语义。
  - 验证方式：`git diff --check`、`python3 -m json.tool .agent-state/handoff.json >/dev/null`、`cd apps/desktop && npm run typecheck`、`cd apps/desktop && npm run build`、`cd apps/desktop && npm run verify:handoff`、`cd apps/desktop && npm run verify:all`，并记录相关 verify 与浏览器人工 smoke 状态。
  - 完成定义：自动验证通过并单任务 commit；完成后必须停止在 `UI-GATE-04-MANUAL-RELAYOUT-REVIEW`，等待用户检查桌面端和移动端观感。

- **UI-POLISH-02-COPY-TRIM**
  - 目标：删除或压缩页面中过多的讲解性文字，只保留必要操作提示与状态判断信息。
  - 当前状态：`completed`；repo-local；等待人工 review / smoke。
  - 已完成：顶部健康详情删除 DB class / 默认项目成功态信息，项目与工作台入口、Knowledge Assist、追记、归档和结案辅助说明压缩；服务器 / 存储错误态、Repair Task、AI-ready 未接真实 AI、文件写盘未接入等边界说明保留。
  - 明确未做：未改 schema、repository contract、HTTP API、server、真实 AI、RAG / embedding、Electron / fs / IPC、业务数据流或状态判断逻辑。

- **UI-POLISH-03-QUICK-ISSUE-LANDING-LAYOUT**
  - 目标：在未选中问题时放大快速建卡主卡，让它占据原“最小演示路径 / 辅助验证”区域；辅助验证下移为测试入口。
  - 当前状态：`completed`；repo-local；等待人工 review / smoke。
  - 已完成：移除 landing 中的最小演示路径；快速建卡卡片加大；辅助验证移动到“未选中问题”提示框下方并标注“仅测试”。
  - 明确未做：未改 schema、repository contract、HTTP API、server、真实 AI、RAG / embedding、Electron / fs / IPC、业务数据流或存储语义。

## 当前唯一执行中的原子任务
- **DATA-01-SQLITE-BACKUP-SERVER-PATH-VERIFY**
  - 目标：在服务器 `/home/hurricane/probeflash/shared/data` 路径下验证 SQLite 备份/恢复流程，确认 WAL 文件不会被漏备，备份可完整恢复。
  - 当前状态：`current`；P0；day-only。
  - 直接输入边界：只改服务器 `shared/data` 备份脚本、仓库内 backup/restore 文档；不碰 server 业务代码、schema、UI 或 AI。
  - 明确不做：不建立备份保留策略（需用户拍板）；不接远程备份/云存储；不修改 SQLite schema；不改变生产数据。
  - 验证方式：服务器端备份命令 + 恢复 dry-run；确认备份文件包含主 DB + WAL 完整性；确认恢复后数据可读。
  - 完成定义：`shared/data` 备份/恢复流程可执行；WAL 文件不遗漏；恢复后数据与原始一致；操作文档完整。

## 当前前沿任务窗口（最多 3 个候选）
- **DATA-01-SQLITE-BACKUP-SERVER-PATH-VERIFY**
  - 状态：`current`；P0；day-only。
  - 选择理由：systemd 自启已验证，下一步最该补的是数据安全——确认备份/恢复流程不丢数据、不遗漏 WAL。
- **DATA-03-RESTORE-DRY-RUN-SERVER-PATH-VERIFY**
  - 状态：`pending`；P0；day-only；依赖 DATA-01。
  - 选择理由：备份验证后必须验证恢复流程可实际执行。
- **UI-GATE-06-MANUAL-QUICK-ISSUE-LAYOUT-REVIEW**
  - 状态：`manual-review`；P1；day-only。
  - 选择理由：快速建卡 landing 调整后仍只能由用户人工检查桌面端和移动端观感。

## 下一步最小可执行动作
- 本轮默认：`DATA-01-SQLITE-BACKUP-SERVER-PATH-VERIFY` 执行中。
- 用户侧最小动作：在服务器执行备份命令，确认 `shared/data/probeflash.sqlite` 及其 WAL 文件被完整复制到备份目录。
- 下一轮选择：DATA-01 完成后进入 DATA-03 恢复 dry-run 验证；DEP 部署系列已全部完成。

## 下一任务选择流程
1. 可以先读 `docs/planning/status.md` 获取概览，但不得只凭它认领或执行任务。
2. 默认读取：`AGENTS.md`、本文件、`.agent-state/handoff.json`、`git status --short`、`git log --oneline -5`、当前任务直接相关文件。
3. 完整路线图、字段和节奏读取 `docs/planning/product-roadmap.md`。
4. 候选池和任务池读取 `docs/planning/backlog.md`。
5. 阶段切换或长期拍板读取 `docs/planning/decisions.md`。
6. README 只在对外展示 / 快速开始 / release 口径变化时读取；产品介绍只在产品定义 / 领域语言变化时读取。
7. Archive 只在 v0.2 前历史背景、专项实现追溯或归档审计时读取。
8. 每次只允许认领一个原子任务；完成前必须最小验证、planning sync、单任务 commit。
9. 夜跑遇到服务器、SSH、sudo、systemd、API key、外部账号、删除 / 迁移真实数据或产品拍板，必须停止。

## DoD / Verification Expectation
- planning-only 任务最小验证：`git diff --check`、`python3 -m json.tool .agent-state/handoff.json >/dev/null`、`cd apps/desktop && npm run verify:handoff`、`git status --short`；若涉及 `docs/planning/status.md`，同时核对其不超长、不流水账化、不复制 backlog / product-roadmap 长表。
- deploy docs / deploy verify 任务最小验证：`git diff --check`、`cd apps/server && npm run verify:deploy-prep`、`python3 -m json.tool .agent-state/handoff.json >/dev/null`、`cd apps/desktop && npm run verify:handoff`、`git status --short`。
- server script / package 任务验证：`git diff --check`、任务对应 server verify、`cd apps/server && npm run verify:s3-local-backend-scaffold`、`cd apps/server && npm run verify:deploy-prep`、`cd apps/desktop && npm run typecheck`、`cd apps/desktop && npm run build`、`cd apps/desktop && npm run verify:handoff`、`cd apps/desktop && npm run verify:all`、`python3 -m json.tool .agent-state/handoff.json >/dev/null`。
- data repair task 任务验证：`git diff --check`、`python3 -m json.tool .agent-state/handoff.json >/dev/null`、`cd apps/server && npm run verify:data-integrity-check`、`cd apps/desktop && npm run verify:data-repair-task-generation`、`cd apps/desktop && npm run typecheck`、`cd apps/desktop && npm run build`、`cd apps/desktop && npm run verify:handoff`、`cd apps/desktop && npm run verify:all`。
- desktop UI / core workflow 任务验证：`git diff --check`、任务对应 `cd apps/desktop && npm run verify:*`、`cd apps/desktop && npm run typecheck`、`cd apps/desktop && npm run build`、`cd apps/desktop && npm run verify:handoff`、`cd apps/desktop && npm run verify:all`、`python3 -m json.tool .agent-state/handoff.json >/dev/null`。
- search / knowledge base 任务验证：`git diff --check`、`python3 -m json.tool .agent-state/handoff.json >/dev/null`、任务对应 server verify、任务对应 desktop verify、`cd apps/desktop && npm run typecheck`、`cd apps/desktop && npm run build`、`cd apps/desktop && npm run verify:handoff`、`cd apps/desktop && npm run verify:all`。
- `docs/planning/current.md` 与 `.agent-state/handoff.json` 是每轮 planning sync 必更；任务池或路线变化时同步 `docs/planning/backlog.md`；状态摘要变化时可覆盖更新 `docs/planning/status.md`；长期拍板变化时同步 `docs/planning/decisions.md`。
