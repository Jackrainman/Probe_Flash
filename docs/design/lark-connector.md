---
title: 飞书 Connector 架构设计（lark-gateway）
status: draft
date: 2026-05-19
decisions: [D-020, D-021]
related_tasks: [LARK-01-CONNECTOR-ARCH, LARK-03-MIN-INTEGRATION, LARK-ONBOARD-GUIDE]
---

# 飞书 Connector 架构设计（lark-gateway）

> 备赛期 MVP 设计：把"飞书 @机器人收到调试症状 → ProbeFlash 处理 → 飞书群内回复检查单"这条链路落到代码层面。本文按 D-021 拍板的路径 A（用 `@larksuiteoapi/node-sdk` Long Connection 模式）展开接口 / 数据流 / 错误模型 / 部署边界。LARK-03-MIN-INTEGRATION 任务实现本设计的代码部分（Mock 模式），真实 LLM provider smoke 留用户线下完成。

## 0. 范围与非范围

### 0.1 在范围内（备赛期 MVP）
- 新建独立子包 `apps/lark-gateway/`（与 `apps/desktop` / `apps/server` 并列，不动 v0.3 冻结代码）
- WebSocket Long Connection 接入飞书事件订阅
- 监听 `im.message.receive_v1`（机器人收到群消息或私聊）
- 仅处理"@机器人"触发的消息（信噪比 + 隐私）
- 消息文本 → ProbeFlash skill 调度层（**Mock 模式**：回显症状 + 提示"需配置 provider 才能生成真实检查单"）
- 通过 `client.im.v1.message.create` 向原会话回复
- 错误模型 + 重试 + 3 秒 ack 边界

### 0.2 在范围外（备赛期不做）
- 真实 LLM provider 接入（Claude / DeepSeek API 调用 + key 注入）→ 留用户线下
- 飞书企业内部应用注册（开发者后台动作）→ 留用户线下
- 多维表格 / 卡片流式 SSE / OAuth 用户授权 / 通讯录读取
- 集群部署、负载均衡、生产监控
- 容器化 / systemd / 反向代理
- TLS 终止（Long Connection 走 SDK 自带 wss）

## 1. 模块拆分

```
apps/lark-gateway/
├── package.json
├── tsconfig.json
├── .env.example                   # 字段示意（不含真实值），入仓库
├── README.md                      # 启动说明 + 故障排查
├── src/
│   ├── main.ts                    # 入口；加载 .env，启动 WSClient
│   ├── config.ts                  # 从 process.env 读 4 个字段，zod 校验非空
│   ├── lark-client.ts             # 构造 lark.Client + WSClient
│   ├── event-router.ts            # EventDispatcher.register 注册 handler
│   ├── message-handler.ts         # @机器人检测 + 文本提取 + 调度 skill
│   ├── skill-dispatcher.ts        # 抽象层：mock | provider(future)
│   ├── reply-sender.ts            # 调 client.im.v1.message.create 回复
│   ├── logger.ts                  # 简易 console logger，结构化输出
│   └── errors.ts                  # 错误分类与统一退避策略
└── test/
    └── message-handler.test.ts    # @机器人解析、文本提取的单测（不打网络）
```

**为什么这样拆**：
- 一个文件一个职责，备赛期看代码 < 30 秒能定位 bug
- `skill-dispatcher` 是 ProbeFlash 与 LLM provider 之间的接缝；mock-first 实现，provider 实现是后续替换
- `reply-sender` 单独抽出，便于 mock 阶段返回 stub 内容 / 后续切卡片消息

## 2. 接口契约

### 2.1 配置层（`config.ts`）

```typescript
import { z } from 'zod';

const ConfigSchema = z.object({
  LARK_APP_ID: z.string().min(1, 'LARK_APP_ID required'),
  LARK_APP_SECRET: z.string().min(1, 'LARK_APP_SECRET required'),
  LARK_BOT_OPEN_ID: z.string().min(1, 'LARK_BOT_OPEN_ID required (for @bot detection)'),
  LARK_DOMAIN: z.enum(['feishu', 'lark']).default('feishu'),
  PROBEFLASH_SKILL_MODE: z.enum(['mock', 'claude', 'deepseek']).default('mock'),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('[config] invalid env:', parsed.error.issues);
    process.exit(1);
  }
  return parsed.data;
}
```

