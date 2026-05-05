import type {
  CloseoutRecoveryItem,
  CloseoutRecoveryListResult,
} from "../../storage/storage-repository";
import { labelIssueStatus, labelSeverity } from "../issue/issueUiHelpers";

const STATE_LABELS: Record<CloseoutRecoveryItem["closeoutState"], string> = {
  pending: "结案进行中（中断未完成）",
  failed: "结案失败（已回滚）",
};

const STATE_HINTS: Record<CloseoutRecoveryItem["closeoutState"], string> = {
  pending:
    "服务器在结案事务中途未完成（可能是上次崩溃 / 中断）。归档与错误表均未写入；问题卡仍处于 archived 之前的状态。",
  failed:
    "结案事务在服务器侧已显式回滚（例如归档文件名冲突 / 校验失败）。归档与错误表均未写入；问题卡未被改动。",
};

function formatTimestamp(value: string): string {
  return value.replace("T", " ").replace(/(?:Z|[+-]\d\d:\d\d)$/, "");
}

export function CloseoutRecoveryPanel({
  result,
  onClear,
  onRefresh,
}: {
  // TECH-02 desktop UI surface for issues whose closeout transaction did not converge
  // to 'completed'. The list itself comes from GET /api/.../closeout-recovery; clearing
  // a marker is a manual action (POST /closeout-recovery/:id/clear), not auto-applied.
  result: CloseoutRecoveryListResult | null;
  onClear: (issueId: string) => Promise<void> | void;
  onRefresh: () => Promise<void> | void;
}) {
  if (result === null) {
    return null;
  }
  if (result.readError !== null) {
    return (
      <section
        className="closeout-recovery-panel"
        data-testid="closeout-recovery-panel"
        data-state="read-error"
      >
        <div className="closeout-recovery-header">
          <h3>结案恢复</h3>
          <button
            type="button"
            className="button-secondary"
            onClick={() => void onRefresh()}
            data-testid="closeout-recovery-refresh"
          >
            重试读取
          </button>
        </div>
        <p className="storage-line" data-testid="closeout-recovery-read-error">
          结案恢复列表读取失败，确认上方项目与存储状态后重试。
        </p>
      </section>
    );
  }
  if (result.items.length === 0) {
    return null;
  }
  return (
    <section
      className="closeout-recovery-panel"
      data-testid="closeout-recovery-panel"
      data-state="needs-review"
      data-count={result.items.length}
    >
      <div className="closeout-recovery-header">
        <h3>结案恢复（{result.items.length} 条待复核）</h3>
        <button
          type="button"
          className="button-secondary"
          onClick={() => void onRefresh()}
          data-testid="closeout-recovery-refresh"
        >
          刷新
        </button>
      </div>
      <p className="storage-line" data-testid="closeout-recovery-summary">
        以下问题卡曾尝试结案，但服务器事务未走完。归档与错误表均未写入，可重新结案或解除标记。
      </p>
      <ul className="closeout-recovery-list" data-testid="closeout-recovery-list">
        {result.items.map((item) => (
          <li
            key={item.id}
            className="closeout-recovery-item"
            data-testid="closeout-recovery-item"
            data-issue-id={item.id}
            data-closeout-state={item.closeoutState}
          >
            <div className="closeout-recovery-item-meta">
              <span className="closeout-recovery-item-title">{item.title || "未命名问题"}</span>
              <span
                className="closeout-recovery-item-state"
                data-testid="closeout-recovery-item-state"
              >
                {STATE_LABELS[item.closeoutState]}
              </span>
              <span className="storage-line">
                {labelSeverity(item.severity)} · {labelIssueStatus(item.status)} · 更新时间{" "}
                {formatTimestamp(item.updatedAt)}
              </span>
              <span className="storage-line" data-testid="closeout-recovery-item-hint">
                {STATE_HINTS[item.closeoutState]}
              </span>
            </div>
            <div className="closeout-recovery-item-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => void onClear(item.id)}
                data-testid="closeout-recovery-clear-button"
              >
                解除标记
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
