# ProbeFlash 产品路线图（从长期愿景重建）

> 本路线图用于把 ProbeFlash 从 v0.2.x 的“本地 HTTP + SQLite + release 可部署基座”推进到“最好用的战队调试问题闭环软件”。本文件是长期产品路线图事实源；当前执行窗口仍以 `docs/planning/current.md` 与 `.agent-state/handoff.json` 为准。`docs/planning/status.md` 只是快速状态索引，不替代本文件。

## 0. 当前定位与边界

### 产品总愿景
ProbeFlash 不是单纯的问题记录工具，而是面向机器人 / 嵌入式战队调试现场的闭环软件：问题记录 -> 排查过程组织 -> 结案归档 -> 错误表沉淀 -> 历史问题检索 -> AI 辅助措辞 / 总结 / 分析 -> 代码上下文辅助定位 -> 长期知识库。

### 当前已完成基座
- 本地 HTTP + SQLite 主链路。
- workspace 创建 / 切换。
- issue / record / closeout / archive / error-entry 主路径。
- `ErrorEntry.prevention` 非空修复。
- release tarball 部署规划。
- `apps/server` 可同端口服务 `dist` + `/api`。
- AI-ready prompt templates。
- rule-based closeout draft panel。
- server schema contract。
- HTTP feedback contract。
- restore dry-run。
- repair task generation（integrity check repair plan + partial closeout repair task UI）。
- quick issue create（一句话创建 open issue 并自动选中）。
- record timeline polish（排查记录按时间线和类型芯片展示）。
- closeout UX polish（结案填写检查、必填提示和空格-only 本地拦截）。
- basic full-text search（基于 SQLite LIKE 的 workspace-scoped 基础搜索，覆盖 issue / record / archive / error-entry 最小集合）。
- search filters（结果类型、问题状态、已有标签和日期范围筛选；覆盖 server / desktop verify）。
- search tags（复用 IssueCard tags，ErrorEntry 增加向后兼容 tags；覆盖创建、展示、筛选、HTTP/localStorage/server verify、workspace 隔离和旧数据无 tags）。
- similar issues lite（基于标题、现象、标签、根因与处理方式重合的可解释规则排序；覆盖 pure ranking、localStorage fallback、HTTP repository 和 workspace 隔离）。
- search result linking（复用 `IssueCard.relatedHistoricalIssueIds`，支持从搜索 / 相似结果人工关联到当前问题、展示与取消关联；覆盖 localStorage fallback 与 HTTP 读写读回）。
- recurrence prompt（基于高相似度结果给出可忽略复发提示，展示历史标题、标签、根因和处理摘要；不接 AI、不自动写库）。
- UI redesign stage brief（`docs/planning/ui-redesign-brief.md`，建议进入受控 UI 小阶段，下一 UI 任务先做信息架构审查，不实际改 UI）。
- UI-GATE-01 visual direction confirmation（用户已确认首屏分区、真实边界、TECH-07 拆分目标和第一轮 UI 修改范围；确认记录见 `docs/planning/ui-redesign-brief.md#ui-gate-01-confirmation`）。
- night-run 安全规则。
- v0.2 历史文档归档。
- lightweight project status ledger（`PROJECT-STATUS-LEDGER-MINIMAL`，`docs/planning/status.md`，仅做人类快速索引）。

### 当前 blocked
- 真实服务器 release 用户目录部署验证。
- systemd 自启。
- 真实 AI provider / API key 接入。

### 分类口径
- `night-safe`：repo-local、可自动验证、可回滚，适合 AI unattended run。
- `day-only`：需要用户白天参与、人工观察或交互验收，不一定依赖外部账号。
- `blocked`：依赖服务器、sudo、API key、外部账号、硬件或真实环境。
- `decision-needed`：需要用户拍板产品方向、交互策略、数据保留策略或权限边界。

### 任务字段说明
下方每一行都是任务项。大任务与小任务都显式包含字段：ID、所属主线、目标、用户价值、前置依赖、允许修改、明确不做、验证方式、完成定义、执行类型、建议优先级、是否适合 AI unattended run。

## 1. Deployment / Operability

目标：服务器稳定运行、可更新、可诊断。

### 大任务
| ID | 所属主线 | 目标 | 用户价值 | 前置依赖 | 允许修改 | 明确不做 | 验证方式 | 完成定义 | 执行类型 | 建议优先级 | 是否适合 AI unattended run |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DEP-M1 | Deployment / Operability | release 用户目录部署与 LAN 可访问验证 | 战队能从同一 WiFi 访问真实服务 | v0.2.0 release assets；用户确认服务器边界 | deploy docs；planning；用户授权的服务器用户目录 | 不 sudo；不写 `/opt`；不碰 80；不服务器 `git pull` | SHA256；4100 Web/API；workspace/issue 创建读回；重启读回 | 固定 release 在 `/home/hurricane/probeflash` 运行，SQLite 持久化可读回 | blocked | P0 | 否 |
| DEP-M2 | Deployment / Operability | systemd 自启与服务生命周期 | 断电 / 重启后自动恢复 | DEP-M1 通过；用户授权 systemd / sudo | deploy service template；planning；用户授权的 systemd unit | 未授权不 sudo；不改旧服务；不抢 80 | `systemctl status`；`journalctl`；重启后 health | ProbeFlash 由 systemd 以 `hurricane` 用户拉起，可诊断 | blocked | P0 | 否 |
| DEP-M3 | Deployment / Operability | release update / rollback / diagnostics | 后续升级不怕覆盖数据，出问题可回滚 | DEP-M1 布局确认；version / health endpoint 可用 | deploy docs/scripts；diagnostics script；planning | 不删除 DB；不把 `shared` 放进 release；不公网暴露 | 新旧 release 切换；health；version；rollback；日志包 | 升级、回滚、诊断都有可重复步骤 | day-only | P1 | 部分：repo-local plan 可夜跑 |

