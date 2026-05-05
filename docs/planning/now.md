# Now

> 唯一当前战况源。机读字段在下方 yaml 块；其它候选见 `backlog.md`，长期决策见 `decisions.md`，长期愿景见 `roadmap.md`，规则见 `AGENTS.md`，已完成历史看 `git log`。瘦身前文档全部保留在 `docs/archive/pre-slim/`，默认不读取。

```yaml
mode: server_storage_migration
stage: R1
stage_goal: v0.3.0 已发布；P0 = 技术债地基加固（夜跑纯还债 完成） + AI草稿流准备（白天主线）
current_task: AIREADY-02-PROMPT-SCHEMA-VERSIONING
frontier:
  - AIREADY-02-PROMPT-SCHEMA-VERSIONING  # current, P1, 白天主线, night-safe
  - AIREADY-08-MOCK-PROVIDER  # pending, P1, 白天, night-safe
  - AIREADY-03-GOLDEN-DRAFT-FIXTURES  # pending, P1, 白天, night-safe
night_run: active  # 技术债地基整波收完；夜跑窗口可承接 AI-ready P1 任务
blocked:
  - REALAI-09-REAL-PROVIDER-OPT-IN-SMOKE  # 等用户 source env，AIREADY P1 完成后解
  - DATA-06-BACKUP-RETENTION-POLICY  # 待用户拍板（低优先级）
post_0_3_registry:
  - AI-DRAFT-DEEPSEEK-SCHEMA-GUARD
  - HERMES-EXPERIMENT-BOOTSTRAP
```

## 当前任务
- **AIREADY-02-PROMPT-SCHEMA-VERSIONING**（P1，白天主线，night-safe）
- 目标：给 AI prompt schema / 草稿 schema 落版本号字段，老草稿在 prompt 升级后能被识别为旧版本而不是被静默丢弃；UI 显示草稿版本与当前 prompt 版本是否匹配。
- 边界：只动 `apps/desktop/src/ai/` + `apps/server/src/ai/` 与必要的 verify 脚本；不动 storage / repositories / database；不引入新的 AI provider。
- 不做：迁移老草稿到新版本、改 prompt 文本本身、添加新 task 类型。
- DoD：草稿 schema 加 `promptVersion` 字段；当前 prompt 版本号化；草稿历史读路径暴露 promptVersion；草稿 UI 标注"当前 prompt vN，本草稿 vM"；新建 `verify-ai-ready-prompt-schema-versioning.mjs`；现有 verify 链全过；`git diff --check` 干净。
- 验证：`cd apps/desktop && npm run typecheck && npm run build && npm run verify:all`；`cd apps/server && npm run verify:realai-deepseek-adapter` + 必要的契约 verify；`git diff --check`。

## 前沿候选（≤3）
- AIREADY-08-MOCK-PROVIDER（pending，P1，白天，night-safe）
- AIREADY-03-GOLDEN-DRAFT-FIXTURES（pending，P1，白天，night-safe）
- AIREADY-06-DRAFT-DIFF（pending，P1，白天，night-safe）

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
- 夜跑：active；技术债地基整波收完，夜跑窗口可承接 AI-ready P1 任务（不需 API key、不依赖真实 provider）。

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
| Workspace 隔离审计 + 全 entity 隔离 verify | ✅ TECH-03 完成 |
| 技术债地基（verify helpers → 架构拆分） | ✅ TECH-04/05/06/01/02/08/09/10/03 整波完成 |
| AI草稿流 prompt schema versioning | 🟡 AIREADY-02 current（白天） |
| 真实 AI provider smoke | 🟡 等 AIREADY P1 完成 |

## 最近完成（最多 5 条；更长历史看 `git log --oneline`）
- TECH-03 workspace 隔离审计 + verify：审 `apps/server/src/db/*.mjs` 所有查询确认每个 list/get/update/delete/closeout/recovery/search 都按 workspace_id 过滤；新建 `verify-server-workspace-isolation.mjs` 覆盖 list/cross-GET/cross-PUT/cross-closeout/recovery scope/search/form-draft DELETE 7 个层面，加直连 sqlite 的 orphan-row 审计
- TECH-10 database.mjs 按 entity 拆分：新增 `apps/server/src/db/{constants,storage-error,validation,schema,lookups,workspace,issue,record,archive,errorEntry,formDraft,closeoutRecovery,search}.mjs`；database.mjs 从 1426 行瘦到 89 行（仅装配 entity ops 进 store）；store 外部形状不变
- TECH-09 server.mjs 路由按 entity 拆分：新增 `routes/{version,health,workspaces,issues,records,archives,errorEntries,closeoutRecovery,formDrafts,search,ai}.mjs` + index 聚合 + `http/{responses,static,dispatcher}.mjs` + `config.mjs` + `closeoutRecoveryScan.mjs`；server.mjs 从 610 行瘦到 85 行
- TECH-08 HTTP Repository 拆分：新增 `apps/server/src/repositories/{workspace,issue,record,archive,errorEntry,formDraft,closeoutRecovery,search}Repository.mjs` + `index.mjs`；server.mjs 路由全部改用 `repositories.<entity>.<method>`
- TECH-02 closeout recovery：`listCloseoutRecovery` + `clearCloseoutState` + 启动扫描日志；GET/POST `/api/.../closeout-recovery` 路由；desktop `closeoutRecovery` repository 接口 + `CloseoutRecoveryPanel` UI 解除标记