**字段说明**：
- `LARK_APP_ID` / `LARK_APP_SECRET`：飞书后台创建应用后给的两个值；Long Connection 模式不需要 encrypt_key / verification_token（D-020 §4 + SDK 文档已说明）。
- `LARK_BOT_OPEN_ID`：机器人自己的 open_id，用于在 `mentions[]` 里识别 "@机器人" 触发；飞书后台创建应用时可拿到。
- `LARK_DOMAIN`：`feishu`（国内）或 `lark`（海外），默认 `feishu`。
- `PROBEFLASH_SKILL_MODE`：备赛期默认 `mock`；用户配置 `ANTHROPIC_API_KEY` 后改 `claude`，配置 `DEEPSEEK_API_KEY` 后改 `deepseek`。

**安全边界**：
- `loadConfig()` 不打印任何 secret 字段（错误信息只说"required"，不回显值）
- AI / Skill 不读 `.env`；用户线下用 `cp .env.example .env` 后手动填值

### 2.2 飞书客户端层（`lark-client.ts`）

```typescript
import * as lark from '@larksuiteoapi/node-sdk';
import type { Config } from './config';

export function createLarkClients(cfg: Config) {
  const baseConfig = {
    appId: cfg.LARK_APP_ID,
    appSecret: cfg.LARK_APP_SECRET,
    domain: cfg.LARK_DOMAIN === 'lark' ? lark.Domain.Lark : lark.Domain.Feishu,
  };

  const client = new lark.Client({
    ...baseConfig,
    appType: lark.AppType.SelfBuild,
  });

  const wsClient = new lark.WSClient({
    ...baseConfig,
    loggerLevel: lark.LoggerLevel.info,
  });

  return { client, wsClient };
}
```

**职责**：
- `client`：用于出站 API（发消息）。SDK 自动管理 `tenant_access_token` 的获取与刷新。
- `wsClient`：用于入站事件（WebSocket Long Connection）。SDK 自动处理鉴权、重连、心跳。

### 2.3 事件路由层（`event-router.ts`）

```typescript
import * as lark from '@larksuiteoapi/node-sdk';
import { handleMessage } from './message-handler';
import type { Config } from './config';
import type { Client } from '@larksuiteoapi/node-sdk';

export function buildEventDispatcher(cfg: Config, client: Client) {
  return new lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (data) => {
      try {
        await handleMessage(data, cfg, client);
      } catch (err) {
        console.error('[event] handler error', err);
        // 静默吞掉异常以保证 3 秒内 ack；详细错误已记日志
      }
    },
  });
}
```

**契约**：
- `im.message.receive_v1` 是飞书事件订阅的标准 event_type；payload 结构见 [官方文档](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/event-subscription-guide/event/im.message.receive_v1)。
- handler 必须 **3 秒内返回**（SDK 内置 ack），否则飞书会重推。复杂处理（如调 LLM）应异步触发但同步 ack。
- 异常必须捕获并降级；不允许冒泡到 SDK 引起连接断（影响后续事件）。

### 2.4 消息处理层（`message-handler.ts`）

```typescript
import type { Config } from './config';
import type { Client } from '@larksuiteoapi/node-sdk';
import { dispatchSkill } from './skill-dispatcher';
import { sendReply } from './reply-sender';

interface LarkMessageEvent {
  message: {
    chat_id: string;
    message_id: string;
    message_type: string;       // 'text' / 'post' / ...
    content: string;            // JSON-stringified payload
    mentions?: Array<{ key: string; id: { open_id: string } }>;
  };
  sender: { sender_id: { open_id: string } };
}

export async function handleMessage(
  data: LarkMessageEvent,
  cfg: Config,
  client: Client,
): Promise<void> {
  // 1. 仅处理文本消息（MVP 范围）
  if (data.message.message_type !== 'text') {
    return;  // 不回复其他类型；后续可扩展 post / image
  }

  // 2. 仅处理 @机器人 触发
  const mentions = data.message.mentions ?? [];
  const isBotMentioned = mentions.some(
    (m) => m.id.open_id === cfg.LARK_BOT_OPEN_ID,
  );
  if (!isBotMentioned) {
    return;  // 非 @机器人，忽略（信噪比 + 隐私）
  }

  // 3. 提取症状文本（去掉 @机器人 标签）
  const rawContent = JSON.parse(data.message.content).text as string;
  const symptom = stripMention(rawContent).trim();
  if (symptom.length === 0) {
    await sendReply(client, data.message.chat_id, data.message.message_id, {
      kind: 'help',
      text: '@我 + 一句调试症状（如"自动跑点又歪了"），我会生成检查清单。',
    });
    return;
  }

  // 4. 调度 skill（mock | provider）
  const reply = await dispatchSkill(symptom, cfg);

  // 5. 回复
  await sendReply(client, data.message.chat_id, data.message.message_id, reply);
}

function stripMention(text: string): string {
  return text.replace(/@[\w_]+/g, '').replace(/\s+/g, ' ').trim();
}
```

