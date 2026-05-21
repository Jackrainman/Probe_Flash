---
title: lark-cli dev 工作流常用命令
status: stable
date: 2026-05-21
audience: dev 自检 / AI Agent / 故障排查时使用
related:
  - docs/research/lark-onboard-guide.md
  - docs/design/lark-connector.md
  - docs/planning/decisions.md D-022
constraints:
  - AGENTS.md §3 末尾：AI 只调 read-only 子命令
---

# lark-cli dev 工作流常用命令

> D-022 拍板后 `apps/lark-toolkit/cli-bridge.ts` 在程序运行时 shell out 到 lark-cli。dev / 排查时同一批命令也用得到，本文按场景列出。

## 1. 首次安装 + 鉴权

- `npm install -g @larksuite/cli` —— 全局安装（用户线下）
- `lark --version` —— 验证安装；预期 `lark version 1.x.y`
- `lark config init` —— 交互式填 App ID / Secret / domain（用户线下；AI 禁调）
- `lark auth login --recommend` —— OAuth 最小权限（用户线下；AI 禁调）
- `lark auth status` —— 验证登录态 + 当前 scope（AI 可调，read-only）
- `lark auth logout` —— 注销（用户线下）

## 2. dev 自检（AI 可调，read-only）

- `lark doctor` —— 跑全部前置自检（PATH / token / network / scope / app config）
- `lark schema <service>` —— 查 API 字段定义。例：
  - `lark schema im.v1.message` —— 发消息 API
  - `lark schema bitable.v1.tables` —— 多维表
  - `lark schema im.v1.chat` —— 群操作

## 3. 只读 API（AI 可调）

- `lark api im.v1.message.list --params '{"chat_id":"oc_xxx"}'` —— 列消息（read-only）
- `lark api im.v1.chat.get --params '{"chat_id":"oc_xxx"}'` —— 查群信息
- `lark api contact.v3.user.get --params '{"user_id":"ou_xxx"}'` —— 查用户（需 scope）

## 4. 写入 API（AI 禁默调；需用户一次一批审批）

- `lark api im.v1.message.create --data '{...}'` —— 发消息
- `lark api im.v1.chat.create --data '{...}'` —— 建群
- `lark api bitable.v1.tables.create --data '{...}'` —— 建多维表
- `lark api im.v1.message.delete --params '{"message_id":"om_xxx"}'` —— 删消息

AI 想代用户跑写入类时，先口头确认该次调用的参数 + 后果，用户批准后 AI 可执行。

## 5. 调试 + 故障排查

- `lark api ... --debug` —— 打印 HTTP request / response
- `lark api ... --output json` —— 结构化输出便于 grep / jq
- `lark api ... --as bot` / `--as user` —— 切机器人 / 用户身份执行
- `lark doctor --verbose` —— 详细诊断输出

## 6. 与 ProbeFlash 仓库的关系

- 仓库代码（`apps/lark-toolkit/cli-bridge.ts`）程序运行时通过 `execa('lark', ['api', method, '--data', json])` 调用，与本文命令是同一 lark-cli 二进制。
- 仓库 dev 命令（`npm run verify:all` 等）**不调用** lark-cli，所以 CI / 本地 verify 不需要装 lark-cli。
- 真实出站功能（卡片 / 多维表等）触发时才需要 lark-cli 在 PATH 上 + 已 `lark auth login`。

## 7. 不在本文范围

- 飞书后台应用注册 / 权限申请 / 事件订阅 → 见 `docs/research/lark-onboard-guide.md` §1-§3
- 配置 `.env` 与 gateway smoke → 见 onboard guide §4-§5
- lark-cli 自带的 24 个 AI Agent Skills 体系 → 上游文档 https://github.com/larksuite/cli/tree/main/skills（**与 ProbeFlash 的 .agents/skills/ 是同名异物**）
