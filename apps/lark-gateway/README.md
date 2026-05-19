# @probeflash/lark-gateway

飞书 Long Connection 入站事件 → debug-checklist skill → 飞书回复 最小闭环。

按 `docs/design/lark-connector.md`（D-021 / D-020）实现路径 A（用 `@larksuiteoapi/node-sdk`）。当前 status: MVP / Mock-first。

## 启动前置

完成 `docs/research/lark-onboard-guide.md` 列出的全部线下动作（飞书后台注册应用、拿到 4 个凭证、在群里 @机器人等），然后：

```bash
cd apps/lark-gateway
cp .env.example .env
# 编辑 .env 填入真实值（4 个 LARK_* 字段）；切勿 git add .env
npm install
npm run dev
```

## 模式说明

`PROBEFLASH_SKILL_MODE` 控制 skill 调度行为：

| 值 | 行为 | 何时启用 |
|----|------|----------|
| `mock`（默认） | 回显症状 + 提示"需配置 provider 才能生成真实检查单" | 备赛期 MVP、链路联通性验证、飞书后台首次接通 |
| `claude` | （未实现）调 Anthropic API 生成 5-8 条检查清单 | 用户配置 `ANTHROPIC_API_KEY` 后切换 |
| `deepseek` | （未实现）调 DeepSeek API 生成 5-8 条检查清单 | 用户配置 `DEEPSEEK_API_KEY` 后切换 |

MVP 阶段 `claude` / `deepseek` 模式抛错；接通真实 provider 是 LARK-03 之后的任务。

## 安全边界（AGENTS.md §3）

- `.env` **不入仓库**（`.gitignore` 已覆盖）
- AI / Agent 不读 `.env`，不要求用户粘贴 key
- 真实 provider smoke 由用户本地执行

## 故障排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 启动时 zod 报错 | `.env` 缺字段 | 对照 `.env.example` 补全 |
| 启动后无任何输出 | WSS 连接未建立 | 检查 `LARK_APP_ID` / `LARK_APP_SECRET` 是否正确，网络是否能出站 |
| @机器人无响应 | `LARK_BOT_OPEN_ID` 不匹配 | 从飞书开发者后台复制机器人自己的 open_id |
| 收到回复但内容是 mock 提示 | `PROBEFLASH_SKILL_MODE=mock` | 这是 MVP 默认行为，等真实 provider 接入后切换 |

## 验收（LARK-03 DoD）

按 `docs/design/lark-connector.md` §10：

```bash
npm install          # 成功
npm run typecheck    # 通过
npm run build        # 通过
npm test             # 通过（test/ 下单测）
npm run verify:all   # 全部通过
```

真实飞书连通验证：见 `docs/research/lark-onboard-guide.md`（由用户线下完成）。