### 小任务
| ID | 所属主线 | 目标 | 用户价值 | 前置依赖 | 允许修改 | 明确不做 | 验证方式 | 完成定义 | 执行类型 | 建议优先级 | 是否适合 AI unattended run |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DEP-01-RELEASE-USER-DIR-DEPLOY-VERIFY | Deployment / Operability | release user-dir deploy verify | 真正确认服务器可跑 Web + API + SQLite | release assets；用户确认 SSH / 上传或下载 / 4100 / 写入路径 | 服务器 `/home/hurricane/probeflash/*`；planning sync | 不 sudo；不 systemd；不 `/opt`；不 80；不升级 Node | SHA256；`curl /`；`curl /api/health`；创建 workspace/issue；重启读回 | `http://192.168.2.2:4100/` 可用且数据持久 | blocked | P0 | 否 |
| DEP-02-STATIC-DIST-SERVER-PATH-VERIFY | Deployment / Operability | 验证 release dist 由 server 同端口服务 | 避免只验证 API、不验证 Web UI | DEP-01 运行中；`PROBEFLASH_STATIC_DIR` 设置 | planning；必要 deploy note | 不引入 nginx/Caddy；不做 `.local` | `/` 返回 index；SPA route 返回 index；missing asset 404；`/api` JSON | 4100 同时服务 Web UI 与 `/api` | day-only | P0 | 否 |
| DEP-03-VERSION-ENDPOINT-SERVER-VERIFY | Deployment / Operability | version endpoint 在服务器 release 下可确认版本 | 用户知道服务器跑的是哪一版 | DEP-01；本地 `/api/version` 已完成 | planning；server env/release metadata 若必要 | 不依赖运行时 `.git`；不暴露 secrets | `curl /api/version`；`/api/health.data.release`；release tag 对应 | 服务器版本、commit、release tag 可读 | day-only | P0 | 否 |
| DEP-04-HEALTH-STATUS-SERVER-VERIFY | Deployment / Operability | health status 在服务器路径下可诊断 | 失败时能快速判断 server/storage/workspace 问题 | DEP-01；本地 health 已完成 | planning；deploy note | 不暴露敏感绝对路径；不做监控平台 | 正常 / 错误 env / DB 不可用时 health 可读 | health 能表达 server/storage/release 状态 | day-only | P0 | 否 |
| DEP-05-SYSTEMD-AUTOSTART-PREP | Deployment / Operability | 准备匹配 release 用户目录的 service 草案 | 降低 systemd 安装误操作风险 | DEP-01 通过 | `apps/server/deploy/*`；planning | 不执行 `systemctl`；不 sudo；不写 `/etc` | 静态检查 `User`、`WorkingDirectory`、`EnvironmentFile`、`ExecStart` | service 草案可给用户审核 | day-only | P0 | 否 |
| DEP-06-SYSTEMD-AUTOSTART-VERIFY | Deployment / Operability | 安装并验证 systemd 开机自启 | 服务器重启后服务自动恢复 | DEP-05；用户明确授权 sudo/systemd | 服务器 `/etc/systemd/system/probeflash.service`；planning | 未授权不 sudo；不影响 filebrowser / docker / portainer | daemon-reload；enable；start；status；journal；重启读回 | systemd 管理 ProbeFlash 且日志可诊断 | blocked | P0 | 否 |
| DEP-07-RELEASE-UPDATE-ROLLBACK-PLAN | Deployment / Operability | 设计 release update / rollback runbook | 后续升级有可回滚路径 | DEP-01 布局或现有 deploy docs | deploy docs；planning | 不真实部署；不删除数据；不改 tag | 文档静态检查；`git diff --check`；路径引用一致 | 更新 / 回滚步骤、持久目录、验证点清楚 | night-safe | P0 | 是 |
| DEP-08-RELEASE-UPDATE-ROLLBACK-VERIFY | Deployment / Operability | 在服务器实测新旧 release 切换 | 证明升级失败可回滚 | DEP-07；DEP-01；有新 release 或测试 release | 服务器 releases/current symlink；planning | 不删除 shared；不公网暴露；不抢 80 | 切新版本；health；version；创建读回；回滚旧版本 | update 和 rollback 都可重复执行 | blocked | P1 | 否 |
| DEP-09-LOGS-DIAGNOSTICS-BUNDLE | Deployment / Operability | 最小日志 / diagnostics bundle | 用户能把失败现场打包给 AI 或维护者 | DEP-04 或本地 health 可用 | deploy docs/scripts；server scripts；planning | 不收集 secrets；不上传外网；不读任意目录 | 生成 redacted diagnostics；包含 version/health/log tail | 一条命令产出可审阅诊断包 | night-safe | P1 | 是 |

## 2. Data Safety

目标：数据不丢、可备份、可恢复。

### 大任务
| ID | 所属主线 | 目标 | 用户价值 | 前置依赖 | 允许修改 | 明确不做 | 验证方式 | 完成定义 | 执行类型 | 建议优先级 | 是否适合 AI unattended run |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DATA-M1 | Data Safety | SQLite backup / JSON export / restore dry-run 稳定化 | 出问题前能备份，出问题后能演练恢复 | 本地 backup/export/restore dry-run 已完成 | server scripts；deploy docs；planning | 不覆盖生产 DB；不备份 secrets；不云同步 | backup/export 生成；dry-run 读回；生产 DB 未改 | 备份、导出、恢复演练三件事可重复 | day-only | P0 | 部分：本地增强可夜跑 |
| DATA-M2 | Data Safety | integrity check 与 partial closeout recovery | 避免 closeout 半成功导致知识库不可信 | HTTP + SQLite 主链路；closeout 主路径 | server scripts；desktop verify；planning | 不破坏性 migration；不自动删数据 | 临时 DB fixture；失败注入；读回验证 | 不一致可发现、可报告、可修复引导 | night-safe | P0 | 是 |
| DATA-M3 | Data Safety | restore policy 与 repair workflow | 真遇到数据损坏时知道该怎么恢复 | DATA-M1/DATA-M2 | docs；repair task schema；planning | 不自动覆盖生产；不隐藏损坏 | dry-run；repair plan 生成；人工确认门 | 恢复从演练走向可审阅操作手册 | decision-needed | P1 | 否 |

### 小任务
| ID | 所属主线 | 目标 | 用户价值 | 前置依赖 | 允许修改 | 明确不做 | 验证方式 | 完成定义 | 执行类型 | 建议优先级 | 是否适合 AI unattended run |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DATA-01-SQLITE-BACKUP-SERVER-PATH-VERIFY | Data Safety | SQLite backup 在服务器 shared/data 路径下复验 | 确认真实数据文件可安全备份 | DEP-01；本地 `backup:export` 已完成 | planning；backup docs | 不复制半写入 DB；不备份 env secrets | 执行 backup；列出文件；health 不回归 | 服务器 DB 备份文件可读且源 DB 正常 | day-only | P0 | 否 |
| DATA-02-JSON-EXPORT-HARDEN | Data Safety | JSON export 输出字段、路径与脱敏边界固化 | 方便迁移、审计和人工查看 | 本地 JSON export 已完成 | server scripts；verify；docs | 不导出 secrets；不做云同步 | fixture export；schema/计数校验；redaction 检查 | JSON export 可被审阅且不泄露敏感路径 | night-safe | P0 | 是 |
| DATA-03-RESTORE-DRY-RUN-SERVER-PATH-VERIFY | Data Safety | restore dry-run 用服务器备份复验 | 证明备份不是摆设 | DATA-01；本地 dry-run 已完成 | planning；restore docs | 不覆盖生产 DB；不删除备份 | 恢复到临时 DB；读回实体；生产 DB 未改 | 服务器备份能被 dry-run 读回 | day-only | P0 | 否 |
| DATA-04-INTEGRITY-CHECK | Data Safety | 增加 SQLite 数据完整性检查 | 尽早发现孤儿记录、缺失 archive/error-entry | HTTP + SQLite schema 已稳定 | server scripts；verify；planning | 不修复真实数据；不做 destructive migration | 临时 DB 注入不一致；脚本返回可读报告 | 一条命令发现 schema/关系/必填字段异常 | night-safe | P0 | 是 |
| DATA-05-PARTIAL-CLOSEOUT-RECOVERY | Data Safety | partial closeout recovery | closeout 半成功时不误报已归档 | closeout 主链路；DATA-04 更佳 | desktop/server closeout verify；planning | 不自动删除用户数据；不改业务语义 | archive 写失败、error-entry 写失败、issue 状态失败注入 | 失败可见，读回不一致可恢复或阻断 | night-safe | P0 | 是 |
| DATA-06-BACKUP-RETENTION-POLICY | Data Safety | 备份保留与清理策略 | 防止备份无限增长或误删 | DATA-01/DATA-02 | docs；scripts dry-run | 不删除用户数据；不默认清空历史备份 | dry-run 列出将清理文件；路径限制检查 | 用户能看懂保留策略，清理需确认 | decision-needed | P1 | 否 |
| DATA-07-RESTORE-APPLY-RUNBOOK | Data Safety | 从 dry-run 到真实恢复的人工 runbook | 真故障时可按步骤恢复 | DATA-03；用户确认停机/覆盖策略 | docs；planning | 不自动覆盖生产；不无人值守执行 | runbook 审阅；演练命令不指向生产 | 恢复流程有人工确认门和回滚说明 | decision-needed | P1 | 否 |
| DATA-08-REPAIR-TASK-GENERATION | Data Safety | 读回失败时生成 repair task | 不把损坏状态静默吞掉 | DATA-04/DATA-05 | verification helpers；planning | 不自动修复真实数据；不假装完成 | 构造失败读回；输出 repair task | completion gate 能阻止错误归档 | completed | P1 | 已完成 |

