# Now

> 唯一当前战况源。机读字段在下方 yaml 块；其它候选见 `backlog.md`，长期决策见 `decisions.md`，长期愿景见 `roadmap.md`，规则见 `AGENTS.md`，已完成历史看 `git log`。瘦身前文档全部保留在 `docs/archive/pre-slim/`，默认不读取。

```yaml
mode: server_storage_migration
stage: R1
stage_goal: v0.3.0 已发布；P0 = 技术债地基加固（夜跑纯还债） + AI草稿流准备（白天主线）
current_task: TECH-10-DATABASE-MODULE-SPLIT
frontier:
  - TECH-10-DATABASE-MODULE-SPLIT  # current, P0, night-safe, 独立无依赖
  - TECH-03-WORKSPACEID-CONSISTENCY-LATER  # pending, P0, 夜跑, 扫尾
  - AIREADY-02-PROMPT-SCHEMA-VERSIONING  # pending, P1, 白天主线, night-safe
night_run: active  # TECH 链纯本地，无真实服务器/API key/sudo 依赖
blocked:
  - REALAI-09-REAL-PROVIDER-OPT-IN-SMOKE  # 等用户 source env，AIREADY P1 完成后解
  - DATA-06-BACKUP-RETENTION-POLICY  # 待用户拍板（低优先级）
post_0_3_registry:
  - AI-DRAFT-DEEPSEEK-SCHEMA-GUARD
  - HERMES-EXPERIMENT-BOOTSTRAP
```

## 当前任务
- **TECH-10-DATABASE-MODULE-SPLIT**（P0，夜跑，night-safe；独立无依赖）
- 目标：1426 行 `apps/server/src/database.mjs` 按 entity 拆成 `apps/server/src/db/<entity>.mjs`（issues / records / archives / errorEntries / formDrafts / workspaces / closeout / search / schema），database.mjs 退化为协调器（schema setup + 子模块装配）。
- 边界：只动 `apps/server/src/database.mjs` + 新建 `apps/server/src/db/*.mjs`；不改 store API（`createProbeFlashDatabase` 保留所有方法名签名 + 行为）；不动 routes/repositories；不引入 ORM。
- 不做：拆 store 方法的语义、删 schema、引入新表/外键；TECH-03 workspaceId consistency 扫尾另走。
- DoD：database.mjs 行数明显下降（< 200 行）；子模块每个 < 300 行；现有 verify 链全过；`createProbeFlashDatabase` 返回的 store 形状不变；`git diff --check` 干净。
- 验证：`cd apps/server` 全量 verify:* + atomicity / recovery；`cd apps/desktop && npm run typecheck && npm run build && npm run verify:all`；`git diff --check`。

## 前沿候选（≤3）
- TECH-03-WORKSPACEID-CONSISTENCY-LATER（pending，P0，夜跑，扫尾）
- AIREADY-02-PROMPT-SCHEMA-VERSIONING（pending，P1，白天主线，night-safe）
- AIREADY-08-MOCK-PROVIDER（pending，P1，白天，night-safe）

## 阻塞 / 待拍板
- REALAI-09 真实 DeepSeek key smoke：等用户 source env + AIREADY P1 完成（prompt schema 版本管理就绪后解）。
- DATA-06 备份保留策略 / DATA-07 恢复 runbook：待用户拍板（低优先级，数据安全整条推后）。
- CODECTX-07 AI 分析 bundle：等 REALAI 真实 AI 通路 + CODECTX-01 bundle CLI 完成。
- CODECTX-08/09 repo connector 白/黑名单：已删除，当前不存在仓库自动扫描功能。
- post-0.3 / Hermes 备案：`AI-DRAFT-DEEPSEEK-SCHEMA-GUARD`、`HERMES-EXPERIMENT-BOOTSTRAP` 已登记，不进入当前窗口。

## 安全边界（仍生效）
- 服务器：不 sudo、不写 `/opt`、不抢 80、不升级系统 Node、不影响 filebrowser/vnt-cli/docker/Portainer；release 部署优先 `/home/hurricane/probeflash` + 独立 Node runtime + 4100。
- AI：API key 只走 server env；AI 不读密钥文件、不写库；只返回草稿。
- Code context：先做用户显式 bundle，server 不任意扫仓库。
- 夜跑：active。TECH 链纯本地、无服务器/API key/sudo 依赖；DAYTIME 工作（AIREADY/REALAI 等）另走白天。

## 能力速览
| 能力 | 状态 |
|---|---|
| Release 用户目录部署 + systemd 自启（4100） | ✅（含 reboot 验证） |
| Web UI + API 同端口、health、version | ✅ |
| 项目/workspace、问题卡、排查记录、结案、归档、错误表 | ✅ |
| 搜索 / 标签 / 相似/复发提示 / 归档复盘 | ✅ |
| AI-ready 草稿 / DeepSeek 结案草稿（代码侧） | ✅ |
| Closeout 原子事务 + pending/failed 标记 + 启动恢复扫描 + 前端解除入口 | ✅ TECH-01/02 完成 |
| HTTP Repository 层 + 路由按 entity 拆分（server.mjs ~85 行） | ✅ TECH-08/09 完成 |
| 技术债地基（verify helpers → 架构拆分） | 🟡 TECH-04/05/06/01/02/08/09 完成；最后一波 TECH-10/03 |
| AI草稿流 prompt schema versioning | 🟡 AIREADY-02 next（白天） |
| 真实 AI provider smoke | 🟡 等 AIREADY P1 完成 |

## 最近完成（最多 5 条；更长历史看 `git log --oneline`）
- TECH-09 server.mjs 路由按 entity 拆分：新增 `routes/{version,health,workspaces,issues,records,archives,errorEntries,closeoutRecovery,formDrafts,search,ai}.mjs` + index 聚合 + `http/{responses,static,dispatcher}.mjs` + `config.mjs` + `closeoutRecoveryScan.mjs`；server.mjs 从 610 行瘦到 85 行
- TECH-08 HTTP Repository 拆分：新增 `apps/server/src/repositories/{workspace,issue,record,archive,errorEntry,formDraft,closeoutRecovery,search}Repository.mjs` + `index.mjs`；server.mjs 路由全部改用 `repositories.<entity>.<method>`
- TECH-02 closeout recovery：`listCloseoutRecovery` + `clearCloseoutState` + 启动扫描日志；GET/POST `/api/.../closeout-recovery` 路由；desktop `closeoutRecovery` repository 接口 + `CloseoutRecoveryPanel` UI 解除标记
- TECH-01 closeout 原子事务：`closeoutIssue` 走 BEGIN IMMEDIATE / COMMIT / ROLLBACK；落 `issues.closeout_state` 标记位（pending/completed/failed）+ 部分索引；新增 POST `/api/.../issues/:id/closeout` 路由
- TECH-06 server fixtures 模块（repoSnapshot/issue/record/archive/errorEntry）+ 3 server 脚本接入
