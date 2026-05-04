# UI Redesign Stage Brief

## Executive Decision

建议进入一个受控的 UI 改造小阶段，但不能直接大改 UI。UI 改造主目标不是做新 dashboard，而是把现有 ProbeFlash 主流程重新整理成更清楚的现场问题闭环：当前项目、快速建卡、问题详情、排查时间线、Knowledge Assist、结案和归档复盘各有明确位置。当前已完成 `UI-01-INFORMATION-ARCHITECTURE-REVIEW`、`UI-GATE-01-MANUAL-VISUAL-DIRECTION`、`TECH-07-APP-TSX-MINIMAL-SPLIT`、`UI-MOD-01-PRE-RELAYOUT-COMPONENT-SPLIT`、`UI-RELAYOUT-01-WORKBENCH-FIRST-PASS`、`UI-POLISH-02-COPY-TRIM` 与 `UI-POLISH-03-QUICK-ISSUE-LANDING-LAYOUT`。下一步必须停在 `UI-GATE-06-MANUAL-QUICK-ISSUE-LAYOUT-REVIEW`，等用户人工检查桌面端和移动端观感后，再决定是否继续下一轮 UI polish。

当前交接更新：`UI-GATE-01-MANUAL-VISUAL-DIRECTION` 已在 2026-04-30 获得用户确认并落盘；`TECH-07-APP-TSX-MINIMAL-SPLIT`、`UI-MOD-01-PRE-RELAYOUT-COMPONENT-SPLIT`、`UI-RELAYOUT-01-WORKBENCH-FIRST-PASS`、`UI-POLISH-02-COPY-TRIM` 与 `UI-POLISH-03-QUICK-ISSUE-LANDING-LAYOUT` 已完成。`UI-POLISH-03` 已放大快速建卡 landing、移除最小演示路径，并把辅助验证下移为仅测试入口；未改 schema / repository / HTTP API / server / AI。当前必须停在 `UI-GATE-06-MANUAL-QUICK-ISSUE-LAYOUT-REVIEW`。

## Current UI Problems

| Problem | Phenomenon | Impact | Evidence source | Fit next stage |
| --- | --- | --- | --- | --- |
| 信息层级偏混合 | `IssuePane` 先渲染快速建卡和历史搜索，再进入 issue rail/detail workbench；相似问题、复发提示、人工关联、追记和结案都堆在同一详情列。 | 用户很难判断当前主任务是“处理当前问题”还是“搜索知识库”。 | `apps/desktop/src/App.tsx:1722-2050`，尤其 `SearchPanel` 在 `issue-workbench` 前渲染于 `1941-1949`。 | Yes，适合 UI-01 / UI-02 先定义主次布局。 |
| `App.tsx` 是最大 UI 冲突面 | 多个 UI 面板、状态和 repository 调用集中在单文件内。 | 直接重写会同时影响 create/select/edit/record/closeout/archive/search/storage feedback。 | `apps/desktop/src/App.tsx:1-2864`；`docs/planning/refactor-assessment.md:12` 已记录 App.tsx 为 2516 LOC，当时已偏大，本轮读到 2864 行。 | Yes，但只适合规划和局部拆分，不适合全量重写。 |
| issue list / detail 拥挤 | 左侧 list 只显示 title、severity、status、createdAt、id；右侧 detail 同时承载主线状态、知识提示、记录表单、时间线、结案表单。 | 现场处理时选中问题后的“下一步”不够突出，最近活动和状态不够一眼可读。 | `apps/desktop/src/App.tsx:567-644`、`1932-2048`。 | Yes，适合 UI-03。 |
| Search / similar / recurrence / linked history 分散 | 搜索、相似历史问题、已关联历史问题、复发提示是 4 个独立面板和不同视觉语义。 | Search / KB 新能力已经完成，但在 UI 上像多个工具块，尚未形成“辅助当前问题判断”的单一区域。 | `SearchPanel` `apps/desktop/src/App.tsx:646-850`；`SimilarIssuesPanel` `852-935`；`RelatedHistoricalIssuesPanel` `937-983`；`RecurrencePromptPanel` `985-1054`；渲染顺序 `1941-2009`。 | High，适合 UI-04。 |
| closeout 表单压迫主流程 | 结案表单包含填写检查、规则草稿、分类、根因、修复、预防和提交，位于记录时间线之后；顶部只能通过“结案”按钮滚动到表单。 | 用户可能把结案理解为长表单填写，而不是问题收束动作；长页面下易漏看前置上下文。 | `CloseoutForm` `apps/desktop/src/App.tsx:1259-1580`；header scroll action `2590-2611`；渲染位置 `2028-2036`。 | Yes，适合 UI-06，但最好先完成 UI-01。 |
| archive review 与 issue 闭环割裂 | 归档入口在 header，归档列表是 drawer；可打开来源问题，但与当前 issue detail 的复盘关系不够强。 | 归档复盘像独立抽屉，不像 closeout 后自然沉淀出的知识资产。 | `ArchivePaneShell` `apps/desktop/src/App.tsx:2158-2243`；`ArchiveListDrawer` `2245-2384`。 | Yes，适合 UI-07。 |
| workspace 状态与 server 状态分散 | workspace selector 在 header toolbar，storage/server feedback 在 header 下方独立 banner，底部也重复边界说明。 | LAN 演示时用户需要同时看多个位置才知道“当前项目”和“当前存储状态”。 | `StorageStatusBanner` `apps/desktop/src/App.tsx:195-247`；`ProjectSelector` `2417-2559`；header `2780-2827`；footer `2849-2851`。 | High，适合 UI-02 / UI-08。 |
| 空状态 / 错误态 / loading 态不统一 | 多数空态复用 `.empty-state`，但 search、similar、archive、issue next step、storage line 各自写文案和状态表达；loading 只在 search/similar 局部表达。 | 页面能用但不够产品化，用户很难从状态样式判断“可继续、需等待、需修复”。 | Empty states: `apps/desktop/src/App.tsx:611-613`、`798-801`、`880-883`、`1207-1209`、`2197-2200`；CSS `.empty-state` `apps/desktop/src/App.css:2131-2140`。 | High，适合 UI-08。 |
| LAN 演示口径偏工程化 | Header 直接显示 `S3：本地 HTTP + SQLite 闭环`，footer 重复 Electron/fs/IPC 未接入。 | 对评审或战队成员演示时，页面像工程联调台而不是产品壳；但这些真实边界不能被隐藏或伪造。 | `apps/desktop/src/App.tsx:2785-2796`、`2849-2851`。 | Yes，适合 UI-10，但不得伪装服务器部署完成。 |
| CSS token 有基础但未形成轻量设计系统 | `index.css` 已有颜色变量，`App.css` 有大量局部类；按钮、badge、panel、empty/error/loading 状态仍分散定义。 | 后续小 UI polish 容易继续复制样式，造成视觉不一致。 | `apps/desktop/src/index.css:1-38`；`apps/desktop/src/App.css:1-2451`。 | Yes，适合 UI-09，但不要引入 Tailwind / shadcn / 组件库。 |

