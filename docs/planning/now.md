# Now

> 唯一当前战况源。机读字段在下方 yaml 块；其它候选见 `backlog.md`，长期决策见 `decisions.md`，长期愿景见 `roadmap.md`，规则见 `AGENTS.md`，已完成历史看 `git log`。瘦身前文档全部保留在 `docs/archive/pre-slim/`，默认不读取。

```yaml
mode: server_storage_migration
stage: R1
stage_goal: v0.3.0 已发布；P0 = 技术债地基加固（夜跑纯还债） + AI草稿流准备（白天主线）
current_task: TECH-01-CLOSEOUT-ATOMICITY-DESIGN
frontier:
  - TECH-01-CLOSEOUT-ATOMICITY-DESIGN  # current, P0, night-safe, 独立无依赖
  - TECH-08-HTTP-REPOSITORY-SPLIT  # pending, P0, night-safe, 独立无依赖
  - AIREADY-02-PROMPT-SCHEMA-VERSIONING  # pending, P1, night-safe, 白天主线
night_run: active  # TECH 链纯本地，无真实服务器/API key/sudo 依赖
blocked:
  - REALAI-09-REAL-PROVIDER-OPT-IN-SMOKE  # 等用户 source env，AIREADY P1 完成后解
  - DATA-06-BACKUP-RETENTION-POLICY  # 待用户拍板（低优先级）
post_0_3_registry:
  - AI-DRAFT-DEEPSEEK-SCHEMA-GUARD
  - HERMES-EXPERIMENT-BOOTSTRAP
```

## 当前任务
- **TECH-01-CLOSEOUT-ATOMICITY-DESIGN**（P0，夜跑，night-safe）
- 目标：把 closeout 写 ErrorEntry + ArchiveDocument + 标 Issue archived 三步包进 SQLite `BEGIN IMMEDIATE / COMMIT / ROLLBACK` 事务，并在数据层落 `closeout_state` 标记位（`pending` / `completed` / `failed`），用于后续 TECH-02 启动时扫描恢复。
- 边界：只动 `apps/server/src/database.mjs` 与必要的 closeout 写路径；不改 schema 之外的迁移、不改前端 UI；不引入新表。
- 不做：TECH-02 的恢复扫描入口、UI 提示、远端备份/恢复（DATA-01~03）、HTTP 路由结构调整（TECH-08/09）。
- DoD：closeout 三段写在同一事务里；任意一步失败时 ROLLBACK；`closeout_state` 字段在 issues 表落地并被读路径读到；新建 `verify-server-closeout-atomicity.mjs`；现有 verify 链全过；`git diff --check` 干净。
- 验证：`cd apps/desktop && npm run verify:all && npm run typecheck && npm run build`；`cd apps/server` 全量 verify:* + 新建 atomicity verify；`git diff --check`。

## 前沿候选（≤3）
- TECH-08-HTTP-REPOSITORY-SPLIT（pending，P0，夜跑，独立无依赖）
- AIREADY-02-PROMPT-SCHEMA-VERSIONING（pending，P1，白天主线，night-safe）
- TECH-10-DATABASE-MODULE-SPLIT（pending，P0，夜跑，独立无依赖）

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
| 技术债地基（verify helpers → 架构拆分） | 🟡 TECH-04/05/06 完成（helpers + tempdir + server fixtures）；下一波 TECH-01/08/10 |
| AI草稿流 prompt schema versioning | 🟡 AIREADY-02 next（白天） |
| 真实 AI provider smoke | 🟡 等 AIREADY P1 完成 |

## 最近完成（最多 5 条；更长历史看 `git log --oneline`）
- TECH-06 server fixtures 模块（repoSnapshot/issue/record/archive/errorEntry）+ 3 server 脚本接入
- TECH-05 verify 脚本 tempdir 全量迁到 createTempDir（25 个脚本）+ s4 release 版本 fixture 修正
- TECH-04 verify helpers 共享模块（desktop .mts + server .mjs）+ 4 个脚本迁入
- DATA-01 deprioritized：数据安全整条推后，夜跑改为技术债
- DEP-05/06 systemd 自启 reboot 验证
