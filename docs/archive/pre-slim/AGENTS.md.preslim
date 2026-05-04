# AGENTS Rules

## 1. Project Overview
- 本项目是 **ProbeFlash — 面向嵌入式调试现场的问题闪记与知识归档系统**。
- 核心模块：项目绑定与仓库快照、问题闪记 / IssueCard intake、InvestigationRecord 追记、debug closeout、ArchiveDocument / ErrorEntry 归档。
- 当前真实运行形态：`apps/desktop` 浏览器 SPA 已通过 HTTP adapter 接入 `apps/server` + SQLite 本地主链路；`window.localStorage` 仅保留为兼容 / verify 路径。v0.2.0 本地 release 已可测试；真实服务器部署尚未完成。

## 2. Workspace Rules
- `docs/product/` 只放产品定义、用户场景、领域语言、数据模型与长期能力方向。
- `docs/planning/` 只放当前战况、候选池与长期拍板；v0.2.0 前已经完成或过期的历史专项输入放入 `docs/archive/v0.2-closeout/`。
- `docs/planning/status.md` 是人类快速阅读的项目状态索引，不是最终事实源，不承载详细任务定义，不替代 `current.md` / `backlog.md` / `product-roadmap.md` / `.agent-state/handoff.json`。
- `docs/archive/v0.2-closeout/` 只放 v0.2.0 closeout 前历史文档；AI 不应默认读取，除非任务明确命中历史背景、专项实现追溯或归档审计。
- `.agent-state/` 只放上下文重置所需的机读状态；当前唯一机读状态文件是 `.agent-state/handoff.json`。
- `.debug_workspace/` 只放调试运行数据与归档。
- `.agents/skills/` 只放可执行流程规则；一个 skill 只做一件事。
- 禁止把临时思考散落到仓库根目录或无关路径。

## 2.1 Secrets / API Key Handling
- AI / Agent 禁止读取、搜索、打印、总结、复制或提交任何真实密钥文件，包括但不限于 `/home/rainman/.config/probeflash/deepseek.env`、`/home/rainman/.config/probeflash/*.env`、仓库内 `.env`、`.env.*`、`.secrets/**`、`*.key`、`*secret*`、`*api-key*`。
- AI 不得要求用户粘贴 API key；真实 provider key 只能由用户手动写入仓库外文件或 shell 环境变量。
- 代码只能通过 server 进程环境变量读取 provider key，例如 `process.env.DEEPSEEK_API_KEY`；禁止把 key 放入浏览器、localStorage、planning、handoff、README、日志或 commit message。
- AI 可修改文档说明和环境变量名称，但不得读取密钥文件内容来验证配置；真实 provider smoke 必须由用户本地执行。

## 3. Delivery-Priority Mode（交差优先模式）
- 当 `.agent-state/handoff.json.current_mode = "delivery_priority"` 或 `current.md` 写明当前阶段为交差优先时，当前最高优先级是：先交付一个“好看、中文、能用、像产品壳”的可演示版本。
- 在该模式下，UI 壳层、中文化、空状态、演示友好性优先于继续扩展深层闭环功能。
- 不得伪造功能完成状态；localStorage、占位区、未接入 Electron/fs/IPC 等边界必须如实标注。
- 阶段名使用 `D1：交差优先中文产品壳`，除非 planning 明确切出 D1 并更新 `current.md` / `.agent-state/handoff.json`。

