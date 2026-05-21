# Now

> 唯一当前战况源。Pivot 后重设。pre-pivot 历史快照 → `docs/archive/v0.3-pivot/`。

```yaml
mode: post_pivot_self_dogfood
stage: 备赛期 self-iteration + 飞书接入推进
stage_goal: 完善 debug-checklist skill 自用迭代 + 推进飞书 D-022 三包拆分（LARK-CLI-01..06）+ 跑通用户线下 onboard §0-§5
current_task: null  # T1 已闭环；frontier 列剩余 5 任务并行起点（待 atomic-task 选）
frontier:
  - LARK-CLI-02                          # 立 apps/pf-skills/（无依赖，可即起）
  - LARK-CLI-04                          # ADR D-022 + lark-connector v2 + AGENTS §2/§3（无依赖，可即起）
  - LARK-CLI-06                          # lark-cli-dev-usage 新建 + AGENTS §7（无依赖，可即起）
blocked:
  - BRIDGE-01-ROSTER-SCHEMA              # 等 BRIDGE 备赛后启动
  - LARK-CLI-03                          # 等 LARK-CLI-01 + 02 都完成（gateway 瘦身依赖两包到位）
  - LARK-CLI-05                          # 等 LARK-CLI-03 + 04（onboard guide 改写依赖代码+ADR）
post_pivot_registry:
  - BRIDGE-03-LARK-INTEGRATION           # 备赛后随 LARK 系列重评
  - TRAIL-01-VIEWER-DESIGN               # 等 .debug-archive ≥ 20 条
frozen:
  - probeflash-v0.3.0                    # 不再加功能、不重构；致命补丁除外
```

## 当前任务

_无（等 atomic-task 从 frontier 选首项）。D-022 三包拆分（lark-cli 接入 + lark-gateway 拆 3 包）spec 已 draft + plan 已 active；T1（apps/lark-toolkit/）已落地于 `e3e2069`。剩余 5 任务：T2/T4/T6 三个并行起点已挂 frontier；T3 阻塞依赖 T1+T2，T5 阻塞依赖 T3+T4。LARK-ONBOARD-GUIDE 已落地用户线下接入清单，§1-§5 文字将在 T5 改写为 lark-cli 路径（保留手填 fallback）；用户线下 onboard 走通时机不阻塞 AI 侧 LARK-CLI 推进。_

## 架构定位（2026-05-15）

ProbeFlash = 中央处理枢纽；飞书 = 输入数据源 + 通知层。详见 `roadmap.md` §0。改动要点：放弃微信接入；允许轻量 server 仅做飞书对接；今年验证目标 = "飞书消息 → ProbeFlash 处理 → 飞书回复" 闭环。Gemini API 能力调研已落地 `docs/research/lark-api-capability.md`（D-020）；Node-TS 栈 OSS 候选已盘点 `docs/research/lark-oss-candidates.md`（D-020 后续）；gateway 路径已拍板路径 A（D-021）。

## 阻塞 / 待拍板

- **BRIDGE 设计**：等 LARK-03 跑通后再启动（`docs/superpowers/specs/2026-05-18-bridge-roster-design.md` 已 forward-looking）
- **D-022 ADR 待 T4 落地**：spec `docs/superpowers/specs/2026-05-21-lark-cli-integration-design.md` 已 draft；LARK-CLI-04 任务负责把 D-022 追到 `decisions.md` 并把 `lark-connector.md` 升 stable
- _D-021 已 DECIDED，不再列待拍板项_

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

- 2026-05-21 LARK-CLI-01 立 apps/lark-toolkit/ 出站门面子包：types/boundary/sdk-client/cli-bridge/index 5 src 文件 + 4 test；boundary.route 白名单（im.v1.message.create → sdk，其他 → cli）；cli-bridge 懒检查 lark --version ≥ 1.x（mock 模式不触发）；12+ 单测全过。落地 D-022 三包架构 LARK-CLI-01 任务。
- 2026-05-19 LARK-ONBOARD-GUIDE 落地：`docs/research/lark-onboard-guide.md`（status: stable，11 节）；§0 前置自检 + §1-§3 飞书后台创建应用/启用机器人/申请权限+事件订阅 + §4 .env 填写 + §5 本地 smoke + §6 可选接真实 LLM provider + §7 可选部署服务器 + §8 排查 + §10 完成 checklist；用户接力链 6 任务全部完成。
- 2026-05-19 LARK-03-MIN-INTEGRATION 代码部分落地：新建 `apps/lark-gateway/` 子包（9 src + 3 test + 7 配置）；WSClient Long Connection 入站、Mock-first skill 调度、handler 依赖注入；24/24 单测；typecheck + build + verify:all 全通；不引入 LLM provider 依赖、不调真实飞书 API；途中遇 .git/objects 5 文件 0 字节损坏 → 软重置 f467c8f 后重做 LARK-01 commit（f3f0578）。
- 2026-05-19 LARK-01-CONNECTOR-ARCH 落地：`docs/design/lark-connector.md`（status: draft，11 节）；新建 `apps/lark-gateway/` 子包架构、WSClient+EventDispatcher 接口契约、Mock-first 调度策略、4 字段 .env 边界、3 秒 ack 边界、错误模型 + decisions.md D-021 后续。
- 2026-05-19 LARK-PATH-DECISION 拍板：D-021 落终态（DECIDED）；用户拍板路径 A + SDK 长期依赖 + Long Connection 模式；LARK-01 / LARK-03 / LARK-ONBOARD 解锁。
