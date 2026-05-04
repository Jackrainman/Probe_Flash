# ProbeFlash 长期路线图

> 长期愿景与 8 主线骨架；不维护任务执行字段（current/pending/状态/依赖/优先级搬到 `backlog.md` 与 `now.md`）。完整 v0.3 前的字段化路线图与历史展开见 `docs/archive/pre-slim/product-roadmap.md`。

## 0. 当前定位

### 产品愿景
ProbeFlash 是面向机器人 / 嵌入式战队调试现场的闭环软件：问题记录 → 排查过程组织 → 结案归档 → 错误表沉淀 → 历史问题检索 → AI 辅助措辞 / 总结 / 分析 → 代码上下文辅助定位 → 长期知识库。

### 当前已完成基座（v0.3.0 已发布）
- 本地 HTTP + SQLite 主链路；workspace 创建 / 切换。
- issue / record / closeout / archive / error-entry 主路径；草稿（四类表单）HTTP+SQLite 持久化 + localStorage fallback。
- search / tags / archive review / similar issues lite / search result linking / recurrence prompt。
- AI-ready prompt schema、rule-based closeout draft panel、DeepSeek 结案草稿最小链路（代码侧已完成，真实 key smoke 待用户）。
- release tarball 部署、`/home/hurricane/probeflash` 用户目录部署 + systemd 自启（reboot 验证通过）；同端口 4100 服务 `dist` + `/api`；version / health endpoint 可读。
- restore dry-run、SQLite integrity check、JSON export、partial closeout recovery、repair task generation、diagnostics bundle、night-run 安全规则、UI 信息架构 + 重排 + copy trim + quick issue layout 第一轮。

### 当前主要阻塞
- 真实 AI provider opt-in smoke（需用户本地 source DeepSeek env，AI 不读密钥文件）。
- 数据备份/恢复仍需服务器路径下复验（DATA-01 进行中）。

## 1. Deployment / Operability
**目标**：服务器稳定运行、可更新、可诊断。

- 已完成：release 用户目录部署、4100 同端口 Web+API、health/version 端点、systemd 自启 reboot 验证、release update / rollback runbook、最小 diagnostics bundle 设计。
- 进行中：无（DEP 主线已通过近期 P0）。
- 后续：实测 release 切换与回滚（DEP-08，等真实测试 release）；反向代理 / `.local` / HTTPS / 美化域名（长期）。

## 2. Data Safety
**目标**：数据不丢、可备份、可恢复。

- 已完成：本地 backup/export/restore dry-run、SQLite integrity check、partial closeout recovery、repair task generation。
- 进行中：服务器 `shared/data` 路径下备份/恢复复验（DATA-01 → DATA-03）。
- 后续 / 拍板：备份保留策略（DATA-06）、恢复 apply runbook（DATA-07）。

## 3. Core Debug Workflow
**目标**：现场记录和结案更快、更顺。

- 已完成：quick issue create、record timeline polish、closeout UX polish、closeout partial save hints、recent issue reopen、workspace UX improvements、CORE-FORM-DRAFT-SERVER-PERSISTENCE、closeout continuation UX、追记 sibling key namespace fix。
- 后续：archive filters、error entry tags、demo seed import；附件接入（截图 / 波形 / 串口日志 / CAN / ROS topic）属长期方向。

## 4. Search / Knowledge Base
**目标**：历史问题能找回、能复用。

- 已完成：basic full-text search、filters、tags、archive review page、similar issues lite、search result linking、recurrence prompt。
- 后续 / 拍板：错误码分类法（SEARCH-05）、标签治理与合并（SEARCH-06）。
- 长期：模块级故障模式统计、归档报告 PDF/HTML 导出、周报 / 复盘报告生成、轻量索引 / RAG / embedding（在 repo connector allowlist 成熟后再评估）。

## 5. AI-ready Workflow
**目标**：先把 AI 草稿流和 prompt schema 做稳，不依赖真实 API。

- 已完成：prompt templates、rule-based closeout draft panel、draft history、本地规则降级路径。
- 后续（night-safe）：prompt schema versioning、golden draft fixtures、draft diff、apply safety、mock provider、no-API-key UX、prompt preview export。

## 6. Real AI Assistance
**目标**：真实 AI 帮助优化措辞、总结排查、建议预防。

- 已完成（代码侧）：provider abstraction、server env API key boundary、timeout/error state、polish closeout、DeepSeek closeout draft minimal integration。
- 阻塞：summarize records / suggest prevention / user review before apply / draft audit metadata 全部等真实 provider opt-in smoke（REALAI-09）；AI key 只走 server env，AI 不读密钥文件，不直接写库。
- post-0.3 备案：`AI-DRAFT-DEEPSEEK-SCHEMA-GUARD`（task/schema mismatch fallback verify）。

## 7. Code Context Analysis
**目标**：AI 能基于用户显式提供的代码上下文分析问题。

- 后续（night-safe）：bundle CLI、secrets protection、bundle schema fixtures、attach bundle to issue、bundle viewer、bundle size error handling。
- 阻塞：CODECTX-07-AI-ANALYZE-EXPLICIT-BUNDLE 等真实 AI 通路。
- 拍板：repo connector allowlist（CODECTX-08）、connector audit denylist（CODECTX-09）；server 不任意扫仓库是硬约束。

## 8. Technical Debt / Architecture
**目标**：避免越跑越石山。

- 已完成：App.tsx 最小拆分（TECH-07）、行为保持的 UI 模块化拆分（UI-MOD-01）。
- 后续（night-safe）：closeout atomicity 设计 / recovery、workspaceId consistency、verify helpers、verify tmp cleanup、smoke fixture consolidation、HTTP repository split / server route split / database module split（仅在具体 storage / server 任务命中它们时优先）。

## 9. UI 改造（受控小阶段，stage gate driven）
**目标**：把 UI 改造拆成可暂停的小阶段，每个阶段都有人工 review gate。

- 已完成：UI-01 信息架构 → UI-GATE-01 visual direction → TECH-07 → UI-GATE-02 → UI-MOD-01 行为保持拆分 → UI-GATE-03 run check → UI-RELAYOUT-01 第一轮 → UI-GATE-04 → UI-POLISH-02 copy trim → UI-GATE-05 → UI-POLISH-03 quick issue landing layout。
- 当前 gate：UI-GATE-06-MANUAL-QUICK-ISSUE-LAYOUT-REVIEW（必须等用户人工检查桌面/移动端观感后才允许继续）。
- 后续：在 UI-GATE-06 通过后再决定是否进入下一轮 polish；不引入组件库或 broad CSS reset。

## 长期方向
- 团队级多项目知识库与轻量权限。
- 串口日志 / CAN 报文 / ROS topic / 截图 / 照片 / 波形附件接入。
- repo connector allowlist 成熟后评估轻量索引 / RAG / embedding。
- 归档报告 PDF/HTML 导出、周报 / 复盘报告生成。
- 模块级高频故障模式统计与预防清单。
- 更完整的局域网部署体验：反向代理、`.local`、HTTPS、美化域名。

## 当前不做（硬约束）
- 不创建独立 console / dashboard app；不把项目管理 UI 塞进 ProbeFlash 本体。
- 不引入 RAG / embedding 作为第一步；不做权限系统、多租户、公网暴露。
- 不做 Electron / preload / fs / IPC；`.debug_workspace` 文件写盘不在当前主线。
- 不抢占服务器 80 端口；不升级系统全局 Node；不影响 filebrowser / vnt-cli / docker / Portainer。
- 不读取、搜索、打印、总结或提交真实 API key；真实 provider smoke 只能由用户本地执行。