## 4. S3 Storage Serverization Rule（存储迁移与服务器化规则）
- 当 `.agent-state/handoff.json.current_mode = "server_storage_migration"` 或 `current.md` 写明阶段为 S3 存储迁移与服务器化时，当前最高优先级是：在本地 HTTP + SQLite 主链路已完成的基础上，完成“局域网共享 + 服务器长期存储”的真实部署验证。
- S3 当前主线：最薄异步 storage / repository port、closeout orchestration、统一 storage error / connection state、本地 WSL 后端 + SQLite + HTTP adapter、workspace 创建与 v0.2.0 本地 release 已完成；下一步只在人工确认边界后做服务器独立部署验证。
- S3 当前不做：AI、RAG、权限系统、Electron、preload、fs/IPC、大 UI 重构、复杂统计、云同步或公网多租户、抢占 80 端口、优先做反向代理 / `.local` 美化、升级服务器全局 Node。
- `current.md` 的前沿任务窗口只放当前 S3 主线 1~3 个候选；更远任务放入 `backlog.md`，不得把 AI/RAG/Electron 等后续方向混入当前入口。
- S3 当前访问口径应先按 `http://192.168.2.2:<port>/` 理解；`.local` / 反向代理美化只在独立部署验证后再考虑。交付目标必须表述为“本地 WSL 最小闭环已跑通，下一步把同一方案以独立 runtime + 独立端口 + systemd service 部署到局域网服务器”，不得把静态演示版或 localStorage 刷新保留说成服务器化完成。

## 5. Safe Change Rule（安全改动规则）
- D1 维护期允许低风险中文文案、空状态和小视觉修补，但不得重做业务数据流。
- S3 阶段允许围绕服务器化目标做最小必要改动：后端脚手架、SQLite schema、storage adapter、部署脚本和 smoke 验证。
- S3 阶段若命中 storage / closeout / adapter / backend scaffold，必须先补最薄架构缝合点，再接 HTTP，再做服务器独立部署；禁止把 HTTP API 直接硬塞进现有组件。
- S3 阶段禁止为了“顺手优化”大规模重构 UI、改动无关 schema / store、引入复杂抽象或提前接 AI/RAG/权限/Electron。
- 涉及仓库访问、归档写盘路径、服务器数据目录、端口和启动方式时，优先可预测性、可调试性和可恢复性，不为表面美化牺牲真实状态表达。

## 6. Rolling Planning And Next Task Selection
- 每轮只允许一个原子任务处于执行中。
- 默认必读输入只保留：`AGENTS.md`、`docs/planning/current.md`、`.agent-state/handoff.json`、`git status --short`、`git log --oneline -5`、当前任务直接相关代码或专项文档。
- 可以先读 `docs/planning/status.md` 获取人类概览；但任务执行前必须读取 `current.md` / `backlog.md` / `product-roadmap.md` / `.agent-state/handoff.json` 等事实源，禁止只凭 `status.md` 认领或执行任务。
- 条件读取规则：
  - `docs/planning/backlog.md`：当前前沿窗口耗尽、任务切换、候选新增/移除/改名/重排优先级时读取。
  - `docs/planning/decisions.md`：阶段切换、长期规则变化、技术争议或需要核对长期拍板时读取。
  - `docs/product/产品介绍.md`：改产品定义、页面结构、领域模型、用户场景或领域语言时读取。
  - `README.md`：对外展示、快速开始、比赛/演示口径变更时读取；它不是内部事实源，不进入默认内部读取链。
  - `docs/archive/v0.2-closeout/`：仅在任务命中 v0.2.0 前历史背景、API / SQLite / 不可达策略追溯或归档审计时读取；不得作为当前默认事实源。
- 选择下一任务时优先判断：当前 mode、阶段目标、completion gate 是否闭合、依赖是否满足、是否遵守“本地 WSL 最小闭环先于服务器部署验证”、planning 与实际是否脱节、是否最有利于验收演示。
- 如果 `current.md` 前沿窗口不再匹配真实阶段，先更新 `current.md` / `.agent-state/handoff.json`，再执行任务。
- 禁止凭旧计划机械顺推；禁止同时推进两个原子任务。

