# Now

> 唯一当前战况源。机读字段在下方 yaml 块；其它候选见 `backlog.md`，长期决策见 `decisions.md`，长期愿景见 `roadmap.md`，规则见 `AGENTS.md`，已完成历史看 `git log`。瘦身前文档全部保留在 `docs/archive/pre-slim/`，默认不读取。

```yaml
mode: server_storage_migration
stage: R1
stage_goal: v0.3.0 已发布；近期 P0 = 部署可用 + 数据安全 + 可观测
current_task: DATA-01-SQLITE-BACKUP-SERVER-PATH-VERIFY
frontier:
  - DATA-01-SQLITE-BACKUP-SERVER-PATH-VERIFY  # current, P0, day-only
  - DATA-03-RESTORE-DRY-RUN-SERVER-PATH-VERIFY  # pending, P0, depends DATA-01
  - UI-GATE-06-MANUAL-QUICK-ISSUE-LAYOUT-REVIEW  # manual-review, P1
night_run: blocked  # current_task 命中真实服务器写入，day-only
blocked:
  - REALAI-09-REAL-PROVIDER-OPT-IN-SMOKE  # 等用户本地 source DeepSeek env
  - DATA-06-BACKUP-RETENTION-POLICY  # 待用户拍板
post_0_3_registry:
  - AI-DRAFT-DEEPSEEK-SCHEMA-GUARD
  - HERMES-EXPERIMENT-BOOTSTRAP
```

## 当前任务
- **DATA-01-SQLITE-BACKUP-SERVER-PATH-VERIFY**（P0，day-only）
- 目标：在服务器 `/home/hurricane/probeflash/shared/data` 路径验证 SQLite 备份/恢复流程，确认 WAL 不漏备，恢复后数据一致。
- 边界：只改备份脚本与 backup/restore 文档；不动 server 业务、schema、UI、AI。
- 不做：保留策略（待拍板）、远程备份、schema 改动、生产数据修改。
- DoD：备份命令可跑；备份文件含主 DB + WAL；恢复 dry-run 数据一致；操作文档完整。
- 验证：`AGENTS.md §verify` 中 deploy/data 行；执行前先看 `git status --short` 干净。

## 前沿候选（≤3）
- DATA-03-RESTORE-DRY-RUN-SERVER-PATH-VERIFY（pending，依赖 DATA-01）
- UI-GATE-06-MANUAL-QUICK-ISSUE-LAYOUT-REVIEW（manual-review，等用户人工 review 桌面/移动端观感）

## 阻塞 / 待拍板
- REALAI-09 真实 DeepSeek key smoke：等用户本地 source env；AI 不读取密钥文件。
- DATA-06 备份保留策略 / DATA-07 恢复 runbook：待用户拍板。
- post-0.3 / Hermes 备案：`AI-DRAFT-DEEPSEEK-SCHEMA-GUARD`、`HERMES-EXPERIMENT-BOOTSTRAP` 已登记，不进入当前窗口。

## 安全边界（仍生效）
- 服务器：不 sudo、不写 `/opt`、不抢 80、不升级系统 Node、不影响 filebrowser/vnt-cli/docker/Portainer；release 部署优先 `/home/hurricane/probeflash` + 独立 Node runtime + 4100。
- AI：API key 只走 server env；AI 不读密钥文件、不写库；只返回草稿。
- Code context：先做用户显式 bundle，server 不任意扫仓库。
- 夜跑：当前 current_task 命中真实服务器写入，必须 day-only。

## 能力速览
| 能力 | 状态 |
|---|---|
| Release 用户目录部署 + systemd 自启（4100） | ✅（含 reboot 验证） |
| Web UI + API 同端口、health、version | ✅ |
| 项目/workspace、问题卡、排查记录、结案、归档、错误表 | ✅ |
| 搜索 / 标签 / 相似/复发提示 / 归档复盘 | ✅ |
| AI-ready 草稿 / DeepSeek 结案草稿（代码侧） | ✅ |
| 真实 AI provider smoke | 🟡 待用户 key |
| 数据备份/恢复 | 🟡 DATA-01 进行中 |

## 最近完成（最多 5 条；更长历史看 `git log --oneline`）
- DEP-05/06 systemd 自启 reboot 验证
- DEP-01~04 release 用户目录部署 + 健康/版本端点
- UI-POLISH-03-QUICK-ISSUE-LANDING-LAYOUT
- REALAI-DEEPSEEK-CLOSEOUT-DRAFT-MINIMAL
- CORE-FORM-DRAFT-SERVER-PERSISTENCE
