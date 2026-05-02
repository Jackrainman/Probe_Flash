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