## 7. Completion Gate And Post-Task Planning Sync
- 当前原子任务未完成“最小验证 + planning sync + 单任务 commit”前，不得选择或执行下一任务。
- 每次完成一个原子任务后，必须执行 post-task planning sync；planning sync 是 completion gate 的必要条件，不是可选交接备注。
- planning sync 的最小必更文件为：`docs/planning/current.md` 与 `.agent-state/handoff.json`。
- `docs/planning/backlog.md` 仅在以下情况更新：当前前沿任务窗口变化；候选任务被移除 / 新增 / 改名 / 重排优先级；当前任务完成后需要显式切换下一前沿任务。
- `docs/planning/decisions.md` 仅在产生新的长期性决定时更新。
- `docs/product/产品介绍.md` 仅在产品定义、用户场景、领域模型或领域语言变化时更新；它不承担当前战况职责。
- `README.md` 仅在对外展示、快速开始、比赛/演示口径变化时更新；它不承担内部 planning 职责。
- 旧的弱化文档已退出主工作流并硬删除；不得以占位、薄重定向或“方便接力”为由重新生成。
- planning sync 采用“覆盖当前状态”而非“追加流水账”；目标是让下一轮 AI 能正确接着干，不是把本轮全过程写成纪实文学。
- 不允许“代码已经变了，但 `current.md` / `.agent-state/handoff.json` 还停留在旧阶段”。

## 8. Controlled Context Reset
- 下一轮优先依赖结构化交接物，而不是聊天历史。
- 每轮结束后的状态必须沉淀到 `current.md` 与 `.agent-state/handoff.json`；仅存在于对话中的约定视为会丢失。
- 允许受控重启：重新读取默认必读输入 -> 重新判断阶段 -> 选择唯一下一任务 -> 执行。

## 9. Mandatory Skill Usage
- `planning`：读取真实状态、判断阶段与前沿任务窗口、生成唯一下一原子任务。
- `task-execution`：只做当前原子任务的落地改动、最小验证、planning sync、单任务 commit。
- `task-verification`：完成定义检查、读回验证、completion gate 放行判断。
- `repo-onboard`：首次进入仓库的路径校验与快照采集。
- `debug-intake`：碎片输入生成 IssueCard。
- `debug-closeout`：结案生成 ErrorEntry 与 ArchiveDocument。

## 10. Acceptance-Facing Mindset（面向验收）
- D1 阶段选择任务时，优先问：页面是否更像产品？中文是否统一？演示是否更顺？用户是否更容易理解当前已做到什么？
- S3 阶段选择任务时，优先问：是否更接近局域网共享？是否更接近服务器长期存储？是否保持 HTTP 主链路、localStorage 兼容路径、服务器尚未部署等真实边界？是否避免把 AI/RAG/Electron 误塞回当前主线？
- 输出必须区分“必须改 / 建议改 / 可选优化”，不确定处标注“待确认 / 信息不足”。

## 11. Feedback Loop And Truthfulness
- AI 输出涉及 IssueCard / InvestigationRecord / ErrorEntry / ArchiveDocument 时必须过 schema 校验；失败要记录错误、保留原始输入、只重生无效结构段。
- 工具调用必须检查 exit code；失败不可静默吞掉。
- 归档后必须读回验证；验证失败时创建 repair task，不得标记“已归档完成”。
- 禁止把“规划中”写成“已完成”；禁止把占位壳说成真实功能。

## 12. Commit And Verification
- 每完成一个离散任务提交一次 commit；一个 commit 只对应一个明确任务结果。
- 当前任务未提交前，不得进入下一任务。
- 文档/规划重构的最小验证：路径存在、内容可读、引用一致、JSON 可解析、planning sync 边界符合 §7 / §14、`git diff --check` 通过、提交范围聚焦。
- 用户当前偏好：除非明确要求，由 AI 自行编译。

## 13. Documentation Responsibilities（文档职责与唯一事实源）
- **内部长期保留**：
  - `AGENTS.md`：长期规则、工作流、DoD、夜跑边界、禁改区、文档职责。
  - `docs/planning/current.md`：唯一当前战况。阶段目标、前沿任务窗口（1~3 候选）、唯一执行中的原子任务、下一任务选择流程、DoD；不保留长篇历史实现细节，不重复 `git log`，不复制 `.agent-state/handoff.json.notes`。
  - `docs/planning/status.md`：快速状态索引。只摘要当前阶段、能力状态、关键 blocked、前 5 个 night-safe 候选和最近完成 10 条以内；不得成为新的长文档或历史日志。
  - `.agent-state/handoff.json`：唯一机读状态。只保存下一轮选择所必需的结构化字段，不承载长篇 prose。
  - `docs/planning/backlog.md`：唯一候选池。只留未开做候选；不再维护“已完成”长列表。
  - `docs/planning/decisions.md`：关键拍板与长期约束。仅在出现新的长期性决定时追加，不是轮次日志。
  - `docs/product/产品介绍.md`：产品定义、场景、数据模型、领域语言、长期能力方向；不承担当前战况职责，不默认读取。
