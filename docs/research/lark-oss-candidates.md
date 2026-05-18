---
title: 飞书 Node-TS 栈开源 SDK / Gateway 候选盘点
status: stable
date: 2026-05-19
sources:
  - GitHub Public API (api.github.com/repos/larksuite/*, api.github.com/search/repositories)
  - larksuite/node-sdk README
related_decisions:
  - D-020
  - D-021（待 LARK-PATH-DECISION 拍板）
---

# 飞书 Node-TS 栈开源 SDK / Gateway 候选盘点

> 调研目的：为 LARK-PATH-DECISION（ADR D-021）提供"路径 A 用开源仓库"和"路径 B 自写最小 gateway"两条路径的事实输入。所有仓库元数据采集自 GitHub Public API（无 auth），采集日期 2026-05-19。

## 0. 摘要

候选清单按"对 ProbeFlash 备赛期路径 A 的适用性"排序：

| 候选 | License | 维护活跃度 | 适用度 | 用途 |
|------|---------|------------|--------|------|
| `larksuite/node-sdk`（npm: `@larksuiteoapi/node-sdk`） | MIT | 2026-05-14 推送，267 stars | ★★★★★ | 路径 A 首选基座 |
| `larksuite/openclaw-lark` | MIT | 2026-05-16，2195 stars | ★★ | 协议错位，仅作参考实现 |
| `larksuite/lark-openapi-mcp` | MIT | 2025-08-14，698 stars | ★ | MCP 协议，方向不符 |
| `larksuite/oapi-sdk-nodejs` | MIT | ARCHIVED，2023-05-20 后停滞 | × | DEPRECATED，禁用 |
| `m1heng/clawdbot-feishu` | MIT | 2026-03-29，4287 stars | ★★ | OpenClaw 桥接，仅参考 |
| `AlexAnys/feishu-openclaw` | 未声明 | 2026-04-01，319 stars | ★ | License 缺失，合规风险 |
| 路径 B：自写最小 gateway | — | — | ★★★ | 零依赖路线 |

**结论**：路径 A 的最优基座 = `@larksuiteoapi/node-sdk`；路径 B 工程量估算 ~200 行核心代码 + 加解密链路单测；最终拍板见 D-021。

## 1. 官方 SDK：`larksuite/node-sdk`

- 仓库：https://github.com/larksuite/node-sdk
- npm：`@larksuiteoapi/node-sdk`
- License：MIT
- 主语言：TypeScript（原生 TS，完整类型提示）
- Stars：267（2026-05-19）
- 最近推送：2026-05-14（持续活跃）
- 创建：2022-08-02
- 取代关系：取代已 DEPRECATED 的 `oapi-sdk-nodejs`

### 1.1 SDK 内置能力（来自 README）
- Token 自动获取与刷新（无需手动管理 `tenant_access_token` 生命周期）
- 事件订阅 Payload AES-256-GCM 解密（内置）
- 请求签名校验（内置）
- Challenge-Response 自动处理（内置）
- `lark.EventDispatcher` 事件分发器 + `register({...})` 注册任意事件 handler
- Web 框架适配器：`adaptExpress` / `adaptKoa` / `adaptKoaRouter` / `adaptDefault`
- 长连接（Long Connection）订阅模式（无需公网 IP 时可用）
- 语义化 API：`client.im.message.create({...})` 等
- `CardActionHandler` 卡片交互回调
- 商店应用 vs 企业自建应用类型切换：`AppType.SelfBuild` / `AppType.ISV`
- 国内/海外双域：`Domain.Feishu` / `Domain.Lark`

### 1.2 与 `lark-api-capability.md` §8.1 的契合度

| capability §8.1 项 | node-sdk 是否覆盖 |
|---|---|
| 凭证 4 件套（app_id / app_secret / encrypt_key / verification_token） | ✓ Client 构造参数 |
| 事件订阅 Webhook 接收 | ✓ adaptExpress / adaptKoa |
| @机器人精准触发事件 | ✓ EventDispatcher.register |
| Challenge-Response 校验 | ✓ 内置 |
| AES-256-GCM 解密 | ✓ 内置 |
| tenant_access_token 自动刷新 | ✓ 自动 |
| im.message.create 发回复 | ✓ 一行调用 |
| 测试企业沙箱环境 | ✓ 透明兼容 |

8/8 契合，MVP 全部需求被 SDK 直接覆盖。

### 1.3 引入风险
- 包体积：含全量 OpenAPI 类型定义；可 tree-shake，但备赛期 ProbeFlash 不需要全量
- 锁定：依赖单一上游；若官方政策变更需手动迁移
- Long Connection 模式可绕开"固定 IP 白名单"约束（备选方案）

## 2. 官方相邻工具（不作为基座）

### 2.1 `larksuite/openclaw-lark`
- 描述：飞书官方 OpenClaw Channel 插件（agent 协议桥）
- Stars：2195，MIT，2026-05-16 推送
- 用途：把"已有的 LLM agent"接到飞书 — 不是给"应用直接与飞书 API 对话"用
- 与 ProbeFlash 的差距：ProbeFlash 不是 LLM agent，是 debug-checklist skill 调度器；OpenClaw 协议把消息流定型为"Claw agent 输入→输出"，与我们的"症状→检查单"流程错位
- 价值：作为 webhook 入口 / 消息格式化的**参考阅读**，不直接依赖

### 2.2 `larksuite/lark-openapi-mcp`
- 描述：飞书官方 OpenAPI MCP（Model Context Protocol）实现
- Stars：698，MIT，2025-08-14 推送（8 个月停滞，活跃度中等）
- 用途：让 LLM 通过 MCP 调用飞书 OpenAPI（飞书→LLM 出站方向）
- 与 ProbeFlash 的差距：ProbeFlash 是入站方向（飞书→ProbeFlash），MCP 协议反向；备赛期不适用

## 3. 官方已废弃（仅记录避坑）

### 3.1 `larksuite/oapi-sdk-nodejs`
- 状态：**DEPRECATED**，GitHub 标记 archived
- 最后推送：2023-05-20（3 年未更新）
- 取代者：`larksuite/node-sdk`
- 行动项：**禁止用此 SDK**；任何检索结果命中此仓库应导向 `node-sdk`

## 4. 社区桥接器（仅参考，不作为基座）

### 4.1 `m1heng/clawdbot-feishu`
- Stars：4287，MIT，TypeScript，2026-03-29 推送
- 描述：OpenClaw bot for Feishu（高 star 但绑定 OpenClaw 协议）
- 适用度：与 `openclaw-lark` 同类；可作为参考实现阅读其 webhook 鉴权代码

### 4.2 `AlexAnys/feishu-openclaw`
- Stars：319，**License 未声明**，2026-04-01 推送
- 描述："Connect 飞书 Feishu/Lark bot to openclaw — no public server"
- 适用度：License 未声明属于合规风险；只做参考阅读，**不可直接依赖**

### 4.3 其他较小高活跃候选
- `Leochens/feishu-bot-chat-plugin`（128 stars, License 未声明, 2026-04-21）— OpenClaw plugin
- `Jiao-Joe/codex-feishu-bridge`（14 stars, MIT, 2026-05-12）— Codex 桥
- 共同特点：均绑定特定 agent 协议（OpenClaw / Codex），不直接为 ProbeFlash 设计

## 5. 路径 B：自写最小 gateway（零依赖）

### 5.1 工程量估算
不引入任何飞书 SDK，自己实现以下模块：

| 模块 | 实现要点 | 估算行数 |
|------|----------|----------|
| Webhook 入口 | Node http 或 Express 路由 `/webhook/event` | ~30 |
| Challenge-Response 校验 | 识别首次 challenge 字段并原样返回 | ~20 |
| AES-256-GCM 解密 | Node 原生 `crypto` 模块，Encrypt Key 派生 | ~30 |
| 签名校验 | HMAC-SHA256 with Verification Token | ~15 |
| Token 获取与缓存 | POST `auth/v3/tenant_access_token/internal`，2h TTL 刷新 | ~50 |
| 发送消息 | POST `/im/v1/messages?receive_id_type=...`，Bearer token | ~30 |
| 错误处理 / 指数退避 | 限流（429）/ Token 过期（99991663）/ 网络抖动 | ~30 |
| 单元测试（加解密 / 签名） | Vitest + 已知向量验证 | ~50 |
| **合计核心** | | **~250 行** |

### 5.2 路径 B 的吸引力
- 零依赖：无版本锁定、无供应链风险、bundle 最小
- 备赛期只需 IM 消息能力，不需要 SDK 全量 OpenAPI 覆盖
- 加解密 / 签名逻辑完全可控，便于审计
- 学习成本低，单文件可读

### 5.3 路径 B 的代价
- 重复造轮子（SDK 已封装好的部分）
- 后续扩展到多维表格 / 卡片更新 / OAuth 用户授权时，需逐 API 自实现，成本骤升
- 加解密代码错一行就漏数据；依赖单元测试覆盖
- 飞书官方文档变更时需手动跟进，无 SDK 升级机制

## 6. 两条路径直接对比

| 维度 | 路径 A：node-sdk | 路径 B：自写 gateway |
|------|------------------|----------------------|
| MVP 集成代码量 | ~50 行 | ~250 行 + 单测 |
| 后续扩展成本 | 低（SDK 全 API 覆盖） | 高（逐 API 自实现） |
| Bundle 大小 | 较大（可 tree-shake） | 最小 |
| TypeScript 类型 | 完整 | 自写 |
| 加解密 / 签名链路 | 内置 | 自实现（易错点） |
| 文档 / 社区 | 官方维护 | 无 |
| 维护风险 | 上游政策变更需迁移 | 自己持续跟踪官方文档 |
| 与 capability §8.1 契合度 | 8/8 直接覆盖 | 8/8 但需自己实现 |
| 引入新依赖 | `@larksuiteoapi/node-sdk` 一个 | 0 个 |
| 学习曲线 | 中（读 SDK 文档） | 低（只读飞书 OpenAPI 文档） |

## 7. 对 LARK-PATH-DECISION 的输入要点

1. **路径 A 的最优基座**：`@larksuiteoapi/node-sdk`，MVP 全需求被 SDK 直接覆盖，集成代码 ~50 行
2. **路径 B 的真实工程量**：~250 行核心代码 + 加解密链路单测；不依赖任何外部 SDK
3. **不可用**：`oapi-sdk-nodejs`（DEPRECATED 3 年）、`lark-openapi-mcp`（MCP 协议方向相反）
4. **不推荐作为基座**：`openclaw-lark` / `clawdbot-feishu` 等 OpenClaw 协议桥接器（协议错位，ProbeFlash 不是 LLM agent）
5. **风险对比的真实区别**：路径 A 风险 = 上游政策变更 / 包体积；路径 B 风险 = 加解密链路自实现的正确性

**下一步**：LARK-PATH-DECISION 任务起 ADR D-021，基于本文 §6 比较表 + §7 输入做拍板。

---

数据采集说明：
- 仓库元数据来源：`https://api.github.com/repos/<owner>/<name>` 与 `https://api.github.com/search/repositories?q=...`
- README 来源：`https://api.github.com/repos/larksuite/node-sdk/readme`
- 采集日期：2026-05-19
- 未做：星数/issue 数走势、依赖图、npm 周下载量历史趋势（备赛期不需要这种深度）