## 3. Core Debug Workflow

目标：现场记录和结案更快、更顺。

### 大任务
| ID | 所属主线 | 目标 | 用户价值 | 前置依赖 | 允许修改 | 明确不做 | 验证方式 | 完成定义 | 执行类型 | 建议优先级 | 是否适合 AI unattended run |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CORE-M1 | Core Debug Workflow | quick issue create 与 workspace UX | 现场更少打断就能记录问题 | HTTP + SQLite workspace 已完成 | desktop UI；repository adapter；verify | 不做大 UI 重构；不引入 Electron | UI smoke；workspace/issue 创建读回 | 30 秒内可创建问题并进入详情 | night-safe | P1 | 是 |
| CORE-M2 | Core Debug Workflow | record timeline polish 与 closeout UX polish | 排查过程更顺，结案更少漏字段 | issue/record/closeout 主路径 | desktop UI；verify；planning | 不改 schema 语义；不接真实 AI | record append、排序、closeout smoke | 时间线清楚，结案必填提示明确 | night-safe | P1 | 是 |
| CORE-M3 | Core Debug Workflow | archive filters 与 error entry tags | 已结案内容更容易浏览和复用 | archive/error-entry 主路径 | desktop UI；server filter API；verify | 不做复杂统计；不做全文搜索替代 | filter/tag fixture；UI smoke | 用户可按状态、标签、类别浏览归档 | night-safe | P1 | 是 |

### 小任务
| ID | 所属主线 | 目标 | 用户价值 | 前置依赖 | 允许修改 | 明确不做 | 验证方式 | 完成定义 | 执行类型 | 建议优先级 | 是否适合 AI unattended run |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CORE-01-QUICK-ISSUE-CREATE | Core Debug Workflow | quick issue create | 调试现场一句话快速建卡 | workspace 创建可用 | `apps/desktop/src` UI；verify | 不接 AI；不改 storage 主链路 | 创建 issue smoke；schema 校验；读回 | 最少字段创建 open issue 并选中 | completed | P1 | 已完成 |
| CORE-02-WORKSPACE-UX-IMPROVEMENTS | Core Debug Workflow | workspace UX improvements | 用户知道当前数据属于哪个项目 | workspace list/create/switch 已完成 | desktop UI；copy；verify | 不做权限/多租户；不改 DB schema | 切换 workspace；空状态；读回 | 当前 workspace、创建入口、错误态清楚 | night-safe | P1 | 是 |
| CORE-03-RECENT-ISSUE-REOPEN | Core Debug Workflow | 最近问题快速回到现场 | 重启页面后不迷路 | issue list 可读 | desktop UI；storage state | 不做通知系统；不做协作 | reload 后最近 issue 可打开 | 用户可快速回到最近活跃问题 | night-safe | P2 | 是 |
| CORE-04-RECORD-TIMELINE-POLISH | Core Debug Workflow | record timeline polish | 排查过程像时间线而不是散文 | record append 已完成 | desktop UI；styles；verify | 不改 record schema；不做附件 | 多类型 record 展示；排序；空状态 | 现象/猜测/动作/结果/结论一眼可分 | completed | P1 | 已完成 |
| CORE-05-CLOSEOUT-UX-POLISH | Core Debug Workflow | closeout UX polish | 降低结案漏填、误填 | closeout 主路径和 draft panel | desktop UI；validation copy；verify | 不自动结案；不接真实 AI | 必填字段提示；错误态；成功读回 | 用户能清楚完成根因/解决/预防 | completed | P1 | 已完成 |
| CORE-06-CLOSEOUT-PARTIAL-SAVE-HINTS | Core Debug Workflow | 结案草稿与失败提示 | closeout 失败时不丢输入 | CORE-05；DATA-05 更佳 | desktop state；verify | 不把草稿当事实；不自动写 archive | 失败注入；保留表单输入 | closeout 失败后用户可继续编辑 | night-safe | P2 | 是 |
| CORE-07-ARCHIVE-FILTERS | Core Debug Workflow | archive filters | 已归档问题可按项目/时间/类别找 | archive list 已可读 | desktop UI；server query 可选 | 不做全文搜索；不做统计大屏 | filter fixture；URL/state smoke | archive 列表可筛选且结果稳定 | night-safe | P1 | 是 |
| CORE-08-ERROR-ENTRY-TAGS | Core Debug Workflow | error entry tags | 错误表能按模块沉淀知识 | ErrorEntry 可读写 | schema/UI 最小扩展；verify | 不做复杂 taxonomy；不自动打标签 | tag 创建/编辑/筛选；读回 | ErrorEntry 有可维护标签 | night-safe | P1 | 是 |
| CORE-09-DEMO-SEED-IMPORT | Core Debug Workflow | 演示数据导入 | 展示时可快速讲完整闭环 | JSON export/import 约束 | scripts；docs；demo fixture | 不污染生产 DB；不伪造已完成能力 | 导入临时 DB；读回；可清理 | demo 数据可重复导入到临时环境 | night-safe | P2 | 是 |

## 4. Search / Knowledge Base

目标：历史问题能找回、能复用。

### 大任务
| ID | 所属主线 | 目标 | 用户价值 | 前置依赖 | 允许修改 | 明确不做 | 验证方式 | 完成定义 | 执行类型 | 建议优先级 | 是否适合 AI unattended run |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SEARCH-M1 | Search / Knowledge Base | basic full-text search 与 filters | 旧问题能被找回 | archive/error-entry 已有 SQLite 数据 | server query；desktop search UI；verify | 不做 embedding/RAG；不接外部搜索 | fixture 搜索；字段过滤；空状态 | 标题、现象、根因、解决方案可搜并可筛选 | completed | P1 | 已完成 |
| SEARCH-M2 | Search / Knowledge Base | tags 与 error code taxonomy | 团队知识按模块沉淀 | CORE-08 或 tag schema | schema/UI/docs；verify | 不一次性复杂分类体系；不自动改旧数据 | tag/taxonomy fixture；迁移兼容 | 可按串口/CAN/电机等分类复用 | decision-needed | P1 | 否 |
| SEARCH-M3 | Search / Knowledge Base | similar issues lite 与 archive review page | 新问题出现时能看到旧经验 | SEARCH-M1/M2 | lightweight ranking；archive review UI | 不做 embedding；不做跨仓推理 | 相似标题/tag/rootCause fixture | 系统能给出可解释相似问题列表 | night-safe | P2 | 是 |