## UI Surface Map

| Area | Current role | Pain point | Redesign priority | Risk |
| --- | --- | --- | --- | --- |
| Workspace header | 选择 / 创建当前项目，展示阶段和边界。 | workspace 与 storage 状态分散；工程阶段标签抢占产品信息。 | High | 不能隐藏服务器未独立部署、localStorage 兼容路径等真实边界。 |
| Issue list/sidebar | 未归档 issue 选择区。 | 元信息薄，缺少最近活动、标签和状态层级。 | High | 不能改 issue schema 或筛选语义。 |
| Issue detail | 当前问题主处理区。 | detail 内同时放主线状态、知识辅助、记录、结案，主次不够清楚。 | High | 不能破坏 issue select/edit/readback。 |
| Record timeline | 展示当前 issue 的 InvestigationRecord。 | 已有时间线视觉，但与 append form 和复盘目标的关系还可更清楚。 | Medium | 不改 record schema。 |
| Closeout panel | 结案输入、规则草稿、归档写入入口。 | 表单长且位于页面底部，像单独大表单而不是收束动作。 | High | 不能自动结案，不接真实 AI。 |
| Search panel | 当前项目历史全文搜索和筛选。 | 放在主流程前方，容易抢主任务焦点。 | High | 不改 search repository contract。 |
| Similar issues / recurrence prompt | 规则相似问题和复发提示。 | 与 search 和 linked history 分散，辅助判断边界需要更显眼。 | High | 不能把规则提示当事实写入。 |
| Linked historical issues | 当前 issue 人工关联的历史问题 id 列表。 | 只显示 id，缺少关联目的和上下文摘要。 | Medium | 不改 `relatedHistoricalIssueIds` schema。 |
| Archive review | Drawer 内浏览 archive markdown 并跳回来源 issue。 | 与 closeout 后的知识沉淀连接较弱。 | Medium | 不编辑 archive 源内容。 |
| Storage / server feedback | 顶部统一存储状态和错误提示。 | 状态可见但视觉优先级和 workspace 状态未整合。 | High | 不能改变错误语义，不能伪造服务器可用。 |

## Final Information Architecture (UI-01)

### Product Shape

