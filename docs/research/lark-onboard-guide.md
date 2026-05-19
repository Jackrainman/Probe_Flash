---
title: 飞书接入线下动作清单（用户侧）
status: stable
date: 2026-05-19
related:
  - docs/design/lark-connector.md
  - docs/research/lark-api-capability.md
  - decisions.md D-020, D-021
audience: 仓库维护者 / 用户本人（不是 AI / Agent）
---

# 飞书接入线下动作清单

> AI 在 LARK-02 → LARK-OSS-SCAN → LARK-PATH-DECISION → LARK-01 → LARK-03 已经把"飞书 → ProbeFlash → 飞书"链路的**代码侧**全部落地（commit `43745c7` 到 `e821c8f`）。剩下的动作必须**用户本地**完成，AI 不参与（AGENTS.md §3 全文生效）。本文按"先后顺序 + 检查清单"形式列出，逐项打钩即完成接入。

## 0. 前置自检（5 分钟）

- [ ] 仓库已 pull 到 `e821c8f` 或更新版本
- [ ] Node.js ≥ 20（推荐 22.x，与 `lark-gateway` 当前测试环境一致）
- [ ] npm ≥ 10
- [ ] 本机能访问 `https://open.feishu.cn`（国内）或 `https://open.larksuite.com`（海外）
- [ ] 拥有一个飞书账号，且**已被加入企业租户**（不能是个人版飞书）
- [ ] 该企业租户的管理员**愿意配合**审批"读取群消息 + 发送消息"权限（不需要管理员账号本身参与，只需肯审批）

如果上面任何一项不满足，停在这里——不要再往下做，先解决前置。

## 1. 在飞书开发者后台创建企业内部应用

> 国内域名 https://open.feishu.cn/app/  ｜  海外域名 https://open.larksuite.com/app/

1. 登录后选 **「企业自建应用」→「创建企业自建应用」**。
2. 应用名称：自定义（如 `ProbeFlash-bot`），描述、图标可选。
3. 创建完成后进入应用详情页，**记下** `App ID`（形如 `cli_xxxxxxxxxxxx`）。
4. 在「凭证与基础信息」找到 `App Secret`，点击"显示"后**复制**保存（管理后台只显示一次，后续要刷新会换值）。

⚠️ App Secret 是敏感凭证：**不要发到群里、不要 commit、不要复制到任何在线工具**。本地用文本编辑器保存到 `.env`（见 §4）。

## 2. 启用「机器人」能力 + 拿到 Bot Open ID

1. 在应用详情页左侧菜单 → **「机器人」**，点击启用。
2. 启用后机器人会获得 `bot_open_id`（形如 `ou_xxxxxxxxxxxxxxxx`）。
3. 在「机器人」页面找到 `Open ID` 字段，**复制**保存。这是机器人**自己**的 open_id，用于检测群里"@机器人"动作。

> 这一步**必须做**——`lark-gateway/src/message-handler.ts` 用这个值判断"用户是不是在 @ 机器人"。没填这字段 → 机器人收到所有群消息但**全部忽略**（@bot 检测失败）。

## 3. 申请权限 + 订阅事件

### 3.1 申请权限（「权限管理」页）

勾选并申请以下两项（**仅需这两项**，不要勾全员通讯录 / 历史消息读取等高敏感权限——会被管理员驳回）：

- [ ] `im:message:send_as_bot` — 以机器人身份发送消息
- [ ] `im:message.group_at_msg:readonly` — 接收群内 @机器人的消息（只读，不是全量群消息）

申请后点「申请发布版本」→ **等管理员审批**。审批耗时由企业 IT 治理决定（敏捷小作坊几分钟，大企业可能数周——飞书平台本身只占毫秒级）。

### 3.2 订阅事件（「事件与回调」→「事件订阅」）

1. 在「事件订阅」页选择 **「使用长连接接收事件」**（关键：本仓库用 Long Connection 模式，不是 Webhook 模式）。
2. 添加事件 **`im.message.receive_v1`**（"接收消息事件"）。
3. 不要配置 Webhook URL（Long Connection 模式无需）。
4. **不需要** 配 `Encrypt Key` 和 `Verification Token`——Long Connection 在 WSS 握手时鉴权，事件 payload 是明文，所以这两个字段在本仓库**不会用到**（`.env.example` 也没有它们）。

### 3.3 把机器人加入测试群

1. 在飞书客户端创建一个测试群（或用现有调试群）。
2. 群设置 → 群机器人 → 添加机器人 → 选刚创建的 `ProbeFlash-bot`。
3. 群里发一条 `@ProbeFlash-bot test` 试试——此时机器人**还不会回应**（gateway 还没启动）。如果连机器人都没出现在 @ 提示里，说明 §3.1 权限没批通过或没加进群。

## 4. 在本地填 `.env`

```bash
cd apps/lark-gateway
cp .env.example .env
# 用任意编辑器（vim / VS Code / nano）打开 .env 填入 §1-2 拿到的值
```

