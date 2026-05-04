# Refactor / Code Simplification Assessment

## Executive Decision

2026-04-30 交接更新：本评估中推荐的 `UI-01-INFORMATION-ARCHITECTURE-REVIEW`、后续 `UI-GATE-01-MANUAL-VISUAL-DIRECTION` 与 `TECH-07-APP-TSX-MINIMAL-SPLIT` 均已完成，且用户已认可 TECH-07 拆分结果。当前下一轮只允许自动认领 `UI-MOD-01-PRE-RELAYOUT-COMPONENT-SPLIT`，先做行为保持模块化拆分；完成后必须停在 `UI-GATE-03-MANUAL-RUN-CHECK-BEFORE-RELAYOUT`，等待用户人工检查能否正常跑，再决定是否进入 UI 重排。

当前不建议在 `DEP-01-RELEASE-USER-DIR-DEPLOY-VERIFY` 或 `UI-01-INFORMATION-ARCHITECTURE-REVIEW` 前插入强制重构任务。代码库确实存在大文件、重复搜索 / 标签归一化、verify fixture 重复和 server 数据库职责过重，但这些问题目前没有阻塞本地 HTTP + SQLite 主链路，也不是 DEP-01 服务器用户目录部署验证或 UI-01 信息架构审查的前置条件。`SEARCH-07-SIMILAR-ISSUES-LITE`、`SEARCH-08-SEARCH-RESULT-LINKING`、`SEARCH-09-RECURRENCE-PROMPT` 与 search / KB cleanup 已完成；旧的 SEARCH-07 推荐不再是当前事实源。

当前唯一 repo-local 下一任务是 `UI-MOD-01-PRE-RELAYOUT-COMPONENT-SPLIT`；如果用户白天确认服务器边界，`DEP-01-RELEASE-USER-DIR-DEPLOY-VERIFY` 仍是 P0 blocked 主线，但下一轮默认不自动改选服务器部署。B 组、人工 UI 方向确认、TECH-07 和 UI-GATE-02 acceptance 已完成；当前必须先做模块化拆分并停在 UI-GATE-03 人工运行检查，再进入真正 UI implementation。

## Confirmed Findings

- `docs/planning/architecture.md` 在当前仓库不存在；本轮没有恢复或补造该文件，当前架构事实来自 `AGENTS.md`、`current.md`、`backlog.md`、`product-roadmap.md`、`decisions.md` 和 `.agent-state/handoff.json`。
- `apps/desktop/src/App.tsx` 为 2516 LOC，承担 UI 渲染、局部状态、workspace 切换、搜索面板、archive drawer、closeout 表单和 repository 调用编排，属于最大冲突面。
- `apps/desktop/src/storage/http-storage-repository.ts` 为 891 LOC，集中 HTTP endpoint、响应 schema、错误映射和实体 repository 方法；职责重，但已经隔离在 storage adapter 边界内。
- `apps/server/src/database.mjs` 为 1118 LOC，集中 SQLite schema、payload validation、CRUD、搜索、workspace seed 和 health 相关存储逻辑；这是未来 server route / database split 的最强证据。
- closeout 多实体写入已经有独立 use-case：`apps/desktop/src/use-cases/closeout-orchestrator.ts` 278 LOC，写入顺序和 `completedWrites` 可见；这说明 closeout 当前不是 App.tsx 内的硬阻塞。
- verify 脚本总体很长：`apps/desktop/scripts` 合计 5285 LOC，`verify-s3-local-end-to-end.mts` 单文件 672 LOC；重复的 `assert`、fixture、mock server、localStorage polyfill 已影响维护成本，但不影响当前产品行为。

## Largest / Highest-Risk Files

| File | LOC | Why it matters | Recommendation |
| --- | ---: | --- | --- |
| `apps/desktop/src/App.tsx` | 2516 | 一个文件承担 UI、状态、workspace、search、archive、closeout 表单与 repository 调用编排；近期高频变更。 | Defer. 不做全量重写；只在后续 UI 功能命中时做最小组件抽取。 |
| `apps/desktop/src/storage/http-storage-repository.ts` | 891 | HTTP adapter 已成为前端切后端存储的主边界，但 endpoint schema、错误映射和列表解析集中。 | Defer. SEARCH-07 若新增 endpoint 时只补最小方法，不先重排全文件。 |
| `apps/desktop/src/storage/storage-feedback.ts` | 573 | 统一存储错误、connection state、repair task 都在这里；对 S3 失败态表达很关键。 | Defer. 行为稳定且覆盖 closeout partial failure，不为变短而拆。 |
| `apps/desktop/src/storage/storage-repository.ts` | 544 | 同时定义 repository port、localStorage fallback、local search；仍是后端切换兼容层。 | Defer. localStorage 兼容路径保留，不建议现在删减。 |
| `apps/desktop/src/storage/storage-result.ts` | 320 | 统一 StorageReadError / StorageWriteError 模型，支撑 HTTP 和 UI feedback。 | Defer. 类型集中有利于一致性。 |
| `apps/desktop/src/domain/closeout.ts` | 300 | closeout 纯函数生成 ArchiveDocument / ErrorEntry / archived IssueCard。 | Defer. 纯函数边界清楚，暂不拆。 |
| `apps/desktop/src/use-cases/closeout-orchestrator.ts` | 278 | 已从 UI 中抽出 closeout 多实体写入编排，覆盖 partial writes。 | Keep. 这是已完成的正确缝合点。 |
| `apps/desktop/src/storage/http-storage-client.ts` | 257 | 封装 API envelope、timeout、server_unreachable、HTTP error。 | Keep. 小而聚焦。 |
| `apps/desktop/src/ai/prompt-templates.ts` | 249 | AI-ready prompt schema 与模板集中。 | Defer. 不接真实 AI 前不动。 |
| `apps/desktop/src/storage/issue-card-store.ts` | 168 | localStorage compatibility path；读写与 list 模式和其它 local stores 重复。 | Do not do now. localStorage 只是 verify / 兼容路径。 |

