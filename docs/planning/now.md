# Now

> 唯一当前战况源。Team Hub 方向已由 D-024 覆盖旧 markdown-only pivot。pre-pivot 历史快照 → `docs/archive/v0.3-pivot/`。

```yaml
mode: team_hub_shell_design
stage: Team Hub 战队中枢概念冻结 + 大后端/控制台壳子规划
stage_goal: 以 docs/design/team-hub-concept.md + D-024 为事实源，先完成架构边界、技术栈拍板、Hub 后端壳子、控制台壳子、adapter 接口；Skill/Bridge/Trail 作为 Hub 下能力位保留
current_task: null  # HUB-CONCEPT-01 已闭环；下一步需重新走 atomic-task，从 HUB-STACK-DECISION 开始评估技术栈
frontier:
  - HUB-STACK-DECISION
blocked: []
post_pivot_registry:
  - SKILL-PROTOCOL-V1                    # 已落地草稿；待后续决定是否按 D-024 重新纳入 Hub skill adapter 契约
  - BRIDGE-01-ROSTER-SCHEMA              # 被 Hub BridgeState 契约覆盖，后续不按旧 markdown-only 任务推进
  - TRAIL-01-VIEWER-DESIGN               # 等 Hub 有 archive / artifact / event 原料后再设计
frozen:
  - probeflash-v0.3.0                    # 不再加功能、不重构；致命补丁除外
```

## 当前任务

_无。HUB-CONCEPT-01（design/docs）**已闭环**：`docs/design/team-hub-concept.md` 明确 Team Hub = 大后端 + 前端控制台 + adapter 插件底座；`.gitignore` 忽略本地参考项目 `xju-feiyue/`；`decisions.md` D-024 拍板 Team Hub 覆盖旧 markdown-only 边界；`backlog.md` 增加 HUB 系列候选。后续不自动顺推，下一步必须重新走 atomic-task 认领 `HUB-STACK-DECISION`。_

## 架构定位（2026-06-06）

ProbeFlash = 战队中枢 / Team Hub；飞书 = 入口与通知层；Hermes / 小龙虾 / Claude Code / pf-skills = adapter 候选；战队服务器 = Git / artifact / 控制台运行层。详见 `docs/design/team-hub-concept.md` 与 D-024。旧 Skill/Bridge/Trail 三 facet 保留为能力分类，但实现边界从 markdown-only 升级为 Hub 后端 + 控制台 + 插件接口。

## 阻塞 / 待拍板

- **HUB-STACK-DECISION**：Node/TypeScript 统一栈 vs FastAPI + React；必须先拍板再开后端/控制台壳子代码。
- **真实外部 adapter**：Hermes / 小龙虾 / Claude Code 真实接入需要用户提供运行方式与权限；AI 当前只能做 mock-first 适配设计。
- **真实服务器写入**：Forgejo/Gitea/bare git 部署、SSH、systemd、80/443、真实数据迁移均需用户白天审批后再做。

## 已冻结

- ProbeFlash v0.3 全部代码（apps/desktop、apps/server、release 流程）：不再加功能、不再重构、不再写 verify。
- pre-pivot backlog 全部任务（TECH-* / AIREADY-* / REALAI-* / CODECTX-* / DEP-* / DATA-* / UI-* / CORE-* / SEARCH-*）：不再认领；详细见 `docs/archive/v0.3-pivot/backlog.md`。
- **原 BRIDGE / TRAIL markdown-only 候选**：已被 D-024 Team Hub 架构覆盖，后续只作为 Hub BridgeState / Trail 能力重评，不按旧任务直接认领。

## 安全边界（pivot 后仍生效）

- 不动 v0.3 server / SQLite / API（致命补丁除外）。
- AI / Skill / Hub adapter 不读 / 打印密钥（`.env` / `*key*` / `*secret*`）。
- 真实 Hermes / 小龙虾 / Claude Code / 飞书 / Git forge smoke 由用户线下配置；AI 只做 mock-first 与只读诊断。
- 不在未审批情况下写真实服务器、SSH、systemd、80/443 或迁移真实数据。

## 最近完成（详见 `git log`）

- 2026-06-06 HUB-CONCEPT-01 — Team Hub 概念设计与边界确认：新增 `docs/design/team-hub-concept.md`（status: stable，覆盖目标/非目标/总体架构/模块边界/业务模型 v0/API 草案/构建步骤/`xju-feiyue` 复用判断/技术栈分歧/工作流判断/后续候选队列）；`.gitignore` 忽略 `xju-feiyue/`；D-024 拍板 Team Hub 覆盖旧 markdown-only 边界；`now.md` / `backlog.md` / `roadmap.md` / `AGENTS.md` 同步。
- 2026-05-24 SKILL-PROTOCOL-V1 — SKILL.md 协议 v1.0 baseline 落地：`.agents/skills/PROTOCOL-v1.0.md`（协议本体 8 节，frontmatter 7 字段 + body 8 必填 H2 + 4–5 可选 H2 + extensions 扩展钩子 + 双 SemVer 版本号）+ `docs/planning/skill-protocol-migration-gap.md`（3 个 active 业务 skill 均评 B 级合规，工作量 ~20 min/skill；atomic-task 列 out-of-scope）+ `docs/design/D-023-skill-protocol-v1.md`（详细 ADR 草稿 status: draft，4 个放弃方案）+ `decisions.md` D-023 聚合段；7 项验证全过含 `verify:skills-sync` exit 0；**不动**三个现有 SKILL.md（迁移留 SKILL-MIGRATION-V1-* 系列后续任务，待 D-023 升 DECIDED 后认领）。
- 2026-05-22 backlog 加 BRIDGE-05-RESEARCH-POOL 候选（pending 备赛后 + 边界待拍板）：「待研究池 + 接棒」——闲时自驱认领研究项 + 接力产出文档与代码。三条边界待拍板：(a) 产能比较禁区（接棒次数上 UI 即 implicit 排名，违反设计宪法 §2）；(b) schema 选型（独立子段并行 vs 学习链串行接力）；(c) 与 BRIDGE-04 / TRAIL-02 / TRAIL-04 重叠面合并评估不单独认领。不进 frontier，备赛后随 BRIDGE 系列统一拍板。
- 2026-05-21 LARK-CLI-05 lark-onboard-guide.md 改写：§0 加 lark-cli 安装检查 + §4 拆 4.A (lark config init + lark auth login) 与 4.B (手填 fallback) 加二选一警告 + §5 拆 5.A (lark api smoke) / 5.B (gateway smoke) / 5.C (fallback) + §8 加 lark-cli 排查 + §10 checklist 同步；旧手填 fallback 完整保留。
- 2026-05-21 LARK-CLI-03 apps/lark-gateway 瘦身整合三包：新增 ws-client.ts + 删 lark-client/reply-sender/skill-dispatcher + message-handler/event-router/main.ts 改 Toolkit + SkillDispatcher 注入；package.json 加 file: deps；测试重写 10 全过 + config 8 测全过（合计 18/18）；gateway src 9 → 7（net -175 行）；typecheck/test/build 三关 PASS。