### 2.5 Skill 调度层（`skill-dispatcher.ts`）

```typescript
import type { Config } from './config';

export interface SkillReply {
  kind: 'checklist' | 'mock' | 'error' | 'help';
  text: string;
}

export async function dispatchSkill(
  symptom: string,
  cfg: Config,
): Promise<SkillReply> {
  switch (cfg.PROBEFLASH_SKILL_MODE) {
    case 'mock':
      return {
        kind: 'mock',
        text: [
          `[mock 模式] 已收到症状：${symptom}`,
          ``,
          `当前 lark-gateway 跑在 Mock 模式，不调用真实 LLM。`,
          `配置 ANTHROPIC_API_KEY 或 DEEPSEEK_API_KEY 后，`,
          `把 PROBEFLASH_SKILL_MODE 改成对应 provider 即可生成真实 5-8 条检查清单。`,
          `详见 docs/research/lark-onboard-guide.md。`,
        ].join('\n'),
      };
    case 'claude':
      // LARK-03 代码部分不实现，留 stub 抛错；后续任务实现
      throw new Error('claude mode not implemented in MVP; configure in followup task');
    case 'deepseek':
      throw new Error('deepseek mode not implemented in MVP; configure in followup task');
  }
}
```

**为什么 mock-first**：
- 真实 LLM 调用需要 provider key，命中"AI 不读 / 不打印 / 不提交真实 key"边界
- 用户接力链明确"不含真实 provider smoke"，让代码层先把"飞书 → ProbeFlash → 飞书"链路打通
- `dispatchSkill` 接口稳定，后续添加 claude / deepseek 实现时不影响其他模块

### 2.6 回复发送层（`reply-sender.ts`）

```typescript
import type { Client } from '@larksuiteoapi/node-sdk';
import type { SkillReply } from './skill-dispatcher';

export async function sendReply(
  client: Client,
  chatId: string,
  replyToMessageId: string,
  reply: SkillReply,
): Promise<void> {
  await client.im.v1.message.create({
    params: { receive_id_type: 'chat_id' },
    data: {
      receive_id: chatId,
      msg_type: 'text',
      content: JSON.stringify({ text: reply.text }),
    },
  });
  // MVP 不带 replyTo（飞书 thread 模式可后续加）；reply 字段保留以便未来扩展
  void replyToMessageId;
}
```

**MVP 简化**：先发普通文本，不挂 thread，不用卡片。后续如有时间换 `messageCard.defaultCard` / markdown card。

### 2.7 入口（`main.ts`）

```typescript
import 'dotenv/config';
import { loadConfig } from './config';
import { createLarkClients } from './lark-client';
import { buildEventDispatcher } from './event-router';

async function main() {
  const cfg = loadConfig();
  const { client, wsClient } = createLarkClients(cfg);
  const eventDispatcher = buildEventDispatcher(cfg, client);

  console.log(`[main] starting lark-gateway in ${cfg.PROBEFLASH_SKILL_MODE} mode...`);
  wsClient.start({ eventDispatcher });
}

main().catch((err) => {
  console.error('[main] fatal:', err);
  process.exit(1);
});
```

## 3. 数据流

```
 飞书 App 后台          飞书 IM 后端                lark-gateway 进程
 (用户线下注册)              │                          (本节代码)
      │                       │                            │
      │  WSS（鉴权）        │                            │
      └───────────────────►  │  ←─── wsClient.start() ───┤
                              │                            │
   群内 "@机器人 自动        │                            │
   跑点又歪了"               │                            │
              │              │                            │
              ▼              │                            │
       事件 im.message.receive_v1                         │
              │              │                            │
              └──────WSS 长连接推送─────────────────►   │
                                                          │
                                          EventDispatcher
                                                  │
                                                  ▼
                                       message-handler
                                       ├─ 非 text? → drop
                                       ├─ 非 @bot? → drop
                                       ├─ strip @标签
                                       └─ skill-dispatcher
                                                  │
                                                  ▼
                                       mock：合成 stub 文本
                                       (claude/deepseek: stub error)
                                                  │
                                                  ▼
                                       reply-sender
                                                  │
                                                  ▼
                                       client.im.v1.message.create
                                                  │
                          ◄────────HTTPS────────┤
              ▼              │                            │
     飞书群内显示回复       │                            │
```

## 4. 错误模型

