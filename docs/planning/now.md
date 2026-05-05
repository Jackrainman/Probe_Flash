# Now

> 唯一当前战况源。机读字段在下方 yaml 块；其它候选见 `backlog.md`，长期决策见 `decisions.md`，长期愿景见 `roadmap.md`，规则见 `AGENTS.md`，已完成历史看 `git log`。瘦身前文档全部保留在 `docs/archive/pre-slim/`，默认不读取。

```yaml
mode: server_storage_migration
stage: R1
stage_goal: v0.3.0 已发布；P0 = 技术债地基加固（夜跑纯还债） + AI草稿流准备（白天主线）
current_task: TECH-03-WORKSPACEID-CONSISTENCY-LATER
frontier:
  - TECH-03-WORKSPACEID-CONSISTENCY-LATER  # current, P0, 夜跑, 扫尾（最后一波技术债）
  - AIREADY-02-PROMPT-SCHEMA-VERSIONING  # pending, P1, 白天主线, night-safe
  - AIREADY-08-MOCK-PROVIDER  # pending, P1, 白天, night-safe
night_run: active  # TECH 链纯本地，无真实服务器/API key/sudo 依赖
blocked:
  - REALAI-09-REAL-PROVIDER-OPT-IN-SMOKE  # 等用户 source env，AIREADY P1 完成后解
  - DATA-06-BACKUP-RETENTION-POLICY  # 待用户拍板（低优先级）
post_0_3_registry:
  - AI-DRAFT-DEEPSEEK-SCHEMA-GUARD
  - HERMES-EXPERIMENT-BOOTSTRAP
```

## 当前任务
- **TECH-03-WORKSPACEID-CONSISTENCY-LATER**（P0，夜跑，night-safe；扫尾，最后一波技术债）
- 目标：审计 `apps/server/src/db/*.mjs` 中所有 SELECT/UPDATE/DELETE 是否都按 `workspace_id` 过滤；为容易跨 workspace 泄漏的查询补 workspace 隔离测试。
- 边界：只动 `apps/server/src/db/*.mjs` 与新建的 verify 脚本；不改 schema、不改 routes / repositories；不引入新 column。
- 不做：跨 workspace 数据迁移、workspace 删除、workspace 软删除。
- DoD：每个 entity 的 list/get/create/update/delete 都已显式过滤 workspace_id（已审计且可在 verify 脚本中证明）；新建 `verify-server-workspace-isolation.mjs` 覆盖每 entity 的"workspace A 的数据不会泄漏到 workspace B"案例；现有 verify 链全过；`git diff --check` 干净。
- 验证：`cd apps/server` 全量 verify:* + 新建 isolation verify；`cd apps/desktop && npm run typecheck && npm run build && npm run verify:all`；`git diff --check`。

## 前沿候选（≤3）
- AIREADY-02-PROMPT-SCHEMA-VERSIONING（pending，P1，白天主线，night-safe）
- AIREADY-08-MOCK-PROVIDER（pending，P1，白天，night-safe）
- AIREADY-03-GOLDEN-DRAFT-FIXTURES（pending，P1，白天，night-safe）

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
| 数据库按 entity 拆分（database.mjs ~89 行 + db/*.mjs） | ✅ TECH-10 完成 |
| 技术债地基（verify helpers → 架构拆分） | 🟡 TECH-04/05/06/01/02/08/09/10 完成；最后一道 TECH-03 |
| AI草稿流 prompt schema versioning | 🟡 AIREADY-02 next（白天） |
| 真实 AI provider smoke | 🟡 等 AIREADY P1 完成 |

## 最近完成（最多 5 条；更长历史看 `git log --oneline`）
- TECH-10 database.mjs 按 entity 拆分：新增 `apps/server/src/db/{constants,storage-error,validation,schema,lookups,workspace,issue,record,archive,errorEntry,formDraft,closeoutRecovery,search}.mjs`；database.mjs 从 1426 行瘦到 89 行（仅装配 entity ops 进 store）；store 外部形状不变
- TECH-09 server.mjs 路由按 entity 拆分：新增 `routes/{version,health,workspaces,issues,records,archives,errorEntries,closeoutRecovery,formDrafts,search,ai}.mjs` + index 聚合 + `http/{responses,static,dispatcher}.mjs` + `config.mjs` + `closeoutRecoveryScan.mjs`；server.mjs 从 610 行瘦到 85 行
- TECH-08 HTTP Repository 拆分：新增 `apps/server/src/repositories/{workspace,issue,record,archive,errorEntry,formDraft,closeoutRecovery,search}Repository.mjs` + `index.mjs`；server.mjs 路由全部改用 `repositories.<entity>.<method>`
- TECH-02 closeout recovery：`listCloseoutRecovery` + `clearCloseoutState` + 启动扫描日志；GET/POST `/api/.../closeout-recovery` 路由；desktop `closeoutRecovery` repository 接口 + `CloseoutRecoveryPanel` UI 解除标记
- TECH-01 closeout 原子事务：`closeoutIssue` 走 BEGIN IMMEDIATE / COMMIT / ROLLBACK；落 `issues.closeout_state` 标记位（pending/completed/failed）+ 部分索引；新增 POST `/api/.../issues/:id/closeout` 路由
