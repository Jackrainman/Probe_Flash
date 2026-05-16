# Now

> 唯一当前战况源。Pivot 后重设。pre-pivot 历史快照 → `docs/archive/v0.3-pivot/`。

```yaml
mode: post_pivot_self_dogfood
stage: 备赛期 self-iteration + 飞书架构验证
stage_goal: 完善 debug-checklist skill + 验证飞书接入可行性；不动 v0.3 现有代码
current_task: SKILL-01-DEBUG-CHECKLIST-V0_0_1
frontier:
  - SKILL-01-DEBUG-CHECKLIST-V0_0_1      # current；debug-checklist v0.0.1 自用
  - SKILL-04-PERSONAL-DAILY-SUMMARY      # current；v0.0.1 已落地，备赛期可用
  - LARK-01-CONNECTOR-DESIGN             # pending；飞书 agent 架构设计
  - LARK-02-API-INVESTIGATION            # pending；调研飞书开放平台能力边界
blocked:
  - BRIDGE-01-ROSTER-SCHEMA              # 等 LARK-02 完成后再设计 schema
post_pivot_registry:
  - BRIDGE-03-LARK-INTEGRATION           # 飞书对接版本，替代原 printable-v0
  - TRAIL-01-VIEWER-DESIGN               # 等 .debug-archive ≥ 20 条
frozen:
  - probeflash-v0.3.0                    # 不再加功能、不重构；致命补丁除外
```

## 当前任务

### SKILL-01-DEBUG-CHECKLIST-V0_0_1（进行中）
- 目标：`.agents/skills/debug-checklist/SKILL.md` 持续迭代，自用喂养 debug-archive
- 边界：只动 SKILL.md；不动 v0.3 代码
- DoD：每次调试问题都尝试用 skill 记录，积累 20+ 条 archive

### SKILL-04-PERSONAL-DAILY-SUMMARY（已落地，使用中）
- 目标：个人日报/周报生成，结合 git log 和口述补充
- 状态：v0.0.1 已落地于 `.agents/skills/personal-daily-summary/SKILL.md`
- 用途：备赛期记录技术学习轨迹（ROS/MPC/RL方向），为明年知识传承留素材

### LARK-01-CONNECTOR-DESIGN（待启动）
- 目标：设计 ProbeFlash ↔ 飞书 的双向对接架构
- 核心问题：飞书作为输入数据源（替代微信），ProbeFlash 作为中央处理枢纽
- 产出：`docs/design/lark-connector-arch.md`

### LARK-02-API-INVESTIGATION（待启动）
- 目标：调研飞书开放平台 API 能力边界
- 关键确认项：
  - 能否读取群聊消息？权限审批难度？
  - 多维表格 API 的读写能力？
  - webhook 推送延迟和可靠性？
  - 企业内部应用 vs 第三方应用的权限差异？
- 产出：飞书能力评估报告，决定哪些数据走飞书、哪些留本地

## 架构定位（2026-05-15）

ProbeFlash = 中央处理枢纽；飞书 = 输入数据源 + 通知层。详见 `roadmap.md` §0。改动要点：放弃微信接入；允许轻量 server 仅做飞书对接；今年验证目标 = "飞书消息 → ProbeFlash 处理 → 飞书回复" 闭环。

## 阻塞 / 待拍板

- **BRIDGE 设计 pending**：等 LARK-02 飞书 API 调研完成，确认可用数据字段后再定 schema
- **是否值得接入飞书**：如果 API 权限审批极难或能力受限，可能退回纯本地方案

## 已冻结

- ProbeFlash v0.3 全部代码（apps/desktop、apps/server、release 流程）：不再加功能、不再重构、不再写 verify。
- pre-pivot backlog 全部任务（TECH-* / AIREADY-* / REALAI-* / CODECTX-* / DEP-* / DATA-* / UI-* / CORE-* / SEARCH-*）：不再认领；详细见 `docs/archive/v0.3-pivot/backlog.md`。
- **原 BRIDGE-02-PRINTABLE-V0**：被 LARK-03 替代，不再推进纯静态方案

## 安全边界（pivot 后仍生效）

- 不动 v0.3 server / SQLite / API（致命补丁除外）。
- AI / Skill 不读 / 打印密钥（`.env` / `*key*` / `*secret*`）。
- 备赛期不夜跑；自用为主。
- 冷静期 48-72h：写代码前让判断沉两天。

## 最近完成（详见 `git log`）

- 2026-05-17 planning 文档瘦身：`now.md` / `roadmap.md` 移除冗余图与状态表（默认读取链 -18%）；新建 `docs/planning/visuals.md` 集中可视化材料（按需读取、显式更新）；AGENTS.md §2 加约束。
- 2026-05-15 架构定位更新：确定 ProbeFlash 为中央枢纽、飞书为数据层的架构方向
- 2026-05-15 新增 skill：`pre-match-checklist` v0.0.1 落地，覆盖赛前检查单场景
- 2026-05-15 STM32 问题归档：uart-idle/systick/heap 三经典陷阱入库
- 2026-05-10 方向复核讨论：三层诉求（个人周总结 / 团队阻塞可见 / 调试闭环）映射到三 facet（Trail / Bridge / Skill）；设计宪法 #2 明确为"阻塞可见但不比产能"。
