# ProbeFlash Project Status

> 本页是人类快速阅读的项目状态索引，不是最终事实源，不承载详细任务定义，也不替代 `current.md` / `backlog.md` / `product-roadmap.md` / `.agent-state/handoff.json`。若本页与事实源冲突，以这些事实源为准；AI 不能只读本页就执行任务，执行前仍必须读取默认事实源。
>
> 硬限制：总长度建议不超过 120 行；不追加流水账；不复制 backlog 长任务表；不复制 product-roadmap 长路线图；最近完成只保留最近 10 条以内；blocked 只列当前关键 blocked；night-safe 只列前 5 个候选；每次任务结束只覆盖当前状态，不追加历史过程。

## 1. 一句话状态
ProbeFlash 已具备本地 HTTP + SQLite + release 可部署基座、核心问题闭环、基础知识检索、轻量相似问题提示、历史问题人工关联和复发提示；`REALAI-DEEPSEEK-CLOSEOUT-DRAFT-MINIMAL` 已完成代码侧接入，DeepSeek key 只走 server env 且 AI 不读取密钥文件，真实 provider smoke 仍需用户本地执行；服务器主线仍卡在真实服务器用户目录部署确认；Post-0.3 / Hermes 备案项 `AI-DRAFT-DEEPSEEK-SCHEMA-GUARD`、`HERMES-EXPERIMENT-BOOTSTRAP` 已登记到 planning / handoff，但当前仍不进入执行窗口。

## 2. 当前能力状态

| 能力 | 状态 |
|---|---|
| 项目 / workspace | ✅ 已可用 |
| 问题卡 | ✅ 已可用 |
| 排查记录 | ✅ 已可用 |
| 结案 / 归档 / 错误表 | ✅ 已可用 |
| SQLite 持久化 | ✅ 已可用 |
| Release 用户目录部署 | ✅ 已完成（含 reboot 验证） |
| systemd 开机自启动 | ✅ 已完成（含 reboot 验证） |
| Web UI + API 同端口 | ✅ 已完成（4100） |
| 搜索 | ✅ 已可用 |
| 标签 | ✅ 已可用 |
| 相似问题提示 | ✅ 已可用 |
| 历史问题关联 | ✅ 已可用 |
| 复发提示 | ✅ 已可用 |
| 归档复盘 | ✅ 已可用 |
| 数据备份 / 恢复 | 🟡 待验证（DATA-01） |
| AI-ready 草稿 | ✅ 已可用 |
| DeepSeek 结案草稿 | 🟡 代码已接，待用户 key smoke |
| 真实 AI | 🟡 closeout 草稿最小链路已接 |

## 3. 当前主线

| 项 | 内容 |
|---|---|
| 白天主线 | `DATA-01-SQLITE-BACKUP-SERVER-PATH-VERIFY` |
| 状态 | `current`，day-only |
| 依赖前置 | DEP-01~06 部署验证已完成（含 systemd reboot 验证） |
| 目标 | 确认服务器 `/home/hurricane/probeflash/shared/data` 备份/恢复流程不遗漏 WAL，可完整恢复 |
| UI 停止点 | `UI-GATE-06-MANUAL-QUICK-ISSUE-LAYOUT-REVIEW`，由用户人工检查桌面端和移动端观感 |

## 4. 当前 night-safe / repo-local 候选
- 当前没有可自动顺推的 UI 或真实 AI 任务；DeepSeek 真实 key smoke 需要用户本地执行，AI 不读取密钥文件。
- 其它 night-safe 候选暂不自动认领：`AIREADY-06-DRAFT-DIFF`、`CODECTX-01-BUNDLE-CLI`、`CODECTX-02-SECRETS-PROTECTION`、`CORE-07-ARCHIVE-FILTERS`。

## 4.1 B 组后顺序
- B 组功能完成后先修 UI，当前顺序为：`UI-GATE-01` completed -> `TECH-07` completed -> `UI-GATE-02` completed/manual accepted -> `UI-MOD-01` completed -> `UI-GATE-03` completed/user approved -> `UI-RELAYOUT-01` completed -> `UI-GATE-04` user-authorized copy trim -> `UI-POLISH-02` completed -> `UI-GATE-05` user-authorized quick issue layout -> `UI-POLISH-03` completed -> `UI-GATE-06-MANUAL-QUICK-ISSUE-LAYOUT-REVIEW` current/day-only。
- 当前必须停止，等待用户人工检查桌面端和移动端观感；不能自动进入下一轮 UI polish。

