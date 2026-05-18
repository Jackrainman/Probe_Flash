# Backlog（pivot 后）

> 一行一候选；状态字段：`current` / `pending` / `frozen` / `decision-needed`。当前唯一任务见 `now.md`，长期路线见 `roadmap.md`，长期决策见 `decisions.md`。pre-pivot backlog 历史快照 → `docs/archive/v0.3-pivot/backlog.md`。

## 认领规则（pivot 后）

1. 每次只认领一个原子任务，未 commit 不进入下一任务。
2. 备赛期允许的任务类型：**SKILL 自用任务 + LARK 飞书接入**（飞书接入是 `now.md.stage_goal` 之一，gemini 已完成 API 调研）；BRIDGE / TRAIL 仍 pending 到备赛后。
3. ProbeFlash v0.3 已冻结：不再认领 TECH / AIREADY / REALAI / CODECTX / DEP / DATA / UI / CORE / SEARCH 任务；致命补丁除外。
4. 冷静期：决定写代码前让判断沉 48-72h，不冲动开新坑。
5. 候选池只在本文件；`roadmap.md` 不构成候选源。若 `now.md` frontier 项在本文件无对应行，视为脱节，必须先补本文件再认领；不允许"凭空 frontier"。

## P0 — Skill 自用闭环（备赛期窗口）

| 任务 | 状态 | type | 内容 |
|------|------|------|------|
| SKILL-01-DEBUG-CHECKLIST-V0_0_1 | done | skill | 已落地 v0.0.1 于 `f5df2bf`；DoD = SKILL.md 落地 + verify:skills-sync 通过（已闭环） |
| SKILL-02-DOGFOOD-NOTE | done | docs | 目录 + 模板已落地于 `f5df2bf`（`docs/dogfood/README.md`）；DoD = `test -f docs/dogfood/README.md`（已闭环）。"每次写 1-3 行"是行为非任务、"30 天后回看"是产品观察非工程谓词，按 M2 均不入原子任务 DoD |
| SKILL-03-PROMPT-ITERATION | pending（dogfood ≥ 30 天） | skill | 基于 dogfood 数据调 SKILL.md 的 prompt 模板；只动 SKILL.md，不动其他 |
| SKILL-04-PERSONAL-DAILY-SUMMARY | done | skill | 已落地 v0.0.1 于 `93dc7d0`；DoD = SKILL.md 落地 + verify:skills-sync 通过（已闭环） |
| SKILL-05-PRE-MATCH-CHECKLIST | done | skill | 已落地 v0.0.1 于 `9beb907`；DoD = SKILL.md 落地 + verify:skills-sync 通过（已闭环） |

## P0 — LARK 飞书接入（备赛期 stage_goal 之一）

| 任务 | 状态 | type | 内容 |
|------|------|------|------|
| LARK-02-CAPABILITY-MIRROR | done | research | 已落地于 2026-05-19；`docs/research/lark-api-capability.md` + `decisions.md` D-020；gemini 两份报告事实底座固化到工程仓库 |
| LARK-OSS-SCAN | done | research | 已落地于 2026-05-19；`docs/research/lark-oss-candidates.md` + decisions.md 追 D-020 后续结论；路径 A 最优基座 = `@larksuiteoapi/node-sdk`，路径 B ~250 行核心代码 |
| LARK-PATH-DECISION | done | docs | 用户已拍板（2026-05-19）路径 A（`@larksuiteoapi/node-sdk`），SDK 长期依赖 + Long Connection 模式 + "先接进去看看再优化"；decisions.md D-021 落终态 DECIDED |
| LARK-01-CONNECTOR-ARCH | pending（已解锁） | design | 飞书 agent 与 ProbeFlash 的接口设计；产出 `docs/design/lark-connector.md`；基于 `@larksuiteoapi/node-sdk` + Long Connection 模式 |
| LARK-03-MIN-INTEGRATION | pending（已解锁，代码部分） | code | 跑通"飞书消息 → ProbeFlash → 飞书回复"最小闭环；@机器人"调试底盘电机不转"→ 返回 debug-checklist 输出；**真实 provider smoke 留用户本地执行** |

## P1 — Bridge（备赛后启动）

| 任务 | 状态 | type | 内容 |
|------|------|------|------|
| BRIDGE-01-ROSTER-SCHEMA | pending（备赛后） | docs | 在 `docs/bridge/ROSTER.schema.md` 起一份 markdown schema；先打印贴墙试用 |
| BRIDGE-02-PRINTABLE-V0 | pending（备赛后） | design | schema 跑通后做一个能打印的纯 markdown 模板，无网页 |
| BRIDGE-03-READONLY-VIEWER | pending（备赛后） | design | 决定要不要做 web 只读视图；要做就把 v0.3 网页 UI 改造为 markdown viewer |
| BRIDGE-04-WORKLOAD-VISIBILITY | pending（备赛后） | design | "谁被任务卡住 + 需要什么帮助"——只显示任务阻塞，不显示人与人的产能排名。可辅助"简单任务的人去帮卡住的人"配对 |

## P2 — Trail（archive 数据足够后启动）

| 任务 | 状态 | type | 内容 |
|------|------|------|------|
| TRAIL-01-VIEWER-DESIGN | pending（archive ≥ 20 条） | design | 设计三种视图：个人足迹 / 模块史 / 赛季年鉴 |
| TRAIL-02-AUTO-WEAVE | pending | design | AI 把 `.debug-archive/` + 个人日报织成"成长摘要" |
| TRAIL-03-V03-UI-RETIRE | pending | design | v0.3 网页 UI 退役为 Trail 的 markdown viewer |
| TRAIL-04-WEEKLY-SUMMARY | pending | design | 自动聚合个人日报/周报 + debug 记录，生成"这周干了啥"的可分享摘要。直接回答老师/学长问话 |

## 已冻结（pre-pivot，不再认领）

- TECH-01..10 全部完成 → 冻结于 v0.3
- AIREADY-02..10：部分完成；剩余不再推进
- REALAI-05..09：等真实 provider key smoke；不再推进
- CODECTX-01..09：bundle CLI / repo connector；不再推进
- DEP-08：release update / rollback verify；不再推进
- DATA-01..07：服务器路径 backup/restore 复验；不再推进
- UI-GATE-06、UI-* 系列：不再推进
- CORE-07..09、SEARCH-05..06：不再推进
- 历史详情见 `docs/archive/v0.3-pivot/backlog.md`。
- 仅当 v0.3 出致命安全 / 数据破坏问题时再开补丁任务。

## Decision-needed

- 备赛后 Bridge schema 第一版要不要含"AI 自动汇总周状态"——决定取决于 dogfood 期间是否有这种需求暴露出来。
- v0.3 网页 UI 是否真改造为 Trail viewer——等 Trail 数据 ≥ 20 条再决定。

## 当前不做

- 不为 v0.3 加新功能、不重构、不 polish。
- 不在备赛期启动 Bridge / Trail。
- 不做人与人比较的产能排名 / 绩效统计 / 多租户 / 权限。任务阻塞可见（"这个任务卡了 3 天需要人帮"）≠ 产能排名（"张三比李四干得多"），前者允许。
- 不做 RAG / embedding / Electron / fs / IPC。
- 不抢占服务器 80 端口；不升级系统 Node。
- 不读 / 搜索 / 提交真实 API key。
- 不依赖学校战队配合作为产品验证。
