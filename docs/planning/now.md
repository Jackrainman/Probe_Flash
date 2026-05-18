# Now

> 唯一当前战况源。Pivot 后重设。pre-pivot 历史快照 → `docs/archive/v0.3-pivot/`。

```yaml
mode: post_pivot_self_dogfood
stage: 备赛期 self-iteration + 飞书接入推进
stage_goal: 完善 debug-checklist skill 自用迭代 + 推进飞书接入（gemini 已完成 API 能力调研，下一步把调研落到仓库 + 找开源候选 + 路径决策）
current_task: null  # LARK-OSS-SCAN 已完成；frontier 首个 = LARK-PATH-DECISION（草稿态：写 ADR D-021 草稿后停等用户拍板）
frontier:
  - LARK-PATH-DECISION           # 用开源 vs 自写最小 gateway 的 ADR D-021；草稿态需用户拍板
blocked:
  - BRIDGE-01-ROSTER-SCHEMA              # 等 BRIDGE 备赛后启动
  - LARK-01-CONNECTOR-ARCH               # 等 PATH-DECISION
  - LARK-03-MIN-INTEGRATION              # 等 LARK-01 + 飞书企业内部应用注册
post_pivot_registry:
  - BRIDGE-03-LARK-INTEGRATION           # 备赛后随 LARK 系列重评
  - TRAIL-01-VIEWER-DESIGN               # 等 .debug-archive ≥ 20 条
frozen:
  - probeflash-v0.3.0                    # 不再加功能、不重构；致命补丁除外
```

## 当前任务

_无。2026-05-19 LARK-OSS-SCAN 已完成：`docs/research/lark-oss-candidates.md` + decisions.md 追"D-020 后续"结论。下次拍板从 frontier 取首个 = `LARK-PATH-DECISION`（草稿态：用户接力链中 AI 写 ADR D-021 草稿后停等用户拍板）。_

## 架构定位（2026-05-15）

ProbeFlash = 中央处理枢纽；飞书 = 输入数据源 + 通知层。详见 `roadmap.md` §0。改动要点：放弃微信接入；允许轻量 server 仅做飞书对接；今年验证目标 = "飞书消息 → ProbeFlash 处理 → 飞书回复" 闭环。Gemini API 能力调研已落地 `docs/research/lark-api-capability.md`（D-020）；Node-TS 栈 OSS 候选已盘点 `docs/research/lark-oss-candidates.md`（D-020 后续）。

## 阻塞 / 待拍板

- **LARK-PATH-DECISION**：用开源（`@larksuiteoapi/node-sdk`）vs 自写最小 gateway——AI 写 D-021 草稿后停等用户拍板
- **BRIDGE 设计**：等 LARK-PATH-DECISION + LARK-03 跑通后再启动（`docs/superpowers/specs/2026-05-18-bridge-roster-design.md` 已 forward-looking）
- **是否值得接入飞书**：gemini 调研已覆盖能力 / 限制 / 鉴权；最终判断在 LARK-PATH-DECISION 之后

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

- 2026-05-19 LARK-OSS-SCAN 落地：`docs/research/lark-oss-candidates.md`（路径 A 最优 SDK = `@larksuiteoapi/node-sdk`；路径 B 自写 gateway 工程量估算 ~250 行）+ decisions.md 追 D-020 后续结论。
- 2026-05-19 LARK-02-CAPABILITY-MIRROR 落地：`docs/research/lark-api-capability.md` + `decisions.md` D-020；gemini 两份报告事实底座固化到工程仓库。
- 2026-05-19 仓库大清理 5 commit：基础（gitignore/AGENTS 路径修正/forward-looking 标注/stale 分支删/templates 删/archive README）+ docs/product 整目录归档到 `v0.3-pivot/product/` + 5 个 v0.3 debug skill 退役到 `.agents/skill-library/`（active Claude 触发面只剩 4 个）+ specs/ 加 README 统一 status 词汇 + 本次 now+backlog 校齐 + LARK 备赛期解锁。
- 2026-05-17 AI 脚手架 spec/plan 已标 archived（M1/M2/M3 + C1 全部落地，详见 `docs/superpowers/specs/2026-05-17-ai-scaffolding-design.md` frontmatter）。
- 2026-05-17 SKILL-05-PRE-MATCH-CHECKLIST v0.0.1 落地（commit `9beb907`，赛前出征检查单 skill）。