### 小任务
| ID | 所属主线 | 目标 | 用户价值 | 前置依赖 | 允许修改 | 明确不做 | 验证方式 | 完成定义 | 执行类型 | 建议优先级 | 是否适合 AI unattended run |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SEARCH-01-BASIC-FULL-TEXT-SEARCH | Search / Knowledge Base | basic full-text search | 输入关键词找回历史问题 | SQLite 数据稳定；archive/error-entry 有文本字段 | server search endpoint；desktop UI；verify | 不做语义检索；不建 embedding | 多字段 fixture；关键词命中；无结果 | 能搜 title/symptom/rootCause/resolution/archive | completed | P1 | 已完成 |
| SEARCH-02-FILTERS | Search / Knowledge Base | filters | 缩小搜索结果 | SEARCH-01 或 archive filters | server query/UI | 不做复杂查询语言 | 项目/状态/时间/标签筛选 fixture | 搜索和筛选可组合 | completed | P1 | 已完成 |
| SEARCH-03-ARCHIVE-REVIEW-PAGE | Search / Knowledge Base | archive review page | 归档文档可集中浏览复盘 | archive list/read 已可用 | desktop page；server read API 可选 | 不编辑源文件；不接 AI 总结 | 页面展示 markdown；链接 issue/error-entry | 用户可浏览归档并跳回源问题 | completed | P1 | 已完成 |
| SEARCH-04-TAGS | Search / Knowledge Base | tags | 按模块/设备/现象组织问题 | CORE-08 或最小 tag 字段 | schema/UI/filter | 不自动生成复杂标签 | tag CRUD；筛选；读回 | issue/error-entry 支持稳定标签 | completed | P1 | 已完成 |
| SEARCH-05-ERROR-CODE-TAXONOMY | Search / Knowledge Base | error code taxonomy | 错误编号有团队共识 | 用户确认编号规则 | docs/schema/UI | 不擅自改历史编号；不引入组织权限 | taxonomy examples；创建新 ErrorEntry | `DBG-YYYYMMDD-XXX` 或新规则被固化 | decision-needed | P1 | 否 |
| SEARCH-06-TAG-HYGIENE-MERGE | Search / Knowledge Base | tag hygiene / merge | 避免 `can`、`CAN`、`canbus` 分裂 | SEARCH-04；用户确认合并策略 | docs/UI/script dry-run | 不自动合并生产数据 | dry-run 显示影响范围 | 标签合并需人工确认且可回滚 | decision-needed | P2 | 否 |
| SEARCH-07-SIMILAR-ISSUES-LITE | Search / Knowledge Base | similar issues lite | 新问题能看到相似旧坑 | SEARCH-01/04 | local ranking；UI；verify | 不做 RAG/embedding；不宣称智能判因 | tag/title/rootCause overlap fixture | 返回相似问题、依据和链接 | completed | P2 | 已完成 |
| SEARCH-08-SEARCH-RESULT-LINKING | Search / Knowledge Base | search result issue linking | 搜索结果可直接复用到当前问题 | SEARCH-01/03 | desktop UI；record/issue linking | 不自动改 rootCause；不自动结案 | 添加 relatedHistoricalIssueIds；读回 | 用户能把旧问题关联到新问题 | completed | P2 | 已完成 |
| SEARCH-09-RECURRENCE-PROMPT | Search / Knowledge Base | 复发提示 | 旧问题复发时减少重复踩坑 | SEARCH-07/08 | UI panel；verify | 不替代人工判断；不自动 closeout | 相似问题出现提示；用户可忽略 | 输入相似现象时展示旧解决摘要 | completed | P2 | 已完成 |

## 5. AI-ready Workflow

目标：先把 AI 草稿流和 prompt schema 做稳，不依赖真实 API。

### 大任务
| ID | 所属主线 | 目标 | 用户价值 | 前置依赖 | 允许修改 | 明确不做 | 验证方式 | 完成定义 | 执行类型 | 建议优先级 | 是否适合 AI unattended run |
|---|---|---|---|---|---|---|---|---|---|---|---|
| AIREADY-M1 | AI-ready Workflow | prompt template system 稳定化 | 后续接 AI 不返工 | 现有 prompt templates 已完成 | prompt module；schema；fixtures | 不调用真实 AI；不保存 key | deterministic fixtures；schema invalid tests | prompt 输入输出边界版本化 | night-safe | P1 | 是 |
| AIREADY-M2 | AI-ready Workflow | draft panel / history / diff / apply safety | 用户能审阅草稿而不是盲信 | closeout draft panel 已完成 | desktop UI；local draft store；verify | 不自动写库；不把 AI 当事实 | draft create/history/diff/apply smoke | 草稿可追踪、可比较、可手动应用 | night-safe | P1 | 是 |
| AIREADY-M3 | AI-ready Workflow | mock provider 与无 key 体验 | 接真实 AI 前先稳定错误态 | AIREADY-M1/M2 | mock provider；server/desktop adapter stub；verify | 不接真实 API；不引入 provider SDK | mock success/error/timeout fixture | 无 key 也能演示草稿流和错误态 | night-safe | P1 | 是 |

### 小任务
| ID | 所属主线 | 目标 | 用户价值 | 前置依赖 | 允许修改 | 明确不做 | 验证方式 | 完成定义 | 执行类型 | 建议优先级 | 是否适合 AI unattended run |
|---|---|---|---|---|---|---|---|---|---|---|---|
| AIREADY-01-PROMPT-TEMPLATE-SYSTEM | AI-ready Workflow | prompt template system | AI 输入输出有约束 | 已完成初版 | prompt templates；verify | 不调用模型；不保存 key | `verify:ai-ready-prompt-template-system` | polish/summarize/prevention 模板稳定 | night-safe | P1 | 是 |
| AIREADY-02-PROMPT-SCHEMA-VERSIONING | AI-ready Workflow | prompt schema versioning | 未来 prompt 变更可追踪 | AIREADY-01 | prompt schema；docs；fixtures | 不做 provider adapter | 旧 fixture 兼容；schema version 输出 | 每个 prompt 有 version 与迁移说明 | night-safe | P1 | 是 |
| AIREADY-03-GOLDEN-DRAFT-FIXTURES | AI-ready Workflow | golden draft fixtures | 防止草稿质量回退 | AIREADY-01 | fixtures；verify scripts | 不调用真实 AI | deterministic output diff | 草稿结构和关键字段有回归测试 | night-safe | P1 | 是 |
| AIREADY-04-DRAFT-PANEL | AI-ready Workflow | draft panel | 用户在 closeout 旁看到草稿 | 已完成初版 | desktop panel；verify | 不自动写库；不接 API | `verify:ai-ready-closeout-draft-panel` | 草稿可应用到表单但仍需用户提交 | night-safe | P1 | 是 |
| AIREADY-05-DRAFT-HISTORY | AI-ready Workflow | draft history | 用户知道草稿从何而来 | AIREADY-04 | draft store；UI；verify | 不长期保存 secrets；不上传 | 多次生成历史；清理；读回 | 草稿历史可审阅和清除 | night-safe | P1 | 是 |
| AIREADY-06-DRAFT-DIFF | AI-ready Workflow | draft diff | 用户能比较草稿和原文 | AIREADY-04 | UI diff component；verify | 不做复杂协同编辑 | diff fixture；apply smoke | 展示新增/删除/替换差异 | night-safe | P1 | 是 |
| AIREADY-07-APPLY-SAFETY | AI-ready Workflow | apply safety | 防止草稿覆盖人工输入 | AIREADY-06 | UI confirmation；verify | 不自动提交 closeout | 有冲突时确认；撤销/保留人工输入 | 应用草稿不会静默覆盖用户文本 | night-safe | P1 | 是 |
| AIREADY-08-MOCK-PROVIDER | AI-ready Workflow | mock provider | 在无 API key 下验证完整草稿链路 | AIREADY-01/04 | server/desktop mock adapter；verify | 不接真实网络；不保存 key | mock success/error/timeout | provider 接口形状稳定但不外呼 | night-safe | P1 | 是 |
| AIREADY-09-NO-API-KEY-UX | AI-ready Workflow | 无 key UX | 用户知道真实 AI 未配置 | AIREADY-08 | UI error state；docs | 不把未配置说成 AI 已接入 | no-key 状态 smoke | 无 key 不阻断主流程，提示清楚 | night-safe | P1 | 是 |
| AIREADY-10-PROMPT-PREVIEW-EXPORT | AI-ready Workflow | prompt preview/export | 方便调试 prompt 和人工审查 | AIREADY-02 | UI/dev tool；docs | 不发送外部请求 | preview 内容脱敏；复制文本 | 用户能看到将发送给 AI 的内容 | night-safe | P2 | 是 |

