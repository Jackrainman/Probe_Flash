# 关键决策（Decisions）

> 仅当前生效的长期 ADR；过期或被覆盖的（D-001~D-004、D-007、D-008、D-010~D-013、D-017）已归档到 `docs/archive/pre-slim/decisions.md.preslim`，git 历史与归档文件均可追溯。

## D-005：schema 校验采用 zod，不走手写 type guard 路线
- 日期：2026-04-21
- 决策：`apps/desktop` 的运行时 schema 校验统一使用 [`zod`](https://zod.dev)（v3.x）。类型与校验都以 zod schema 为单一事实源，通过 `z.infer` 派生 TS 类型；读盘、AI 输出入库均使用 `safeParse` 以拿到结构化错误。
- 原因：单一事实源避免双份漂移；`safeParse` 返回结构化 `error.issues[]`，满足"仅重生无效字段"的反馈闭环；4 个实体多嵌套场景下手写 guard 代码量过大；zod 是纯本地 devDep，不引入远端调用；tree-shakable，社区成熟。
- 放弃方案：手写 `is*` type guard（样板量大、易漂移）；`ajv` + JSON Schema（双源易脱节）；`valibot`（生态较薄）。
- 适用范围：`apps/desktop` 与后续 Node 侧统一用 zod；`.agents/skills/*/SKILL.md` 里的 JSON 示例仍是规则说明。

## D-006：S1-A3 本地存储采用浏览器 localStorage
- 日期：2026-04-21
- 决策：S1-A3 阶段 IssueCard 的本地持久化使用 `window.localStorage`，键名固定为 `repo-debug:issue-card:<id>`。读取后必须经 `IssueCardSchema.safeParse`：通过返回 `{ok:true, card}`；未命中 / JSON 损坏 / schema 不符返回结构化错误（`not_found` / `parse_error` / `validation_error`），不得静默降级。
- 原因：最短路径跑通 MVP 闭环，与 S1-A4 进度解耦；纯浏览器本地持久化，不引远端调用、不依赖额外 MCP；Node 侧用 Map polyfill 即可 round-trip 黑盒测试；覆盖"重开"语义。
- 放弃方案：`.debug_workspace/active/<issueId>.json`（需 fs/IPC 桥接）；IndexedDB（key-value 单实体场景过重）；内存单例（不跨刷新）。
- 适用范围：仅 S1-A3 IssueCard 持久化；后续 InvestigationRecord / ErrorEntry / ArchiveDocument 落盘归 S2 归档链路。当前主链路已迁到 HTTP + SQLite，localStorage 仅作 fallback / verify 路径。

## D-009：S3 切换为存储迁移与服务器化
- 日期：2026-04-22
- 决策：S3 阶段切换为"存储迁移与服务器化"。当前优先目标是把前端从 localStorage 演示版升级为同一 WiFi 下可访问、服务器端长期存储的版本。
- 本阶段不做：AI、RAG、权限系统、Electron、fs/IPC、大 UI 重构、复杂统计、云同步或公网多租户。
- 原因：局域网共享与服务器长期存储是从静态演示走向战队可用的最短路径；继续推 AI/Electron 不解决多设备共享与数据长期保存。
- 放弃方案：localStorage 强行演示团队共享；立刻写后端跳过环境盘点；转向 AI/RAG。
- 影响：`current_mode = server_storage_migration` 至今仍生效；本地 WSL 最小闭环已通，正在做服务器路径下数据安全验证（DATA-01/03）。

## D-014：服务器部署采用 release tarball first
- 日期：2026-04-26
- 决策：服务器部署以 GitHub Release tarball 为主路径：下载固定版本资产，校验 `SHA256SUMS.txt`，解压到 `/home/hurricane/probeflash/releases/vX.Y.Z`，独立 Node runtime 启动，`current` symlink 指向当前版本，SQLite/日志/env 保存在 `/home/hurricane/probeflash/shared/`；服务器不作为开发 checkout，`git pull` 只是开发/调试方式，非正式部署方式。
- 原因：release 部署可重复、可校验、可回滚；避免源码树漂移、误用系统 Node v10、误删持久数据或把开发态当生产；`current` symlink + `releases/` + `shared/` 让版本切换与数据持久化解耦。
- 放弃方案：服务器长期 `git pull`；把 `shared/data` 放进 release 目录；未校验 SHA256 直接运行；写 `/opt`；直接 systemd；抢占 80；升级全局 Node。
- 影响：DEP-01~06 已按此路径完成（含 systemd reboot 验证）；后续升级 / 回滚遵循同一约定。

## D-015：长期路线图重建为 8 条产品主线
- 日期：2026-04-26
- 决策：以 `docs/planning/roadmap.md` 为长期产品路线图事实源，把后续演进拆为 8 条主线：Deployment / Operability、Data Safety、Core Debug Workflow、Search / Knowledge Base、AI-ready Workflow、Real AI Assistance、Code Context Analysis、Technical Debt / Architecture。
- 原因：8 主线同时保留长期愿景与当前执行边界；近期仍先做部署可用、数据安全、可观测，避免在真实服务器未验证、API key 未确认时抢跑真实 AI 或 repo connector。
- 放弃方案：继续维护只围绕 S3/S4/AI 的短队列；把 AI/RAG/权限/代码扫描提前塞进当前入口；多文档重复维护当前战况长篇。
- 影响：`now.md` 只保留当前 P0 执行窗口与 ≤3 前沿候选；`backlog.md` 一行一候选；`roadmap.md` 保留 8 主线骨架不维护任务态字段。

## D-016：UI 大问题先进入受控 UI 修复链路，TECH-07 只作为中间支撑
- 日期：2026-04-30
- 决策：B 组 repo-local 功能完成后，优先进入受控 UI 修复链路而非先做 broad refactor；具体顺序：`UI-01` → `UI-GATE-01` → `TECH-07` → `UI-GATE-02` → `UI-MOD-01` → `UI-GATE-03` → `UI-RELAYOUT-01` → `UI-GATE-04` → `UI-POLISH-02` → `UI-GATE-05` → `UI-POLISH-03` → `UI-GATE-06`。每个 gate 必须等用户人工 review 通过才能继续。
- 原因：UI 是当前验收观感最大问题；UI 改动必须先有信息架构与人工方向确认；`TECH-07` 价值是降低 `App.tsx` 冲突面，不应独立变成技术洁癖式重构。
- 放弃方案：B 组后直接做 `TECH-08` / `TECH-09` / `TECH-10`；全量重写 `App.tsx`；绕过人工确认大改 UI；引入组件库或 broad CSS reset。
- 影响：UI gate 链已执行至 UI-GATE-06；当前必须停在用户人工 review 桌面/移动端观感，未通过前不得自动进入下一轮 polish。