ProbeFlash 主界面应被理解为 **workspace-scoped issue workbench**，不是 dashboard、console 或项目管理系统。首屏只回答 4 个问题：当前数据属于哪个项目、现在选中哪个问题、下一步该记录 / 排查 / 结案什么、有哪些历史知识可辅助判断。

### First Screen Regions

| Region | Primary content | Priority | Notes for implementation |
| --- | --- | --- | --- |
| Global header | 产品名、当前阶段真实边界、archive review 入口。 | Secondary | 阶段和边界要真实但不能压过当前 workspace。 |
| Project context bar | 当前 workspace、创建 / 切换入口、storage/server 状态、错误与重试提示。 | Primary | `CORE-02` 优先把 workspace 与 storage feedback 合并成用户能读懂的项目上下文。 |
| Issue rail | 快速建卡、open issue list、当前选中态、空状态和错误态。 | Primary | 这是导航和现场 triage，不承载知识库搜索主任务。 |
| Issue workbench | 当前 issue 摘要、状态 / 标签、下一步提示、record composer、timeline、closeout CTA / panel。 | Primary | 选中问题后的主操作都在这里，避免被 search 抢首屏焦点。 |
| Knowledge Assist | 复发提示、相似问题、人工关联历史、历史搜索。 | Supporting | 单一区域表达“辅助判断”，不把规则建议当事实，不自动写库。 |
| Archive review | 归档文档浏览和跳回来源 issue。 | Auxiliary | 仍可用 drawer / secondary surface，不进入首屏主任务。 |
| Footer boundary | localStorage 兼容路径、Electron/fs/IPC 未接入等长期边界。 | Low | 保留真实边界，但首屏优先级低于 project context bar。 |

### Workspace And Storage State Placement

- 当前 workspace 名称 / ID、创建入口、切换入口和 storage/server 连接状态应合并为一个 **Project context bar**，放在 header 下方或 header 主操作区内。
- storage/server 错误态应直接说明影响范围：当前项目数据是否可读、创建 / 写入是否可重试、用户下一步应该刷新 / 切换 workspace / 稍后重试。
- localStorage 兼容路径只能作为次级技术边界，不应与当前 workspace 主身份争抢视觉优先级。
- 不得把本地 HTTP + SQLite 说成真实服务器部署完成；真实服务器、systemd 和真实 AI 仍保持 blocked 表达。

### Issue List And Detail Relationship

- Issue rail 是选择和快速创建区域；它显示 open issues、当前选中态、关键状态、标签和最近活动线索，但不承载完整排查内容。
- Issue workbench 是主任务区域；无 issue 选中时给出“先创建或选择问题”的空状态，已选中时优先显示 issue 摘要、下一步建议、record timeline 和 closeout 入口。
- Issue detail 内的记录、时间线和结案应按“记录现场 -> 组织排查 -> 收束归档”的顺序排列；Knowledge Assist 不应插在快速建卡和主 workbench 之间。
- Workspace 切换、issue 不存在或已归档时，detail 应安全降级到可理解的空状态，并提示重新选择 open issue 或打开归档复盘。

### Knowledge Assist Region

- Search、similar issues、recurrence prompt 和 linked historical issues 合并为一个 **Knowledge Assist** 区域，文案统一使用“辅助判断 / 历史线索 / 人工关联”。
- 复发提示优先级最高，因为它直接影响当前 issue 判断；相似问题和已关联历史其次；全文搜索作为用户主动查询入口。
- Knowledge Assist 只能提供解释、链接和人工关联动作；不得自动修改 root cause、resolution、record 或 closeout 内容。
- 该区域可以在桌面端作为右侧 supporting rail，在窄屏下落到 issue workbench 下方；具体视觉需要 `UI-GATE-01` 人工确认。

### Closeout Entry Strategy

- Closeout 是当前 issue 的收束动作，不是独立长表单页面；入口应靠近 issue 摘要 / 当前状态，并能跳转或聚焦到 closeout panel。
- Closeout panel 仍保留在 issue workbench 内，放在 record timeline 之后或同一区域的明确“收束”段落，避免遮挡正在记录的排查过程。
- AI-ready / rule-based draft 只能以“草稿”出现，必须由用户审阅和手动应用；真实 AI 未接入时不能宣称模型生成。
- Closeout 成功语义、ArchiveDocument / ErrorEntry 写入语义和 schema 语义不因 UI 信息架构改变。

### CORE-02 Input Boundary

`CORE-02-WORKSPACE-UX-IMPROVEMENTS` 只接收本节中与 Project context bar、workspace 创建 / 切换、workspace 空状态、storage/server 错误态和“当前数据属于哪个项目”相关的输入。它可以做最小 UI / copy / verify 改善，但不得移动 Knowledge Assist、重排 closeout 主流程、执行 `TECH-07`、全量重写 `App.tsx`、引入组件库、改 schema、改 server 或改变业务数据流。

