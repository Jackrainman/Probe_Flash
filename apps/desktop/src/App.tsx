import { useEffect, useState } from "react";
import "./App.css";
import type { IssueCard } from "./domain/schemas/issue-card";
import {
  DEFAULT_WORKSPACE,
  DEFAULT_WORKSPACE_ID,
  DEFAULT_WORKSPACE_NAME,
  type Workspace,
} from "./domain/workspace";
import {
  STORAGE_REPOSITORY_RUNTIME,
  checkHttpStorageHealth,
  createStorageRepository,
  type CloseoutRecoveryListResult,
  type CreateWorkspaceResult,
  type HttpStorageHealthStatus,
  type IssueCardListResult,
  type LoadIssueCardResult,
  type InvestigationRecordListResult,
  type StorageRepository,
  type WorkspaceListResult,
} from "./storage/storage-repository";
import { loadArchiveIndex, type ArchiveIndex } from "./storage/archive-index";
import {
  findSimilarIssuesForIssue,
  type SimilarIssuesResult,
} from "./search/similar-issues";
import {
  addRelatedHistoricalIssue,
  removeRelatedHistoricalIssue,
} from "./search/related-historical-issues";
import {
  getBrowserRecentIssueStorage,
  rememberRecentIssueForReopen,
  resolveRecentIssueReopen,
  type RecentIssueReopenState,
} from "./storage/recent-issue-reopen";
import {
  buildRecurrencePrompt,
} from "./search/recurrence-prompt";
import { IssueMainFlow, KnowledgeAssistPanel } from "./IssueWorkflowSections";
import { WorkspaceChrome } from "./WorkspaceChrome";
import {
  CLOSEOUT_FORM_ID,
  CloseoutForm,
  type CloseoutSummary,
} from "./components/closeout/CloseoutForm";
import {
  ArchivedCloseoutSummary,
  type ArchivedCloseoutDisplayData,
} from "./components/closeout/ArchivedCloseoutSummary";
import {
  InvestigationAppendForm,
  InvestigationRecordListView,
} from "./components/investigation/InvestigationComponents";
import {
  RecurrencePromptPanel,
  RelatedHistoricalIssuesPanel,
  SearchPanel,
  SimilarIssuesPanel,
} from "./components/knowledge/KnowledgePanels";
import {
  IssueCardListView,
  QuickIssueCreateBar,
} from "./components/issue/IssueEntryComponents";
import { MainlineResultPanel } from "./components/issue/MainlineResultPanel";
import { CloseoutRecoveryPanel } from "./components/closeout/CloseoutRecoveryPanel";
import { formatTags, labelIssueStatus } from "./components/issue/issueUiHelpers";
import {
  CHECKING_STORAGE_CONNECTION_STATE,
  LOCAL_STORAGE_CONNECTION_STATE,
  createInvalidDataStorageFeedbackError,
  createOnlineStorageConnectionState,
  describeStorageConnectionState,
  formatStorageFeedbackError,
  healthCheckErrorToFeedback,
  loadIssueCardFailureToFeedback,
  storageReadErrorToFeedback,
  storageWriteErrorToFeedback,
  type StorageConnectionState,
  type StorageFeedbackError,
} from "./storage/storage-feedback";

const SAMPLE_ISSUE_ID = "sample-issue-0001";
const SAMPLE_TIMESTAMP = "2026-04-21T02:30:00+08:00";

const DEFAULT_WORKSPACE_SUMMARY: Workspace = {
  ...DEFAULT_WORKSPACE,
  createdAt: SAMPLE_TIMESTAMP,
  updatedAt: SAMPLE_TIMESTAMP,
};

const SAMPLE_CARD: IssueCard = {
  id: SAMPLE_ISSUE_ID,
  projectId: DEFAULT_WORKSPACE_ID,
  title: "示例问题卡：启动日志停在握手阶段",
  rawInput: "用于演示 HTTP 存储链路保存与读回的示例问题卡。",
  normalizedSummary: "验证问题卡可以经 /api 写入本地 WSL backend，并通过结构校验读回。",
  symptomSummary: "演示数据：启动流程卡在握手阶段，尚未绑定真实硬件日志。",
  suspectedDirections: ["HTTP 存储适配链路"],
  suggestedActions: [
    "点击“保存示例卡”经 /api 写入本地 WSL backend。",
    "点击“读取示例卡”执行结构化读回。",
  ],
  status: "open",
  severity: "low",
  tags: ["示例", "HTTP 存储"],
  repoSnapshot: {
    branch: "master",
    headCommitHash: "0000000000000000000000000000000000000000",
    headCommitMessage: "fixture snapshot",
    hasUncommittedChanges: false,
    changedFiles: [],
    recentCommits: [],
    capturedAt: SAMPLE_TIMESTAMP,
  },
  relatedFiles: [],
  relatedCommits: [],
  relatedHistoricalIssueIds: [],
  createdAt: SAMPLE_TIMESTAMP,
  updatedAt: SAMPLE_TIMESTAMP,
};

