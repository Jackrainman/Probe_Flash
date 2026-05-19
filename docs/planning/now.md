# Now

> 唯一当前战况源。Pivot 后重设。pre-pivot 历史快照 → `docs/archive/v0.3-pivot/`。

```yaml
mode: post_pivot_self_dogfood
stage: 备赛期 self-iteration + 飞书接入推进
stage_goal: 完善 debug-checklist skill 自用迭代 + 推进飞书接入（gemini 已完成 API 能力调研，下一步把调研落到仓库 + 找开源候选 + 路径决策）
current_task: null  # LARK-03 代码部分已完成；frontier 首个 = LARK-ONBOARD-GUIDE
frontier:
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

_无。2026-05-19 LARK-03-MIN-INTEGRATION 代码部分已完成：`apps/lark-gateway/` 子包落地（9 src + 3 test + 7 配置），24/24 单测通过，typecheck + build + verify:all 全通；Mock-first 模式不调真实 LLM / 不调真实飞书 API。下次拍板从 frontier 取首个 = `LARK-ONBOARD-GUIDE`（用户线下接入动作清单）。_

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

- 2026-05-19 LARK-03-MIN-INTEGRATION 代码部分落地：新建 `apps/lark-gateway/` 子包（9 src + 3 test + 7 配置）；WSClient Long Connection 入站、Mock-first skill 调度、handler 依赖注入；24/24 单测；typecheck + build + verify:all 全通；不引入 LLM provider 依赖、不调真实飞书 API；途中遇 .git/objects 5 文件 0 字节损坏 → 软重置 f467c8f 后重做 LARK-01 commit（f3f0578）。
- 2026-05-19 LARK-01-CONNECTOR-ARCH 落地：`docs/design/lark-connector.md`（status: draft，11 节）；新建 `apps/lark-gateway/` 子包架构、WSClient+EventDispatcher 接口契约、Mock-first 调度策略、4 字段 .env 边界、3 秒 ack 边界、错误模型 + decisions.md D-021 后续。
- 2026-05-19 LARK-PATH-DECISION 拍板：D-021 落终态（DECIDED）；用户拍板路径 A + SDK 长期依赖 + Long Connection 模式；LARK-01 / LARK-03 / LARK-ONBOARD 解锁。
- 2026-05-19 LARK-OSS-SCAN 落地：`docs/research/lark-oss-candidates.md`（路径 A 最优 SDK = `@larksuiteoapi/node-sdk`；路径 B 自写 gateway 工程量估算 ~250 行）+ decisions.md 追 D-020 后续结论。
- 2026-05-19 LARK-02-CAPABILITY-MIRROR 落地：`docs/research/lark-api-capability.md` + `decisions.md` D-020；gemini 两份报告事实底座固化到工程仓库。