## 6. Real AI Assistance

目标：真实 AI 帮助优化措辞、总结排查、建议预防。

### 大任务
| ID | 所属主线 | 目标 | 用户价值 | 前置依赖 | 允许修改 | 明确不做 | 验证方式 | 完成定义 | 执行类型 | 建议优先级 | 是否适合 AI unattended run |
|---|---|---|---|---|---|---|---|---|---|---|---|
| REALAI-M1 | Real AI Assistance | provider abstraction 与 server env API key boundary | 安全接入真实 AI | AIREADY-M3；用户确认 provider/key | server env；provider adapter；docs；verify | browser 不持 key；不直接写库；不做 RAG | mock/no-key/timeout/error；真实 key 人工 smoke | AI key 只在 server，失败可降级 | completed | P1 | 否 |
| REALAI-M2 | Real AI Assistance | polish closeout / summarize records / suggest prevention | 减少结案总结负担 | REALAI-M1 | server draft endpoints；desktop draft UI；verify | 不替代人工验证；不自动入库 | mock + real opt-in；用户 review | AI 产出草稿，用户确认后应用 | partial | P1 | 否 |
| REALAI-M3 | Real AI Assistance | timeout/error state 与 user review before apply | AI 不稳定时主流程仍可靠 | REALAI-M1/M2 | UI state；audit metadata；verify | 不把草稿当事实；不隐藏 provider 错误 | timeout/error/no-key/apply review | 所有 AI 输出都有来源、状态和确认门 | blocked | P1 | 否 |

### 小任务
| ID | 所属主线 | 目标 | 用户价值 | 前置依赖 | 允许修改 | 明确不做 | 验证方式 | 完成定义 | 执行类型 | 建议优先级 | 是否适合 AI unattended run |
|---|---|---|---|---|---|---|---|---|---|---|---|
| REALAI-01-PROVIDER-ABSTRACTION | Real AI Assistance | provider abstraction | 后续可换 provider 不重写 UI | AIREADY-08；用户确认 provider 范围 | server provider port；mock implementation | 不做多 provider 复杂配置；不外呼无授权 API | mock provider contract；error fixture | server 有统一 draft provider interface | completed | P1 | 否 |
| REALAI-02-SERVER-ENV-API-KEY-BOUNDARY | Real AI Assistance | server env API key boundary | 避免 API key 泄露到浏览器 | 用户确认 key 放置方式 | server env docs；config validation | 不写入 localStorage；不提交 key | no-key health；redaction；docs check | key 只来自 server env 且日志脱敏 | completed | P1 | 否 |
| REALAI-03-TIMEOUT-ERROR-STATE | Real AI Assistance | timeout/error state | AI 挂了也不影响结案 | REALAI-01/02 | server timeout；UI status；verify | 不无限等待；不 silent fallback | timeout fixture；provider error fixture | 用户看到失败原因并可继续手写 | completed | P1 | 否 |
| REALAI-04-POLISH-CLOSEOUT | Real AI Assistance | polish closeout | 根因/解决描述更清楚 | REALAI-01-03；AIREADY-04 | draft endpoint；draft panel | 不自动提交；不改原始记录 | mock/real draft；apply review | closeout polish 草稿可审阅应用 | completed | P1 | 否 |
| REALAI-05-SUMMARIZE-RECORDS | Real AI Assistance | summarize records | 长时间线快速收束 | REALAI-04 | summarize endpoint；UI section | 不删除原记录；不替代事实 | 多 record fixture；空 record 状态 | 生成排查摘要草稿并可追溯来源 | blocked | P1 | 否 |
| REALAI-06-SUGGEST-PREVENTION | Real AI Assistance | suggest prevention | 减少同类问题复发 | REALAI-04/05 | prevention prompt；draft UI | 不自动写 `ErrorEntry.prevention` | 有/无 records；provider failure | 预防建议草稿需用户确认 | blocked | P1 | 否 |
| REALAI-07-USER-REVIEW-BEFORE-APPLY | Real AI Assistance | user review before apply | 保留人工责任边界 | REALAI-04-06 | UI confirmation；audit metadata | 不自动写库；不批量覆盖 | review gate fixture | 所有 AI 草稿入表单前都有确认 | blocked | P1 | 否 |
| REALAI-08-AI-DRAFT-AUDIT-METADATA | Real AI Assistance | draft audit metadata | 后续能追溯草稿来源 | REALAI-07 | draft metadata schema；UI | 不存 prompt secrets；不过度记录 key | draft provider/model/template version 可读 | 每条草稿有来源和时间 | blocked | P2 | 否 |
| REALAI-09-REAL-PROVIDER-OPT-IN-SMOKE | Real AI Assistance | real provider opt-in smoke | 用真实 key 验证最小闭环 | 用户提供 API key / provider /额度 | server env；manual smoke docs | 不提交 key；不夜跑；不压测 | 人工运行一次 polish/summarize/prevention | 真实 AI 可返回草稿且失败可诊断 | blocked | P1 | 否 |

## 7. Code Context Analysis

目标：AI 能基于用户显式提供的代码上下文分析问题。

### 大任务
| ID | 所属主线 | 目标 | 用户价值 | 前置依赖 | 允许修改 | 明确不做 | 验证方式 | 完成定义 | 执行类型 | 建议优先级 | 是否适合 AI unattended run |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CODECTX-M1 | Code Context Analysis | code context bundle CLI 与 secrets protection | 用户显式提供可审阅代码上下文 | Git CLI 可用；bundle schema 设计 | dev tool/scripts；schema；docs；verify | server 不扫仓；不读 secrets；不自动上传 | allowlist；denylist；大文件跳过；bundle fixture | 生成 markdown/json bundle 且默认安全 | night-safe | P1 | 是 |
| CODECTX-M2 | Code Context Analysis | attach bundle to issue 与 bundle viewer | 代码上下文能挂到问题闭环里 | CODECTX-M1 | schema/API/UI；viewer；verify | 不自动执行命令；不解析 secrets | attach/read/view；大 bundle 错误态 | issue 详情可查看显式 bundle 摘要 | night-safe | P1 | 是 |
| CODECTX-M3 | Code Context Analysis | AI analyze explicit bundle 与 repo connector later | AI 分析基于明确材料而不是乱猜 | CODECTX-M2；REALAI-M1 | AI prompt；draft UI；later connector design | 不默认扫全仓；不做 RAG；不自动写记录 | mock/real opt-in；allowlist audit | AI 输出假设和下一步，用户确认后使用 | blocked | P2 | 否 |