## Protected Product Flows

- workspace create / switch
- quick issue create
- issue select / edit
- record append
- closeout
- archive review
- search
- similar issues
- linked historical issue
- recurrence prompt
- storage/server feedback
- localStorage compatibility verify path

## Redesign Principles

- 先整理信息架构，再做视觉美化。
- 先改局部，不重写 `App.tsx`。
- 每个 UI implementation 任务必须有 verify 和读回路径。
- 不改变 schema / repository contract / HTTP API contract。
- 不引入组件库，不新增依赖。
- 不做 dashboard / console / 新 app，不把项目管理 UI 塞进 ProbeFlash 产品本体。
- Search / Knowledge Base 要成为 issue flow 的辅助区，不要变成另一个复杂系统。
- 所有 AI-ready / recurrence / similar 提示都必须保持“辅助判断”，不能变成事实写入。

## Proposed UI Task Breakdown

### UI-01-INFORMATION-ARCHITECTURE-REVIEW

目标：只做信息架构重排设计，明确页面区域、主次关系、导航和状态布局。

类型：planning-only / night-safe。

不做：不改 UI 代码，不改 `App.tsx`，不改 CSS，不改业务逻辑。

验证：`git diff --check`、`python3 -m json.tool .agent-state/handoff.json >/dev/null`、`cd apps/desktop && npm run verify:handoff`、`status.md` 不流水账。

### UI-GATE-01-MANUAL-VISUAL-DIRECTION

目标：在任何较大 UI 代码修改前，由用户人工确认目标信息架构、首屏布局、视觉方向和必须保留的真实边界。

类型：manual-blocked / day-review；不能夜跑。

不做：不直接重写 `App.tsx`，不引入组件库，不改业务逻辑，不隐藏服务器未部署、localStorage 兼容路径或真实 AI 未接入边界。

验证：读回本 brief、`current.md`、`backlog.md`、`.agent-state/handoff.json`；人工确认记录必须存在于 planning sync；`git diff --check`；`python3 -m json.tool .agent-state/handoff.json >/dev/null`。

### TECH-07-APP-TSX-MINIMAL-SPLIT

目标：在目标 UI 方向已人工确认后，做最小 `App.tsx` 组件 / hook 拆分，为后续 UI implementation 降低冲突面。

类型：gated-night-safe；依赖 `UI-01-INFORMATION-ARCHITECTURE-REVIEW` 与 `UI-GATE-01-MANUAL-VISUAL-DIRECTION`。

不做：不做视觉重设计，不改 schema / repository / HTTP API contract，不改业务语义，不删除 localStorage compatibility verify path。

验证：`git diff --check`、`python3 -m json.tool .agent-state/handoff.json >/dev/null`、`cd apps/desktop && npm run typecheck`、`cd apps/desktop && npm run build`、`cd apps/desktop && npm run verify:handoff`、`cd apps/desktop && npm run verify:all`、主流程 smoke。

### UI-GATE-02-MANUAL-UI-POLISH-AFTER-SPLIT

目标：在 TECH-07 后执行第一轮人工 review 的 UI 修改任务，优先修首屏、workspace / storage 状态、当前问题主区域和 Knowledge Assist 主次关系。

类型：manual-blocked / day-review；不能夜跑。

不做：不全量重写 `App.tsx`，不重做业务数据流，不接真实 AI，不做 dashboard / console / new app，不引入组件库或 broad CSS reset。

验证：desktop / mobile 人工 smoke 记录、`git diff --check`、`python3 -m json.tool .agent-state/handoff.json >/dev/null`、`cd apps/desktop && npm run typecheck`、`cd apps/desktop && npm run build`、`cd apps/desktop && npm run verify:handoff`、`cd apps/desktop && npm run verify:all`。

当前状态：TECH-07 拆分结果已被用户认可，但用户要求在真正 UI 重排前先做模块化拆分；因此 UI-GATE-02 不再直接放行 UI implementation。

### UI-MOD-01-PRE-RELAYOUT-COMPONENT-SPLIT

目标：在三栏布局、QuickIssue landing、Knowledge Assist 合并和 closeout 视觉整理之前，把 `App.tsx` 中直接相关的 UI 组件做行为保持模块化拆分。

类型：night-safe / repo-local；下一轮唯一可自动认领任务。

允许：只移动 / 拆出 UI 组件和直接依赖的 label/render helper；优先抽取 `QuickIssueCreateBar`、`IssueIntakeForm`、`IssueCardListView`、Knowledge Assist 四个面板、`InvestigationAppendForm`、`InvestigationRecordListView`、`CloseoutForm`、`MainlineResultPanel`。