function sampleIssueIdForWorkspace(workspaceId: string): string {
  const safeWorkspaceId = workspaceId
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${SAMPLE_ISSUE_ID}-${safeWorkspaceId || "workspace"}`;
}

function buildSampleCard(workspaceId: string): IssueCard {
  return {
    ...SAMPLE_CARD,
    id: sampleIssueIdForWorkspace(workspaceId),
    projectId: workspaceId,
  };
}

function RepairTaskPanel({
  repairTask,
}: {
  repairTask: NonNullable<StorageFeedbackError["repairTask"]>;
}) {
  return (
    <aside className="repair-task-panel" data-testid="repair-task-panel">
      <div className="repair-task-header">
        <span>只读 Repair Task</span>
        <strong>{repairTask.problemType}</strong>
      </div>
      <p className="repair-task-risk">风险：{repairTask.risk}</p>
      <div className="repair-task-grid">
        <div>
          <span className="repair-task-label">受影响实体</span>
          <ul>
            {repairTask.affectedEntities.map((entity) => (
              <li key={`${entity.entityType}:${entity.entityId}`}>
                {entity.entityType} / {entity.entityId}
                {entity.description ? `（${entity.description}）` : ""}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <span className="repair-task-label">建议修复步骤</span>
          <ol>
            {repairTask.suggestedRepairSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </div>
      <p className="repair-task-check">
        人工确认：{repairTask.requiresManualConfirmation ? "需要" : "不需要"}；验证方式：{repairTask.verification}
      </p>
    </aside>
  );
}

type SaveStatus =
  | { state: "idle" }
  | { state: "saved"; at: string }
  | { state: "error"; reason: string };

function StorageStatusBanner({
  connectionState,
  error,
  healthStatus,
  activeWorkspace,
  workspaceList,
}: {
  connectionState: StorageConnectionState;
  error: StorageFeedbackError | null;
  healthStatus: HttpStorageHealthStatus | null;
  activeWorkspace: Workspace;
  workspaceList: WorkspaceListResult | null;
}) {
  const workspaceListStatus = describeWorkspaceListStatus(workspaceList);
  const healthDetail = healthStatus
    ? [
        healthStatus.serverReady ? "服务就绪" : "服务未就绪",
        `${healthStatus.storageKind} ${healthStatus.storageReady ? "就绪" : "未就绪"}`,
        healthStatus.releaseVersion
          ? `版本=${healthStatus.releaseVersion} / ${healthStatus.releaseTag ?? "no tag"}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <section
      className={`storage-feedback-banner${error === null ? "" : " storage-feedback-banner-error"}`}
      data-testid="storage-feedback-banner"
      data-connection-state={connectionState.state}
    >
      <div className="storage-feedback-row">
        <span className="storage-feedback-label">项目与存储状态</span>
        <span className="storage-feedback-connection">
          {describeStorageConnectionState(connectionState)}
        </span>
      </div>
      <div className="project-context-summary" data-testid="project-context-summary">
        <div className="project-context-identity">
          <span className="project-context-eyebrow">当前数据归属</span>
          <strong>{activeWorkspace.name}</strong>
          <span>项目 ID：{activeWorkspace.id}</span>
        </div>
        <p className="project-context-state" data-testid="workspace-list-state">
          {workspaceListStatus}
        </p>
      </div>
      <p className="storage-feedback-message" data-testid="storage-feedback-message">
        {renderProjectStorageMessage(connectionState, error, activeWorkspace)}
      </p>
      {healthDetail && error === null ? (
        <p className="storage-feedback-detail" data-testid="storage-health-detail">
          {healthDetail}
        </p>
      ) : null}
      {error?.repairTask ? <RepairTaskPanel repairTask={error.repairTask} /> : null}
    </section>
  );
}

function describeWorkspaceListStatus(
  workspaceList: WorkspaceListResult | null,
): string {
  if (workspaceList === null) {
    return "项目列表读取中。";
  }
  if (workspaceList.readError !== null) {
    return "项目列表读取失败，请修复存储状态后重试。";
  }
  const invalidNote = workspaceList.invalid.length > 0
    ? `，${workspaceList.invalid.length} 个异常项目已跳过`
    : "";
  return `可切换项目 ${workspaceList.valid.length} 个${invalidNote}。`;
}

function renderProjectStorageMessage(
  connectionState: StorageConnectionState,
  error: StorageFeedbackError | null,
  activeWorkspace: Workspace,
): string {
  if (error !== null) {
    return `${formatStorageFeedbackError(error)} 当前项目「${activeWorkspace.name}」读写可能受影响；请按提示修复后刷新或重试。`;
  }
  if (connectionState.state === "checking") {
    return "正在检查 /api 与长期存储状态…";
  }
  return "HTTP + SQLite 可读写。";
}

function IssueStorageControls({
  repository,
  workspaceId,
  reportStorageError,
  clearStorageFeedback,
}: {
  repository: StorageRepository;
  workspaceId: string;
  reportStorageError: (error: StorageFeedbackError) => void;
  clearStorageFeedback: () => void;
}) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: "idle" });
  const [loadResult, setLoadResult] = useState<LoadIssueCardResult | null>(null);

  const handleSave = async () => {
    const saved = await repository.issueCards.save(buildSampleCard(workspaceId));
    if (!saved.ok) {
      reportStorageError(storageWriteErrorToFeedback("demo", "create_issue", saved.error));
      setSaveStatus({
        state: "error",
        reason: "请查看顶部统一存储提示",
      });
      return;
    }
    clearStorageFeedback();
    setSaveStatus({ state: "saved", at: new Date().toISOString() });
  };

  const handleLoad = async () => {
    const loaded = await repository.issueCards.load(sampleIssueIdForWorkspace(workspaceId));
    setLoadResult(loaded);
    if (!loaded.ok) {
      reportStorageError(loadIssueCardFailureToFeedback("demo", loaded.error));
      return;
    }
    clearStorageFeedback();
  };

  return (
    <div className="storage-controls" data-testid="issue-storage-controls">
      <div className="form-caption form-caption-muted">
        <h3>辅助验证（仅测试）</h3>
        <p>保存/读取示例卡。</p>
      </div>
      <div className="storage-buttons">
        <button type="button" className="button-secondary" onClick={handleSave}>
          保存示例卡
        </button>
        <button type="button" className="button-secondary" onClick={handleLoad}>
          读取示例卡
        </button>
      </div>
      <p className="storage-line" data-testid="save-status">
        保存状态：{renderSaveStatus(saveStatus)}
      </p>
      <p className="storage-line" data-testid="load-status">
        读取状态：{renderLoadStatus(loadResult)}
      </p>
    </div>
  );
}

function renderSaveStatus(status: SaveStatus): string {
  switch (status.state) {
    case "idle":
      return "尚未保存";
    case "saved":
      return `已保存 · ${status.at}`;
    case "error":
      return `保存失败：${status.reason}`;
  }
}