| 错误类别 | 触发场景 | 处理策略 | 用户可见度 |
|----------|----------|----------|------------|
| 网络断 | WSS 连接中断 | SDK 自动重连（指数退避） | 短暂中断后自动恢复，不主动通知 |
| Token 过期 | `tenant_access_token` 2h 后失效 | SDK 自动刷新 | 透明 |
| 消息发送失败 | `im.message.create` 抛错（限流 / 网络） | 单次重试 1 次（间隔 1s），仍失败记日志放弃 | 用户看到的是机器人未回复 |
| Handler 异常 | message-handler 内部 throw | event-router 捕获 + 记日志 + 静默吞 | 机器人未回复，下一条 @ 仍能正常处理 |
| 3 秒 ack 超时 | 同步处理过长 | 把耗时任务移到 `setImmediate` / Promise.resolve().then() 异步链；同步函数立即返回 | 飞书重推 → 重复消息，需后续去重 |
| 配置缺失 | 启动时 .env 字段缺 | `loadConfig` 直接 `process.exit(1)` 并打印 zod issues | 进程不启动，用户看启动日志 |
| @机器人但消息为空 | 用户只 @ 没说话 | 回复"@我 + 一句调试症状"帮助语 | 直接帮助 |
| Skill mode 未实现 | mode=claude/deepseek but unimplemented | dispatchSkill 抛错 → handler 捕获 → 不回复 | 机器人不回复（应在 MVP 阶段保持 mode=mock） |

**3 秒 ack 边界的真实处理**（MVP 不踩雷）：
- mock 模式纯本地字符串拼接，远在 3 秒内（实测应在 50ms 内）
- 后续接入 claude/deepseek 时必须改异步：handler 立即返回 → setImmediate(async () => { ... await llm.call(); await reply; })。否则飞书会重推同一条消息，产生重复回复。

## 5. 凭证管理与安全边界

### 5.1 .env 字段（用户线下注入）

`apps/lark-gateway/.env`（**不入仓库**，`apps/lark-gateway/.gitignore` 覆盖）：

```bash
LARK_APP_ID=cli_xxxxx
LARK_APP_SECRET=xxxxx
LARK_BOT_OPEN_ID=ou_xxxxx
LARK_DOMAIN=feishu
PROBEFLASH_SKILL_MODE=mock
```

`apps/lark-gateway/.env.example`（**入仓库**，字段示意）：

```bash
LARK_APP_ID=
LARK_APP_SECRET=
LARK_BOT_OPEN_ID=
LARK_DOMAIN=feishu
PROBEFLASH_SKILL_MODE=mock
# When ready, add provider keys to enable real checklist generation:
# ANTHROPIC_API_KEY=sk-ant-xxx   # then set PROBEFLASH_SKILL_MODE=claude
# DEEPSEEK_API_KEY=sk-xxx        # then set PROBEFLASH_SKILL_MODE=deepseek
```

### 5.2 .gitignore 规则

在 `apps/lark-gateway/.gitignore` 加：

```
.env
.env.*
!.env.example
```

仓库根级 `.gitignore` 也保留对 `*.env` 的覆盖（已存在）。

### 5.3 AI / Skill 行为约束（AGENTS.md §3 全文生效）

- AI 不读 `apps/lark-gateway/.env`
- AI 不要求用户粘贴 key
- AI 不在 README / planning / 日志 / commit message 中写入 key
- LARK-03 实现时只 import `process.env.LARK_*`，不直接 `fs.readFile('.env')`
- 真实 provider smoke 由用户本地执行

## 6. 部署形态

### 6.1 本地开发 / 备赛期自用
- Node 20+（与 v0.3 desktop / server 同一 Node 版本基线）
- TypeScript 5.x
- 启动：`cd apps/lark-gateway && npm install && npm run dev`
- 不需要公网 IP、不需要端口暴露（Long Connection 主动出站 WSS）
- 可跑在 WSL2 / Mac / Linux / 任何能 npm install 的机器
- 进程退出后机器人离线；重启即恢复

### 6.2 战队服务器（备赛期可选）
- 同上 npm install + npm run dev / npm start
- 若需后台常驻：用 tmux / screen / nohup（不强求 systemd，避免触碰 AGENTS.md §8 禁止项）
- **不**部署到 80/443 端口；不写 `/opt`；不动现有 v0.3 server

### 6.3 集群行为（重要 SDK 约束）
- 飞书 Long Connection **不广播**：同一应用部署多实例时只有 1 个随机收到消息
- MVP 不考虑多实例；战队服务器跑一个就够

## 7. 与现有 ProbeFlash 仓库的耦合