### 小任务
| ID | 所属主线 | 目标 | 用户价值 | 前置依赖 | 允许修改 | 明确不做 | 验证方式 | 完成定义 | 执行类型 | 建议优先级 | 是否适合 AI unattended run |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CODECTX-01-BUNDLE-CLI | Code Context Analysis | code context bundle CLI | 用户可生成可审阅上下文包 | Node/Git 可用；bundle schema 初稿 | scripts；schema；docs；verify | 不上传外网；不自动跑破坏命令 | git status/log/diff stat；allowlist files；output json/md | CLI 生成包含 repo/branch/diff/files/logs 的 bundle | night-safe | P1 | 是 |
| CODECTX-02-SECRETS-PROTECTION | Code Context Analysis | secrets protection | 防止 `.env`、token、私钥泄露 | CODECTX-01 | denylist/allowlist；verify | 不读取 `.env`/`.git`/`node_modules`；不绕过 allowlist | fixture 包含敏感文件；确认跳过 | 默认排除敏感路径并报告跳过原因 | night-safe | P1 | 是 |
| CODECTX-03-BUNDLE-SCHEMA-FIXTURES | Code Context Analysis | bundle schema fixtures | bundle 可被 ProbeFlash 稳定解析 | CODECTX-01 | schema；fixtures；verify | 不接 UI；不接 AI | valid/invalid bundle parse | schema 错误能给出可读错误 | night-safe | P1 | 是 |
| CODECTX-04-ATTACH-BUNDLE-TO-ISSUE | Code Context Analysis | attach bundle to issue | 问题卡保留相关代码上下文 | CODECTX-03 | server API/storage；desktop UI | 不让 server 扫路径；不自动执行命令 | attach/read/list；oversize error | bundle 可挂到 issue 并读回 | night-safe | P1 | 是 |
| CODECTX-05-BUNDLE-VIEWER | Code Context Analysis | bundle viewer | 用户能看懂附加上下文 | CODECTX-04 | desktop viewer；styles；verify | 不编辑源代码；不执行命令 | repo/branch/diff/files 展示 smoke | viewer 可浏览摘要和选中文件片段 | night-safe | P1 | 是 |
| CODECTX-06-BUNDLE-SIZE-ERROR-HANDLING | Code Context Analysis | bundle size/error handling | 大仓库不会拖垮系统 | CODECTX-04/05 | size limit；UI error；verify | 不无限制保存大文件；不压缩 secrets | oversize fixture；invalid json | 超限有清楚错误，不破坏 issue 主路径 | night-safe | P1 | 是 |
| CODECTX-07-AI-ANALYZE-EXPLICIT-BUNDLE | Code Context Analysis | AI analyze explicit bundle | AI 基于显式代码包给排查方向 | CODECTX-05；REALAI-04 | prompt；server draft endpoint；UI | 不扫描服务器文件系统；不直接写 record | mock/real opt-in；bundle missing state | 输出 hypothesis/next steps 草稿并需确认 | blocked | P2 | 否 |
| CODECTX-08-REPO-CONNECTOR-LATER-ALLOWLIST | Code Context Analysis | repo connector later with allowlist | bundle 不够用时再评估只读连接 | CODECTX-07 使用反馈；用户拍板 | design doc；connector spike；verify | 不默认扫全仓；不读 secrets；不写操作 | allowlist fixture；audit log | connector 只读且显式授权 | decision-needed | P3 | 否 |
| CODECTX-09-CONNECTOR-AUDIT-DENYLIST | Code Context Analysis | connector audit + denylist | 知道系统读了哪些文件 | CODECTX-08 | audit log；denylist；UI/doc | 不隐藏读取行为；不后台扫描 | audit fixture；denylist test | 每次读取可审计、可关闭 | decision-needed | P3 | 否 |

## 8. Technical Debt / Architecture

目标：避免越跑越石山。

### 大任务
| ID | 所属主线 | 目标 | 用户价值 | 前置依赖 | 允许修改 | 明确不做 | 验证方式 | 完成定义 | 执行类型 | 建议优先级 | 是否适合 AI unattended run |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TECH-M1 | Technical Debt / Architecture | closeout atomicity design 与 workspaceId consistency later | 主闭环数据更可信 | closeout 主路径；HTTP/SQLite schema | closeout orchestration；verify；docs | 不做大 schema migration；不删数据 | failure injection；readback；workspace mismatch fixture | closeout 失败不产生伪完成 | night-safe | P0 | 是 |
| TECH-M2 | Technical Debt / Architecture | verify helpers 与 verify tmp cleanup | 每轮验证更快、更可靠 | 现有 verify scripts | scripts；fixtures；docs | 不依赖真实服务器；不慢速 E2E 膨胀 | helper deterministic；git status clean | 高风险路径有可复用 helper，临时文件可控 | night-safe | P1 | 是 |
| TECH-M3 | Technical Debt / Architecture | App.tsx / HTTP repository / server route / database split | 后续功能不继续堆石山 | 主流程测试稳定；任务边界明确；UI 方向已确认时优先支持 UI 修复 | `apps/desktop/src`；`apps/server/src`；verify | 不大 UI 重构；不改业务语义；不接新功能 | typecheck/build/verify:all；主路径 smoke | 文件职责更清楚且行为不回归 | night-safe | P2 | 是；TECH-07 已过人工 UI gate |