function IssuePane({
  repository,
  activeWorkspace,
  externalSelectedIssueId,
  onCloseoutResult,
  onSelectedIssueChange,
  reportStorageError,
  clearStorageFeedback,
}: {
  repository: StorageRepository;
  activeWorkspace: Workspace;
  externalSelectedIssueId: string | null;
  onCloseoutResult: (summary: CloseoutSummary) => void;
  onSelectedIssueChange: (id: string | null) => void;
  reportStorageError: (error: StorageFeedbackError) => void;
  clearStorageFeedback: () => void;
}) {
  const [cardList, setCardList] = useState<IssueCardListResult | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<IssueCard | null>(null);
  const [recordList, setRecordList] = useState<InvestigationRecordListResult | null>(null);
  const [lastCloseout, setLastCloseout] = useState<CloseoutSummary | null>(null);
  const [archivedCloseoutData, setArchivedCloseoutData] = useState<ArchivedCloseoutDisplayData | null>(null);
  const [isUnarchivingIssue, setIsUnarchivingIssue] = useState(false);
  const [similarIssues, setSimilarIssues] = useState<SimilarIssuesResult | null>(null);
  const [isLoadingSimilarIssues, setIsLoadingSimilarIssues] = useState<boolean>(false);
  const [recentIssueReopenState, setRecentIssueReopenState] = useState<RecentIssueReopenState>({
    state: "checking",
  });
  const [dismissedRecurrencePrompt, setDismissedRecurrencePrompt] = useState<{
    currentIssueId: string;
    historicalIssueId: string;
  } | null>(null);
  const [closeoutRecovery, setCloseoutRecovery] = useState<CloseoutRecoveryListResult | null>(null);

  const recentIssueStorage = getBrowserRecentIssueStorage();

  const refreshCloseoutRecovery = async () => {
    const result = await repository.closeoutRecovery.list();
    setCloseoutRecovery(result);
    if (result.readError !== null) {
      reportStorageError(
        storageReadErrorToFeedback("issue_list", "list_closeout_recovery", result.readError),
      );
    }
  };

  const handleClearCloseoutRecovery = async (issueId: string) => {
    const result = await repository.closeoutRecovery.clear(issueId);
    if (!result.ok) {
      reportStorageError(
        storageWriteErrorToFeedback("issue_list", "clear_closeout_recovery", result.error),
      );
      return;
    }
    clearStorageFeedback();
    await refreshCloseoutRecovery();
  };

  const refreshCardList = async (options: { restoreRecent?: boolean } = {}) => {
    const shouldRestoreRecent = options.restoreRecent ?? true;
    const result = await repository.issueCards.list();
    setCardList(result);
    if (result.readError !== null) {
      setRecentIssueReopenState({ state: "unavailable" });
      reportStorageError(storageReadErrorToFeedback("issue_list", "list_issues", result.readError));
      return;
    }
    if (result.invalid.length > 0) {
      reportStorageError(
        createInvalidDataStorageFeedbackError(
          "issue_list",
          "list_issues",
          `问题卡列表中有 ${result.invalid.length} 条异常数据，已跳过。`,
          "issue_card",
        ),
      );
      return;
    }
    clearStorageFeedback();
    if (shouldRestoreRecent && selectedIssueId === null && externalSelectedIssueId === null) {
      const resolved = resolveRecentIssueReopen(recentIssueStorage, activeWorkspace.id, result.valid);
      setRecentIssueReopenState(resolved.state);
      if (resolved.issueIdToOpen !== null) {
        setSelectedIssueId(resolved.issueIdToOpen);
        onSelectedIssueChange(resolved.issueIdToOpen);
        void reloadSelectedCard(resolved.issueIdToOpen, { recentState: "restored" });
        void loadRecordList(resolved.issueIdToOpen);
        setLastCloseout(null);
        setSimilarIssues(null);
        setDismissedRecurrencePrompt(null);
      }
    }
  };

  useEffect(() => {
    void refreshCardList({ restoreRecent: true });
    void refreshCloseoutRecovery();
  }, []);

  const reloadSelectedCard = async (
    id: string,
    options: { recentState?: "recorded" | "restored" | null } = {},
  ) => {
    const loaded = await repository.issueCards.load(id);
    setSelectedCard(loaded.ok ? loaded.card : null);
    if (!loaded.ok) {
      reportStorageError(loadIssueCardFailureToFeedback("issue_detail", loaded.error));
      return;
    }
    const nextRecentState = rememberRecentIssueForReopen(
      recentIssueStorage,
      activeWorkspace.id,
      loaded.card,
    );
    setRecentIssueReopenState(
      nextRecentState.state === "recorded" && options.recentState === "restored"
        ? { state: "restored", issueId: loaded.card.id }
        : nextRecentState,
    );
    clearStorageFeedback();
  };

  const loadRecordList = async (issueId: string) => {
    const result = await repository.investigationRecords.listByIssueId(issueId);
    setRecordList(result);
    if (result.readError !== null) {
      reportStorageError(
        storageReadErrorToFeedback("investigation_list", "list_records", result.readError),
      );
      return;
    }
    if (result.invalid.length > 0) {
      reportStorageError(
        createInvalidDataStorageFeedbackError(
          "investigation_list",
          "list_records",
          `排查时间线里有 ${result.invalid.length} 条异常数据，已跳过。`,
          "investigation_record",
        ),
      );
      return;
    }
    clearStorageFeedback();
  };

  const loadSimilarIssues = async (card: IssueCard) => {
    setIsLoadingSimilarIssues(true);
    const result = await findSimilarIssuesForIssue(repository, card);
    setSimilarIssues(result);
    setIsLoadingSimilarIssues(false);
    if (result.readError !== null) {
      reportStorageError(
        storageReadErrorToFeedback("knowledge_search", "search", result.readError),
      );
    }
  };

  const refreshRecordList = () => {
    if (selectedIssueId === null) {
      setRecordList(null);
      return;
    }
    void loadRecordList(selectedIssueId);
  };

  const handleSelect = (id: string) => {
    setSelectedIssueId(id);
    onSelectedIssueChange(id);
    void reloadSelectedCard(id, { recentState: "recorded" });
    void loadRecordList(id);
    setLastCloseout(null);
    setArchivedCloseoutData(null);
    setIsUnarchivingIssue(false);
  };

  const loadArchivedCloseoutData = async (issueId: string) => {
    const errorList = await repository.errorEntries.list();
    const entry = errorList.valid.find((e) => e.sourceIssueId === issueId);
    if (entry) {
      setArchivedCloseoutData({
        errorCode: entry.errorCode,
        archivedAt: entry.createdAt,
        category: entry.category,
        rootCause: entry.rootCause,
        resolution: entry.resolution,
        prevention: entry.prevention,
        tags: entry.tags ?? [],
      });
    } else {
      setArchivedCloseoutData(null);
    }
  };

  useEffect(() => {
    if (externalSelectedIssueId === null || externalSelectedIssueId === selectedIssueId) {
      return;
    }
    handleSelect(externalSelectedIssueId);
  }, [externalSelectedIssueId]);

  useEffect(() => {
    if (selectedCard === null) {
      setSimilarIssues(null);
      setIsLoadingSimilarIssues(false);
      setArchivedCloseoutData(null);
      return;
    }
    void loadSimilarIssues(selectedCard);
  }, [selectedCard?.id, selectedCard?.updatedAt, repository]);

  useEffect(() => {
    if (selectedCard === null || selectedCard.status !== "archived") {
      setArchivedCloseoutData(null);
      return;
    }
    void loadArchivedCloseoutData(selectedCard.id);
  }, [selectedCard?.id, selectedCard?.status]);

  const handleCreateNew = () => {
    setSelectedIssueId(null);
    onSelectedIssueChange(null);
    setSelectedCard(null);
    setRecordList(null);
    setLastCloseout(null);
    setArchivedCloseoutData(null);
    setIsUnarchivingIssue(false);
    setSimilarIssues(null);
    setDismissedRecurrencePrompt(null);
  };

  const handleCardCreated = (id: string) => {
    void refreshCardList({ restoreRecent: false });
    setSelectedIssueId(id);
    onSelectedIssueChange(id);
    void reloadSelectedCard(id, { recentState: "recorded" });
    void loadRecordList(id);
    setLastCloseout(null);
    setArchivedCloseoutData(null);
    setIsUnarchivingIssue(false);
    setSimilarIssues(null);
    setDismissedRecurrencePrompt(null);
  };

  const handleRecordAppended = () => {
    refreshRecordList();
  };

  const handleIssueClosed = (summary: CloseoutSummary) => {
    setLastCloseout(summary);
    onCloseoutResult(summary);
    void refreshCardList({ restoreRecent: false });
    void refreshCloseoutRecovery();
    void loadRecordList(summary.issueId);
    void reloadSelectedCard(summary.issueId, { recentState: null });
  };

  const saveSelectedCardUpdate = async (updatedCard: IssueCard) => {
    const saved = await repository.issueCards.save(updatedCard);
    if (!saved.ok) {
      reportStorageError(
        storageWriteErrorToFeedback("issue_detail", "create_issue", saved.error),
      );
      return false;
    }
    setSelectedCard(updatedCard);
    void refreshCardList({ restoreRecent: false });
    clearStorageFeedback();
    return true;
  };

  const handleUnarchiveIssue = async () => {
    if (selectedCard === null || selectedCard.status !== "archived") return;
    setIsUnarchivingIssue(true);
    const updatedCard: IssueCard = {
      ...selectedCard,
      status: "investigating",
      updatedAt: new Date().toISOString(),
    };
    const saved = await saveSelectedCardUpdate(updatedCard);
    setIsUnarchivingIssue(false);
    if (!saved) return;
    setLastCloseout(null);
    setArchivedCloseoutData(null);
    void loadRecordList(updatedCard.id);
  };

  const handleLinkHistoricalIssue = (issueId: string) => {
    if (selectedCard === null) return;
    const updatedCard = addRelatedHistoricalIssue(selectedCard, issueId, new Date().toISOString());
    if (
      updatedCard.updatedAt === selectedCard.updatedAt &&
      updatedCard.relatedHistoricalIssueIds.join("\0") === selectedCard.relatedHistoricalIssueIds.join("\0")
    ) {
      return;
    }
    void saveSelectedCardUpdate(updatedCard);
  };

  const handleUnlinkHistoricalIssue = (issueId: string) => {
    if (selectedCard === null) return;
    const updatedCard = removeRelatedHistoricalIssue(selectedCard, issueId, new Date().toISOString());
    if (
      updatedCard.updatedAt === selectedCard.updatedAt &&
      updatedCard.relatedHistoricalIssueIds.join("\0") === selectedCard.relatedHistoricalIssueIds.join("\0")
    ) {
      return;
    }
    void saveSelectedCardUpdate(updatedCard);
  };

  const recordCount = recordList?.valid.length ?? 0;
  const relatedHistoricalIssueIds = selectedCard?.relatedHistoricalIssueIds ?? [];
  const ignoredRecurrenceIssueIds =
    dismissedRecurrencePrompt !== null && dismissedRecurrencePrompt.currentIssueId === selectedIssueId
      ? [dismissedRecurrencePrompt.historicalIssueId]
      : [];
  const recurrencePrompt = buildRecurrencePrompt(similarIssues, ignoredRecurrenceIssueIds);

  return (
    <div className="issue-pane-stack">
      <CloseoutRecoveryPanel
        result={closeoutRecovery}
        onClear={handleClearCloseoutRecovery}
        onRefresh={refreshCloseoutRecovery}
      />
      <div className="issue-workbench">
        <aside className="issue-rail" aria-label="问题卡选择区">
          <IssueCardListView
            result={cardList}
            selectedIssueId={selectedIssueId}
            recentIssueReopenState={recentIssueReopenState}
            onCreateNew={handleCreateNew}
            onRefresh={refreshCardList}
            onSelect={handleSelect}
          />
        </aside>
        <IssueMainFlow
          selectedIssueId={selectedIssueId}
          quickIssueEntry={(
            <QuickIssueCreateBar
              key={activeWorkspace.id}
              repository={repository}
              workspaceId={activeWorkspace.id}
              onCreated={handleCardCreated}
              reportStorageError={reportStorageError}
              clearStorageFeedback={clearStorageFeedback}
            />
          )}
          mainlinePanel={(
            <MainlineResultPanel
              selectedCard={selectedCard}
              recordCount={recordCount}
              lastCloseout={lastCloseout}
            />
          )}
          investigationAppendForm={selectedIssueId !== null ? (
            <InvestigationAppendForm
              key={`investigation:${activeWorkspace.id}:${selectedIssueId}`}
              repository={repository}
              workspaceId={activeWorkspace.id}
              issueId={selectedIssueId}
              isArchived={selectedCard?.status === "archived"}
              onAppended={handleRecordAppended}
              reportStorageError={reportStorageError}
              clearStorageFeedback={clearStorageFeedback}
            />
          ) : null}
          investigationRecordList={(
            <InvestigationRecordListView
              result={recordList}
              onRefresh={refreshRecordList}
            />
          )}
          closeoutForm={selectedIssueId !== null && selectedCard?.status === "archived" && archivedCloseoutData !== null ? (
            <ArchivedCloseoutSummary
              data={archivedCloseoutData}
              onUnarchive={handleUnarchiveIssue}
              isUnarchiving={isUnarchivingIssue}
            />
          ) : selectedIssueId !== null && selectedCard?.status !== "archived" ? (
            <CloseoutForm
              key={`closeout:${activeWorkspace.id}:${selectedIssueId}`}
              repository={repository}
              workspaceId={activeWorkspace.id}
              issueId={selectedIssueId}
              issueCard={selectedCard}
              records={recordList?.valid ?? []}
              onClosed={handleIssueClosed}
              reportStorageError={reportStorageError}
              clearStorageFeedback={clearStorageFeedback}
            />
          ) : null}
          issueStorageControls={(
            <IssueStorageControls
              repository={repository}
              workspaceId={activeWorkspace.id}
              reportStorageError={reportStorageError}
              clearStorageFeedback={clearStorageFeedback}
            />
          )}
        />
        <aside className="knowledge-assist-rail" aria-label="Knowledge Assist supporting 区">
          <KnowledgeAssistPanel
            recurrencePromptPanel={selectedIssueId !== null && !isLoadingSimilarIssues ? (
              <RecurrencePromptPanel
                prompt={recurrencePrompt}
                relatedHistoricalIssueIds={relatedHistoricalIssueIds}
                onOpenIssue={handleSelect}
                onLinkHistoricalIssue={handleLinkHistoricalIssue}
                onDismiss={() => {
                  if (selectedIssueId !== null && recurrencePrompt !== null) {
                    setDismissedRecurrencePrompt({
                      currentIssueId: selectedIssueId,
                      historicalIssueId: recurrencePrompt.issueId,
                    });
                  }
                }}
              />
            ) : null}
            relatedHistoricalIssuesPanel={(
              <RelatedHistoricalIssuesPanel
                issue={selectedCard}
                onOpenIssue={handleSelect}
                onUnlinkHistoricalIssue={handleUnlinkHistoricalIssue}
              />
            )}
            similarIssuesPanel={selectedIssueId !== null ? (
              <SimilarIssuesPanel
                result={similarIssues}
                isLoading={isLoadingSimilarIssues}
                currentIssueId={selectedIssueId}
                relatedHistoricalIssueIds={relatedHistoricalIssueIds}
                onOpenIssue={handleSelect}
                onLinkHistoricalIssue={handleLinkHistoricalIssue}
              />
            ) : null}
            searchPanel={(
              <SearchPanel
                repository={repository}
                currentIssueId={selectedIssueId}
                relatedHistoricalIssueIds={relatedHistoricalIssueIds}
                onOpenIssue={handleSelect}
                onLinkHistoricalIssue={handleLinkHistoricalIssue}
                reportStorageError={reportStorageError}
                clearStorageFeedback={clearStorageFeedback}
              />
            )}
          />
        </aside>
      </div>
    </div>
  );
}

