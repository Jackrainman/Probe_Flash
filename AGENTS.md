# AGENTS Rules

## 1. Project Overview
- ProbeFlash — 面向嵌入式 / 机器人调试现场的问题闪记与知识归档系统。
- 核心：项目绑定与仓库快照、IssueCard intake、InvestigationRecord 追记、debug closeout、ArchiveDocument / ErrorEntry 归档。
- 当前形态：`apps/desktop` 浏览器 SPA 经 HTTP adapter 接入 `apps/server` + SQLite；v0.3.0 已发布（含用户目录部署 + systemd reboot 验证），数据备份/恢复服务器路径复验进行中。

## 2. Workspace Rules
- `docs/planning/`：唯一当前战况源 = `now.md`；候选池 = `backlog.md`；长期 ADR = `decisions.md`；长期愿景 = `roadmap.md`。这 4 份是 AI 默认读取链。
- `docs/product/`：产品定义、领域语言、长期能力方向。仅在产品定义变化时读取。
- `docs/archive/`：历史归档（含 `pre-slim/` 瘦身前文档与 `v0.2-closeout/`），默认不读，仅在历史追溯命中时读取。
- `.agents/skills/`：可执行流程规则；权威源；一个 skill 只做一件事。
- `.debug_workspace/`：调试运行数据与归档。
- `README.md`：对外门面，不是内部事实源。
- 禁止把临时思考散落到仓库根目录或无关路径。

## 3. Secrets Handling
- AI / Agent 禁止读取、搜索、打印、总结、复制或提交任何真实密钥文件，包括 `/home/rainman/.config/probeflash/*.env`、仓库内 `.env` / `.env.*` / `.secrets/**` / `*.key` / `*secret*` / `*api-key*`。
- 不得要求用户粘贴 API key；真实 provider key 只能由用户手动写入仓库外文件或 shell env。
- 代码只能通过 server 进程环境变量读取 provider key（如 `process.env.DEEPSEEK_API_KEY`）；禁止把 key 放入浏览器 / localStorage / planning / README / 日志 / commit message。
- 真实 provider smoke 必须由用户本地执行；AI 不读密钥文件来"验证配置"。

## 4. Modes
- `delivery_priority`（交差优先）：UI 壳层、中文化、空状态、演示友好优先于深层闭环；不伪造功能完成；占位 / 未接入边界必须如实标注。
- `server_storage_migration`（当前生效）：在本地 HTTP+SQLite 主链路已通的基础上，完成"局域网共享 + 服务器长期存储"的真实部署验证；不做 AI/RAG/权限/Electron/大 UI 重构/云同步/公网多租户；不抢 80 端口；不升级全局 Node。
- 模式切换必须先更新 `now.md.mode`，再选任务。

## 5. Atomic Task Discipline
- 同一时刻只允许一个原子任务处于执行中。
- Completion gate 三件套：最小验证通过 + `now.md` planning sync + 单任务 commit。三者全齐才允许选下一任务。
- planning sync = 覆盖式更新 `now.md`（current_task / frontier / blocked / 最近完成裁剪到 5 条）；候选池增删改名重排时同步 `backlog.md`；长期决策变化时追加 `decisions.md`。
- 禁止凭旧计划机械顺推；禁止 commit 后自动续推下一任务，必须重新走 `atomic-task` skill 第 1 步。
- 完整循环规则见 `.agents/skills/atomic-task/SKILL.md`。

## 6. Verify Matrix
| 任务类型 | 必跑 |
|---|---|
| docs / planning / skills-only | `git diff --check`；`now.md` yaml 可解析；`grep` 旧路径引用一致 |
| deploy docs / deploy verify | `git diff --check`；`cd apps/server && npm run verify:deploy-prep` |
| server script / package | `cd apps/server` 任务对应 verify + `verify:deploy-prep`；`cd apps/desktop && npm run typecheck && npm run build && npm run verify:all` |
| desktop UI / core workflow / search | `cd apps/desktop && npm run typecheck && npm run build && npm run verify:all`；任务对应 `verify:*`；`git diff --check` |
| data repair / integrity | `cd apps/server && npm run verify:data-integrity-check`；`cd apps/desktop && npm run verify:data-repair-task-generation`；同上 desktop 必跑 |
| 任何任务（共性） | `git diff --check`；`cd apps/desktop && npm run verify:skills-sync` |
- exit code != 0 一律失败；未跑的必跑项必须在 commit message 或 `now.md` 中如实标注原因，不得静默跳过。
- 架构类任务（storage / repository / closeout / adapter / backend scaffold）必须有任务相关代码级 + 契约级验证；只有分析结论一律视为未完成。

## 7. Night Run / Unattended Mode
- 允许：docs / planning 整理、`now.md` 对齐、本地代码功能、本地 verify / smoke 脚本、backup/export 本地功能、AI-ready UI / prompt schema、code context bundle CLI、小型局部重构。
- 禁止：SSH 写入服务器、`sudo`、`systemd`、写 `/opt`、操作 80/443、真实服务器部署、release/tag 删除、destructive migration、删除用户数据、真实生产数据修改、大规模 UI 重构、引入大型框架、需要用户拍板的产品方向、任何无法本地自动验证的任务。
- 停止条件：`git status --short` 不干净且无法归类；typecheck/build/verify 失败且无法在当前边界内修复；命中 SSH/sudo/systemd/外部账号/API key/服务器/数据迁移；planning 与代码冲突且无法判断谁 stale；任务边界不清；连续两次修复仍失败；命令出现权限/网络/端口冲突且原因不明。
- 当 `now.md.current_task` 命中真实服务器写入（DATA-01 等），夜跑必须 blocked，等用户白天确认。
- 输出：夜跑结束必须输出已完成任务、commit、验证结果、未完成任务、阻塞点、下一步最小动作、是否需用户白天介入。

## 8. Skills Mirror Rule
- 唯一权威源：`.agents/skills/<name>/SKILL.md`，由 Codex / OpenCode / Claude Code 三方共用。
- `.claude/skills/` 是 Claude Code 读取镜像，由 `.agents/hooks/sync-skills.sh`（PostToolUse hook）在 Edit/Write 命中 `.agents/skills/**` 时自动复制；**禁止手动编辑 `.claude/skills/`**。
- 新增 skill：在 `.agents/skills/<new-name>/SKILL.md` 创建即可（用 Edit/Write 工具触发 hook；用 vim/shell 重定向后需手动 `cp -rp .agents/skills/. .claude/skills/`）。
- 删除 skill：删 `.agents/skills/<name>/` 后**必须**手动 `rm -rf .claude/skills/<name>`；hook 只复制不删。
- 漂移哨兵：`cd apps/desktop && npm run verify:skills-sync`（也含在 `verify:all`）；不一致 exit 非零并提示修复命令。
- sandbox 设计史与详细原理（为什么不能 symlink、bwrap EISDIR、hardlink VS Code rename 漂移、PostToolUse 在沙箱外执行）见 `docs/archive/pre-slim/status.md` §9-§18；本节只是操作纪要。

## 9. Truthfulness
- AI 输出涉及 IssueCard / InvestigationRecord / ErrorEntry / ArchiveDocument 必须过 schema 校验；失败要记录错误、保留原始输入、只重生无效结构段。
- 工具调用必须检查 exit code；失败不可静默吞掉。
- 归档后必须读回验证；验证失败时创建 repair task，不得标记"已归档完成"。
- 禁止把"规划中"写成"已完成"；禁止把占位壳说成真实功能；禁止把 `localStorage` 静默 fallback 当作"服务器化成功"。
