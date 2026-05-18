# Now

> 唯一当前战况源。Pivot 后重设。pre-pivot 历史快照 → `docs/archive/v0.3-pivot/`。

```yaml
mode: post_pivot_self_dogfood
stage: 备赛期 self-iteration + 飞书架构验证
stage_goal: 完善 debug-checklist skill + 验证飞书接入可行性；不动 v0.3 现有代码
current_task: null  # T1/T2/T3 完成后下次重新拍板
frontier: []  # T1/T2/T3 完成后下次重新拍板；不预选
blocked:
  - BRIDGE-01-ROSTER-SCHEMA              # 等 LARK-02 完成后再设计 schema
post_pivot_registry:
  - BRIDGE-03-LARK-INTEGRATION           # 备赛后随 LARK 系列重评
  - TRAIL-01-VIEWER-DESIGN               # 等 .debug-archive ≥ 20 条
frozen:
  - probeflash-v0.3.0                    # 不再加功能、不重构；致命补丁除外
```

## 当前任务

_无。T1/T2/T3 脚手架补强完成后下次拍板。_

## 架构定位（2026-05-15）

ProbeFlash = 中央处理枢纽；飞书 = 输入数据源 + 通知层。详见 `roadmap.md` §0。改动要点：放弃微信接入；允许轻量 server 仅做飞书对接；今年验证目标 = "飞书消息 → ProbeFlash 处理 → 飞书回复" 闭环。

## 阻塞 / 待拍板

- **BRIDGE 设计 pending**：等 LARK-02 飞书 API 调研完成，确认可用数据字段后再定 schema
- **是否值得接入飞书**：如果 API 权限审批极难或能力受限，可能退回纯本地方案

## 已冻结

- ProbeFlash v0.3 全部代码（apps/desktop、apps/server、release 流程）：不再加功能、不再重构、不再写 verify。
- pre-pivot backlog 全部任务（TECH-* / AIREADY-* / REALAI-* / CODECTX-* / DEP-* / DATA-* / UI-* / CORE-* / SEARCH-*）：不再认领；详细见 `docs/archive/v0.3-pivot/backlog.md`。
- **原 BRIDGE-02-PRINTABLE-V0**：暂存不动；备赛后随 BRIDGE 系列重评（LARK-03 当前不在候选池）

## 安全边界（pivot 后仍生效）

- 不动 v0.3 server / SQLite / API（致命补丁除外）。
- AI / Skill 不读 / 打印密钥（`.env` / `*key*` / `*secret*`）。
- 备赛期不夜跑；自用为主。
- 冷静期 48-72h：写代码前让判断沉两天。

## 最近完成（详见 `git log`）

- 2026-05-17 SKILL-01-DEBUG-CHECKLIST-V0_0_1 工程闭环承认：v0.0.1 在 `f5df2bf` 已落地于 `.agents/skills/debug-checklist/SKILL.md`；DoD（"积累 20+ 条 archive"）属产品价值非工程谓词，不在原子任务 DoD 范围。
- 2026-05-17 AI 脚手架设计 spec 起草（`da1b666`）+ M3 修订（`86cdedf`）：`docs/superpowers/specs/2026-05-17-ai-scaffolding-design.md`。
- 2026-05-17 软件工程复用 review 归档 `docs/archive/reviews/2026-05-17-se-review.md`（飞书 SDK / Hono / Quartz / monorepo / workflow protocol 归档等 10 条建议；用户态度待回填，未触发任何实施）。
- 2026-05-17 planning 文档瘦身：`now.md` / `roadmap.md` 移除冗余图与状态表（默认读取链 -18%）；新建 `docs/planning/visuals.md` 集中可视化材料（按需读取、显式更新）；AGENTS.md §2 加约束。
- 2026-05-15 架构定位更新：确定 ProbeFlash 为中央枢纽、飞书为数据层的架构方向