function renderLoadStatus(result: LoadIssueCardResult | null): string {
  if (result === null) return "尚未读取";
  if (result.ok) {
    return `读取成功 · ${result.card.id} · ${result.card.title} · ${labelIssueStatus(result.card.status)}`;
  }
  return "读取失败：请查看顶部统一存储提示";
}

type Pane = {
  id: "project" | "issue" | "archive";
  title: string;
  badge: string;
  hint: string;
  status: string;
  bullets: string[];
};

const PANES: Pane[] = [
  {
    id: "project",
    title: "项目区",
    badge: "上下文",
    hint: "选择或创建调试项目。",
    status: "项目列表 / 创建：HTTP + SQLite",
    bullets: [
      `默认工作区：${DEFAULT_WORKSPACE_NAME} 保留`,
      "新项目：创建成功后自动切换",
      "仓库快照：后续接入 Git",
      "文件写盘：后续接入 .debug_workspace",
    ],
  },
  {
    id: "issue",
    title: "问题卡区",
    badge: "主流程",
    hint: "建卡、追记、结案。",
    status: "问题卡 / 排查记录 / 结案归档：HTTP + SQLite",
    bullets: [],
  },
  {
    id: "archive",
    title: "归档区",
    badge: "沉淀物",
    hint: "结案后的归档资产。",
    status: "归档摘要 / 错误表：SQLite",
    bullets: [
      "归档文档：结案摘要（SQLite）",
      "错误表条目：复发检索入口（SQLite）",
      "后续：.debug_workspace 文件双写",
    ],
  },
];