- **对外保留**：
  - `README.md`：对外门面、快速开始、展示口径、当前限制；不是内部事实源，不默认读取。
- **历史归档**：
  - `docs/archive/v0.2-closeout/`：v0.2.0 前已完成 / 过期专项输入。默认不读；只有任务明确需要历史 API / SQLite / 不可达策略背景、release closeout 追溯或归档审计时才读。
- **已完成任务历史**：以 `git log` 与 `.agent-state/handoff.json.completed_atomic_tasks` 为主，不在 `current.md` / `backlog.md` 重复维护长已完成列表。
- **禁止**：在多个文档里并行维护“当前战况 / 已完成列表 / 上一轮详述”；弱化文档已硬删除，不得恢复。

## 14. Documentation Update Triggers（何时更新哪份文档）
- 每轮原子任务完成后，**必须执行 planning sync**：
  - `docs/planning/current.md`：必更。只覆盖当前阶段、前沿窗口、当前唯一执行中的原子任务、下一任务选择流程、DoD 当前态；“当前唯一执行中的原子任务”只保留当前态，不保留多轮旧任务正文。
  - `.agent-state/handoff.json`：必更。只写机读状态与下一轮必须保留的结构化字段；`notes` 只保留长期约束或关键边界，不复写任务完成明细。
  - `docs/planning/backlog.md`：条件更新。仅当前前沿任务窗口变化、候选任务被移除 / 新增 / 改名 / 重排优先级、或当前任务完成后需要显式切换下一前沿任务时修改。
  - `docs/planning/status.md`：可更新。仅覆盖当前状态索引，不追加流水账，不复制 backlog 长任务表或 product-roadmap 长路线图。
- **按需**更新：
  - `AGENTS.md`：长期规则、工作流、文档职责、夜跑边界发生变化时。
  - `docs/planning/decisions.md`：产生了新的长期性决定（D-xxx 级别）时。
  - `docs/product/产品介绍.md`：产品定义、场景、领域模型、用户语言发生变化时。
  - `README.md`：产品对外口径、快速开始、阶段口径、演示说明发生变化时。
- **防膨胀约束**：单轮 planning sync 优先修改已有段落，不新增同义新段；若某段描述只是在重复 `backlog.md` / `decisions.md` / `git log` / `.agent-state/handoff.json`，必须删减或改为引用；非长期规则不得写入 `AGENTS.md`；非长期决策不得写入 `decisions.md`。

## 15. Night Run / Unattended Mode（夜跑 / 无人值守模式）
- 定义：当用户不在线、明确要求夜跑、或任务需要无人值守执行时，AI 只能执行 repo-local、可自动验证、可回滚的原子任务；遇到外部系统、权限、服务器、真实数据或产品拍板问题必须停止并留下 handoff。
- 允许任务：docs / planning 整理、`.agent-state/handoff.json` 对齐、本地代码功能、本地 verify 脚本、单元测试 / smoke 脚本、backup / export 本地功能、AI-ready UI / prompt schema、code context bundle CLI、小型局部重构。
- 禁止任务：SSH 到服务器写入、`sudo`、`systemd`、写 `/opt`、操作 80/443 端口、真实服务器部署、GitHub release / tag 删除、数据库 destructive migration、删除用户数据、修改真实生产数据、大规模 UI 重构、引入大型框架、需要用户拍板的产品方向、任何无法本地自动验证的任务。
- 停止条件：`git status --short` 不干净且无法归类；typecheck / build / verify 失败且不能在当前任务边界内修复；需要 SSH / `sudo` / `systemd` / 外部账号 / API key；需要用户确认路径、权限、端口、账号或密钥；涉及真实服务器；涉及删除或迁移数据；planning 与代码冲突且无法判断谁 stale；任务边界不清；连续两次修复验证仍失败；命令出现权限错误、网络错误或端口冲突且无法确定原因。
- 提交规则：每个原子任务单独 commit；提交前必须验证；提交后 `git status --short` 必须为空；不允许 push，除非用户明确要求；不允许改 tag / release；不允许进入下一个任务前留下脏工作区。
- 输出要求：夜跑结束必须输出已完成任务、每个任务 commit、验证结果、未完成任务、阻塞点、下一步最小动作、是否需要用户白天介入。
- 服务器任务规则：`S3-SERVER-USER-DIR-DEPLOY-VERIFY`、`S3-SERVER-SYSTEMD-AUTOSTART-PREP`、`S3-SERVER-SYSTEMD-AUTOSTART-VERIFY` 与任何真实服务器部署 / systemd / sudo 任务都不能夜跑；当前下一任务仍是 `S3-SERVER-USER-DIR-DEPLOY-VERIFY`，必须等用户白天确认 SSH、上传、写入路径、启动进程与端口边界后才可执行。

