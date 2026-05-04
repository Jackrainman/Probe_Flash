// apps/server/scripts/fixtures/verify-fixtures.mjs
// 共享 verify 脚本 fixture 模板（server 侧 raw 数据 shape）。
// 任务：TECH-06-SMOKE-FIXTURE-CONSOLIDATION（夜跑还债，纯本地）。
//
// 桌面 verify 大多走 buildIssueCardFromIntake / buildInvestigationRecordFromIntake 等 domain
// 工厂；server verify 直接 POST 原始 schema-shape JSON 到 HTTP 路由，需要自己造 raw
// fixture。原本每个 server verify 脚本都重复定义 repoSnapshot/issueFixture/recordFixture/
// archiveFixture/errorEntryFixture 的本地版本（字段几乎一致，少数有 per-test 覆盖）。
//
// 本模块只做"默认填全 schema 必填字段 + overrides 覆盖"——脚本通过 overrides 表达自己关心
// 的差异（title/tags/relatedFiles/状态等），共享字段交给默认值。
//
// 设计边界（TECH-06 不做）：
//   - 不替桌面侧 buildIssueCardFromIntake 类型的 domain 工厂兜底。
//   - 不强行挑选每条 fixture 的语义内容；脚本侧 overrides 自己关心的字段。
//   - 不承担 atomicity / repository 拆分（TECH-01/02/08~10）。

export function makeRepoSnapshot({ now, overrides = {} } = {}) {
  return {
    branch: "master",
    headCommitHash: "0000000000000000000000000000000000000000",
    headCommitMessage: "verify fixture",
    hasUncommittedChanges: false,
    changedFiles: [],
    recentCommits: [],
    capturedAt: now,
    ...overrides,
  };
}

export function makeIssueFixture({ id, workspaceId, now, repoSnapshot, overrides = {} } = {}) {
  return {
    id,
    projectId: workspaceId,
    title: "verify fixture issue",
    rawInput: "verify fixture",
    normalizedSummary: "verify fixture",
    symptomSummary: "verify fixture",
    suspectedDirections: ["verify"],
    suggestedActions: ["verify"],
    status: "open",
    severity: "medium",
    tags: ["verify"],
    repoSnapshot: repoSnapshot ?? makeRepoSnapshot({ now }),
    relatedFiles: [],
    relatedCommits: [],
    relatedHistoricalIssueIds: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeRecordFixture({ id, issueId, now, overrides = {} } = {}) {
  return {
    id,
    issueId,
    type: "observation",
    rawText: "verify fixture record",
    polishedText: "verify fixture record",
    aiExtractedSignals: [],
    linkedFiles: [],
    linkedCommits: [],
    createdAt: now,
    ...overrides,
  };
}

export function makeArchiveFixture({ issueId, workspaceId, fileName, now, overrides = {} } = {}) {
  return {
    issueId,
    projectId: workspaceId,
    fileName,
    filePath: `.debug_workspace/archive/${fileName}`,
    markdownContent: "# verify fixture\n",
    generatedBy: "manual",
    generatedAt: now,
    ...overrides,
  };
}

export function makeErrorEntryFixture({
  id,
  sourceIssueId,
  workspaceId,
  errorCode,
  archiveFilePath,
  now,
  overrides = {},
} = {}) {
  return {
    id,
    projectId: workspaceId,
    sourceIssueId,
    errorCode,
    title: "verify fixture error entry",
    category: "verify",
    symptom: "verify fixture symptom",
    rootCause: "verify fixture root cause",
    resolution: "verify fixture resolution",
    prevention: "Run verify fixtures regularly.",
    relatedFiles: [],
    relatedCommits: [],
    archiveFilePath,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