不做：不改变渲染顺序，不做三栏布局，不把快速建卡替换默认主界面，不新增 severity 交互，不删 3/4 编号文案，不改 CSS 主视觉，不改 schema / repository / HTTP API / server。

验证：`git diff --check`、`python3 -m json.tool .agent-state/handoff.json >/dev/null`、`cd apps/desktop && npm run typecheck`、`cd apps/desktop && npm run build`、`cd apps/desktop && npm run verify:handoff`、`cd apps/desktop && npm run verify:all`。

### UI-GATE-03-MANUAL-RUN-CHECK-BEFORE-RELAYOUT

目标：模块化拆分完成后，由用户人工启动 / 浏览 ProbeFlash，确认现有主流程仍能正常跑，再决定是否进入 UI 重排实现。

类型：day-review / manual-blocked；不能夜跑。

不做：AI 不自动越过此 gate 做三栏布局、QuickIssue landing、Knowledge Assist 合并、closeout 重排或任何视觉重构。

### UI-02-SHELL-LAYOUT-POLISH

目标：轻量优化整体 shell、header、workspace 状态、主内容区域布局，让当前项目、服务器状态和产品边界更清楚。

类型：night-safe，但截图或人工 review 更好。

不做：不重写 `App.tsx`，不改业务逻辑，不隐藏服务器未部署边界。

验证：`typecheck`、`build`、`verify:handoff`、`verify:all`、关键 UI smoke。

### UI-03-ISSUE-LIST-DETAIL-POLISH

目标：优化 issue list 与 issue detail 的信息层级，让问题卡选择、状态、标签、最近活动更清楚。

类型：night-safe / UI implementation。

不做：不改 issue schema，不改 storage contract，不新增编辑语义。

验证：issue create/select/readback smoke、`typecheck`、`build`、`verify:all`。

### UI-04-SEARCH-KB-PANEL-POLISH

目标：把 search、similar issues、linked historical issues、recurrence prompt 整理成清楚的 Knowledge Assist 区域。

类型：night-safe / UI implementation，可在人工 review 后调整视觉。

不做：不接 AI，不做 embedding，不做 RAG，不做复杂知识图谱，不自动关联历史问题。

验证：`verify:search-similar-issues`、`verify:search-result-linking`、`verify:search-recurrence-prompt`、`typecheck`、`build`、`verify:all`。

### UI-05-RECORD-TIMELINE-VISUAL-POLISH

目标：让排查记录时间线更适合现场复盘，突出观察、假设、动作、结果、结论的节奏。

类型：night-safe / UI implementation。

不做：不改 record schema，不做附件，不做自动总结。

验证：`verify:core-record-timeline-polish`、record append/list smoke、`typecheck`、`build`、`verify:all`。

### UI-06-CLOSEOUT-FLOW-VISUAL-POLISH

目标：让结案流程更像“收束问题”，减少表单压迫感和误填，保留必填提示与草稿辅助边界。

类型：night-safe / maybe day-review。

不做：不自动结案，不接真实 AI，不改变 closeout orchestration。

验证：`verify:core-closeout-ux-polish`、closeout success/failure smoke、`typecheck`、`build`、`verify:all`。

### UI-07-ARCHIVE-REVIEW-POLISH

目标：让 archive review 更适合复盘和知识沉淀，并与来源 issue / closeout 结果建立更清楚的关系。

类型：night-safe。

不做：不编辑 archive 源内容，不伪装 `.debug_workspace` 文件写盘已接入。

验证：`verify:search-archive-review-page`、archive open issue smoke、`typecheck`、`build`、`verify:all`。

### UI-08-EMPTY-ERROR-LOADING-STATES-POLISH

目标：统一空状态、错误态、loading 态、storage/server feedback，让用户知道下一步能做什么。

类型：night-safe。

不做：不改错误语义，不吞掉 storage/server 错误，不改 repair task 语义。

验证：storage feedback smoke、相关 flow verify、`typecheck`、`build`、`verify:all`。

### UI-09-DESIGN-TOKEN-LITE

目标：轻量统一颜色、间距、卡片、按钮、标签、状态 badge，减少局部样式复制。

类型：night-safe。

不做：不引入 Tailwind / shadcn / 组件库，不做 broad CSS reset，不全量重写 CSS。

验证：`typecheck`、`build`、`verify:all`、视觉 smoke。

### UI-10-LAN-DEMO-POLISH

目标：优化局域网演示观感和常见屏幕尺寸可读性，让页面更像产品壳，同时真实标注未部署 / 未接入边界。

类型：day-review preferred。

不做：不做部署任务，不碰服务器，不改 release，不伪装 LAN 部署完成。

