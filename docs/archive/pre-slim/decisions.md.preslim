# 关键决策（Decisions）

## D-001：采用“规划区 + 交接区”双轨机制
- 日期：2026-04-20
- 决策：用 `docs/planning/` 管推进，用 `.agent-state/` 管上下文重置交接。
- 原因：避免仅依赖长对话上下文，保证可恢复和可追踪。
- 放弃方案：只在 README 里维护进度（信息耦合高，易失真）。

## D-002：产品文档迁移到 `docs/product/`
- 日期：2026-04-20
- 决策：把 `产品介绍.md` 迁移到 `docs/product/产品介绍.md`。
- 原因：按“产品定义”和“执行规划”分层管理文档。
- 放弃方案：继续放在仓库根目录（后续扩展易混乱）。

## D-003：坚持原子任务单提交
- 日期：2026-04-20
- 决策：每完成一个离散任务立即提交，未提交不进入下一任务。
- 原因：提高回滚与追溯粒度，符合 AI 长期协作节奏。
- 放弃方案：多任务打包提交（难以审计与交接）。

## D-004：MVP 阶段优先本地 CLI + 文件系统
- 日期：2026-04-20
- 决策：优先本地 Git CLI 与本地存储，不强依赖额外 MCP。
- 原因：减少故障面，优先验证闭环与可恢复机制。
- 放弃方案：一开始引入多 MCP 编排（调试与维护成本高）。