Additional high-risk non-TS files:

| File | LOC | Why it matters | Recommendation |
| --- | ---: | --- | --- |
| `apps/server/src/database.mjs` | 1118 | SQLite schema、manual validation、CRUD、search 都在一个文件。 | Defer until after DEP-01 or next storage/server feature. |
| `apps/server/scripts/integrity-check.mjs` | 591 | 数据一致性检查逻辑集中且较长，但属于独立 CLI。 | Defer; only refactor with new data repair work. |
| `apps/server/src/server.mjs` | 473 | route matching、static serve、API response、server startup 在一个文件。 | Defer; TECH-09 可后续做，不挡 DEP-01。 |
| `apps/desktop/scripts/verify-s3-local-end-to-end.mts` | 672 | 覆盖 HTTP + SQLite + closeout + failures；长但高价值。 | Defer helper extraction; keep behavior stable. |

## S3-Relevant Friction Points

| Area | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| App shell coupling | `App.tsx` 2516 LOC；`IssuePane` 维护 selected issue、record list、closeout summary；`App` 维护 workspace repository、archive index、storage feedback。 | High for UI repair; Low for DEP-01. | Do not split before UI-01 and the manual UI direction gate. `TECH-07-APP-TSX-MINIMAL-SPLIT` should support the next UI implementation, not become a broad rewrite. |
| HTTP repository concentration | `http-storage-repository.ts` 891 LOC；list methods repeat envelope parse + invalid bucket normalization for workspaces/issues/records/archives/error-entries. | Medium for future API additions. | Defer until a concrete storage/API task touches it; avoid unrelated adapter restructuring during UI repair. |
| Dual search implementations | localStorage search in `storage-repository.ts` lines 264-420; server SQLite search in `database.mjs` lines 731-875; HTTP adapter response schema in `http-storage-repository.ts` lines 95-125. | Medium for future search consistency; current SEARCH-07/08/09 chain is complete. | Not blocking. Preserve existing search verifies during UI/Knowledge Assist polish. |
| Repeated tag normalization | `App.tsx` lines 308-319; `storage-repository.ts` lines 137-162; `http-storage-repository.ts` lines 196-207; `database.mjs` lines 95-119 and 424-440. | Medium for tags / future taxonomy. | Defer. Only extract a tiny helper when a future tag/taxonomy task exposes mismatch. |
| Server database responsibility | `database.mjs` 1118 LOC includes schema, validation, SQL, search, workspace seed and storage object methods. | Medium for server feature work; Low for no-code DEP-01 deploy verify. | Defer. `TECH-10-DATABASE-MODULE-SPLIT` only after deployment path proves stable or a DB feature forces it. |
| Closeout atomicity | `closeout-orchestrator.ts` lines 232-269 writes archive, error-entry, issue in sequence; `storage-feedback.ts` lines 153-206 creates repair task for partial writes. | High domain importance, but already isolated. | Do not refactor now. Continue using existing orchestrator and verify coverage. |
| Verify script duplication | desktop verify scripts total 5285 LOC; repeated `assert`, fixture builders, mock servers, and localStorage polyfills appear across search and S3 scripts. | Low product risk; Medium maintenance risk. | Safe future simplification, but not a prerequisite for DEP-01 or SEARCH-07. |

## Candidates