## 5. 最近完成
- `DEP-05/06-SYSTEMD-AUTOSTART`：`probeflash.service` 已 enabled，reboot 后自动 active，监听 `0.0.0.0:4100`，`/api/health` 正常，数据目录 `shared/data/probeflash.sqlite` 被使用，filebrowser 80 端口未受影响。
- `DEP-01~04-DEPLOY-VERIFICATION`：Web UI、version endpoint、health endpoint 均在服务器 `192.168.2.2:4100` 正常服务，独立 Node runtime `/home/hurricane/probeflash/runtime/node/bin/node v22.22.2`。
- `UI-POLISH-03-QUICK-ISSUE-LANDING-LAYOUT`：未选中问题时快速建卡主卡已放大，移除最小演示路径，辅助验证移到“未选中问题”提示框下方并标注仅测试；未改业务数据流、schema、repository、HTTP API 或 server。
- `REALAI-DEEPSEEK-CLOSEOUT-DRAFT-MINIMAL`：server-side DeepSeek adapter、AI status/draft route、desktop AI draft client、CloseoutForm DeepSeek 优先 / 本地规则兜底、DeepSeek 草稿历史来源与密钥禁读规则已完成；未读取或提交真实 key，真实 provider smoke 需用户本地执行。
- `UI-POLISH-02-COPY-TRIM`：已压缩顶部项目/存储成功态、项目弹窗、工作台入口、Knowledge Assist、追记、归档和结案辅助说明；保留服务器/存储错误态、Repair Task、真实 AI 未接入和文件写盘未接入等状态边界；未改业务数据流、schema、repository、HTTP API 或 server。
- `UI-RELAYOUT-01-WORKBENCH-FIRST-PASS`：默认主界面已从完整建卡大表单改为 QuickIssue landing；快速建卡新增 severity 选择；workbench 形成 Issue rail / 当前问题主线 / Knowledge Assist supporting 区；recurrence、related、similar、search 已统一到 Knowledge Assist；旧 `3.` / `4.` 编号文案已删除；未改 schema / repository / HTTP API / server / AI。
- `UI-MOD-01-PRE-RELAYOUT-COMPONENT-SPLIT`：已把快速建卡、完整建卡、问题列表、Knowledge Assist 四个面板、追记表单、排查时间线、结案表单和主线结果面板抽到独立 UI 模块；保持 render 顺序、className、test id、文案和数据流不变。
- `TECH-07-APP-TSX-MINIMAL-SPLIT`：已抽取 `WorkspaceChrome` / `ProjectContextShell`、`KnowledgeAssistPanel` 与 `IssueMainFlow` 纯展示壳；保持原 render 顺序、条件渲染和业务触发，不改 `App.css` 主视觉。
- `UI-GATE-01-MANUAL-VISUAL-DIRECTION`：用户已确认首屏分区、真实边界约束、`TECH-07` 最小拆分目标和第一轮 UI 修改范围；确认结果已落盘到 `ui-redesign-brief.md`，TECH-07 已按该 execution contract 执行。
- `AIREADY-05-DRAFT-HISTORY`：规则 closeout 草稿会保存浏览器本地历史，可审阅多次生成的来源时间、问题边界和草稿内容，并可清除；不接真实 AI、不自动写 archive / error-entry / issue；`verify:ai-ready-closeout-draft-panel` 已覆盖。
- `CORE-06-CLOSEOUT-PARTIAL-SAVE-HINTS`：结案写归档摘要、错误表或问题卡状态失败时，表单明确提示未归档成功，保留根因 / 修复结论 / 预防建议，并提示可重试或先处理 Repair Task；新增 `verify:core-closeout-partial-save-hints`。
- `CORE-03-RECENT-ISSUE-REOPEN`：新增 workspace-scoped 最近活跃问题本地状态；刷新 / 重开后回到当前项目最近未归档问题，缺失、已归档或 workspace 切换时安全降级；新增 `verify:core-recent-issue-reopen`。
- `CORE-02-WORKSPACE-UX-IMPROVEMENTS`：顶部项目 / 存储状态并入当前 workspace 身份，项目选择 / 创建入口、workspace 列表空态 / 错误态和 issue list 空态 / 错误态更清楚；新增 `verify:core-workspace-ux-improvements`。
- `UI-01-INFORMATION-ARCHITECTURE-REVIEW`：补齐最终信息架构，明确首屏区域、workspace/storage 状态位置、issue list/detail 主次关系、Knowledge Assist 区域、closeout 入口和 `CORE-02` 输入边界；未改 UI / CSS / 业务代码。
- `UI-REDESIGN-STAGE-BRIEF`：新增 UI 改造阶段 brief，建议进入受控 UI 小阶段；其推荐的 `UI-01` 已完成。