验证：desktop/mobile smoke、`typecheck`、`build`、`verify:all`，人工 review 记录。

## Recommended Next UI Task

唯一推荐的下一 UI 步骤是 `UI-GATE-06-MANUAL-QUICK-ISSUE-LAYOUT-REVIEW`。

判断依据：信息架构、视觉方向、TECH-07 支撑拆分、UI-MOD-01 行为保持模块化拆分、UI-RELAYOUT-01 第一轮工作台重排、UI-POLISH-02 文案瘦身和 UI-POLISH-03 快速建卡 landing 调整均已完成。下一步需要用户人工检查桌面端和移动端观感，确认快速建卡面积、辅助验证下移和未选中提示位置是否符合预期。

后续顺序：`UI-GATE-06` 通过后，才允许选择下一轮 UI polish；未通过前不得顺推 closeout 视觉重构、archive drawer 重做或任何新的 UI implementation。`TECH-08` / `TECH-09` / `TECH-10` 等非 UI 支撑型重构应后置到具体 server / storage 任务命中时。

## Night-safe vs Day-review

| Task | Type | Why |
| --- | --- | --- |
| UI-01 | night-safe | planning-only，不改 UI 代码。 |
| UI-GATE-01 | manual-blocked | 目标 UI、首屏信息架构和边界表述必须人工确认，不能夜跑。 |
| TECH-07 | gated-night-safe | 只在 UI-GATE-01 后作为 UI implementation 支撑，不做视觉重设计。 |
| UI-GATE-02 | completed/manual accepted | TECH-07 拆分结果已被用户认可，但不直接放行 UI 重排。 |
| UI-MOD-01 | completed | 已完成行为保持模块化拆分。 |
| UI-GATE-03 | completed/user approved | 用户已确认模块化拆分后页面可进入 UI 改造。 |
| UI-RELAYOUT-01 | completed | 已完成第一轮 QuickIssue landing、workbench 层级和 Knowledge Assist supporting 区。 |
| UI-GATE-04 | completed/user-authorized-copy-trim | 用户指出讲解性文字过多并授权执行 copy trim。 |
| UI-POLISH-02 | completed | 已完成说明文案瘦身，保留状态判断边界。 |
| UI-GATE-05 | completed/user-authorized-quick-issue-layout | 用户要求快速建卡占据原最小演示路径和辅助验证位置。 |
| UI-POLISH-03 | completed | 已完成快速建卡 landing 调整，辅助验证下移为仅测试入口。 |
| UI-GATE-06 | manual-blocked | 快速建卡 landing 调整后必须人工检查桌面端和移动端观感，不能夜跑越过。 |
| UI-02 | day-review preferred | shell 观感和 LAN 演示第一印象最好人工看一眼。 |
| UI-03 | night-safe | issue create/select/readback 可自动验证，但视觉仍建议截图。 |
| UI-04 | night-safe or day-review | Search/Kb 行为可验证，Knowledge Assist 观感最好人工确认。 |
| UI-05 | night-safe | record timeline 已有 verify，可局部 polish。 |
| UI-06 | maybe day-review | closeout 是高风险主流程，视觉压迫感需要人工判断。 |
| UI-07 | night-safe | archive review 已有 verify，不编辑源内容。 |
| UI-08 | night-safe | 状态表达可通过 existing flows 和 verify 覆盖。 |
| UI-09 | night-safe | 仅轻量 token / class 收敛，不引入依赖。 |
| UI-10 | day-review preferred | LAN demo 观感和常见屏幕尺寸需要人工验收。 |

## Forbidden Scope

- No dashboard / console / new app
- No App.tsx full rewrite
- No business logic rewrite
- No server change
- No real AI
- No embedding / RAG
- No Electron / fs / IPC
- No schema migration
- No component library
- No broad CSS reset
- No SSH / sudo / systemd / `/opt` / 80 / 443
- No real server deploy
- No project-management UI inside ProbeFlash product UI

## Verification Plan For Future UI Tasks

未来 UI implementation 任务至少运行：

- `git diff --check`
- `python3 -m json.tool .agent-state/handoff.json >/dev/null`
- `cd apps/desktop && npm run typecheck`
- `cd apps/desktop && npm run build`
- `cd apps/desktop && npm run verify:handoff`
- `cd apps/desktop && npm run verify:all`
- 任务相关 verify，例如 search / closeout / record / archive 对应脚本
- 如有 Playwright / smoke，记录是否运行；没有自动化截图时，记录“未执行人工浏览器冒烟”的原因

planning-only UI 任务可以不跑 typecheck/build/verify:all，但必须在汇报和 handoff 中说明原因。

## Planning Impact