| Candidate | Evidence | S3 impact | Risk | Suggested action |
| --- | --- | --- | --- | --- |
| `TECH-07-APP-TSX-MINIMAL-SPLIT` | `App.tsx` 2516 LOC; high-frequency recent changes in search/archive/core UX commits; UI brief later observed 2864 LOC and serious information hierarchy issues. | High for UI repair | High | Do after UI-01 and the manual UI direction gate; keep it as enabling split before broad UI implementation, not visual redesign. |
| `TECH-08-HTTP-REPOSITORY-SPLIT` | `http-storage-repository.ts` 891 LOC; repeated endpoint list parsing and error mapping. | Medium | Medium | Defer. Reassess when adding another storage endpoint. |
| `TECH-10-DATABASE-MODULE-SPLIT` | `database.mjs` 1118 LOC; manual validation + SQL + search in one module. | Medium | High | Defer until after DEP-01 or a DB feature requires it. |
| `TECH-06-SMOKE-FIXTURE-CONSOLIDATION` | `apps/desktop/scripts` 5285 LOC; repeated fixture builders and localStorage polyfills. | Low | Low | Defer. Safe later cleanup, not S3-blocking. |
| `SEARCH-TAG-NORMALIZATION-LITE` | Tag normalization duplicated in App, local repository, HTTP adapter and server database. | Medium for SEARCH-07 | Medium | Defer. Only do inside SEARCH-07 if tests expose mismatch. |
| `LOCAL-STORAGE-STORE-HELPER-SPLIT` | local stores repeat list/parse/invalid buckets; localStorage path is compatibility only. | Low | Low | Do not do now. No S3 value. |
| `APP-TSX-FULL-REWRITE` | Would touch the entire 2516 LOC UI shell. | Low immediate S3 value | High | Do not do. Explicitly outside safe boundary. |
| `SERVER-ROUTE-FULL-REWRITE` | `server.mjs` 473 LOC route matcher is long but working. | Low for DEP-01 | High | Do not do now. |

### Do Now

None for broad refactor.

No candidate simultaneously satisfies “blocks DEP-01 / UI-01” and “small, safe, clearly verifiable” strongly enough to justify inserting a mandatory refactor gate before the next task. `TECH-07-APP-TSX-MINIMAL-SPLIT` becomes useful only after UI-01 produces a target layout and the user confirms the UI direction.

### Defer

- `TECH-07-APP-TSX-MINIMAL-SPLIT`: do after UI-01 and a manual UI direction gate, before the first broad UI implementation pass; forbidden scope remains full App rewrite, visual redesign, storage behavior changes.
- `TECH-08-HTTP-REPOSITORY-SPLIT`: do only when adding or changing HTTP endpoints makes duplication actively costly; forbidden scope remains API contract changes and localStorage removal.
- `TECH-10-DATABASE-MODULE-SPLIT`: do after DEP-01 or when a storage/server feature requires it; forbidden scope remains destructive migration or schema semantics changes.
- `TECH-06-SMOKE-FIXTURE-CONSOLIDATION`: safe later scripts-only cleanup; forbidden scope remains changing product behavior or broad test framework migration.

### Do Not Do

- Do not rewrite `App.tsx` wholesale.
- Do not create dashboard / console / new app.
- Do not remove localStorage compatibility / verify path before a concrete persisted-data migration requirement.
- Do not split server storage before DEP-01 if the task is only deployment verification.
- Do not introduce a shared package or new dependency just to deduplicate schema / validation now.
- Do not connect real AI, embedding, RAG, Electron, preload, fs or IPC as part of cleanup.

## Recommended Next Task

Current unique repo-local next task after this assessment's follow-up work: `UI-MOD-01-PRE-RELAYOUT-COMPONENT-SPLIT`.

Rationale: DEP-01 remains externally blocked and is not the next default task. UI-01, UI-GATE-01 and TECH-07 have completed; the user accepted TECH-07 and requested a behavior-preserving module split before UI relayout. `UI-MOD-01` must stop at `UI-GATE-03-MANUAL-RUN-CHECK-BEFORE-RELAYOUT` for manual run/smoke checking.

If a small refactor is later forced by UI implementation evidence, the minimum safe boundary is: extract only the `App.tsx` component or hook slice needed by that UI task, keep server API contracts unchanged, keep localStorage compatibility, do not alter repository semantics, and verify with `typecheck`, `build`, `verify:handoff`, relevant flow verifies and `verify:all`.

## Verification

Actual verification before commit:

| Command | Result |
| --- | --- |
| `git diff --check` | PASS |
| `python3 -m json.tool .agent-state/handoff.json >/dev/null` | PASS |
| `cd apps/desktop && npm run verify:handoff` | PASS |
| `cd apps/desktop && npm run typecheck` | PASS |
| `cd apps/desktop && npm run verify:all` | PASS |
| `cd apps/desktop && npm run build` | PASS |

Read-only evidence commands completed:

| Command | Result |
| --- | --- |
| `git status --short` | Clean before edits |
| `git log --oneline -20` | Recent high-frequency changes concentrated in search, App, storage, server database and planning |
| `git log --stat -20` | Confirmed App/storage/server database/scripts were touched repeatedly by recent tasks |
| `find apps/desktop/src ... wc -l` | Largest desktop source file is `App.tsx` at 2516 LOC; desktop src total 7258 LOC |
| `find apps/desktop/scripts ... wc -l` | Desktop verify scripts total 5285 LOC; largest is 672 LOC |
| `find apps/server/src apps/server/scripts ... wc -l` | Server source/scripts total 5950 LOC; `database.mjs` is 1118 LOC |
