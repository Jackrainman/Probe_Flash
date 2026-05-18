# Now

> 唯一当前战况源。Pivot 后重设。pre-pivot 历史快照 → `docs/archive/v0.3-pivot/`。

```yaml
mode: post_pivot_self_dogfood
stage: 备赛期 self-iteration + 飞书接入推进
stage_goal: 完善 debug-checklist skill 自用迭代 + 推进飞书接入（gemini 已完成 API 能力调研，下一步把调研落到仓库 + 找开源候选 + 路径决策）
current_task: null  # D-021 用户已拍板路径 A；frontier 首个 = LARK-01-CONNECTOR-ARCH
frontier:
  - LARK-01-CONNECTOR-ARCH       # 设计 docs/design/lark-connector.md（基于 @larksuiteoapi/node-sdk + Long Connection）
  - LARK-03-MIN-INTEGRATION      # PATH-DECISION 已拍板，代码部分可推进（不含真实 provider smoke）
  - LARK-ONBOARD-GUIDE           # 用户线下动作清单（飞书后台注册 / 4 凭证 .env / 本地 smoke）
blocked:
  - BRIDGE-01-ROSTER-SCHEMA              # 等 BRIDGE 备赛后启动
post_pivot_registry:
  - BRIDGE-03-LARK-INTEGRATION           # 备赛后随 LARK 系列重评
  - TRAIL-01-VIEWER-DESIGN               # 等 .debug-archive ≥ 20 条
frozen:
  - probeflash-v0.3.0                    # 不再加功能、不重构；致命补丁除外
```

## 当前任务

_无。2026-05-19 LARK-PATH-DECISION 用户已拍板：**路径 A**（`@larksuiteoapi/node-sdk`），SDK 长期依赖 + Long Connection 模式 + "先接进去看看，有问题或者有时间再去优化"。D-021 已落终态。下次拍板从 frontier 取首个 = `LARK-01-CONNECTOR-ARCH`（用户接力链继续推进）。_

## 架构定位（2026-05-15）

ProbeFlash = 中央处理枢纽；飞书 = 输入数据源 + 通知层。详见 `roadmap.md` §0。改动要点：放弃微信接入；允许轻量 server 仅做飞书对接；今年验证目标 = "飞书消息 → ProbeFlash 处理 → 飞书回复" 闭环。Gemini API 能力调研已落地 `docs/research/lark-api-capability.md`（D-020）；Node-TS 栈 OSS 候选已盘点 `docs/research/lark-oss-candidates.md`（D-020 后续）；gateway 路径已拍板路径 A（D-021）。

## 阻塞 / 待拍板

- **BRIDGE 设计**：等 LARK-03 跑通后再启动（`docs/superpowers/specs/2026-05-18-bridge-roster-design.md` 已 forward-looking）
- _LARK 系列拍板已完成（D-021），不再列待拍板项_

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

- 2026-05-19 LARK-PATH-DECISION 拍板：D-021 落终态（DECIDED）；用户拍板路径 A + SDK 长期依赖 + Long Connection 模式；LARK-01 / LARK-03 / LARK-ONBOARD 解锁。
- 2026-05-19 LARK-PATH-DECISION 草稿落地：decisions.md D-021 草稿（DECISION-NEEDED）→ 拍板后改 DECIDED。
- 2026-05-19 LARK-OSS-SCAN 落地：`docs/research/lark-oss-candidates.md`（路径 A 最优 SDK = `@larksuiteoapi/node-sdk`；路径 B 自写 gateway 工程量估算 ~250 行）+ decisions.md 追 D-020 后续结论。
- 2026-05-19 LARK-02-CAPABILITY-MIRROR 落地：`docs/research/lark-api-capability.md` + `decisions.md` D-020；gemini 两份报告事实底座固化到工程仓库。
- 2026-05-19 仓库大清理 5 commit：基础（gitignore/AGENTS 路径修正/forward-looking 标注/stale 分支删/templates 删/archive README）+ docs/product 整目录归档到 `v0.3-pivot/product/` + 5 个 v0.3 debug skill 退役到 `.agents/skill-library/`（active Claude 触发面只剩 4 个）+ specs/ 加 README 统一 status 词汇 + 本次 now+backlog 校齐 + LARK 备赛期解锁。