## 16. Verification Matrix（验证矩阵）
- **必跑**（每轮都要跑，除非用户明确免除；docs / planning / skills-only 治理任务可按任务要求改跑文档专用最小验证，但必须在 handoff / 汇报说明未跑 typecheck、build、verify:all 的原因）：
  - `npm run typecheck`（在 `apps/desktop` 下）。
  - `npm run build`（在 `apps/desktop` 下）。
  - `git diff --check`（不限目录）。
  - `.agent-state/handoff.json` 可被 `JSON.parse`。
- **按需**（任务相关时跑）：
  - `apps/desktop/scripts/verify-*.mts` 中与本轮改动语义相关的脚本。
  - 涉及 storage / repository / closeout / adapter / backend scaffold 时，额外执行 `npm run verify:all` 与任务相关代码级 / 契约级验证；若本轮仅改 docs / planning / skills 且未跑某项，必须明确记录原因。
  - 浏览器人工冒烟（涉及 UI 行为变化时；不改代码时可仅标注未执行）。
- **文档/规划类任务专用最小验证**：路径存在、内容可读、引用一致、planning sync 边界符合 §7 / §14、`JSON.parse` 通过、`git diff --check` 通过；typecheck 与 build 仍建议跑以避免误伤。
- 未跑的必跑项必须在 commit message 或 handoff 中如实标注原因，不得静默跳过。

## 17. Skills Mirror Rule（项目级 Skills 同步规则）
- 项目 skill 的**唯一权威源**是 `.agents/skills/<name>/SKILL.md`，由 Codex / OpenCode / Claude Code 三方共用读取。
- `.claude/skills/` 是 **Claude Code 读取镜像**，由 `.agents/hooks/sync-skills.sh`（PostToolUse hook）在 Claude Code 用 Edit / Write 工具写入 `.agents/skills/**` 时自动复制；**禁止手动编辑 `.claude/skills/`**，下次 hook 触发会覆盖你的修改或制造漂移。
- 新增 skill 流程：在 `.agents/skills/<new-name>/SKILL.md` 创建文件即可；hook 自动镜像。**若用编辑器或 shell 命令（非 Edit / Write 工具）创建**，hook 不会触发，需要手动跑一次 `cp -rp .agents/skills/. .claude/skills/`。
- 删除 skill 流程：删 `.agents/skills/<name>/` 后，必须**手动**同步 `rm -rf .claude/skills/<name>`；hook 只复制不删。
- 漂移哨兵：`apps/desktop` 的 `npm run verify:skills-sync`（也含在 `verify:all` 里）会跑 `.agents/scripts/verify-skills-sync.sh`，对比两边目录；不一致直接 exit 非零并提示修复命令。
- hook 失败日志：`.agents/hooks/sync-skills.log`（被 .gitignore 的 `.claude/` 不影响这里）；定期或验证失败时查看。
- sandbox 备注：Claude Code 内置 sandbox `denyWithinAllow` 锁住 `.claude/skills/` 子树，Claude 永远不能直接写镜像目录；这条规则是设计上必要的隔离，不要绕过。镜像由 hook 在沙箱外完成。