## 6. 当前不要碰
- 不创建 `apps/console`、dashboard UI 或新的项目管理 app。
- 不把项目管理 UI 塞进 ProbeFlash 产品本体。
- 不改 `apps/desktop` / `apps/server` 业务代码来满足本状态页。
- 不做 sudo、systemd（已验证完成）、`/opt`、真实服务器新建部署或 release/tag 修改（DEP-01~06 已完成）。
- 不读取、搜索、打印、总结或提交真实 API key；真实 DeepSeek smoke 只能由用户本地 source env 后执行。
- 不引入 RAG / embedding、权限系统、多租户、Electron / preload / fs / IPC。
- 不在 `UI-GATE-06` 人工 review / smoke 通过前执行下一轮 UI polish；不把快速建卡 landing 调整扩展成全量重写。

## 7. 用户下一步
- 今天完全不想动：停止自动推进；不做真实 key smoke。
- 想继续数据安全：先执行 DATA-01-SQLITE-BACKUP-SERVER-PATH-VERIFY，在服务器 `/home/hurricane/probeflash/shared/data` 路径执行备份，确认 WAL 文件不被遗漏。
- 想继续 UI：先人工启动 / 浏览检查快速建卡 landing 调整后的桌面端和移动端观感，再决定是否进入下一轮 UI polish。
- 只有 10 分钟：先执行 `UI-GATE-06` 人工 quick issue layout review，不切服务器。
- 想测 DeepSeek：用户自行创建并 source `/home/rainman/.config/probeflash/deepseek.env` 后启动 server，再在结案表单点“生成 AI 草稿”。

## 8. 状态来源
- `AGENTS.md`
- `docs/planning/current.md`
- `docs/planning/backlog.md`
- `docs/planning/product-roadmap.md`
- `docs/planning/decisions.md`
- `.agent-state/handoff.json`
- `git log --oneline -20`

---

# 跨 AI 应用 Skills 共享设计（2026-05-04 完成）

> 本节是历史性专项设计存档，**不是任务事实源**；执行规则以 `AGENTS.md §17 Skills Mirror Rule` 为准。本节允许超过本页 120 行硬限制（用户已明确豁免）。

## 9. 背景与问题

### 9.1 起点
`.agents/skills/` 下早已有 8 个 SKILL.md（`repo-onboard` / `planning` / `task-execution` / `task-verification` / `debug-intake` / `debug-hypothesis` / `debug-session-update` / `debug-closeout`），由 Codex 与 OpenCode 框架使用。这些 SKILL.md 用 Anthropic 标准 frontmatter（`name` + `description`），Claude Code 也能识别 —— 但 Claude Code 默认从 `.claude/skills/` 读取项目级 skill，不去读 `.agents/skills/`。

项目原本的 `.claude/skills` 是 0 字节只读占位文件（同目录下 `agents` / `commands` / `settings.json` 也都是 0 字节占位），导致 Claude Code 在 ProbeFlash 项目下加载不到任何项目级 skill —— 三个框架走在三条没有交点的路上。

### 9.2 目标
- **写入只一处**：未来新增或修改 skill 不必在两个目录手动同步。
- **读取最好也一处**：三个框架最好读同一份物理文件，杜绝漂移。
- **零认知负担**：Claude 不能因为"两个地方要同步"而下意识写错位置；下意识反应必须等于正确行为。

