import type { CloseoutOrchestrationFailure } from "./closeout-orchestrator.ts";

export interface CloseoutFailureFeedbackCopy {
  statusReason: string;
  retryHint: string;
}

const COMPLETED_WRITE_LABELS: Record<string, string> = {
  archive_document: "归档摘要",
  error_entry: "错误表条目",
  issue_card: "问题卡状态",
};

const labelCompletedWrite = (entity: string): string => COMPLETED_WRITE_LABELS[entity] ?? entity;

function buildRetryStep(failure: CloseoutOrchestrationFailure): string {
  if (failure.completedWrites.length > 0) {
    const completed = failure.completedWrites.map(labelCompletedWrite).join("、");
    return `已检测到部分写入（已完成：${completed}），先按顶部 Repair Task 人工确认数据状态，再重试结案。`;
  }
  if (failure.reason === "archive_save_failed") {
    return "暂未检测到已完成写入，确认存储恢复后可以直接重试结案。";
  }
  return "先按顶部存储或校验提示修正问题，再重试提交。";
}

export function buildCloseoutFailureFeedbackCopy(
  failure: CloseoutOrchestrationFailure,
): CloseoutFailureFeedbackCopy {
  return {
    statusReason: "未归档成功，表单内容已保留",
    retryHint: `未归档成功；你填写的根因、修复/结论、预防建议等内容已保留在表单中。下一步：${buildRetryStep(failure)}`,
  };
}