function StaticPaneShell({ pane }: { pane: Pane }) {
  return (
    <div className="demo-shell">
      <div className="demo-status-row">
        <span className="demo-status-label">当前状态</span>
        <p className="pane-status">{pane.status}</p>
      </div>
      <ul className="demo-list">
        {pane.bullets.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function ArchivePaneShell({
  pane,
  archiveIndex,
  onOpenList,
}: {
  pane: Pane;
  archiveIndex: ArchiveIndex;
  onOpenList?: () => void;
}) {
  const latest = archiveIndex.items[0] ?? null;
  const total = archiveIndex.items.length;
  return (
    <div className="archive-pane-stack" data-testid="archive-panel">
      <StaticPaneShell pane={pane} />
      {onOpenList !== undefined && (
        <div className="archive-summary-row" data-testid="archive-summary-row">
          <span
            className="archive-count-chip"
            data-testid="archive-count-chip"
            data-total={total}
          >
            累计归档 {total} 条
          </span>
          <button
            type="button"
            className="button-secondary"
            onClick={onOpenList}
            disabled={total === 0}
            data-testid="archive-open-list-button"
          >
            查看归档列表
          </button>
        </div>
      )}
      {archiveIndex.invalidCount > 0 && (
        <p className="storage-line" data-testid="archive-invalid-note">
          有 {archiveIndex.invalidCount} 条归档相关异常数据已跳过；详细原因见顶部统一存储提示。
        </p>
      )}
      {latest === null ? (
        <p className="empty-state archive-empty-state" data-testid="archive-empty-state">
          尚无归档结果。结案后显示累计数量和最近摘要。
        </p>
      ) : (
        <section className="archive-result-panel" data-testid="archive-result-panel">
          <header className="archive-result-header">
            <span className="archive-result-badge">最近一次</span>
            <h3>最近一次归档摘要</h3>
          </header>
          <p className="archive-result-status" data-testid="archive-result-status">
            ArchiveDocument / ErrorEntry 已写入 SQLite。
          </p>
          <dl className="archive-result-fields">
            <div>
              <dt>归档摘要</dt>
              <dd>{latest.fileName}</dd>
            </div>
            <div>
              <dt>错误表编号</dt>
              <dd>{latest.errorCode ?? "(未记录)"}</dd>
            </div>
            <div>
              <dt>来源问题</dt>
              <dd>{latest.issueId}</dd>
            </div>
            <div>
              <dt>分类</dt>
              <dd>{latest.category ?? "(未记录)"}</dd>
            </div>
            <div>
              <dt>标签</dt>
              <dd>{formatTags(latest.tags)}</dd>
            </div>
            <div>
              <dt>归档时间</dt>
              <dd>{latest.generatedAt}</dd>
            </div>
          </dl>
          <p className="archive-result-note">
            文件写盘未接入：{latest.filePath}
          </p>
        </section>
      )}
    </div>
  );
}

export function ArchiveListDrawer({
  open,
  archivePane,
  archiveIndex,
  onClose,
  onOpenIssue,
}: {
  open: boolean;
  archivePane: Pane;
  archiveIndex: ArchiveIndex;
  onClose: () => void;
  onOpenIssue?: (issueId: string) => void;
}) {
  const { items } = archiveIndex;
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedFilePath((current) => {
      if (current !== null && items.some((item) => item.filePath === current)) {
        return current;
      }
      return items[0]?.filePath ?? null;
    });
  }, [open, items]);

  if (!open) return null;
  const selectedItem = items.find((item) => item.filePath === selectedFilePath) ?? items[0] ?? null;

  const handleOpenIssue = (issueId: string) => {
    onOpenIssue?.(issueId);
  };

  return (
    <div
      className="archive-drawer-overlay"
      data-testid="archive-drawer"
      role="dialog"
      aria-label="归档列表"
      onClick={onClose}
    >
      <div
        className="archive-drawer"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="archive-drawer-header">
          <div className="archive-drawer-title">
            <h3>归档区</h3>
            <span className="archive-drawer-count">共 {items.length} 条（按归档时间倒序）</span>
          </div>
          <button
            type="button"
            className="button-secondary"
            onClick={onClose}
            data-testid="archive-drawer-close"
          >
            关闭
          </button>
        </header>
        <ArchivePaneShell pane={archivePane} archiveIndex={archiveIndex} />
        {items.length > 0 && (
          <div className="archive-review-layout" data-testid="archive-review-page">
            <div className="archive-drawer-section">
              <div className="archive-drawer-section-label">全部归档条目</div>
              <ul className="archive-drawer-list" data-testid="archive-drawer-list">
                {items.map((item) => {
                  const selected = selectedItem?.filePath === item.filePath;
                  return (
                    <li key={item.filePath} className="archive-drawer-item">
                      <button
                        type="button"
                        className="archive-drawer-item-button"
                        aria-current={selected ? "true" : undefined}
                        data-selected={selected ? "true" : "false"}
                        onClick={() => setSelectedFilePath(item.filePath)}
                        data-testid="archive-review-select"
                      >
                        <span className="archive-drawer-item-row">
                          <span className="archive-drawer-file">{item.fileName}</span>
                          <span className="archive-drawer-time">{item.generatedAt}</span>
                        </span>
                        <span className="archive-drawer-item-hint">
                          {item.errorCode ?? "未绑定错误表"} · {formatTags(item.tags)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            {selectedItem !== null && (
              <section className="archive-review-panel" data-testid="archive-review-panel">
                <div className="archive-drawer-section-label">归档复盘预览</div>
                <div className="archive-review-actions">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => handleOpenIssue(selectedItem.issueId)}
                    data-testid="archive-review-open-issue"
                  >
                    打开来源问题
                  </button>
                </div>
                <dl className="archive-drawer-meta archive-review-meta">
                  <div>
                    <dt>来源问题</dt>
                    <dd>{selectedItem.issueId}</dd>
                  </div>
                  <div>
                    <dt>错误表编号</dt>
                    <dd>{selectedItem.errorCode ?? "(未记录)"}</dd>
                  </div>
                  <div>
                    <dt>错误表条目</dt>
                    <dd data-testid="archive-review-error-entry-link">{selectedItem.errorEntryId ?? "(未记录)"}</dd>
                  </div>
                  <div>
                    <dt>分类</dt>
                    <dd>{selectedItem.category ?? "(未记录)"}</dd>
                  </div>
                  <div>
                    <dt>标签</dt>
                    <dd>{formatTags(selectedItem.tags)}</dd>
                  </div>
                  <div>
                    <dt>后续写盘位置</dt>
                    <dd>{selectedItem.filePath}</dd>
                  </div>
                </dl>
                <pre className="archive-review-markdown" data-testid="archive-review-markdown">{selectedItem.markdownContent}</pre>
              </section>
            )}
          </div>
        )}
        <p className="archive-drawer-note">
          当前归档来自本地 WSL 后端 SQLite，不是 .debug_workspace 文件写盘；接入 Electron / fs 后这里会补真实文件路径。
        </p>
      </div>
    </div>
  );
}

type WorkspaceCreateStatus =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved"; id: string }
  | { state: "error"; reason: string };

function renderWorkspaceCreateStatus(status: WorkspaceCreateStatus): string {
  switch (status.state) {
    case "idle":
      return "输入名称后创建";
    case "saving":
      return "正在创建并写入服务器";
    case "saved":
      return `已创建并切换 · ${status.id}`;
    case "error":
      return `项目创建失败：${status.reason}；确认上方项目与存储状态后可重试`;
  }
}

function mergeWorkspaceItems(
  result: WorkspaceListResult | null,
  activeWorkspace: Workspace,
): Workspace[] {
  const items = result?.valid ?? [];
  if (items.some((workspace) => workspace.id === activeWorkspace.id)) {
    return items;
  }
  return [activeWorkspace, ...items];
}

function ProjectSelector({
  pane,
  open,
  activeWorkspace,
  workspaceList,
  onToggle,
  onClose,
  onRefreshWorkspaces,
  onSelectWorkspace,
  onCreateWorkspace,
}: {
  pane: Pane;
  open: boolean;
  activeWorkspace: Workspace;
  workspaceList: WorkspaceListResult | null;
  onToggle: () => void;
  onClose: () => void;
  onRefreshWorkspaces: () => void;
  onSelectWorkspace: (workspace: Workspace) => void;
  onCreateWorkspace: (name: string) => Promise<CreateWorkspaceResult>;
}) {
  const [name, setName] = useState<string>("");
  const [createStatus, setCreateStatus] = useState<WorkspaceCreateStatus>({ state: "idle" });
  const workspaces = mergeWorkspaceItems(workspaceList, activeWorkspace);
  const workspaceListReadFailed = workspaceList?.readError !== null && workspaceList?.readError !== undefined;
  const workspaceListEmpty = workspaceList !== null && workspaceList.readError === null && workspaceList.valid.length === 0;

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      setCreateStatus({ state: "error", reason: "项目名称不能为空" });
      return;
    }
    setCreateStatus({ state: "saving" });
    const result = await onCreateWorkspace(trimmedName);
    if (!result.ok) {
      setCreateStatus({ state: "error", reason: "请查看上方项目与存储状态" });
      return;
    }
    setName("");
    setCreateStatus({ state: "saved", id: result.workspace.id });
  };

  return (
    <div className="project-selector" data-testid="project-selector">
      <button
        type="button"
        className="project-entry-button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="project-selector-popover"
        data-testid="project-selector-button"
      >
        <span className="header-entry-icon" aria-hidden="true">📁</span>
        <span className="header-entry-label project-entry-label">
          <span className="project-entry-kicker">当前项目</span>
          <span>{activeWorkspace.name}</span>
        </span>
        <span className="project-entry-id">{activeWorkspace.id}</span>
        <span className="project-entry-caret" aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div
          id="project-selector-popover"
          className="project-selector-popover"
          data-testid="project-selector-popover"
          role="dialog"
          aria-label="项目详情"
        >
          <div className="project-selector-popover-header">
            <h3>{pane.title}</h3>
            <button
              type="button"
              className="button-secondary"
              onClick={onClose}
              aria-label="关闭项目详情"
            >
              关闭
            </button>
          </div>
          <p className="pane-hint">{pane.hint}</p>
          <section className="project-current-card" data-testid="project-current-card">
            <span className="project-current-label">当前项目</span>
            <strong>{activeWorkspace.name}</strong>
            <span className="project-current-id">{activeWorkspace.id}</span>
            <p className="project-current-note" data-testid="project-current-note">
              切换项目只清空当前选中问题，不删除数据。
            </p>
          </section>
          <div className="project-selector-section">
            <div className="project-selector-section-header">
              <span>可用项目</span>
              <button type="button" className="button-secondary" onClick={onRefreshWorkspaces}>
                刷新
              </button>
            </div>
            {workspaceListReadFailed && (
              <p className="empty-state project-state-warning" data-testid="workspace-list-error">
                项目列表读取失败。确认上方项目与存储状态后刷新。
              </p>
            )}
            {workspaceListEmpty && (
              <p className="empty-state project-state-empty" data-testid="workspace-list-empty">
                暂无可切换项目，当前使用「{activeWorkspace.name}」。
              </p>
            )}
            {workspaceList !== null && workspaceList.invalid.length > 0 && (
              <p className="storage-line">有 {workspaceList.invalid.length} 个异常项目已跳过。</p>
            )}
            <ul className="project-workspace-list" data-testid="workspace-list">
              {workspaces.map((workspace) => {
                const selected = workspace.id === activeWorkspace.id;
                return (
                  <li key={workspace.id}>
                    <button
                      type="button"
                      className="project-workspace-option"
                      data-selected={selected ? "true" : "false"}
                      onClick={() => onSelectWorkspace(workspace)}
                    >
                      <span className="project-workspace-name">
                        {workspace.name}{workspace.isDefault ? "（默认）" : ""}
                      </span>
                      <span className="project-workspace-id">{workspace.id}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <form className="project-create-form" onSubmit={handleCreate} data-testid="workspace-create-form">
            <label className="intake-field">
              <span>创建新项目（创建后自动切换）</span>
              <input
                type="text"
                value={name}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：27年 R1 / 舵轮调试"
              />
              <small className="field-help">
                按赛季、机器人或调试分支区分。
              </small>
            </label>
            <div className="intake-actions">
              <button type="submit" disabled={createStatus.state === "saving"}>
                创建并切换
              </button>
            </div>
            <p className="storage-line workspace-create-status" data-state={createStatus.state} data-testid="workspace-create-status">
              创建状态：{renderWorkspaceCreateStatus(createStatus)}
            </p>
          </form>
        </div>
      )}
    </div>
  );
}

function ArchiveEntryButton({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="archive-entry-button"
      onClick={onClick}
      disabled={count === 0}
      data-testid="archive-open-list-button"
      aria-label="查看归档列表"
    >
      <span className="header-entry-icon" aria-hidden="true">📦</span>
      <span className="header-entry-label">查看归档列表</span>
      <span
        className="archive-entry-count"
        data-testid="archive-count-chip"
        data-total={count}
      >
        {count}
      </span>
    </button>
  );
}

function CloseoutEntryButton({ issueId }: { issueId: string | null }) {
  if (issueId === null) return null;

  const handleClick = () => {
    document.getElementById(CLOSEOUT_FORM_ID)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <button
      type="button"
      className="closeout-entry-button"
      onClick={handleClick}
      data-testid="closeout-header-action"
      aria-label={`结案当前问题 ${issueId}`}
    >
      <span className="header-entry-icon" aria-hidden="true">✅</span>
      <span className="header-entry-label">结案</span>
    </button>
  );
}

export default function App() {
  const [storageConnectionState, setStorageConnectionState] = useState<StorageConnectionState>(
    STORAGE_REPOSITORY_RUNTIME === "http"
      ? CHECKING_STORAGE_CONNECTION_STATE
      : LOCAL_STORAGE_CONNECTION_STATE,
  );
  const [storageFeedbackError, setStorageFeedbackError] = useState<StorageFeedbackError | null>(
    null,
  );
  const [storageHealthStatus, setStorageHealthStatus] = useState<HttpStorageHealthStatus | null>(
    null,
  );
  const [workspaceRepository, setWorkspaceRepository] = useState<StorageRepository>(() =>
    createStorageRepository({ workspaceId: DEFAULT_WORKSPACE_ID }),
  );
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>(DEFAULT_WORKSPACE_SUMMARY);
  const [workspaceList, setWorkspaceList] = useState<WorkspaceListResult | null>(null);
  const [archiveIndex, setArchiveIndex] = useState<ArchiveIndex>({
    items: [],
    invalidCount: 0,
    readErrors: [],
  });
  const [isArchiveListOpen, setIsArchiveListOpen] = useState<boolean>(false);
  const [isProjectEntryOpen, setIsProjectEntryOpen] = useState<boolean>(false);
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);

  const normalizeStorageFeedbackForRuntime = (error: StorageFeedbackError): StorageFeedbackError => {
    if (STORAGE_REPOSITORY_RUNTIME !== "http" || error.connectionState.state !== "local_ready") {
      return error;
    }
    return {
      ...error,
      connectionState:
        storageConnectionState.state === "local_ready"
          ? createOnlineStorageConnectionState()
          : storageConnectionState,
    };
  };

  const reportStorageError = (error: StorageFeedbackError) => {
    const normalizedError = normalizeStorageFeedbackForRuntime(error);
    setStorageConnectionState(normalizedError.connectionState);
    setStorageFeedbackError(normalizedError);
  };

  const clearStorageFeedback = () => {
    setStorageConnectionState(
      STORAGE_REPOSITORY_RUNTIME === "http"
        ? createOnlineStorageConnectionState()
        : LOCAL_STORAGE_CONNECTION_STATE,
    );
    setStorageFeedbackError(null);
  };

  const refreshWorkspaceList = async () => {
    const result = await workspaceRepository.workspaces.list();
    setWorkspaceList(result);
    if (result.readError !== null) {
      reportStorageError(
        storageReadErrorToFeedback("workspace_selector", "list_workspaces", result.readError),
      );
      return;
    }
    if (result.invalid.length > 0) {
      reportStorageError(
        createInvalidDataStorageFeedbackError(
          "workspace_selector",
          "list_workspaces",
          `项目列表中有 ${result.invalid.length} 条异常数据，已跳过。`,
          "workspace",
          createOnlineStorageConnectionState(),
        ),
      );
      return;
    }
    clearStorageFeedback();
  };

  const refreshArchiveIndex = async () => {
    const index = await loadArchiveIndex(workspaceRepository, activeWorkspace.id);
    setArchiveIndex(index);
    if (index.readErrors.length > 0) {
      reportStorageError(storageReadErrorToFeedback("archive_index", "list_archives", index.readErrors[0]!));
      return;
    }
    if (index.invalidCount > 0) {
      reportStorageError(
        createInvalidDataStorageFeedbackError(
          "archive_index",
          "list_archives",
          `归档区有 ${index.invalidCount} 条异常数据，已跳过。`,
          undefined,
          createOnlineStorageConnectionState(),
        ),
      );
      return;
    }
    clearStorageFeedback();
  };

  useEffect(() => {
    if (STORAGE_REPOSITORY_RUNTIME !== "http") {
      return;
    }
    let cancelled = false;
    const checkConnection = async () => {
      setStorageConnectionState(CHECKING_STORAGE_CONNECTION_STATE);
      const result = await checkHttpStorageHealth();
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setStorageHealthStatus(null);
        reportStorageError(healthCheckErrorToFeedback(result.error));
        return;
      }
      setStorageConnectionState(createOnlineStorageConnectionState(result.checkedAt));
      setStorageHealthStatus(result.status);
      setStorageFeedbackError(null);
    };
    void checkConnection();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void refreshWorkspaceList();
  }, []);

  useEffect(() => {
    void refreshArchiveIndex();
  }, [workspaceRepository]);

  const handleWorkspaceSelected = (workspace: Workspace) => {
    setActiveWorkspace(workspace);
    setWorkspaceRepository(createStorageRepository({ workspaceId: workspace.id }));
    setActiveIssueId(null);
    setArchiveIndex({ items: [], invalidCount: 0, readErrors: [] });
    setIsArchiveListOpen(false);
    setIsProjectEntryOpen(false);
    clearStorageFeedback();
  };

  const handleWorkspaceCreate = async (name: string): Promise<CreateWorkspaceResult> => {
    const result = await workspaceRepository.workspaces.create({ name });
    if (!result.ok) {
      reportStorageError(
        storageWriteErrorToFeedback("workspace_selector", "create_workspace", result.error),
      );
      return result;
    }
    handleWorkspaceSelected(result.workspace);
    void refreshWorkspaceList();
    return result;
  };

  const handleCloseoutResult = (_summary: CloseoutSummary) => {
    void refreshArchiveIndex();
  };

  const projectPane = PANES.find((p) => p.id === "project")!;
  const issuePane = PANES.find((p) => p.id === "issue")!;
  const archivePane = PANES.find((p) => p.id === "archive")!;
  const archiveTotal = archiveIndex.items.length;

  return (
    <div className="app-root">
      <WorkspaceChrome
        projectSelector={(
          <ProjectSelector
            pane={projectPane}
            open={isProjectEntryOpen}
            activeWorkspace={activeWorkspace}
            workspaceList={workspaceList}
            onToggle={() => setIsProjectEntryOpen((prev) => !prev)}
            onClose={() => setIsProjectEntryOpen(false)}
            onRefreshWorkspaces={() => void refreshWorkspaceList()}
            onSelectWorkspace={handleWorkspaceSelected}
            onCreateWorkspace={handleWorkspaceCreate}
          />
        )}
        closeoutEntryButton={<CloseoutEntryButton issueId={activeIssueId} />}
        archiveEntryButton={(
          <ArchiveEntryButton
            count={archiveTotal}
            onClick={() => setIsArchiveListOpen(true)}
          />
        )}
        storageStatusBanner={(
          <StorageStatusBanner
            connectionState={storageConnectionState}
            error={storageFeedbackError}
            healthStatus={storageHealthStatus}
            activeWorkspace={activeWorkspace}
            workspaceList={workspaceList}
          />
        )}
      />
      <main className="app-main">
        <section className="pane" data-pane="issue">
          <div className="pane-heading">
            <div className="pane-title-row">
              <h2>{issuePane.title}</h2>
              <span className="pane-badge">{issuePane.badge}</span>
            </div>
            <p className="pane-hint">{issuePane.hint}</p>
          </div>
          <IssuePane
            key={activeWorkspace.id}
            repository={workspaceRepository}
            activeWorkspace={activeWorkspace}
            externalSelectedIssueId={activeIssueId}
            onCloseoutResult={handleCloseoutResult}
            onSelectedIssueChange={setActiveIssueId}
            reportStorageError={reportStorageError}
            clearStorageFeedback={clearStorageFeedback}
          />
        </section>
      </main>
      <footer className="app-footer">
        <span>当前边界：前端 /api + 本地 WSL backend + SQLite；独立部署、Electron / fs / IPC / .debug_workspace 文件写盘未接入。</span>
      </footer>
      <ArchiveListDrawer
        open={isArchiveListOpen}
        archivePane={archivePane}
        archiveIndex={archiveIndex}
        onClose={() => setIsArchiveListOpen(false)}
        onOpenIssue={(issueId) => {
          setActiveIssueId(issueId);
          setIsArchiveListOpen(false);
        }}
      />
    </div>
  );
}