### 9.3 关键约束
- Claude Code 内置 sandbox 的 `denyWithinAllow` 列表锁住了 `.claude/skills/` 整个子树；**Claude 在沙箱内永远不能写 `.claude/skills/`**。这条规则不在用户可改的 `settings.json` 里，是 Claude Code 的硬编码自我保护（同列表里 `settings.json` / `settings.local.json` / `managed-settings.d` 都是配置文件保护）。
- bwrap 在为 `denyWithinAllow` 路径设置 bind-mount 挡板时用 `lstat`、不跟随 symlink；如果把 `.claude/skills` 做成 symlink，bwrap 误判为 file 类型 → mount 时内核解析 symlink 看到 directory → `EISDIR: Can't create file at .claude/skills` → **整个 Bash 工具瘫痪**。
- Codex 与 OpenCode 已经在用 `.agents/skills/`，迁移它们的读取路径会破坏既有约定。

## 10. 排除掉的方案

| 方案 | 否决原因 |
|---|---|
| 直接复制（两份独立维护） | 写入要两处，认知负担最重，易漂移 |
| `.claude/skills` 整体 symlink → `.agents/skills` | bwrap `lstat` 触发 EISDIR，沙箱起不来，Bash 全瘫（实测踩过） |
| per-skill 子 symlink（`.claude/skills/<x>` → `.agents/skills/<x>`） | 已有 skill OK，但**新增** skill 时 sandbox `denyWithinAllow` 仍禁止 Claude 在 `.claude/skills/` 下创建新条目；每个新 skill 都要用户手动 `ln -s` |
| Hard link（SKILL.md 共享 inode） | VS Code / vim / git 用 tempfile + rename 原子保存，会**静默断开** inode 链接，两边漂移而无人发现 |
| Bind mount（`mount --bind .agents/skills .claude/skills`） | 需 root + fstab 持久化；sandbox deny 仍挡 Claude 自身写；代价远大于收益 |
| 反向：`.claude/skills/` 当权威源 + `.agents/skills` symlink 过去 | sandbox 仍禁止 Claude 写 `.claude/skills/`，根问题没解 |
| 修改 Claude Code 内置 sandbox 把 `.claude/skills` 移出 deny 列表 | 规则硬编码在 harness，不在用户可改的 settings.json 中，不是工程上能落地的方向 |

## 11. 最终方案：权威源 + Hook 镜像

### 11.1 数据流

```
                       唯一权威源（三方都可写，Claude 默认写这里）
                       ┌──────────────────────────────────────────┐
                       │  .agents/skills/<name>/SKILL.md          │
                       └──────────────────────────────────────────┘
                                       │
                                       │ Claude Code Edit / Write 命中 .agents/skills/**
                                       │ 触发 PostToolUse hook（harness 进程，沙箱外）
                                       ▼
                       ┌──────────────────────────────────────────┐
                       │  .agents/hooks/sync-skills.sh            │
                       │  cp -p 源文件 → 镜像对应位置              │
                       └──────────────────────────────────────────┘
                                       │
                                       ▼
                       ┌──────────────────────────────────────────┐
                       │  .claude/skills/<name>/SKILL.md（镜像）  │  ← Claude Code 实际读取
                       └──────────────────────────────────────────┘

           Codex / OpenCode ───── 直接读 .agents/skills/
           Claude Code      ───── 读 .claude/skills/（经 hook 同步的副本）
```

### 11.2 为什么这个方案能满足全部三条目标

- **写入只一处**：Claude / Codex / OpenCode / 你 都只往 `.agents/skills/<name>/SKILL.md` 写。Claude Code 的 sandbox 也允许 Claude 直接写这里（不在 deny 列表）。
- **读取最好也一处**：Codex 和 OpenCode 直接读权威源；Claude Code 读镜像。镜像内容由 hook 自动维护，与权威源始终保持 byte-for-byte 一致（漂移哨兵兜底）。
- **零认知负担**：Claude 写 `.agents/skills/` 是它的自然反应（也是 sandbox 唯一允许的路径）；hook 在 harness 进程里做镜像，Claude 完全无感。Claude 永远不需要"想起来还要同步另一个目录"。

### 11.3 hook 在沙箱外执行（关键）

PostToolUse hook 不是 Claude 在沙箱内调用 Bash —— 它是 Claude Code harness 在 Claude 工具调用完成后、用 harness 自己的进程执行配置中声明的脚本。这条 harness 通路**绕过**了 sandbox 的 `denyWithinAllow`，所以 hook 能写 `.claude/skills/`（Claude 自己不能）。这是把"硬编码的写保护"和"零认知负担"两个看似冲突的需求兼容起来的关键。

