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
- 影响：UI gate 链已执行至 UI-GATE-06；当前必须停在用户人工 review 桌面/移动端观感，未通过前不得自动进入下一轮 polish。**已被 D-018 覆盖：v0.3 整体冻结，UI-GATE-06 不再推进。**

## D-018：v0.3.0 退役；新方向以 Skill / Bridge / Trail 三 facet 替代单体 issue tracker
- 日期：2026-05-07
- 决策：ProbeFlash v0.3.0 作为完整作品冻结，不再加功能 / 重构 / polish / 写新 verify。后续方向不再做单体 issue tracker，按时间维度拆成三个独立 facet：
  - **当下**：Skill `debug-checklist`——一句症状描述 → 5-8 条带依据和验证动作的检查清单 → 可选写入 `.debug-archive/*.md`。
  - **现在 / 即将**：Bridge（联调板）—— `ROSTER.md` 极简看板，记"我做什么 / 等谁 / 谁等我"，无 server。
  - **过去**：Trail（足迹档案）——静态 viewer，读 `.debug-archive/`，三种视图（个人足迹 / 模块史 / 赛季年鉴）。

  所有数据为 markdown + git native，无 SQLite，无新 server。备赛期只允许 Skill 自用 dogfood；Bridge / Trail 备赛后启动。
- 原因：v0.3 形态本质是"跨组需求单"——为大组织异步协作 + 责任划分 + audit 设计。但目标用户（机器人战队）是 5-15 人小作坊：群里吼一声 / 私聊就解决，结构性不需要 ticketing。"做出来没人用"不是工程缺陷而是形态错配。同时确认两条产品宪法：(1) 填写的成本必须由当下回报抵消——v0.3 让人填"过去发生了什么"，填者当下不受益所以失败，新形态只允许"当下填、当下受益"的输入；(2) 让协作摩擦可见，让产能不可比——量化贡献会异化协作文化（GitHub PR review queue 是好的反例，contribution graph 是坏的反例）。
- 放弃方案：继续推 AIREADY / REALAI / CODECTX / DEP / DATA / UI / CORE / SEARCH 等围绕 v0.3 的演进；为小作坊加权限 / 多租户 / 协作隔离；做 RAG / embedding / Electron。
- 适用范围：v0.3 全部冻结（仅致命补丁）；新工作只在 `.agents/skills/debug-checklist/`、`.debug-archive/`、（备赛后）`docs/bridge/`、`docs/trail/`。pre-pivot 计划全部归档到 `docs/archive/v0.3-pivot/`。
- 影响：`now.md.mode = post_pivot_self_dogfood`；备赛期只允许 skill 自用与 dogfood 记录；D-005 / D-006 / D-009 / D-014 / D-015 / D-016 仍作为 v0.3 的历史 ADR 保留，但不再驱动新工作；本 ADR 之后所有新决策都以 Skill / Bridge / Trail 为框架。

## D-019：明确"阻塞可见但不比产能"——宪法 #2 的边界线
- 日期：2026-05-10
- 决策：设计宪法 #2"让协作摩擦可见，让产能不可比"的精确边界为：**仪表盘只显示任务状态和阻塞原因，不显示人与人之间的完成量排名。** 允许展示"导航模块任务卡了 3 天，需要懂 RTOS 的人支援"；不允许展示"张三这周完成 5 个任务，李四完成 2 个"。核心判断标准：信息能否直接导向"谁需要帮"而不是"谁干得少"。
- 原因：真实痛点（有人卡住没人知道）和产品宪法（不异化协作文化）之间的折中。阻塞可见帮助队员配对、减少等待，而人与人比产能才会触发刷分/隐藏问题等负向行为。用户认为"即使有一定刷分风险，能看到谁被难住而派人帮"的收益大于风险。
- 放弃方案：完全不做任何统计（解决不了"有人卡住没人知道"）；做全量产能排名（直接违反宪法 #2）。
- 适用范围：生效于 Bridge（阻塞看板）和 Trail（个人成长摘要）的设计；Bridge 仪表盘字段只能包含任务名、阻塞原因、所需技能/知识、等待时长；禁止包含个人完成计数、个人效率分、排名。个人 Trail 页面可以显示"自己"的时间线和完成记录（用于自我回顾和汇报），但团队视图不能做人与人比较。
- 影响：Bridge-04 和 Trail-04 按此边界设计；此前 backlog.md 中关于"贡献量化"的禁止条款更新为更精确的表述。

## D-020：飞书开放平台 API 能力边界与限制（事实底座）
- 日期：2026-05-19
- 决策：把用户已委托 gemini 完成的两份飞书开放平台调研报告中与 ProbeFlash 接入相关的事实，固化到 `docs/research/lark-api-capability.md`，作为后续 LARK 系列任务（OSS-SCAN / PATH-DECISION / CONNECTOR-ARCH / MIN-INTEGRATION）的唯一事实引用源。原 gemini 报告保留在 `docs/` 根目录但不直接被工程文档引用。
- 核心结论：
  1. 备赛期最小集成只需走「IM 事件订阅 + 机器人回复」一条路径；多维表格、文档嵌入、AnyBridge、SSE 卡片流式均在 MVP 范围外。
  2. 硬性约束：**IP 白名单**（Serverless 不可行，必须固定公网 IP）、**自定义机器人 Webhook 100 次/分钟**、**Encrypt Key AES-256-GCM 解密 + Verification Token 签名校验 + Challenge-Response**。
  3. 凭证 4 件套：`app_id` / `app_secret` / `encrypt_key` / `verification_token`，由用户线下注入 server 进程 .env，AI 不读不写不打印（AGENTS.md §3 全文生效）。
  4. 2026-03 起企业内部应用 API 免费额度 100 万次/月（每月 1 号重置），备赛期成本视为 0。
  5. 群聊消息读取与通讯录读取属高敏感权限，需企业管理员审批；测试企业沙箱免审，备赛期开发应全程在沙箱内跑通。
  6. 原生自动化流免费版 200 次/月，对外部高频任务等同不可用；ProbeFlash 架构上不依赖原生自动化流。
- 放弃方案：直接引用 gemini 原报告（语气宣传化、含未来不确定推断、不可工程引用）；把 capability 信息散落到多份 LARK 任务文档（多源漂移）。
- 适用范围：本 ADR 是事实陈述层，不含路径选择；路径 A（用开源 SDK） vs 路径 B（自写最小 gateway）的拍板见后续 D-021（LARK-PATH-DECISION）。
- 影响：解锁 LARK-OSS-SCAN（开源候选调研）；为 LARK-PATH-DECISION 提供约束输入；为 LARK-01-CONNECTOR-ARCH 提供接口设计的事实底座。
