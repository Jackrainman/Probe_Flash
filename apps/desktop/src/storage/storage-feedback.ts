import type {
  LoadIssueCardResult,
  StorageErrorConnection,
  StorageReadError,
  StorageWriteError,
} from "./storage-repository.ts";
import type { StorageEntity } from "./storage-result.ts";
import type { CloseoutOrchestrationFailure } from "../use-cases/closeout-orchestrator.ts";

export type StorageConnectionState =
  | { state: "local_ready"; mode: "local_storage" }
  | { state: "checking" }
  | { state: "online"; checkedAt: string }
  | { state: "degraded"; reason: string; checkedAt: string }
  | { state: "unreachable"; reason: string; checkedAt: string };

export const LOCAL_STORAGE_CONNECTION_STATE: StorageConnectionState = {
  state: "local_ready",
  mode: "local_storage",
};

export const CHECKING_STORAGE_CONNECTION_STATE: StorageConnectionState = {
  state: "checking",
};

export function createOnlineStorageConnectionState(
  checkedAt: string = new Date().toISOString(),
): StorageConnectionState {
  return {
    state: "online",
    checkedAt,
  };
}

export type StorageFeedbackSurface =
  | "demo"
  | "server_connection"
  | "workspace_selector"
  | "issue_intake"
  | "issue_list"
  | "issue_detail"
  | "investigation_append"
  | "investigation_list"
  | "closeout"
  | "knowledge_search"
  | "archive_index";

export type StorageFeedbackOperation =
  | "health"
  | "list_workspaces"
  | "create_workspace"
  | "create_issue"
  | "list_issues"
  | "load_issue"
  | "save_record"
  | "list_records"
  | "closeout"
  | "search"
  | "list_archives";

export type StorageFeedbackCode =
  | "validation_failed"
  | "read_failed"
  | "write_failed"
  | "invalid_data"
  | "server_unreachable"
  | "timeout"
  | "conflict"
  | "not_found";

export interface StorageFeedbackError {
  surface: StorageFeedbackSurface;
  operation: StorageFeedbackOperation;
  code: StorageFeedbackCode;
  message: string;
  detail?: string;
  entity?: StorageEntity;
  retryable: boolean;
  connectionState: StorageConnectionState;
  step?: string;
  completedWrites?: string[];
  repairTask?: RepairTask;
}

export interface RepairTaskAffectedEntity {
  entityType: StorageEntity | "closeout";
  entityId: string;
  description?: string;
}

export interface RepairTask {
  problemType: string;
  affectedEntities: RepairTaskAffectedEntity[];
  risk: string;
  suggestedRepairSteps: string[];
  requiresManualConfirmation: boolean;
  verification: string;
}

type LoadIssueCardFailure = Extract<LoadIssueCardResult, { ok: false }>["error"];

const STORAGE_ENTITY_LABELS: Record<StorageEntity, string> = {
  workspace: "项目/工作区",
  issue_card: "问题卡",
  investigation_record: "排查记录",
  archive_document: "归档摘要",
  error_entry: "错误表条目",
  form_draft: "表单草稿",
};

const SURFACE_LABELS: Record<StorageFeedbackSurface, string> = {
  demo: "辅助验证",
  server_connection: "服务器连接",
  workspace_selector: "项目选择",
  issue_intake: "创建问题卡",
  issue_list: "问题卡列表",
  issue_detail: "问题卡详情",
  investigation_append: "追加排查记录",
  investigation_list: "排查时间线",
  closeout: "结案归档",
  knowledge_search: "历史搜索",
  archive_index: "归档区",
};

const COMPLETED_WRITE_LABELS: Record<string, string> = {
  archive_document: "归档摘要",
  error_entry: "错误表条目",
  issue_card: "问题卡",
};

const labelStorageEntity = (entity: StorageEntity): string => STORAGE_ENTITY_LABELS[entity];
const labelSurface = (surface: StorageFeedbackSurface): string => SURFACE_LABELS[surface];
const labelCompletedWrite = (entity: string): string => COMPLETED_WRITE_LABELS[entity] ?? entity;