## 12. 关键文件清单

| 路径 | 角色 | 维护方 |
|---|---|---|
| `.agents/skills/<name>/SKILL.md` | 唯一权威源 | Codex / OpenCode / Claude / 人 |
| `.agents/hooks/sync-skills.sh` | PostToolUse hook 脚本 | 一次性创建，后续不动 |
| `.agents/scripts/verify-skills-sync.sh` | 漂移哨兵 | 一次性创建，后续不动 |
| `.claude/settings.local.json` | 注册 PostToolUse hook | 一次性配置 |
| `.claude/skills/<name>/SKILL.md` | Claude Code 读取镜像（自动维护） | hook 自动 |
| `apps/desktop/package.json` | `verify:skills-sync` 挂入 `verify:all` | 加一行 |
| `AGENTS.md §17` | 操作规则 | 一次性写入 |
| `.agents/hooks/sync-skills.log` | 失败日志（成功时不存在） | hook 自动 |

## 13. 组件细节

### 13.1 hook 脚本 `.agents/hooks/sync-skills.sh`

行为：
1. 从 stdin 读 Claude Code hook payload（JSON）
2. 取 `tool_input.file_path`
3. 优先用环境变量 `CLAUDE_PROJECT_DIR` 作 ROOT；缺省时退到脚本自身 `dirname` 上溯两层
4. 仅当 `file_path` 落在 `<ROOT>/.agents/skills/` 子树内才动作
5. 计算相对路径，`mkdir -p` 镜像端父目录，`cp -p` 复制源文件（`-p` 保 mtime，有利于 diff）
6. 源文件不存在（被删）直接 exit 0，删除场景见 §14.3
7. 失败追加一行到 `<ROOT>/.agents/hooks/sync-skills.log` 后 exit 0（不阻塞 tool 调用）

设计取舍：
- jq 可用就用，缺失时退到 grep + sed 兜底，避免硬依赖
- 失败不抛错（`exit 0`）：hook 失败不应让原本的 Edit/Write 也失败；漂移由哨兵兜底
- `-p` 保 mtime：`diff -rq` 是按 size + mtime 速判，不保 mtime 会让哨兵每次都全量字节比较

### 13.2 PostToolUse 注册（`.claude/settings.local.json` 节选）

```json
"hooks": {
  "PostToolUse": [
    {
      "matcher": "Edit|Write",
      "hooks": [
        { "type": "command", "command": ".agents/hooks/sync-skills.sh" }
      ]
    }
  ]
}
```

matcher 只选 `Edit` 与 `Write`，因为只有这两个工具会修改 SKILL.md 文件；Bash 工具下的 `mv` / `rm` / `vim` 等不会触发 hook（见 §15 风险）。

### 13.3 漂移哨兵 `.agents/scripts/verify-skills-sync.sh`

- `diff -rq .agents/skills .claude/skills`，有任何差异 exit 1 并打印 "fix" 提示
- 通过 npm script `verify:skills-sync` 暴露，挂入 `verify:all` 末尾
- 在 `apps/desktop/package.json` 中：`"verify:skills-sync": "../../.agents/scripts/verify-skills-sync.sh"`

## 14. 操作规程

### 14.1 新增 skill（标准路径）
- Claude / 人 / Codex / OpenCode 在 `.agents/skills/<new-name>/SKILL.md` 创建文件
- **若使用 Claude Code 的 Edit / Write 工具**：hook 自动镜像，无需手动操作
- **若使用 vim / cat / 编辑器 / shell 重定向**：hook 不会触发，需要手动跑一次 `cp -rp .agents/skills/. .claude/skills/`

### 14.2 修改已有 skill
同上。Edit/Write 自动镜像；非工具修改后跑全量 cp 兜底。

### 14.3 删除 skill
- 删 `.agents/skills/<name>/`
- **必须**手动 `rm -rf .claude/skills/<name>` 同步；hook 当前只复制不删
- 跑哨兵确认 exit=0

### 14.4 漂移恢复
跑 `verify:skills-sync` 报 drift 时，按提示执行：
```bash
cp -rp .agents/skills/. .claude/skills/         # 内容/新增对齐
# 若有删除，逐个 rm -rf .claude/skills/<gone>
```