`.env` 必填字段（其他字段保持默认）：

| 字段 | 填什么 | 来自 §哪 |
|------|--------|---------|
| `LARK_APP_ID` | App ID（`cli_xxx`） | §1 |
| `LARK_APP_SECRET` | App Secret | §1 |
| `LARK_BOT_OPEN_ID` | 机器人 Open ID（`ou_xxx`） | §2 |
| `LARK_DOMAIN` | `feishu`（国内）或 `lark`（海外），默认 `feishu` | §1 |
| `PROBEFLASH_SKILL_MODE` | `mock`（备赛期 MVP 用这个；先打通链路） | 默认 |

### 安全自检
- [ ] `.env` 在 `apps/lark-gateway/` 目录内，**不是**仓库根级
- [ ] `git status` 看不到 `.env`（被 `.gitignore` 覆盖）
- [ ] App Secret 没出现在任何 commit、log、聊天记录里

如果担心，跑这条命令做最终自检（应该全部找不到）：

```bash
git ls-files | xargs grep -l "$(grep LARK_APP_SECRET .env | cut -d= -f2)" 2>/dev/null
# 期望输出：空（说明 secret 没泄到仓库任何文件）
```

## 5. 启动 lark-gateway + 跑 Mock 模式 smoke

```bash
cd apps/lark-gateway
npm install                  # 首次必跑；后续若已 install 可跳
npm run dev                  # 进程常驻；Ctrl-C 退出
```

### 预期启动日志
```
[info] starting lark-gateway {"domain":"feishu","mode":"mock","bot_open_id":"ou_xxx..."}
# 之后 SDK 会输出 WSS 连接相关日志（"connected" / "subscribe ok" 之类）
```

启动失败的常见原因：
- zod 报错列了具体字段 → `.env` 缺字段，对照 §4 表格补
- `connect ETIMEDOUT` / `getaddrinfo ENOTFOUND` → 本机访问飞书域名被防火墙拦
- `app_id or app_secret invalid` → §1 凭证错；重新复制 / 重新点"显示 App Secret"
- 启动后无任何反应（连 SDK info 都没出） → 把 `loggerLevel` 改 `debug` 看更多输出

### Mock 模式 smoke 走查

1. 在测试群里 @ 机器人 + 一句症状：
   ```
   @ProbeFlash-bot 自动跑点又歪了
   ```

2. 期望 1-3 秒内机器人在群里回复：
   ```
   [mock 模式] 已收到症状：自动跑点又歪了

   lark-gateway 当前 PROBEFLASH_SKILL_MODE=mock，不调用真实 LLM。
   配置 ANTHROPIC_API_KEY 或 DEEPSEEK_API_KEY 后，把
   PROBEFLASH_SKILL_MODE 改成对应 provider 即可生成 5-8 条检查清单。
   详见 docs/research/lark-onboard-guide.md。
   ```

3. 测以下边缘情况确认 handler 行为：

| 操作 | 期望行为 |
|------|---------|
| 在群里发 `hello`（不 @机器人） | 机器人**不**回复 |
| `@ProbeFlash-bot` 后什么都不打 | 机器人回复 `@我 + 一句调试症状（如"自动跑点又歪了"），我会生成检查清单。` |
| `@另一个人` 后说话 | 机器人**不**回复（@ 的不是它） |
| 私聊机器人发文本 | 看你的权限范围；默认情况下私聊不触发 `im.message.group_at_msg:readonly`（只有群 @ 才触发） |

✅ Mock 模式 smoke 走查通过 = 飞书 → ProbeFlash → 飞书 **链路打通**。LARK-03 整体任务在你这里收尾。

## 6. （可选）接通真实 LLM provider

Mock 模式只是回显。要让机器人真的输出 5-8 条 debug-checklist，需要接通 LLM。这一步**不在备赛期 MVP 范围内**（D-021 明确"先接进去看看"），但本节列出后续接入的 checklist 供有时间时使用。

### 6.1 选 provider

- **Claude（Anthropic）**：质量高，价格中等，需要 `ANTHROPIC_API_KEY`（从 console.anthropic.com 拿）
- **DeepSeek**：国内可访问，价格低，需要 `DEEPSEEK_API_KEY`（从 platform.deepseek.com 拿）

### 6.2 在 .env 加 key
```bash
# 编辑 apps/lark-gateway/.env，加一行：
ANTHROPIC_API_KEY=sk-ant-xxx           # 选 Claude 时
# 或
DEEPSEEK_API_KEY=sk-xxx                 # 选 DeepSeek 时

# 并把模式改成对应 provider：
PROBEFLASH_SKILL_MODE=claude            # 或 deepseek
```

### 6.3 实现 provider 调用（后续任务）

当前 `apps/lark-gateway/src/skill-dispatcher.ts` 的 `claude` / `deepseek` 分支抛 `not implemented` 错。要让它真的工作：

