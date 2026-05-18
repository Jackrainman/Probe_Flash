# Backlog（pivot 后）

> 一行一候选；状态字段：`current` / `pending` / `frozen` / `decision-needed`。当前唯一任务见 `now.md`，长期路线见 `roadmap.md`，长期决策见 `decisions.md`。pre-pivot backlog 历史快照 → `docs/archive/v0.3-pivot/backlog.md`。

## 认领规则（pivot 后）

1. 每次只认领一个原子任务，未 commit 不进入下一任务。
2. 备赛期只允许 SKILL 类自用任务；BRIDGE / TRAIL 都 pending 到备赛后。
3. ProbeFlash v0.3 已冻结：不再认领 TECH / AIREADY / REALAI / CODECTX / DEP / DATA / UI / CORE / SEARCH 任务；致命补丁除外。
4. 冷静期：决定写代码前让判断沉 48-72h，不冲动开新坑。
5. 候选池只在本文件；`roadmap.md` 不构成候选源。若 `now.md` frontier 项在本文件无对应行，视为脱节，必须先补本文件再认领；不允许"凭空 frontier"。

## P0 — Skill 自用闭环（备赛期窗口）

| 任务 | 状态 | type | 内容 |
|------|------|------|------|
| SKILL-01-DEBUG-CHECKLIST-V0_0_1 | done | skill | 已落地 v0.0.1 于 f5df2bf；DoD = SKILL.md 落地 + verify:skills-sync 通过（已闭环） |
| SKILL-02-DOGFOOD-NOTE | pending | docs | 起 `docs/dogfood/` 目录；备赛期每次用 / 没用都写 1-3 行；30 天后回看 |
| SKILL-03-PROMPT-ITERATION | pending | skill | 基于 dogfood 数据调 SKILL.md 的 prompt 模板；只动 SKILL.md，不动其他 |
| SKILL-04-PERSONAL-DAILY-SUMMARY | done | skill | 已落地 v0.0.1 于 93dc7d0；DoD = SKILL.md 落地 + verify:skills-sync 通过（已闭环） |

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
