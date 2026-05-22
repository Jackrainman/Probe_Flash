# Now

> 唯一当前战况源。Pivot 后重设。pre-pivot 历史快照 → `docs/archive/v0.3-pivot/`。

```yaml
mode: post_pivot_self_dogfood
stage: 备赛期 self-iteration + 飞书接入推进
stage_goal: 完善 debug-checklist skill 自用迭代 + 推进飞书 D-022 三包拆分（LARK-CLI-01..06）+ 跑通用户线下 onboard §0-§5
current_task: null  # LARK-CLI 系列 T1-T6 全部闭环；待用户线下走 onboard §0-§5
frontier: []
blocked:
  - BRIDGE-01-ROSTER-SCHEMA              # 等 BRIDGE 备赛后启动
post_pivot_registry:
  - BRIDGE-03-LARK-INTEGRATION           # 备赛后随 LARK 系列重评
  - TRAIL-01-VIEWER-DESIGN               # 等 .debug-archive ≥ 20 条
frozen:
  - probeflash-v0.3.0                    # 不再加功能、不重构；致命补丁除外
```

## 当前任务

_无。LARK-CLI 系列 T1-T6 **全部闭环**：T1（apps/lark-toolkit/）落地于 `e3e2069`，T2（apps/pf-skills/）落地于 `ea41c74`，T3（lark-gateway 瘦身整合三包）落地于 `7c47f9a`，T4（D-022 ADR + lark-connector v2 + AGENTS §2/§3）落地于 `fef9e77`，T6（lark-cli-dev-usage + AGENTS §7）落地于 `4d5854a`，T5（onboard guide §0/§4/§5/§8/§10 改写加 lark-cli 路径并保留手填 fallback）落地于本提交。**下一步等用户线下走 onboard §0-§5**（lark-cli 路径或 fallback 手填路径，二选一），AI 侧 D-022 三包拆分全部完成。_

## 架构定位（2026-05-15）

ProbeFlash = 中央处理枢纽；飞书 = 输入数据源 + 通知层。详见 `roadmap.md` §0。改动要点：放弃微信接入；允许轻量 server 仅做飞书对接；今年验证目标 = "飞书消息 → ProbeFlash 处理 → 飞书回复" 闭环。Gemini API 能力调研已落地 `docs/research/lark-api-capability.md`（D-020）；Node-TS 栈 OSS 候选已盘点 `docs/research/lark-oss-candidates.md`（D-020 后续）；gateway 路径已拍板路径 A（D-021）；lark-cli 接入 + 三包拆分已拍板（D-022，2026-05-21）。

## 阻塞 / 待拍板

- **BRIDGE 设计**：等 LARK-03 跑通后再启动（`docs/superpowers/specs/2026-05-18-bridge-roster-design.md` 已 forward-looking）
- _D-021 / D-022 已 DECIDED，不再列待拍板项_

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

- 2026-05-22 backlog 加 BRIDGE-05-RESEARCH-POOL 候选（pending 备赛后 + 边界待拍板）：「待研究池 + 接棒」——闲时自驱认领研究项 + 接力产出文档与代码。三条边界待拍板：(a) 产能比较禁区（接棒次数上 UI 即 implicit 排名，违反设计宪法 §2）；(b) schema 选型（独立子段并行 vs 学习链串行接力）；(c) 与 BRIDGE-04 / TRAIL-02 / TRAIL-04 重叠面合并评估不单独认领。不进 frontier，备赛后随 BRIDGE 系列统一拍板。
- 2026-05-21 LARK-CLI-05 lark-onboard-guide.md 改写：§0 加 lark-cli 安装检查 + §4 拆 4.A (lark config init + lark auth login) 与 4.B (手填 fallback) 加二选一警告 + §5 拆 5.A (lark api smoke) / 5.B (gateway smoke) / 5.C (fallback) + §8 加 lark-cli 排查 + §10 checklist 同步；旧手填 fallback 完整保留。
- 2026-05-21 LARK-CLI-03 apps/lark-gateway 瘦身整合三包：新增 ws-client.ts + 删 lark-client/reply-sender/skill-dispatcher + message-handler/event-router/main.ts 改 Toolkit + SkillDispatcher 注入；package.json 加 file: deps；测试重写 10 全过 + config 8 测全过（合计 18/18）；gateway src 9 → 7（net -175 行）；typecheck/test/build 三关 PASS。
- 2026-05-21 LARK-CLI-06 lark-cli-dev-usage 指南新建 + AGENTS §7 同步：`docs/research/lark-cli-dev-usage.md`（status: stable, 7 节，含安装/鉴权/dev自检/只读 API/写入审批/排查/与仓库关系/范围外）+ AGENTS.md §7 Verify Matrix 加 lark-cli 接入行。
- 2026-05-21 LARK-CLI-04 ADR D-022 + lark-connector v2 + AGENTS §2/§3 同步：decisions.md 追 D-022 (DECIDED) lark-cli 接入 + 三包拆分 + §3 对齐；lark-connector.md 重写 v2 (status: stable)：三包架构 §1.1-§1.4 + createToolkit/createSkillDispatcher/buildEventDispatcher 接口契约 + §9 实现通道列 + 调用链图；roadmap.md §4 出站扩展通道标注；AGENTS.md §2 末尾 lark-cli skills 命名预警 + §3 末尾 lark-cli auth boundary。git diff --check 干净 + frontmatter yaml 解析通过；commit `fef9e77`。