### 14.5 排查 hook 失败
- 看 `.agents/hooks/sync-skills.log`（只在失败时出现）
- 临时开 trace：`bash -x .agents/hooks/sync-skills.sh < payload.json`
- 确认 `CLAUDE_PROJECT_DIR` 是否被注入（脚本有 dirname 缺省兜底）

## 15. 风险与已知边界

| 风险 | 缓解 |
|---|---|
| hook 静默失败 → 漂移而无人发现 | 漂移哨兵挂在 `verify:all` 末尾；hook 自身写 `sync-skills.log` |
| 用户/Codex 直接 vim 编辑 → 不触发 hook | AGENTS.md §17 明确"非工具修改后跑一次全量 cp"；哨兵兜底 |
| 删除 skill 不会触发镜像删除 | 操作规程 §14.3 明确手动 `rm -rf` |
| `.claude/settings.local.json` 在 sandbox deny 内 → Claude 不能改 hook 配置 | 一次性由用户手动配置；改动属于罕见操作 |
| Claude Code 升级后内置 sandbox 规则可能变化 | 设计与具体规则解耦，只要 PostToolUse hook 机制还在，本方案就成立 |
| 某些 skill 包含 SKILL.md 之外的资源文件（图片、参考脚本） | 当前 hook 是文件级 cp，会复制单个被改的文件；若新增其他类型资源，首次需要全量 `cp -rp` |
| `debug-hypothesis` / `debug-session-update` 含非标准 frontmatter `trigger:` 字段 | Claude Code 实测忽略；若未来报错，删行即可，Codex/OpenCode 不依赖 |

## 16. 验证记录（2026-05-04 落地当日）

| 验证项 | 方法 | 结果 |
|---|---|---|
| 8 个 skill 在 Claude Code 系统列表中可见 | 重启 Claude Code 后 system reminder 列表 | ✅ 全部显示 |
| 首次全量同步 | `cp -rp .agents/skills/. .claude/skills/` 后 `ls .claude/skills/` | ✅ 8 个目录存在 |
| 实时同步增加内容 | Edit `.agents/skills/planning/SKILL.md` 加 `<!-- hook-sync-test: probe-mark -->` | ✅ 镜像第 5 行立刻出现同样标记 |
| 实时同步删除内容 | Edit 撤销上一步 | ✅ 镜像第 5 行恢复空行 |
| Hook 无失败 | 检查 `.agents/hooks/sync-skills.log` | ✅ 文件不存在（0 失败） |
| 漂移哨兵 exit=0 | `.agents/scripts/verify-skills-sync.sh` | ✅ exit=0，输出为空 |
| `verify:skills-sync` 挂入 verify | `cd apps/desktop && npm run verify:skills-sync` | ✅ exit=0 |
| Sandbox 健康 | Edit/Write 工具能写 `.agents/`，Bash 不再报 EISDIR | ✅ |

## 17. 未来可演化点（非当前任务）

- **删除自动镜像**：hook 监听不到 Bash `rm`，可改为 PreToolUse + 路径白名单，或加一个 PostToolUse 钩子配 fanotify；当前手动 `rm -rf` 已够用
- **多资源文件支持**：若 skill 拆出 README、图片等资源，hook 需要改成"对子目录做 rsync 而非单文件 cp"；改动量小，触发条件再说
- **跨项目级 skill 共享**：本方案只解项目级；若想把同一组 skill 放到 `~/.claude/skills/` 给所有项目共用，需要把 skill 内的 ProbeFlash 专属路径（`docs/planning/current.md`、`.agent-state/handoff.json`、`apps/desktop`）抽象成参数，代价不小，目前不做

## 18. 给未来 Claude（自己）的备忘

- 项目 skill 永远写到 `.agents/skills/<name>/SKILL.md`，**不要碰 `.claude/skills/`**；sandbox 也会拒绝你写
- 新增 skill 用 Edit/Write 工具，hook 自动镜像；用 Bash mkdir + cat 写入则需要提示用户跑一次全量 cp
- 删除 skill 后，记得提醒用户手动 `rm -rf .claude/skills/<gone>`
- 哨兵报 drift，先看 `.agents/hooks/sync-skills.log`，再跑全量 cp 修复
- 详细规则见 `AGENTS.md §17`，本节是完整设计与历史背景