1. 在 `apps/lark-gateway/` 安装 provider SDK（`npm i @anthropic-ai/sdk` 或 `openai`-兼容客户端调 DeepSeek）。
2. 把 `.agents/skills/debug-checklist/SKILL.md` 的 prompt 模板读进来（fs.readFile + parse YAML frontmatter）。
3. 在 `dispatchSkill` 的 `case 'claude'` 分支构造 messages.create 调用，把症状文本插值进 SKILL.md 的 prompt 模板。
4. 关键：把同步 handler 改异步——3 秒 ack 边界要求 `handleMessage` 立即返回，LLM 调用放 `setImmediate` 异步链。否则飞书会重推 → 重复回复。
5. 加 `provider` 失败的降级回复（mock 文本 + "provider 暂时不可用"）。

### 6.4 启用 prompt cache（如选 Claude）

按 `claude-api` skill 推荐，多轮调用应启用 prompt caching：把 SKILL.md prompt 模板标为 `cache_control: { type: 'ephemeral' }` 系统消息，可省 90% token。这是后续优化项，**不**在 MVP 范围内。

### 6.5 真实 provider smoke（用户跑）

```bash
# 改完 .env + 实现完代码后：
cd apps/lark-gateway && npm run dev
# 在群里 @ 机器人 + 症状 → 期望收到 5-8 条带依据 + 验证动作的检查清单
```

预期回包格式（按 SKILL.md 模板）：

```markdown
# 检查清单：自动跑点又歪了

**症状**：自动跑点又歪了
**仓库上下文**：<AI 自动填>
**生成时间**：<YYYY-MM-DD HH:MM>

## 检查项

1. **<检查项标题>** [优先级：高]
   - **依据**：...
   - **验证动作**：...

... (共 5-8 条)
```

## 7. 部署到战队服务器（可选）

备赛期建议**只跑本地**（自己机器或 WSL）。若确实要常驻战队服务器：

- [ ] 服务器有 Node 20+
- [ ] 服务器**能出站**到飞书 WSS（防火墙允许 443 出站）
- [ ] `git clone` 仓库到服务器，`cd apps/lark-gateway && npm install`
- [ ] 用 `tmux new -s lark-gateway` 创建会话，里面跑 `npm run dev`，`Ctrl-b d` 脱离
- [ ] **不** 用 `systemd`、**不** 写 `/opt`、**不** 占 80/443 端口（AGENTS.md §8 夜跑/部署边界）

如果要更严肃的常驻方案（开机自启 / 监控 / 日志聚合）→ 备赛后再做，不在本 guide 范围内。

## 8. 常见问题排查

| 现象 | 检查顺序 |
|------|----------|
| `npm run dev` 启动报 zod 错 | `.env` 字段缺；对照 §4 表格 |
| 启动成功但 @ 机器人无反应 | (a) `LARK_BOT_OPEN_ID` 对不对（§2）；(b) 权限审批通过了吗（§3.1）；(c) 事件订阅是否选了 Long Connection（§3.2）；(d) 机器人是否在群里（§3.3） |
| 收到回复但内容是 mock 提示 | 这是预期；`PROBEFLASH_SKILL_MODE=mock` 即此行为；要真实 checklist 看 §6 |
| 机器人对每条消息回复多次 | handler 处理超过 3 秒导致飞书重推；改异步（§6.3 第 4 点） |
| 连不上 WSS（启动后没有 connected 日志） | 本地网络出站到 `open.feishu.cn:443` 被拦；或公司代理 |
| `429 Too Many Requests` | 单租户/月超 100 万次或单应用 QPS 默认极低；备赛期不可能触发，触发请先复查代码循环 |

## 9. 这份指南的边界

- 本文**不**包含飞书后台 UI 的截图（飞书后台 UI 会变；以官方文档为准 https://open.feishu.cn/document/）
- 本文**不**包含 SDK 版本细节（看 `apps/lark-gateway/package.json` 的 `@larksuiteoapi/node-sdk` 版本）
- 本文**不**包含真实 LLM provider 接入的完整代码（§6 只列 checklist，实际代码是后续任务）
- 本文**不**包含战队服务器系统初始化（Node / npm / 防火墙等）；以你的服务器现状为准

## 10. 完成 checklist 总表

走完一遍打钩留底：

- [ ] §0 前置自检
- [ ] §1 创建企业内部应用 + 拿到 App ID + App Secret
- [ ] §2 启用机器人 + 拿到 Bot Open ID
- [ ] §3.1 申请 `im:message:send_as_bot` + `im:message.group_at_msg:readonly`，等管理员审批通过
- [ ] §3.2 事件订阅选 Long Connection + 添加 `im.message.receive_v1`
- [ ] §3.3 机器人加入测试群
- [ ] §4 本地 `.env` 填好 5 字段；`git status` 看不到 `.env`
- [ ] §5 `npm install` + `npm run dev` 启动成功
- [ ] §5 在群里 @ 机器人 → 收到 mock 模式回复
- [ ] §5 边缘情况走查全部符合预期
- （可选）§6 接真实 provider；MVP 不做
- （可选）§7 部署到战队服务器；备赛期不建议