### 小任务
| ID | 所属主线 | 目标 | 用户价值 | 前置依赖 | 允许修改 | 明确不做 | 验证方式 | 完成定义 | 执行类型 | 建议优先级 | 是否适合 AI unattended run |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TECH-01-CLOSEOUT-ATOMICITY-DESIGN | Technical Debt / Architecture | closeout atomicity design | 避免 archive/error-entry/issue 状态不一致 | closeout 主路径已完成 | design note；verify fixtures；minimal code if needed | 不做大重构；不改 schema 语义 | 成功/失败路径设计审阅；fixture | 原子性边界和失败策略明确 | night-safe | P0 | 是 |
| TECH-02-CLOSEOUT-ATOMICITY-RECOVERY | Technical Debt / Architecture | closeout atomicity recovery | 半成功状态可见可恢复 | TECH-01；DATA-05 | closeout orchestration；server storage；verify | 不自动删数据；不伪造 archived | 写入失败注入；读回验证失败 | closeout 失败不标 archived，用户能重试 | night-safe | P0 | 是 |
| TECH-03-WORKSPACEID-CONSISTENCY-LATER | Technical Debt / Architecture | workspaceId consistency later | 多 workspace 下数据不串 | workspace 创建/切换稳定 | schema/server validation；verify | 不迁移真实数据；不改权限模型 | cross-workspace mismatch fixture | issue/record/archive/error-entry workspaceId 一致 | night-safe | P2 | 是 |
| TECH-04-VERIFY-HELPERS | Technical Debt / Architecture | verify helpers | 降低人工读文档成本 | 现有 verify 脚本 | scripts；fixtures；package scripts if needed | 不触碰真实服务器；不外呼 | helper pass/fail fixture；`git diff --check` | deploy/handoff/storage/closeout 有 helper 覆盖 | night-safe | P1 | 是 |
| PROJECT-STATUS-LEDGER-MINIMAL | Technical Debt / Architecture | lightweight project status ledger | 用户不用翻全部 planning 文件也能快速知道推进到哪 | current/backlog/product-roadmap/handoff 已存在 | `docs/planning/status.md`；AGENTS；planning / execution / verification skills；planning sync | 不做 console/dashboard；不改产品 UI；不替代事实源；不追加流水账 | `git diff --check`；JSON parse；`verify:handoff`；skill frontmatter 检查 | `status.md` 存在、短、可读且 current/backlog/product-roadmap/handoff 仍是事实源 | completed | P1 | 已完成 |
| TECH-05-VERIFY-TMP-CLEANUP | Technical Debt / Architecture | verify tmp cleanup | 测试残留不污染判断 | TECH-04 | scripts；tmp path docs | 不删除用户数据；不指向生产路径 | verify 前后 git status；tmp dir 限制 | 临时 DB/log/backup 生命周期清楚 | night-safe | P1 | 是 |
| TECH-06-SMOKE-FIXTURE-CONSOLIDATION | Technical Debt / Architecture | smoke fixture consolidation | 避免重复造测试数据 | 多条 verify 已存在 | fixtures；verify helpers | 不引入大测试框架 | fixture reuse；verify pass | 主流程 fixture 一处维护 | night-safe | P2 | 是 |
| UI-GATE-01-MANUAL-VISUAL-DIRECTION | Technical Debt / Architecture | TECH-07 前人工确认 UI 方向 | 避免在错误视觉方向上拆分或实现 | UI-01；用户可人工 review | `docs/planning/ui-redesign-brief.md`；planning sync；人工确认记录 | 不改产品代码；不引入组件库；不隐藏真实边界 | 人工确认；`git diff --check`；handoff JSON parse | 首屏布局、主次关系和边界表达被确认 | completed | P1 | 已完成 |
| TECH-07-APP-TSX-MINIMAL-SPLIT | Technical Debt / Architecture | App.tsx minimal split | 降低前端变更冲突 | UI-GATE-01；主流程 smoke 稳定 | desktop components/hooks split | 不重做视觉；不改业务语义 | typecheck/build/verify:all；UI smoke | `App.tsx` 支撑壳已抽出且行为不回归 | completed | P1 | 已完成 |
| UI-GATE-02-MANUAL-UI-POLISH-AFTER-SPLIT | Technical Debt / Architecture | TECH-07 后人工 review 拆分结果 | 防止直接进入错误方向的 UI implementation | TECH-07；用户可人工验收 | planning sync；人工确认记录 | 不直接做 UI 实现；不改业务数据流；不接真实 AI | 人工确认；handoff JSON parse | 用户已认可 TECH-07 拆分结果，并要求先做模块化拆分再 UI 重排 | completed | P1 | 已完成 |
| UI-MOD-01-PRE-RELAYOUT-COMPONENT-SPLIT | Technical Debt / Architecture | UI 重排前组件模块化拆分 | 降低三栏布局、QuickIssue landing 和 Knowledge Assist 合并的回归风险 | TECH-07；UI-GATE-02 用户认可 | `apps/desktop/src` UI components；imports；必要 helper 移动；planning sync | 不改变渲染顺序；不做三栏布局；不改文案/交互；不改 schema/repository/API/server | typecheck；build；verify:handoff；verify:all；git diff --check | `App.tsx` 变成更薄编排层，抽出组件行为保持 | night-safe | P1 | 是 |
| UI-GATE-03-MANUAL-RUN-CHECK-BEFORE-RELAYOUT | Technical Debt / Architecture | 模块化后 UI 重排前人工运行检查 | 确认行为保持拆分没有破坏现有可用性 | UI-MOD-01 | 人工 smoke 记录；planning sync | 不自动进入 UI 重排；不做视觉实现 | 用户启动 / 浏览主流程；handoff JSON parse | 用户确认能正常跑后，才允许选择 UI 重排实现任务 | day-only | P1 | 否 |
| TECH-08-HTTP-REPOSITORY-SPLIT | Technical Debt / Architecture | HTTP repository split | storage adapter 更易维护 | HTTP adapter 主链路稳定 | desktop storage/repository files | 不改 API contract；不移除 localStorage verify path | adapter contract verify；主路径 smoke | HTTP repository 和 UI 编排边界清楚 | night-safe | P2 | 是 |
| TECH-09-SERVER-ROUTE-SPLIT | Technical Debt / Architecture | server route split | server endpoint 更好维护 | server tests/verify 稳定 | `apps/server/src` routes | 不改 API 行为；不引入框架 | server verify；health/version/CRUD smoke | routes 从单文件拆出且契约不变 | night-safe | P2 | 是 |
| TECH-10-DATABASE-MODULE-SPLIT | Technical Debt / Architecture | database module split | SQLite schema/queries/validation 更清楚 | server schema contract 已完成 | database modules；verify | 不做 destructive migration；不改 schema 语义 | schema contract verify；backup/restore verify | schema、mapping、queries 分层且读写不回归 | night-safe | P2 | 是 |

## 9. 执行节奏

### 近期 1 周（最多 8 个任务）
目标：部署可用、数据安全、可观测。

| 顺序 | 任务 ID | 目标 | 类型 | P |
|---|---|---|---|---|
| 1 | DEP-01-RELEASE-USER-DIR-DEPLOY-VERIFY | 完成真实服务器 release 用户目录部署验证 | blocked | P0 |
| 2 | DEP-02-STATIC-DIST-SERVER-PATH-VERIFY | 验证 4100 同端口 Web UI + `/api` | day-only | P0 |
| 3 | DEP-03-VERSION-ENDPOINT-SERVER-VERIFY | 服务器 release 版本可确认 | day-only | P0 |
| 4 | DEP-04-HEALTH-STATUS-SERVER-VERIFY | 服务器健康状态可诊断 | day-only | P0 |
| 5 | DATA-01-SQLITE-BACKUP-SERVER-PATH-VERIFY | 服务器 SQLite backup 复验 | day-only | P0 |
| 6 | DATA-03-RESTORE-DRY-RUN-SERVER-PATH-VERIFY | 服务器备份 restore dry-run 复验 | day-only | P0 |
| 7 | DEP-07-RELEASE-UPDATE-ROLLBACK-PLAN | 更新 / 回滚 runbook | completed | P0 |
| 8 | DATA-04-INTEGRITY-CHECK | SQLite integrity check | completed | P0 |

### 近期 2-4 周（B 组已展开）
目标：搜索、AI-ready、code context bundle。

| 顺序 | 任务 ID | 目标 | 类型 | P |
|---|---|---|---|---|
| 1 | CORE-01-QUICK-ISSUE-CREATE | 更快创建问题 | completed | P1 |
| 2 | CORE-04-RECORD-TIMELINE-POLISH | 时间线更清楚 | completed | P1 |
| 3 | CORE-05-CLOSEOUT-UX-POLISH | 结案体验更稳 | completed | P1 |
| 4 | SEARCH-01-BASIC-FULL-TEXT-SEARCH | 基础全文搜索 | completed | P1 |
| 5 | SEARCH-02-FILTERS | 搜索筛选 | completed | P1 |
| 6 | SEARCH-04-TAGS | 标签能力 | completed | P1 |
| 7 | SEARCH-05-ERROR-CODE-TAXONOMY | 错误编号分类规则 | decision-needed | P1 |
| 8 | SEARCH-07-SIMILAR-ISSUES-LITE | 轻量相似问题 | completed | P2 |
| 9 | AIREADY-05-DRAFT-HISTORY | 草稿历史 | completed | P1 |
| 10 | AIREADY-06-DRAFT-DIFF | 草稿 diff | night-safe | P1 |
| 11 | CODECTX-01-BUNDLE-CLI | code context bundle CLI | night-safe | P1 |
| 12 | CODECTX-02-SECRETS-PROTECTION | bundle secrets protection | night-safe | P1 |

### 中期 1-2 月（含 UI gate 顺序）
目标：真实 AI、知识库、架构拆分。