function uniqueAffectedEntities(entities: RepairTaskAffectedEntity[]): RepairTaskAffectedEntity[] {
  const seen = new Set<string>();
  return entities.filter((entity) => {
    const key = `${entity.entityType}:${entity.entityId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createCloseoutRepairTask(failure: Extract<
  CloseoutOrchestrationFailure,
  { reason: "archive_save_failed" | "error_entry_save_failed" | "issue_card_save_failed" }
>): RepairTask {
  const artifacts = "artifacts" in failure ? failure.artifacts : undefined;
  const completedLabels = failure.completedWrites.map(labelCompletedWrite).join("、") || "无";
  const affectedEntities: RepairTaskAffectedEntity[] = [
    {
      entityType: failure.error.entity,
      entityId: failure.error.target,
      description: `失败写入目标：${labelStorageEntity(failure.error.entity)}`,
    },
  ];

  if (artifacts?.updatedIssueCard?.id) {
    affectedEntities.push({
      entityType: "issue_card",
      entityId: artifacts.updatedIssueCard.id,
      description: "结案对应的问题卡",
    });
  }
  if (artifacts?.archiveDocument?.fileName) {
    affectedEntities.push({
      entityType: "archive_document",
      entityId: artifacts.archiveDocument.fileName,
      description: artifacts.archiveDocument.filePath,
    });
  }
  if (artifacts?.errorEntry?.id) {
    affectedEntities.push({
      entityType: "error_entry",
      entityId: artifacts.errorEntry.id,
      description: artifacts.errorEntry.errorCode,
    });
  }

  const hasCompleted = failure.completedWrites.length > 0;
  return {
    problemType: hasCompleted ? "partial_closeout_write_failure" : "closeout_write_blocked",
    affectedEntities: uniqueAffectedEntities(affectedEntities),
    risk: hasCompleted
      ? `结案流程已部分落库（已完成：${completedLabels}），问题卡、归档摘要与错误表可能处于不一致状态。`
      : "结案写入被阻断；如果不审阅冲突目标就反复重试，可能掩盖已有归档或错误表状态。",
    suggestedRepairSteps: [
      "不要删除、覆盖或自动补写生产数据。",
      "先审阅受影响的问题卡、归档摘要和错误表条目，确认哪些实体已经落库。",
      "人工决定是保留已落库实体并补齐缺失关系，还是重新生成 closeout ID 后再结案。",
      "在临时副本或可回滚步骤中验证修复方案，再由人工确认是否应用到真实数据。",
    ],
    requiresManualConfirmation: true,
    verification:
      "重新读回 issue、archive、error-entry 三者，确认 archived issue 同时拥有归档摘要和错误表条目；必要时运行 SQLite integrity check。",
  };
}

function connectionStateFromError(connection?: StorageErrorConnection): StorageConnectionState {
  if (!connection) return LOCAL_STORAGE_CONNECTION_STATE;
  if (connection.state === "online") {
    return { state: "online", checkedAt: connection.checkedAt };
  }
  const { state, reason, checkedAt } = connection;
  return state === "unreachable"
    ? { state: "unreachable", reason, checkedAt }
    : { state: "degraded", reason, checkedAt };
}

export function describeStorageConnectionState(state: StorageConnectionState): string {
  switch (state.state) {
    case "local_ready":
      return "浏览器本地存储（仅演示模式）";
    case "checking":
      return "正在检查服务器连接";
    case "online":
      return `服务器在线（${state.checkedAt}）`;
    case "degraded":
      return `服务器降级：${state.reason}`;
    case "unreachable":
      return `服务器不可达：${state.reason}`;
  }
}

export function createValidationStorageFeedbackError(
  surface: StorageFeedbackSurface,
  operation: StorageFeedbackOperation,
  detail: string,
  connectionState: StorageConnectionState = LOCAL_STORAGE_CONNECTION_STATE,
): StorageFeedbackError {
  return {
    surface,
    operation,
    code: "validation_failed",
    message: "输入校验未通过",
    detail,
    retryable: false,
    connectionState,
  };
}

export function createInvalidDataStorageFeedbackError(
  surface: StorageFeedbackSurface,
  operation: StorageFeedbackOperation,
  detail: string,
  entity?: StorageEntity,
  connectionState: StorageConnectionState = LOCAL_STORAGE_CONNECTION_STATE,
): StorageFeedbackError {
  return {
    surface,
    operation,
    code: "invalid_data",
    message: "发现异常数据，当前已跳过不可信条目",
    detail,
    entity,
    retryable: false,
    connectionState,
  };
}

export function createServerUnreachableStorageFeedbackError(
  surface: StorageFeedbackSurface,
  operation: StorageFeedbackOperation,
  reason: string,
  checkedAt: string,
): StorageFeedbackError {
  return {
    surface,
    operation,
    code: "server_unreachable",
    message: "无法连接服务器长期存储",
    detail: reason,
    retryable: true,
    connectionState: {
      state: "unreachable",
      reason,
      checkedAt,
    },
  };
}

export function createTimeoutStorageFeedbackError(
  surface: StorageFeedbackSurface,
  operation: StorageFeedbackOperation,
  reason: string,
  checkedAt: string,
): StorageFeedbackError {
  return {
    surface,
    operation,
    code: "timeout",
    message: "请求超时，未确认服务器写入结果",
    detail: reason,
    retryable: true,
    connectionState: {
      state: "degraded",
      reason,
      checkedAt,
    },
  };
}

function transportReadErrorToFeedback(
  surface: StorageFeedbackSurface,
  operation: StorageFeedbackOperation,
  error: StorageReadError,
): StorageFeedbackError | null {
  const checkedAt = error.connection?.checkedAt ?? new Date().toISOString();
  if (error.code === "server_unreachable") {
    return createServerUnreachableStorageFeedbackError(surface, operation, error.message, checkedAt);
  }
  if (error.code === "timeout") {
    return createTimeoutStorageFeedbackError(surface, operation, error.message, checkedAt);
  }
  return null;
}

export function healthCheckErrorToFeedback(error: StorageReadError): StorageFeedbackError {
  const transport = transportReadErrorToFeedback("server_connection", "health", error);
  if (transport) return transport;
  const base = {
    surface: "server_connection" as const,
    operation: "health" as const,
    detail: error.message,
    connectionState: connectionStateFromError(error.connection),
  };
  return error.code === "not_found"
    ? { ...base, code: "not_found", message: "未找到服务器健康检查入口", retryable: false }
    : { ...base, code: "read_failed", message: "服务器健康检查失败", retryable: true };
}

export function storageReadErrorToFeedback(
  surface: StorageFeedbackSurface,
  operation: StorageFeedbackOperation,
  error: StorageReadError,
): StorageFeedbackError {
  const transport = transportReadErrorToFeedback(surface, operation, error);
  if (transport) return transport;
  const entityLabel = labelStorageEntity(error.entity);
  const base = {
    surface,
    operation,
    detail: error.message,
    entity: error.entity,
    connectionState: connectionStateFromError(error.connection),
  };
  return error.code === "not_found"
    ? { ...base, code: "not_found", message: `${entityLabel}不存在`, retryable: false }
    : { ...base, code: "read_failed", message: `${entityLabel}读取失败`, retryable: true };
}

export function storageWriteErrorToFeedback(
  surface: StorageFeedbackSurface,
  operation: StorageFeedbackOperation,
  error: StorageWriteError,
): StorageFeedbackError {
  if (error.code === "server_unreachable") {
    return createServerUnreachableStorageFeedbackError(surface, operation, error.message, error.connection.checkedAt);
  }
  if (error.code === "timeout") {
    return createTimeoutStorageFeedbackError(surface, operation, error.message, error.connection.checkedAt);
  }
  const entityLabel = labelStorageEntity(error.entity);
  const base = {
    surface,
    operation,
    entity: error.entity,
    connectionState: connectionStateFromError(error.connection),
  };
  switch (error.code) {
    case "validation_failed":
      return {
        ...base,
        code: "validation_failed",
        message: `${entityLabel}写入前校验失败`,
        detail: error.issues.length > 0 ? `${error.issues.length} 个字段问题` : error.message,
        retryable: false,
      };
    case "conflict":
      return { ...base, code: "conflict", message: `${entityLabel}写入冲突`, detail: error.message, retryable: false };
    case "not_found":
      return { ...base, code: "not_found", message: `${entityLabel}引用目标不存在`, detail: error.message, retryable: false };
    case "serialize_failed":
    case "unexpected_write_error":
      return { ...base, code: "write_failed", message: `${entityLabel}写入失败`, detail: error.message, retryable: true };
  }
}

export function loadIssueCardFailureToFeedback(
  surface: StorageFeedbackSurface,
  error: LoadIssueCardFailure,
): StorageFeedbackError {
  switch (error.kind) {
    case "not_found":
      return {
        surface,
        operation: "load_issue",
        code: "not_found",
        message: "未找到问题卡",
        detail: error.id,
        entity: "issue_card",
        retryable: false,
        connectionState: LOCAL_STORAGE_CONNECTION_STATE,
      };
    case "parse_error":
      return createInvalidDataStorageFeedbackError(
        surface,
        "load_issue",
        `问题卡 JSON 解析失败（${error.id}）：${error.message}`,
        "issue_card",
      );
    case "validation_error":
      return createInvalidDataStorageFeedbackError(
        surface,
        "load_issue",
        `问题卡结构校验失败（${error.id}，${error.issues.length} 个字段问题）`,
        "issue_card",
      );
    case "read_failed":
      return storageReadErrorToFeedback(surface, "load_issue", error);
  }
}

export function closeoutFailureToFeedback(
  failure: CloseoutOrchestrationFailure,
): StorageFeedbackError {
  switch (failure.reason) {
    case "issue_load_failed":
      return {
        ...loadIssueCardFailureToFeedback("closeout", failure.error),
        step: failure.step,
      };
    case "record_list_failed":
      return {
        ...storageReadErrorToFeedback("closeout", "closeout", failure.error),
        step: failure.step,
      };
    case "record_list_invalid":
      return {
        ...createInvalidDataStorageFeedbackError(
          "closeout",
          "closeout",
          `排查记录里有 ${failure.invalidCount} 条异常数据，已阻断结案。`,
          "investigation_record",
        ),
        step: failure.step,
      };
    case "closeout_validation_failed":
      return {
        ...createValidationStorageFeedbackError("closeout", "closeout", failure.error.reason),
        step: failure.step,
      };
    case "archive_save_failed":
    case "error_entry_save_failed":
    case "issue_card_save_failed": {
      const mapped = storageWriteErrorToFeedback("closeout", "closeout", failure.error);
      return {
        ...mapped,
        step: failure.step,
        completedWrites: failure.completedWrites,
        repairTask: createCloseoutRepairTask(failure),
        detail:
          failure.completedWrites.length > 0
            ? `${mapped.detail ?? ""}；已完成写入：${failure.completedWrites
                .map(labelCompletedWrite)
                .join("、")}`
            : mapped.detail,
      };
    }
  }
}

export function formatStorageFeedbackError(error: StorageFeedbackError): string {
  const detail = error.detail ? `：${error.detail}` : "";
  const retry = error.retryable ? "可重试" : "需先修正后再试";
  const step = error.step ? ` · 步骤=${error.step}` : "";
  const partial =
    error.completedWrites && error.completedWrites.length > 0
      ? ` · 已完成=${error.completedWrites.map(labelCompletedWrite).join("、")}`
      : "";
  const repair = error.repairTask ? ` · repair=${error.repairTask.problemType}` : "";
  return `${labelSurface(error.surface)}：${error.message}${detail}${step}${partial}${repair}（${retry}）`;
}