- `DEP-01-RELEASE-USER-DIR-DEPLOY-VERIFY` 的 P0 白天主线仍 blocked；但下一轮默认停在 `UI-GATE-06`，除非用户明确推翻本轮 UI review gate 并重新授权服务器部署。
- 推荐下一 UI 步骤是 `UI-GATE-06-MANUAL-QUICK-ISSUE-LAYOUT-REVIEW`；它只做人工 review / smoke，不实际改 UI 代码。
- B 组功能完成后，UI 大问题优先级高于 broad refactor；当前执行顺序为 `UI-GATE-01-MANUAL-VISUAL-DIRECTION` -> `TECH-07-APP-TSX-MINIMAL-SPLIT` -> `UI-GATE-02` 用户认可 -> `UI-MOD-01-PRE-RELAYOUT-COMPONENT-SPLIT` -> `UI-GATE-03-MANUAL-RUN-CHECK-BEFORE-RELAYOUT` 用户放行 -> `UI-RELAYOUT-01-WORKBENCH-FIRST-PASS` -> `UI-GATE-04` 用户授权 copy trim -> `UI-POLISH-02-COPY-TRIM` -> `UI-GATE-05` 用户授权 quick issue layout -> `UI-POLISH-03-QUICK-ISSUE-LANDING-LAYOUT` -> `UI-GATE-06-MANUAL-QUICK-ISSUE-LAYOUT-REVIEW`。
- `status.md` 只做摘要，不变成 UI backlog 副本。
- 完整 UI 拆分以本文为 brief；`backlog.md` / `.agent-state/handoff.json` 只提升当前最小下一候选，避免同时推进多个 UI 任务。

## UI-GATE-01 Confirmation

确认时间：2026-04-30T14:30:51+08:00。

人工确认标记：用户已认可本轮 `UI-GATE-01-MANUAL-VISUAL-DIRECTION` 输出的视觉方向、首屏分区、真实边界约束、`TECH-07` 最小拆分目标和第一轮 UI 修改范围。该确认已用于放行 `TECH-07-APP-TSX-MINIMAL-SPLIT`。

确认结论：下一阶段 UI 方向是 workspace-scoped issue workbench，不做 dashboard / console / new app。首屏从上到下保持：顶部产品与边界、Project context bar、issue rail + issue main flow + Knowledge Assist、结案面板、archive / footer 边界。Knowledge Assist 是 supporting 区，不抢当前 issue 处理主线。

### Confirmed Problem Matrix

| 编号 | 问题简述 | 当前严重度 | 建议修复阶段 | 人工确认结论 |
|---|---|---|---|---|
| 1 | 信息层级混合 | 高 | 第一轮 | Knowledge Assist 改为 supporting 区，不再压在主流程前。 |
| 2 | `App.tsx` 冲突面 | 高 | `TECH-07` | 只做 1-3 个支撑抽取，不全量重写。 |
| 3 | issue list / detail 拥挤 | 中 | 第二轮 | issue rail 与 issue main flow 分清主次，第一轮不大改 detail。 |
| 4 | Search / similar / recurrence / linked history 分散 | 高 | 第一轮 | 统一为 Knowledge Assist 区。 |
| 5 | closeout 表单压迫主流程 | 中 | 第二轮 | 第一轮暂不重排 closeout，只保留入口和真实边界。 |
| 6 | archive review 与 issue 闭环割裂 | 中 | 后续 | archive drawer 暂不重做。 |
| 7 | workspace 状态与 server 状态分散 | 高 | 第一轮 | Project context bar 是首屏强主区。 |
| 8 | 空状态 / 错误态 / loading 态不统一 | 中 | 第二轮 | 后续统一状态语义，不改变错误语义。 |
| 9 | LAN 演示口径偏工程化 | 中 | 第一轮 | 可产品化文案，但必须保留“独立部署未验证”。 |
| 10 | CSS token 未形成轻量设计系统 | 低 | 后续 | 不引入组件库，不做 broad CSS reset。 |

### Confirmed First Screen Regions

