# Now

> 唯一当前战况源。Pivot 后重设。pre-pivot 历史快照 → `docs/archive/v0.3-pivot/`。

```yaml
mode: post_pivot_self_dogfood
stage: 备赛期 self-iteration only
stage_goal: 完善 debug-checklist skill + 探索个人日报/周报 skill；不动 v0.3 现有代码
current_task: SKILL-01-DEBUG-CHECKLIST-V0_0_1
frontier:
  - SKILL-01-DEBUG-CHECKLIST-V0_0_1   # current；写完即开始 dogfood
  - SKILL-02-DOGFOOD-NOTE             # pending；备赛期间记 用了/没用 + 为什么
  - SKILL-04-PERSONAL-DAILY-SUMMARY   # pending；备赛期可做，极简日报/周报 skill
night_run: paused  # 备赛期，不夜跑；自用为主
blocked: []
post_pivot_registry:
  - BRIDGE-01-ROSTER-SCHEMA           # 备赛后启动
  - BRIDGE-02-PRINTABLE-V0            # 备赛后启动
  - TRAIL-01-VIEWER-DESIGN            # 等 .debug-archive ≥ 20 条
frozen:
  - probeflash-v0.3.0                 # 不再加功能、不重构；致命补丁除外
```

## 当前任务
- **SKILL-01-DEBUG-CHECKLIST-V0_0_1**（current）
- 目标：在 `.agents/skills/debug-checklist/SKILL.md` 落第一版协议。一句症状描述 → 5-8 条带依据和验证动作的检查清单 → 可选写入 `.debug-archive/`。
- 边界：只动 `.agents/skills/debug-checklist/`；不动 `.agents/skills/debug-*` 已有 6 个 skill；不动 ProbeFlash 现有任何代码。
- DoD：SKILL.md 含触发示例、输入、输出 markdown 模板、协议、存档 schema、约束、不做的事；hook 自动同步到 `.claude/skills/`；`verify:skills-sync` 通过；`git diff --check` 干净。
- 验证：`cd apps/desktop && npm run verify:skills-sync`；`git diff --check`。

## 前沿候选（≤3）
- SKILL-02-DOGFOOD-NOTE（pending，备赛期窗口）：起 `docs/dogfood/` 目录，备赛期每次用 / 没用 skill 都写 1-3 行；30 天后回看。
- SKILL-03-PROMPT-ITERATION（pending，备赛期窗口）：基于 dogfood 数据调 SKILL.md 的 prompt 模板；只动 SKILL.md。
- SKILL-04-PERSONAL-DAILY-SUMMARY（pending，备赛期窗口）：极简日报/周报 skill，每天问"今天干了啥"，生成个人 markdown 存档。备赛期可做，不动 v0.3。

## 阻塞 / 待拍板
- 无当前阻塞。
- BRIDGE / TRAIL 系任务全部 pending 至备赛后。
- 2026-05-10 方向讨论定调：三层诉求（个人周总结 / 团队阻塞可见 / 调试闭环）对应三 facet（Trail / Bridge / Skill）；设计宪法 #2 明确为"阻塞可见但不比产能"——仪表盘显示任务状态，不显示人与人的排名。

## 已冻结
- ProbeFlash v0.3 全部代码（apps/desktop、apps/server、release 流程）：不再加功能、不再重构、不再写 verify。
- pre-pivot backlog 全部任务（TECH-* / AIREADY-* / REALAI-* / CODECTX-* / DEP-* / DATA-* / UI-* / CORE-* / SEARCH-*）：不再认领；详细见 `docs/archive/v0.3-pivot/backlog.md`。

## 安全边界（pivot 后仍生效）
- 不动 ProbeFlash v0.3 现有 server / SQLite / API。
- AI / Skill 不读 `.env` / `*key*` / `*secret*`；不打印密钥。
- 备赛期不夜跑；自用为主，不批量推进。
- v0.3 出致命问题再打补丁，否则不回头。
- 冷静期 48-72h：写代码前让判断沉两天，不冲动开新坑。

## 能力速览（pivot 后）
| 能力 | 状态 |
|---|---|
| ProbeFlash v0.3 完整产品（含部署 / systemd / verify 全套） | ✅ 冻结 |
| Skill: `debug-checklist` v0.0.1 | 🟡 SKILL-01 current |
| Skill: 个人日报/周报 | 🟢 SKILL-04 备赛期可做 |
| Skill dogfood 记录 | ⏳ SKILL-02 备赛期窗口 |
| Bridge / 联调板（阻塞可见 + 帮忙配对） | ⏸️ 备赛后启动 |
| Trail / 足迹档案（含自动周总结） | ⏸️ 等 archive 数据积累 |

## 最近完成（详见 `git log`）
- 2026-05-10 方向复核讨论：三层诉求（个人周总结 / 团队阻塞可见 / 调试闭环）映射到三 facet（Trail / Bridge / Skill）；设计宪法 #2 明确为"阻塞可见但不比产能"。
- 2026-05-07 pivot 决策落地：planning 全部重写；pre-pivot 历史快照到 `docs/archive/v0.3-pivot/`；`decisions.md` 追加 D-018。
- 2026-05-07 SKILL-01-DEBUG-CHECKLIST-V0_0_1：`.agents/skills/debug-checklist/SKILL.md` v0.0.1 落地。
- pre-pivot 完成历史看 `docs/archive/v0.3-pivot/now.md`。