| 顺序 | 任务 ID | 目标 | 类型 | P |
|---|---|---|---|---|
| 1 | REALAI-01-PROVIDER-ABSTRACTION | 真实 AI provider 抽象 | blocked | P1 |
| 2 | REALAI-02-SERVER-ENV-API-KEY-BOUNDARY | API key 只在 server env | blocked | P1 |
| 3 | REALAI-03-TIMEOUT-ERROR-STATE | AI timeout/error state | blocked | P1 |
| 4 | REALAI-04-POLISH-CLOSEOUT | AI 优化结案措辞 | blocked | P1 |
| 5 | REALAI-05-SUMMARIZE-RECORDS | AI 总结排查记录 | blocked | P1 |
| 6 | REALAI-06-SUGGEST-PREVENTION | AI 建议预防措施 | blocked | P1 |
| 7 | CODECTX-04-ATTACH-BUNDLE-TO-ISSUE | bundle 挂到 issue | night-safe | P1 |
| 8 | CODECTX-05-BUNDLE-VIEWER | bundle viewer | night-safe | P1 |
| 9 | CODECTX-07-AI-ANALYZE-EXPLICIT-BUNDLE | AI 分析显式 bundle | blocked | P2 |
| 10 | SEARCH-03-ARCHIVE-REVIEW-PAGE | archive review page | completed | P1 |
| 11 | UI-GATE-01-MANUAL-VISUAL-DIRECTION | TECH-07 前人工确认 UI 方向 | completed | P1 |
| 12 | TECH-07-APP-TSX-MINIMAL-SPLIT | App.tsx 最小拆分 | completed | P1 |
| 13 | UI-GATE-02-MANUAL-UI-POLISH-AFTER-SPLIT | TECH-07 后人工 review 拆分结果 | completed | P1 |
| 14 | UI-MOD-01-PRE-RELAYOUT-COMPONENT-SPLIT | UI 重排前组件模块化拆分 | night-safe | P1 |
| 15 | UI-GATE-03-MANUAL-RUN-CHECK-BEFORE-RELAYOUT | 模块化后 UI 重排前人工运行检查 | day-only | P1 |
| 16 | TECH-09-SERVER-ROUTE-SPLIT | server route split | night-safe | P2 |

### 长期方向（只列方向）
- 团队级多项目知识库与轻量权限。
- 串口日志、CAN 报文、ROS topic、截图/照片/波形附件接入。
- repo connector allowlist 成熟后，再评估轻量索引、RAG 或 embedding。
- 归档报告 PDF/HTML 导出和周报 / 复盘报告生成。
- 模块级高频故障模式统计与预防清单。
- 更完整的局域网部署体验：反向代理、`.local`、HTTPS、美化域名。

## 10. 夜跑任务池

### Night-safe pool
- UI-MOD-01-PRE-RELAYOUT-COMPONENT-SPLIT（current）：用户已认可 TECH-07 拆分结果；下一轮只做行为保持模块化拆分，不做 UI 重排。
- UI-01-INFORMATION-ARCHITECTURE-REVIEW
- CORE-02-WORKSPACE-UX-IMPROVEMENTS
- CORE-03-RECENT-ISSUE-REOPEN
- CORE-06-CLOSEOUT-PARTIAL-SAVE-HINTS
- CORE-07-ARCHIVE-FILTERS
- CORE-08-ERROR-ENTRY-TAGS
- CORE-09-DEMO-SEED-IMPORT
- AIREADY-02-PROMPT-SCHEMA-VERSIONING
- AIREADY-03-GOLDEN-DRAFT-FIXTURES
- AIREADY-05-DRAFT-HISTORY
- AIREADY-06-DRAFT-DIFF
- AIREADY-07-APPLY-SAFETY
- AIREADY-08-MOCK-PROVIDER
- AIREADY-09-NO-API-KEY-UX
- AIREADY-10-PROMPT-PREVIEW-EXPORT
- CODECTX-01-BUNDLE-CLI
- CODECTX-02-SECRETS-PROTECTION
- CODECTX-03-BUNDLE-SCHEMA-FIXTURES
- CODECTX-04-ATTACH-BUNDLE-TO-ISSUE
- CODECTX-05-BUNDLE-VIEWER
- CODECTX-06-BUNDLE-SIZE-ERROR-HANDLING
- TECH-01-CLOSEOUT-ATOMICITY-DESIGN
- TECH-02-CLOSEOUT-ATOMICITY-RECOVERY
- TECH-03-WORKSPACEID-CONSISTENCY-LATER
- TECH-04-VERIFY-HELPERS
- TECH-05-VERIFY-TMP-CLEANUP
- TECH-06-SMOKE-FIXTURE-CONSOLIDATION
- TECH-08-HTTP-REPOSITORY-SPLIT
- TECH-09-SERVER-ROUTE-SPLIT
- TECH-10-DATABASE-MODULE-SPLIT

### Gated night-safe pool
- UI-MOD-01-PRE-RELAYOUT-COMPONENT-SPLIT：当前唯一可自动认领的 UI 相关 repo-local 任务；只做行为保持模块化拆分，不做 UI 重排。
- UI-GATE-03-MANUAL-RUN-CHECK-BEFORE-RELAYOUT：`UI-MOD-01` 完成后必须停下等待用户人工检查，不能夜跑越过。

### Day-only pool
- DEP-02-STATIC-DIST-SERVER-PATH-VERIFY
- DEP-03-VERSION-ENDPOINT-SERVER-VERIFY
- DEP-04-HEALTH-STATUS-SERVER-VERIFY
- DEP-05-SYSTEMD-AUTOSTART-PREP
- DATA-01-SQLITE-BACKUP-SERVER-PATH-VERIFY
- DATA-03-RESTORE-DRY-RUN-SERVER-PATH-VERIFY
- UI-GATE-03-MANUAL-RUN-CHECK-BEFORE-RELAYOUT

### Blocked by external
- DEP-01-RELEASE-USER-DIR-DEPLOY-VERIFY
- DEP-06-SYSTEMD-AUTOSTART-VERIFY
- DEP-08-RELEASE-UPDATE-ROLLBACK-VERIFY
- REALAI-01-PROVIDER-ABSTRACTION
- REALAI-02-SERVER-ENV-API-KEY-BOUNDARY
- REALAI-03-TIMEOUT-ERROR-STATE
- REALAI-04-POLISH-CLOSEOUT
- REALAI-05-SUMMARIZE-RECORDS
- REALAI-06-SUGGEST-PREVENTION
- REALAI-07-USER-REVIEW-BEFORE-APPLY
- REALAI-08-AI-DRAFT-AUDIT-METADATA
- REALAI-09-REAL-PROVIDER-OPT-IN-SMOKE
- CODECTX-07-AI-ANALYZE-EXPLICIT-BUNDLE

### Decision-needed
- DATA-06-BACKUP-RETENTION-POLICY
- DATA-07-RESTORE-APPLY-RUNBOOK
- SEARCH-05-ERROR-CODE-TAXONOMY
- SEARCH-06-TAG-HYGIENE-MERGE
- CODECTX-08-REPO-CONNECTOR-LATER-ALLOWLIST
- CODECTX-09-CONNECTOR-AUDIT-DENYLIST
- 长期是否做权限系统、多队伍协作、RAG/embedding、硬件日志自动接入。

## 11. 下一轮建议认领

下一轮默认只认领 `UI-MOD-01-PRE-RELAYOUT-COMPONENT-SPLIT`，即使白天可用也不要自动改选服务器部署，除非用户明确推翻本轮 UI 模块化优先约束并重新授权 DEP-01。

`UI-MOD-01` 完成、验证并提交后，必须停在 `UI-GATE-03-MANUAL-RUN-CHECK-BEFORE-RELAYOUT`，等待用户人工启动 / 浏览确认能正常跑；在此之前不得进入三栏 UI 重排、QuickIssue landing、Knowledge Assist 合并或 closeout 视觉重构。
