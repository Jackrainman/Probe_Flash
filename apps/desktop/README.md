# apps/desktop

ProbeFlash 桌面壳 —— 面向嵌入式调试现场的问题闪记与知识归档系统，D1 交差优先阶段的中文产品壳。

## 当前阶段

- 阶段：D1 交差优先中文产品壳（`current_mode = delivery_priority`）。
- 阶段目标：在 SPA 形态下提供一个“好看、中文、能用、像产品壳”的可演示版本，主操作区的“创建 → 选中 → 追记 → 结案 → 结果反馈”在当前页面上真实跑通。
- 边界（如实标注，不能包装成已完成）：
  - 数据持久化仍在 `window.localStorage`，前缀 `repo-debug:*`；**不是** `.debug_workspace/` 文件写盘。
  - Electron / preload / IPC / Node fs 未接入；项目选择、归档列表仅演示当前本地状态。
  - AI runtime、MCP、相似问题检索均未接入。

阶段依据以仓库根的 `AGENTS.md`、`docs/planning/now.md`（机读字段在顶部 yaml 块）为准。

## 技术栈

- Vite 5 + React 18 + TypeScript 5
- zod 3（`IssueCard` / `InvestigationRecord` / `ErrorEntry` / `ArchiveDocument` 运行时校验单一事实源）
- 纯前端 SPA 壳，无 Electron / Node 主进程

## 目录结构

```text
apps/desktop/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── .gitignore
├── scripts/                    # verify-*.mts：store round-trip / now.md yaml 校验
│   ├── verify-now-yaml.mts
│   ├── verify-s1-a3.mts
│   ├── verify-s2-a1.mts
│   ├── verify-s2-a2.mts
│   ├── verify-s2-a3.mts
│   ├── verify-s2-a4.mts
│   └── verify-d1-archive-persist-index.mts
└── src/
    ├── main.tsx                # React 入口
    ├── App.tsx                 # 页面壳（header 双入口 + 主问题卡区 + 归档抽屉）
    ├── App.css
    ├── index.css
    ├── domain/                 # 业务规则：intake / closeout 构造器
    │   ├── issue-intake.ts
    │   ├── investigation-intake.ts
    │   ├── closeout.ts
    │   └── schemas/            # zod 单一事实源（类型由 z.infer 派生）
    │       ├── issue-card.ts
    │       ├── investigation-record.ts
    │       ├── archive-document.ts
    │       ├── error-entry.ts
    │       └── repo-snapshot.ts
    └── storage/                # localStorage 读写 + safeParse + 结构化错误
        ├── issue-card-store.ts
        ├── investigation-record-store.ts
        ├── archive-document-store.ts
        └── error-entry-store.ts
```

## 启动方式

```bash
cd apps/desktop
npm install
npm run dev
```

默认监听 http://localhost:5173 。打开后可见：

- 顶部左侧“项目：演示工作区”入口（popover 展示当前项目上下文边界）。
- 顶部右侧“查看归档列表”入口（点击打开抽屉，展示累计归档计数、最近一次摘要、全部归档条目，跨刷新保留）。
- 中部主问题卡区：创建问题卡 → 选择问题卡 → 追加排查记录 → 结案归档 的四段演示路径。

## 最小演示路径

1. 在“1. 创建问题卡”段填写标题与现象，点击“创建问题卡”。
2. 列表自动选中刚创建的卡（也可用“刷新列表”从已有卡里选一张）。
3. 在“3. 追加排查记录”段填写假设、执行动作、观察结果，保存追记。
4. 在“4. 结案归档”段填写分类、根因、处理结论、预防建议，点击“结案并生成归档摘要”。
5. 右上角“查看归档列表”徽标计数增加；打开抽屉可见最近一次摘要 + 全部归档条目。
6. 刷新页面：问题卡、追记、归档均保留（localStorage 路径稳定）。

## 常用脚本

```bash
npm run typecheck                         # tsc --noEmit
npm run build                             # tsc -b && vite build
npm run preview                           # 预览产物

npm run verify:now-yaml                   # docs/planning/now.md yaml 块可解析 + 最小字段存在
npm run verify:s1-a3                      # IssueCard 存储 round-trip
npm run verify:s2-a1                      # IssueCard intake 表单最小闭环
npm run verify:s2-a2                      # IssueCard 列表视图读写 + invalid 桶
npm run verify:s2-a3                      # InvestigationRecord 追记
npm run verify:s2-a4                      # 结案 → ArchiveDocument + ErrorEntry
npm run verify:d1-archive-persist-index   # 归档索引跨刷新读回 + invalid 桶隔离
npm run verify:all                        # 以上 7 个脚本串跑
```

verify 脚本均在 Node 侧用 Map-based polyfill 模拟 `window.localStorage`，直接调用真实 store 做黑盒 round-trip；不需要浏览器环境。

## 验证矩阵（来自 AGENTS §16，夜跑与交接遵循）

- 必跑：`npm run typecheck`、`npm run build`、仓库根 `git diff --check`、`npm run verify:now-yaml`。
- 按需：任务相关 `npm run verify:*`；涉及 UI 行为变化时做浏览器人工冒烟。
- 未跑的必跑项必须在 commit message 或 handoff 中如实标注原因，不得静默跳过。

## 当前不做

- 不改 zod schema / storage key / localStorage 契约 / closeout 工厂行为。
- 不接入 Electron / preload / IPC / Node fs / `.debug_workspace` 文件写盘。
- 不接入 AI runtime / MCP / 远端服务。
- 不做大规模 UI 重构；仅允许安全美化（AGENTS §5）。