- 新建 `apps/lark-gateway/`，与 `apps/desktop` / `apps/server` 并列
- 根级 `package.json` 已有 workspaces 配置（v0.3 设置），新子包加进去
- **不动** v0.3 冻结代码（D-018）：`apps/desktop` / `apps/server` 不引用 lark-gateway，反之亦然
- 引用 `.agents/skills/debug-checklist/SKILL.md`：仅在 `PROBEFLASH_SKILL_MODE=claude/deepseek` 时读取 prompt 模板（MVP mock 模式不读，后续 provider 实现时再加）
- TypeScript 配置独立：lark-gateway 自己的 `tsconfig.json`；可继承根级 `tsconfig.base.json` 如存在

## 8. 测试策略（MVP 范围）

### 8.1 单元测试
- `message-handler.test.ts`：
  - 非 text 消息 → 不调用 reply-sender
  - 非 @机器人 消息 → 不调用 reply-sender
  - @机器人空内容 → 调用 reply-sender with kind='help'
  - @机器人有内容 → 调用 dispatchSkill + reply-sender
  - `stripMention` 单元用例
- 不打飞书网络，所有外部依赖（`Client`、`dispatchSkill`、`sendReply`）通过 mock 注入

### 8.2 集成测试（备赛期不强制）
- 真实飞书连通性测试 = "真实 provider smoke" 范畴 → 由用户线下完成
- 检查项写在 `docs/research/lark-onboard-guide.md`（LARK-ONBOARD-GUIDE 任务交付）

### 8.3 npm scripts
- `npm run dev`：tsx 运行 `src/main.ts`（开发热重载可选）
- `npm run build`：tsc 输出到 `dist/`
- `npm start`：node `dist/main.js`
- `npm test`：vitest 跑 `test/**/*.test.ts`
- `npm run typecheck`：tsc --noEmit
- `npm run verify:all`：typecheck + test + build

## 9. 未来扩展（备赛后或本期有余力时）

按 D-021 "先接进去看看，有问题或者有时间再去优化" 原则，**MVP 阶段不做**以下，但保留扩展点：

| 扩展 | 触发条件 | 改动范围 |
|------|---------|----------|
| 真实 LLM 接入（claude/deepseek） | 用户配置 provider key | skill-dispatcher 新加分支 + 读 SKILL.md 模板 |
| 卡片消息回复（markdown 富文本） | UI 体验需求 | reply-sender 切 `messageCard.defaultCard` |
| 飞书 thread 模式回复 | 群内对话上下文 | reply-sender 加 `reply_in_thread` |
| 切换 Webhook 模式 | 公网 IP 已就绪、需多实例集群 | 入口替换 wsClient 为 lark.adaptExpress + 加 express |
| 写入 `.debug-archive/` | dogfood 数据沉淀 | 加 archive-writer.ts，message-handler 调用 |
| 多 skill 路由 | 不止 debug-checklist | message-handler 加 intent 解析（关键词触发） |
| 富媒体消息（图片 / 文件） | 调试截图直接发群 | message-handler.message_type 分支 |

## 10. 验收标准（对 LARK-03-MIN-INTEGRATION 代码任务）

LARK-03 代码部分完成的标志：
1. `apps/lark-gateway/` 子包结构按 §1 落地
2. `npm install` 成功（含 `@larksuiteoapi/node-sdk` + `zod` + `dotenv` + dev: `vitest` + `tsx` + `typescript`）
3. `npm run typecheck` 通过
4. `npm run build` 通过
5. `npm test` 通过（§8.1 单元测试）
6. `npm run dev` 在缺 .env 时 zod 报错 + 退出（验证 config 边界）
7. `.env.example` + `.gitignore` 入仓库；`.env` **不入** 仓库
8. **不引入**任何 LLM provider 依赖（claude / deepseek SDK 不 install）
9. **不调** 真实飞书 API（开发者后台未注册、.env 未填的状态下，typecheck/build/test 全部能跑过）

真实飞书连通验证：由 LARK-ONBOARD-GUIDE 任务说明用户线下完成。

## 11. 关联文档

- `docs/research/lark-api-capability.md`（D-020）— 飞书 API 能力事实底座
- `docs/research/lark-oss-candidates.md`（D-020 后续）— SDK 选型证据链
- `docs/planning/decisions.md` D-021 — 路径 A 拍板与约束
- `docs/superpowers/plans/2026-05-16-lark-gateway.md`（forward-looking，**未激活**）— 历史路径 B 计划，本期不参考
- `.agents/skills/debug-checklist/SKILL.md` — 检查清单生成 skill（mock 模式不读，provider 模式读 prompt 模板）

---

设计版本：v1（status: draft）。LARK-03 代码落地后若发现接口偏差，回头更新本文件并把 status 升为 `stable`。