| 区域 | 当前代码位置 | 主次关系 | 可见性 | 边界要求 |
|---|---|---|---|---|
| 顶部栏 | `apps/desktop/src/App.tsx:3059-3099` | primary | 首屏可见 | 保留独立部署未验证。 |
| Project context bar | `StorageStatusBanner` `apps/desktop/src/App.tsx:211-273`，渲染 `3100-3106` | primary | 首屏可见 | 保留 HTTP + SQLite / error 状态。 |
| 问题 rail / 快速建卡 | `QuickIssueCreateBar` `400-483`，`IssueCardListView` `643-738`，渲染 `2190-2217` | primary | 始终可达 | 显示当前项目归属。 |
| 当前问题主线 | `MainlineResultPanel` `1840-1943`，渲染 `2232-2236` | primary | 选中问题后可见 | 显示真实状态和追记数。 |
| 追记与时间线 | `InvestigationAppendForm` `1173-1265`，`InvestigationRecordListView` `1278-1334`，渲染 `2275-2285` | primary | 选中问题后可见 | 不隐藏排查记录读写状态。 |
| Knowledge Assist | `SearchPanel` `740-944`，`RecurrencePromptPanel` `1079-1148`，`RelatedHistoricalIssuesPanel` `1031-1077`，`SimilarIssuesPanel` `946-1029` | secondary | 桌面侧栏，移动端下沉 | 标注规则提示 / 辅助判断。 |
| 结案面板 | `CloseoutForm` `1355-1791`，入口 `CloseoutEntryButton` `2867-2889` | secondary | 入口可见，面板按需聚焦 | 规则草稿非真实 AI。 |
| Archive review | `ArchiveListDrawer` `2503-2643`，入口 `2838-2864` | auxiliary | 不必首屏常驻 | 不隐藏 SQLite / `.debug_workspace` 未接入边界。 |
| Footer boundary | `apps/desktop/src/App.tsx:3128-3130` | auxiliary | 低优先级可见 | 保留长期未接入边界。 |

### Confirmed Real Boundaries

| 边界 | 当前 UI 展示位置和文案 | 后续要求 |
|---|---|---|
| 服务器未独立部署 | Header `apps/desktop/src/App.tsx:3069-3072`；Footer `3128-3129`。 | 可产品化表达，但必须保留“独立部署未验证”。 |
| localStorage 兼容路径仍存在 | Closeout 草稿历史 `1596-1653`、`1805-1815`。 | 不说成全部数据都只在服务器；保留浏览器本地草稿历史边界。 |
| 真实 AI 未接入 | Closeout 草稿区 `1577-1582`。 | 不把规则草稿包装成模型能力。 |
| AI-ready 是规则草稿 | Closeout 草稿区 `1580-1590`。 | 继续强调规则、草稿、人工审阅。 |
| Code context 未接入 | 当前 UI 没有全局显式展示；相近边界在 `PANES` `2338-2339`。 | 第一轮若改 shell，应补低优先级边界：Code context 需用户显式生成 bundle，当前未接入。 |

### TECH-07 Execution Contract

`TECH-07-APP-TSX-MINIMAL-SPLIT` 的目标是让后续 UI implementation 有清楚落点，不做视觉实现。该任务已完成，实际抽取目标如下：

| 抽取目标 | 从 `App.tsx` 哪段抽 | 后续收益最大任务 |
|---|---|---|
| `WorkspaceChrome` / `ProjectContextShell` | Header + toolbar + `StorageStatusBanner` 渲染：`3059-3106`；复用现有 `ProjectSelector` 和 `ArchiveEntryButton`。 | `UI-02-SHELL-LAYOUT-POLISH`。 |
| `KnowledgeAssistPanel` | 当前 `SearchPanel` 渲染 `2197-2205`，以及 recurrence / related / similar 渲染 `2237-2267`。 | `UI-04-SEARCH-KB-PANEL-POLISH`。 |
| `IssueMainFlow` | 当前问题主线、追记、时间线、结案渲染：`2218-2305`。 | `UI-MOD-01` 后的主流程 polish。 |

`TECH-07` 明确不抽：`CloseoutForm` 内部、repository / storage hooks、`ArchiveListDrawer` 内部、CSS token 系统。原因分别是：closeout 字段多且第一轮不重排；storage 语义不得改变；archive 不是第一轮重点；CSS token 等视觉实现边界稳定后再做。

`TECH-07` 禁止范围：不做视觉重设计、不改 `App.css` 主视觉、不改 schema / repository / HTTP API、不改 server、不接真实 AI、不做 RAG / Electron / preload / fs / IPC、不移除 localStorage compatibility verify path、不隐藏服务器未独立部署 / AI-ready / Code context 边界。

### First UI Change After TECH-07

`TECH-07` 拆分结果已被用户认可，`UI-MOD-01` 行为保持模块化拆分、`UI-RELAYOUT-01` 第一轮工作台重排、`UI-POLISH-02` 文案瘦身与 `UI-POLISH-03` 快速建卡 landing 调整已完成。当前必须停在 `UI-GATE-06-MANUAL-QUICK-ISSUE-LAYOUT-REVIEW`；用户人工确认桌面端和移动端观感后，才允许选择下一轮 UI polish。不得在 review 前继续做 closeout 重排、archive drawer 重做、真实 AI、RAG、Code context、Electron / fs / IPC 或 server / schema / repository / HTTP API 改动。