## D-005：schema 校验采用 zod，不走手写 type guard 路线
- 日期：2026-04-21
- 背景：S1-A2 需要为 `IssueCard` / `InvestigationRecord` / `ErrorEntry` / `ArchiveDocument` 落地可运行的运行时校验；AGENTS §9 与 README 4.4 明确要求"AI 输出先过 schema 校验，不通过不入库"，并要求 schema 失败时可定位到无效字段。动代码前必须先锁定选型。
- 决策：`apps/desktop` 的运行时 schema 校验统一使用 [`zod`](https://zod.dev)（v3.x）。类型与校验都以 zod schema 为单一事实源，通过 `z.infer` 派生 TS 类型；读盘、AI 输出入库均使用 `safeParse` 以拿到结构化错误。
- 原因：
  - 单一事实源：TS 类型与运行时 schema 从同一份声明派生，避免手写 guard 与类型定义双份漂移。
  - 错误可定位：`safeParse` 返回 `error.issues[]` 含路径与原因，直接满足 AGENTS §9"记录校验错误 + 仅重生无效字段"。
  - 4 个实体 + 多字段 + 嵌套（RepoSnapshot / 枚举 / 时间戳）下，手写 guard 的样板代码量会淹没 MVP 节奏。
  - D-004 约束的是 MCP/服务依赖，不约束前端库选择；zod 是纯本地 devDep，不引入远端调用。
  - Tree-shakable、社区成熟、长期维护风险低。
- 放弃方案：
  - 手写 `is*` type guard：样板量大、易漂移、错误信息需自己拼，违背"仅重生无效字段"这类反馈闭环需求。
  - `ajv` + JSON Schema：需要同时维护 JSON Schema 与 TS 类型，双源易脱节；对 TS-first 项目过重。
  - `valibot`：API 与 zod 接近但生态与范例更薄，MVP 阶段不抢跑。
- 适用范围：`apps/desktop` 前端与后续 Node 侧（若引入）统一用 zod。`.agents/skills/*/SKILL.md` 里的 JSON 示例仍是规则说明，不直接落为 zod schema。
- 影响与后续动作：
  - 解锁 S1-A2：schema 骨架应放在 `apps/desktop/src/domain/schemas/`，每个实体一个文件，导出 `*Schema` 与通过 `z.infer` 派生的类型。
  - 依赖：`apps/desktop/package.json` 将新增 `zod` 为 dependency（非 devDependency，因为运行时需要）。
  - `handoff.json` 中"schema 校验方案尚未决定"的 risk 由本决策消解。

## D-006：S1-A3 本地存储采用浏览器 localStorage
- 日期：2026-04-21
- 背景：S1-A3 需要把"样例 IssueCard → 保存 → 重开读取 → schema 校验"最小闭环跑通。当前 `apps/desktop` 仍是纯 Vite SPA，S1-A4 Electron 外壳尚未接入，没有 Node / IPC / 文件桥接，渲染进程无法直接写 `.debug_workspace/` 下的磁盘文件。动代码前需要锁定持久化介质。
- 决策：S1-A3 阶段 IssueCard 的本地持久化使用浏览器 `window.localStorage`，键名固定为 `repo-debug:issue-card:<id>`，值为 `JSON.stringify(IssueCard)`。读取后必须经过 `IssueCardSchema.safeParse`：通过则返回 `{ok:true, card}`；未命中 / JSON 损坏 / schema 不符必须返回结构化错误（`not_found` / `parse_error` / `validation_error`），不得静默降级。
- 原因：
  - 最短路径：不引入 Electron / Node fs / 文件桥接即可跑通 MVP 最小闭环；与 S1-A4 的进度解耦。
  - 与 D-004 一致：`window.localStorage` 是纯浏览器本地持久化，不引入远端调用、不依赖额外 MCP。
  - 易验证：Node 侧用 Map-based 轻量 polyfill 即可做 round-trip 黑盒测试，无需浏览器。
  - 覆盖"重开"语义：localStorage 跨 tab reload 持久，足够验证完成标准 #5"能人工验证问题卡被保存并重新读取"。
- 放弃方案：
  - 直接写 `.debug_workspace/active/<issueId>.json`：需要 Node fs 或 Electron IPC 桥接，越出 S1-A3 范围，强耦合 S1-A4。
  - IndexedDB：单实体 key-value 场景过重；调试与序列化复杂度 MVP 阶段不必要。
  - 内存单例 / React state：不跨页面刷新，等同于没有"重开"语义，不满足完成标准。
- 适用范围：仅 S1-A3 的 IssueCard 持久化；InvestigationRecord / ErrorEntry / ArchiveDocument 的落盘**不**在本决策范围（归 S2 归档链路）。
- 影响与后续动作：
  - 落地位置：`apps/desktop/src/storage/issue-card-store.ts`，导出 `saveIssueCard(card)` / `loadIssueCard(id)` / `LoadIssueCardResult` 联合类型。
  - 当 S1-A4 Electron 外壳落地后，可在 `src/storage/` 下把 `window.localStorage` 封成一层 `IssueCardStore` 抽象，浏览器用 localStorage、主进程用 fs（典型 adapter 模式）。本次不做。
  - 本决策不改写 D-001 ~ D-005，仅补充 S1-A3 阶段的具体存储选型。

## D-007：S1 阶段 Electron 外壳延后，S1 即刻关闭，阶段过渡到 S2
- 日期：2026-04-21
- 背景：S1 阶段完成定义最后一项要求"具备 Electron 外壳（或明确延后决策）"。当前 SPA + localStorage 已跑通 IssueCard save/load 最小闭环（S1-A3 / D-006），可直接支撑 S2 主闭环（调试闭环 intake → 追记 → 结案归档）的前半段验证；Electron 本体的核心价值是"桌面进程 + fs/IPC 桥接"，与 S2 主闭环所需能力不是强耦合关系。处于无人值守连续推进阶段，不宜引入会占用多轮的环境依赖。
- 决策：S1 阶段接受"Electron 外壳延后"，以本条 D-007 作为"明确延后决策"落盘，满足 S1 阶段完成定义最后一项。Electron 外壳推迟到 S2 主闭环完成、fs 持久化或主进程能力真正成为阻塞项时再接入。S1 阶段即刻关闭，下一阶段切换到 S2（调试闭环主流程）。
- 原因：
  - MVP 最短路径：SPA + localStorage 足够承载 IssueCard intake → update → closeout 主闭环前半段验证；先打通 S2 业务链路的价值高于先套外壳。
  - 减少环境风险：Electron 本体 + electron-builder + main/preload/IPC 交叉调试在 WSL 下成本不低；当前无人值守阶段不宜引入会占用多轮的环境依赖。
  - 接入点明确：S2 主闭环完成后再把 localStorage 替换为 fs 或 IPC，改动会集中在 `src/storage/` 层，已符合 D-006 预留的 adapter 路线。
  - 不关闭路线图：S2 / S3 阶段均可重新评估 Electron 外壳，不视为永久废弃；若 S2 推进过程中出现"必须写 `.debug_workspace/` 到磁盘"或"必须主进程级能力"的硬阻塞，可重新把 S1-A4 或其等价任务拉回前沿窗口。
- 放弃方案：
  - 立刻实装 S1-A4 Electron 外壳：`electron` + `electron-builder` devDep + `electron/main.ts` + `electron/preload.ts` + `dev:electron` 脚本 + IPC 通道的最小骨架估算至少 1~2 轮无人值守周期，与 MVP 链路推进节奏脱节；且 WSL 下 Electron 首次运行可能需额外桌面环境配置，风险不对等。
  - 切换到 Tauri：需引入 Rust 工具链，跨环境风险更高；若未来需要切换也应在 S2 之后重新评估。
  - 继续延迟决策：本身已在前沿窗口挂了若干轮，继续挂起会让 planning 与实际脱节，也让 S1 无法关闭。
- 适用范围：仅针对 S1 阶段完成定义最后一项。`apps/desktop` 继续以 SPA + localStorage 形态演进；任何 fs / IPC / 主进程能力都属于 S2 之后的任务。不改写 D-001 ~ D-006。
- 影响与后续动作：
  - S1 阶段完成定义最后一项已满足，S1 阶段即刻关闭。
  - 下一阶段切换为 S2（调试闭环主流程）。
  - 前沿窗口切换到 S2 候选：优先考虑 IssueCard intake 最小表单、IssueCard 列表视图、InvestigationRecord 追加三类任务；M-1 typecheck 脚本修复仍保留作为低风险插入项。
  - 当前战况与机读状态同步更新，阶段代号从 S1 过渡到 S2。

## D-008：切换到 D1 交差优先中文产品壳
- 日期：2026-04-21
- 背景：S2 主闭环关键路径已经在 SPA + localStorage 路径打通，但当前界面仍偏英文工程验证壳；用户当前目标不是继续深挖全部闭环能力，而是先交付一个“好看、中文、能用、像产品壳”的可演示版本。
- 决策：新增当前阶段 `D1：交差优先中文产品壳`，并设置 `.agent-state/handoff.json.current_mode = "delivery_priority"`。D1 阶段链路 B（中文化、视觉统一、空状态、演示友好、产品壳）为当前优先主线；链路 A（技术闭环深化）降级为后续主线。
- 原因：
  - 交差验收优先看页面是否像产品、中文是否统一、演示是否顺畅。
  - 继续推进 S3 / Electron / fs 会提升底层能力，但不能解决当前壳层不够可演示的问题。
  - D1 可以在不改 schema / store / Electron / fs / IPC 的前提下显著提升可理解性和交付观感。
- 放弃方案：
  - 继续默认推进 S3-ENTRY-PLANNING：会让后续 AI 继续沿技术闭环机械前进。
  - 立刻做 Electron / 文件写盘：对当前交差目标收益低，且会扩大风险面。
  - 直接大改 UI 架构或引入组件库：超出“安全美化”范围，容易破坏已打通数据流。
- 影响与后续动作：
  - `AGENTS.md` 新增 delivery-priority mode、dual-track rule、safe polish rule、mandatory doc sync、acceptance-facing mindset。
  - `current.md` 前沿窗口切到 D1-UI-V0 / D1-UI-V1 / D1-DEMO-PATH。
  - S3 技术闭环不取消；交差版本完成后，必须由 planning 重新读取真实状态并明确切回技术主线。


## D-009：S3 切换为存储迁移与服务器化
- 日期：2026-04-22
- 背景：D1 产品壳与浏览器主流程 smoke 已完成，当前最大缺口不再是页面演示，而是 `window.localStorage` 演示存储无法支撑战队局域网共享、服务器长期保存和多设备协同查看。
- 决策：S3 阶段切换为“存储迁移与服务器化”。当前优先目标是把前端从 localStorage 演示版升级为同一 WiFi 下可访问、服务器端长期存储的版本；预期入口类似 `http://hurricane-server.local:<port>/`。
- 本阶段不做：AI、RAG、权限系统、Electron、fs/IPC、大 UI 重构、复杂统计、云同步或公网多租户。
- 原因：
  - 局域网共享与服务器长期存储是从“静态演示版”走向战队可用版本的最短工程路径。
  - 后端脚手架、SQLite schema、前端 storage adapter、部署方式都依赖服务器环境与端口/域名/权限条件，必须先盘点再实现。
  - 继续优先做 AI 或 Electron 会扩大风险面，且不能解决多设备共享和数据长期保存的核心阻塞。
- 放弃方案：
  - 继续用 localStorage 强行演示团队共享：数据无法跨设备共享，容易误导验收。
  - 立刻写后端：缺少服务器环境、端口、hostname、权限、数据路径和部署条件，会导致返工。
  - 转向 AI/RAG：与当前阶段“服务器长期存储”目标不匹配。
- 影响与后续动作：
  - `current_mode` 更新为 `server_storage_migration`。
  - 当前唯一入口任务为 `S3-SERVER-INVENTORY`。
  - S3 后续候选拆分为 `S3-BACKEND-SCAFFOLD`、`S3-SQLITE-STORAGE`、`S3-FRONTEND-STORAGE-ADAPTER`、`S3-LAN-DEPLOY`、`S3-MULTI-DEVICE-SMOKE`。


## D-010：S3 改为“WSL 本地最小闭环优先，服务器独立部署后验”
- 日期：2026-04-23
- 背景：D-009 已把阶段切到 S3，但其执行顺序仍偏“服务器 inventory 优先”。现在服务器与本机事实已确认：服务器为 Ubuntu 20.04.6 LTS，IP `192.168.2.2`，80 端口已被占用，`systemd` 可用，系统 Node 仅 `v10.19.0`，且 `sqlite3` 未安装；本机 / WSL 为 Ubuntu 24.04 LTS，已具备 `sqlite3`、`python3`、`gcc/g++`、`make`、`pkg-config`。同时代码现状表明 `App.tsx` 仍承担 UI + 业务编排 + 存储协调 + closeout 多步写入，若直接接 HTTP / SQLite / 服务器部署，返工与不一致风险高。
- 决策：S3 主线改为“先补最薄架构缝合点，再在 WSL 本地跑通最小 backend + SQLite + HTTP adapter 闭环，最后做服务器独立部署验证”。服务器部署必须使用 **独立 runtime + 独立端口 + 独立 systemd service**；不升级服务器全局 Node，不影响现有 Web 服务，不抢占 80 端口。当前访问口径先按 `http://192.168.2.2:<port>/` 理解，`.local` / 反向代理美化延后。
- 原因：
  - 服务器事实已足够支撑后续独立部署方案，不再需要把“服务器未知”当当前第一阻塞。
  - 真正高风险点在现有前端架构：同步 store、`void` 写操作、closeout 多步写入都不适合直接硬塞 HTTP。
  - WSL 本地已具备 SQLite 与编译环境，最适合先把最小闭环跑通，再把已验证方案迁到服务器。
- 放弃方案：
  - 继续沿用“服务器 inventory 优先，然后再决定能不能写后端”的旧顺序。
  - 直接升级服务器全局 Node 或改动现有服务依赖。
  - 把 HTTP API 直接硬塞进现有组件，或用 localStorage silent fallback 冒充服务器化成功。
- 影响与后续动作：
  - 当前唯一待认领任务改为 `S3-ARCH-ASYNC-STORAGE-PORT`。
  - `current.md` / `handoff.json` / `backlog.md` 统一切换到 8 个串行原子任务队列。
  - 后续只有在 `S3-LOCAL-END-TO-END-VERIFY` 完成后，才允许认领服务器独立部署准备与验证任务。


## D-011：服务器部署采用分层授权策略
- 日期：2026-04-26
- 背景：v0.2.0 本地 release 已验证，但目标服务器 `/opt` 属于 root、sudo 需要密码、80 端口已有 filebrowser，且系统 Node 为 `v10.19.0`，不适合一次性直接进入 `/opt` + systemd 部署。
- 决策：ProbeFlash 服务器部署必须按分层顺序推进：先在 `/home/hurricane/probeflash` 做 no-sudo 用户目录验证；再准备指向该用户目录的 `probeflash.service`；用户明确授权后才写 `/etc/systemd/system/probeflash.service` 并验证 systemd 自启；`/opt`、反向代理、`.local`、80/443 美化全部后置。
- 原因：先验证独立 Node runtime、4100 端口、SQLite 持久化与旧服务旁路，能把权限风险、服务风险和数据风险拆开，避免影响 filebrowser / vnt-cli / docker / Portainer。
- 放弃方案：直接写 `/opt`；默认 sudo；直接安装 systemd；抢占 80；升级系统 Node；把 Portainer / vnt-cli 的 root 服务方式照抄给 ProbeFlash。
- 影响与后续动作：当时 `current.md`、`backlog.md`、`.agent-state/handoff.json` 的下一任务切到用户目录部署验证，后续 systemd 任务必须显式依赖用户授权；该任务命名与部署方式已由 D-014 更新为 release tarball first。


## D-012：AI 与代码上下文能力采用 draft-only 与 explicit bundle 优先
- 日期：2026-04-26
- 背景：ProbeFlash 下一阶段需要 AI 辅助措辞与代码上下文分析，但当前尚未完成服务器安全部署和 operability，且不能让 AI 或 server 默认扫描用户仓库、持有浏览器侧 API key 或自动写库。
- 决策：AI 路线按四层推进：先定义 prompt template / schema 与规则草稿面板，不调用外部模型；再接最小真实 AI 措辞优化，API key 只在 server env，AI 只返回草稿；再扩展预防建议草稿；代码上下文分析必须先由用户在本地生成 explicit code context bundle，ProbeFlash 只分析用户显式提供的内容。
- 原因：draft-only 能保留用户确认权，explicit bundle 能避免服务器任意扫仓库路径、读取 secrets 或自动执行命令，同时仍能支撑后续 AI 排查建议。
- 放弃方案：一上来接 RAG / embedding；浏览器保存 API key；AI 直接写库；server 任意读取项目路径；默认扫全仓库；自动运行构建或测试命令。
- 影响与后续动作：`AI-READY-*` 必须先于 `AI-ASSIST-*`；`CODE-CONTEXT-BUNDLE-CLI` 必须先于任何 repo connector；repo connector 只作为 bundle MVP 后的后续评估项。


## D-013：建立夜跑安全执行范式并归档 v0.2 前历史文档
- 日期：2026-04-26
- 背景：v0.2.0 release 已完成，本地 HTTP + SQLite 主链路可用；下一主线是服务器用户目录部署验证，但该任务涉及 SSH、上传、真实服务器写入、启动进程与端口边界，不能在用户不在线时硬跑。与此同时，v0.2 前 API / SQLite / 不可达策略草案已被实现吸收，继续放在 `docs/planning/` 会让后续 AI 误读为当前输入。
- 决策：建立 Night Run / Unattended Mode。夜跑只允许 repo-local、可自动验证、可回滚任务；遇到服务器、sudo、systemd、外部账号、API key、路径 / 权限 / 端口确认、删除 / 迁移数据、产品拍板或无法本地验证的问题必须停止并留下 handoff。将 v0.2 前历史专项输入移动到 `docs/archive/v0.2-closeout/`，默认读取链不再包含 archive。
- 原因：把无人值守能力限制在安全边界内，避免误操作服务器或真实数据；同时让 `docs/planning/` 继续只承载当前战况、候选池与长期拍板，降低上下文重置后的误读风险。
- 放弃方案：夜跑继续推进真实服务器部署；把历史草案留在 `docs/planning/`；删除历史文档；恢复已硬删除的弱化 handoff / roadmap / architecture 文档。
- 影响与后续动作：`AGENTS.md`、`current.md`、`backlog.md`、`.agent-state/handoff.json` 与相关 skills 必须保留夜跑边界；当时的用户目录部署验证只能在用户白天确认 SSH / 上传 / 写入路径 / 启动进程 / 4100 端口边界后执行；当前任务命名与部署方式已由 D-014 更新为 release tarball first。


## D-014：服务器部署采用 release tarball first
- 日期：2026-04-26
- 背景：v0.2.0 GitHub Release 已发布，资产包括 `probeflash-web-v0.2.0.tar.gz`、`probeflash-server-v0.2.0.tar.gz`、`probeflash-dev-tools-v0.2.0.tar.gz` 与 `SHA256SUMS.txt`；WSL 本地已验证 release 包可下载、解压、运行与 `/api` proxy 失败态。用户当前没有时间做真实服务器验证，并明确倾向用 release 压缩包部署，而不是服务器上 `git pull` 开发态部署。
- 决策：ProbeFlash 后续服务器部署以 GitHub Release tarball 为主路径：下载固定版本资产，校验 `SHA256SUMS.txt`，解压到 `/home/hurricane/probeflash/releases/vX.Y.Z`，用独立 Node runtime 启动，用 `current` symlink 指向当前版本，并把 SQLite、日志与 env 保存在 `/home/hurricane/probeflash/shared/`；服务器不作为开发 checkout，`git pull` 只可作为开发 / 调试方式，不是正式部署方式。
- 原因：release 包部署可重复、可校验、可回滚，能避免服务器源码树漂移、误用系统 Node v10、误删持久数据或把开发态 checkout 当成生产部署；`current` symlink + `releases/` + `shared/` 能把版本切换和数据持久化拆开。
- 放弃方案：服务器上长期 `git checkout` / `git pull`；把 `shared/data` 放进 release 目录；未校验 SHA256 直接运行；直接写 `/opt`；直接 systemd；抢占 80；升级服务器全局 Node。
- 影响与后续动作：旧 `S3-SERVER-USER-DIR-DEPLOY-VERIFY` 拆分为 `S3-SERVER-RELEASE-DOWNLOAD-PLAN`、`S3-SERVER-RELEASE-USER-DIR-DEPLOY-VERIFY`、`S3-SERVER-RELEASE-STATIC-WEB-SERVE-PLAN`、`S3-SERVER-RELEASE-UPDATE-FLOW` 与后置 `S3-SERVER-SYSTEMD-AUTOSTART-PREP`。当前真实部署任务是 `S3-SERVER-RELEASE-USER-DIR-DEPLOY-VERIFY`，状态保持 `blocked_by_user_confirmation` + `blocked_by_user_time` + not night-safe。


## D-015：长期路线图重建为 8 条产品主线
- 日期：2026-04-26
- 背景：ProbeFlash 已具备 v0.2.x 本地 HTTP + SQLite + release 可部署基座，但后续规划仍容易在服务器部署、AI-ready、真实 AI、代码上下文和技术债之间互相挤压。用户要求从“最好用的战队调试问题闭环软件”愿景出发，重建长期产品路线图，并区分 night-safe / day-only / blocked / decision-needed。
- 决策：新增 `docs/planning/product-roadmap.md` 作为长期产品路线图事实源，把后续演进拆为 8 条主线：Deployment / Operability、Data Safety、Core Debug Workflow、Search / Knowledge Base、AI-ready Workflow、Real AI Assistance、Code Context Analysis、Technical Debt / Architecture。每个大任务和小任务都必须带目标、用户价值、依赖、允许修改、不做项、验证方式、完成定义、执行类型、优先级和 AI unattended 适配性。
- 原因：8 条主线能同时保留长期愿景和当前执行边界；近期仍先做部署可用、数据安全、可观测，避免在真实服务器未验证、API key 未确认时抢跑真实 AI 或 repo connector。
- 放弃方案：继续维护只围绕 S3/S4/AI 的短队列；把 AI/RAG/权限/代码扫描提前塞进当前入口；在多个 planning 文档里重复维护长篇当前战况。
- 影响与后续动作：`current.md` 只保留当前 P0 执行窗口和 3 个前沿候选；`backlog.md` 保存节奏队列与任务池；`.agent-state/handoff.json` 保存机器可读的下一任务选择依据。下一轮白天主线仍是 `DEP-01-RELEASE-USER-DIR-DEPLOY-VERIFY`；`DEP-07-RELEASE-UPDATE-ROLLBACK-PLAN` 已完成，当前无服务器授权时优先认领 `UI-01-INFORMATION-ARCHITECTURE-REVIEW`。


## D-016：UI 大问题先进入受控 UI 修复链路，TECH-07 只作为中间支撑
- 日期：2026-04-30
- 背景：Search / KB 链路和 UI redesign brief 已完成，当前 UI 存在信息层级混合、Knowledge Assist 分散、workspace / storage 状态分散、长表单压迫主流程等问题。与此同时，`App.tsx` 是最大冲突面，直接全量重写或先做 broad refactor 都会扩大回归面。
- 决策：B 组 repo-local 功能一起规划但仍串行执行；B 组完成后，优先进入受控 UI 修复，而不是先做 TECH-08 / TECH-09 / TECH-10 等 broad refactor。具体顺序为：`UI-01-INFORMATION-ARCHITECTURE-REVIEW` -> `UI-GATE-01-MANUAL-VISUAL-DIRECTION` -> `TECH-07-APP-TSX-MINIMAL-SPLIT` -> `UI-GATE-02-MANUAL-UI-POLISH-AFTER-SPLIT` -> 后续 UI 局部实现任务。
- 原因：UI 当前是验收观感最大问题；但 UI 修改必须先有信息架构和人工方向确认。`TECH-07` 的价值是降低 `App.tsx` 冲突面，为后续 UI 改造提供支撑，不应独立变成技术洁癖式重构。
- 放弃方案：B 组后直接做 `TECH-08-HTTP-REPOSITORY-SPLIT`、`TECH-09-SERVER-ROUTE-SPLIT`、`TECH-10-DATABASE-MODULE-SPLIT`；直接全量重写 `App.tsx`；绕过人工确认直接做大 UI 改版；引入组件库或 broad CSS reset。
- 影响与后续动作：`backlog.md` 与 `.agent-state/handoff.json` 需要记录 B 组串行队列和 TECH-07 前后的人工 UI gate；`ui-redesign-brief.md` 需要把这些 gate 写入 UI 小阶段边界。`current.md` 仍只保留最多 3 个前沿候选，不把整个 B 组展开成当前执行窗口。


## D-017：UI 重排前先做行为保持模块化拆分，并设置人工运行检查门
- 日期：2026-04-30
- 背景：用户已认可 `TECH-07-APP-TSX-MINIMAL-SPLIT` 的初步拆分结果，但当前 `App.tsx` 仍包含大量 UI 组件和 helper。若直接进入三栏布局、QuickIssue landing、Knowledge Assist 合并或 closeout 视觉整理，会在同一轮同时承担模块拆分、布局重排和交互文案变化，回归面过大。
- 决策：下一轮只允许自动认领 `UI-MOD-01-PRE-RELAYOUT-COMPONENT-SPLIT`。该任务只做行为保持的 UI 组件模块化拆分，不改变渲染顺序、CSS 主视觉、业务数据流、schema、repository、HTTP API 或 server。模块化完成、验证并提交后，必须停在 `UI-GATE-03-MANUAL-RUN-CHECK-BEFORE-RELAYOUT`，由用户人工启动 / 浏览确认能正常跑；未通过该 gate 前不得自动进入 UI 重排实现。
- 原因：先降低 `App.tsx` 冲突面，可以让后续 UI 重排只处理信息层级和视觉，不同时承担搬家风险；人工运行检查能在大 UI 改造前确认行为保持拆分没有破坏现有功能。
- 放弃方案：直接做三栏 UI 重排；把 QuickIssue landing、severity 下拉、删除 3/4 编号和 Knowledge Assist 合并混入模块化拆分；继续扩展 `App.tsx`；跳过人工检查直接进入 UI implementation。
- 影响与后续动作：`current.md`、`backlog.md`、`product-roadmap.md`、`ui-redesign-brief.md`、`status.md` 与 `.agent-state/handoff.json` 必须把下一任务切到 `UI-MOD-01`，并记录 `UI-GATE-03` 是后续 UI 重构前的强制停止点。
