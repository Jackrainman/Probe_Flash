import type { IssueCard } from "../domain/schemas/issue-card.ts";

export interface RecentIssueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type RecentIssueReopenState =
  | { state: "checking" }
  | { state: "none" }
  | { state: "restored"; issueId: string }
  | { state: "recorded"; issueId: string }
  | { state: "missing"; issueId: string }
  | { state: "archived"; issueId: string }
  | { state: "unavailable" };

export type RecentIssueCandidate = Pick<IssueCard, "id" | "status">;

export const RECENT_ISSUE_STORAGE_KEY_PREFIX = "probeflash:recent-active-issue:";

export function getBrowserRecentIssueStorage(): RecentIssueStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function recentIssueStorageKey(workspaceId: string): string {
  return `${RECENT_ISSUE_STORAGE_KEY_PREFIX}${encodeURIComponent(workspaceId)}`;
}

function withStorage<T>(
  storage: RecentIssueStorage | null,
  fn: (storage: RecentIssueStorage) => T,
  fallback: T,
): T {
  if (storage === null) return fallback;
  try {
    return fn(storage);
  } catch {
    return fallback;
  }
}

export function readRecentIssueIdForWorkspace(
  storage: RecentIssueStorage | null,
  workspaceId: string,
): string | null {
  return withStorage(storage, (s) => {
    const issueId = s.getItem(recentIssueStorageKey(workspaceId))?.trim() ?? "";
    return issueId.length > 0 ? issueId : null;
  }, null);
}

export function writeRecentIssueIdForWorkspace(
  storage: RecentIssueStorage | null,
  workspaceId: string,
  issueId: string,
): boolean {
  const normalizedIssueId = issueId.trim();
  if (normalizedIssueId.length === 0) return false;
  return withStorage(storage, (s) => {
    s.setItem(recentIssueStorageKey(workspaceId), normalizedIssueId);
    return true;
  }, false);
}

export function clearRecentIssueIdForWorkspace(
  storage: RecentIssueStorage | null,
  workspaceId: string,
): boolean {
  return withStorage(storage, (s) => {
    s.removeItem(recentIssueStorageKey(workspaceId));
    return true;
  }, false);
}

export function isRecentIssueReopenableStatus(status: IssueCard["status"]): boolean {
  return status !== "archived";
}

export function rememberRecentIssueForReopen(
  storage: RecentIssueStorage | null,
  workspaceId: string,
  issue: RecentIssueCandidate,
): RecentIssueReopenState {
  if (!isRecentIssueReopenableStatus(issue.status)) {
    clearRecentIssueIdForWorkspace(storage, workspaceId);
    return { state: "archived", issueId: issue.id };
  }
  return writeRecentIssueIdForWorkspace(storage, workspaceId, issue.id)
    ? { state: "recorded", issueId: issue.id }
    : { state: "unavailable" };
}

export function resolveRecentIssueReopen(
  storage: RecentIssueStorage | null,
  workspaceId: string,
  candidates: RecentIssueCandidate[],
): { state: RecentIssueReopenState; issueIdToOpen: string | null } {
  if (storage === null) return { state: { state: "unavailable" }, issueIdToOpen: null };
  const issueId = readRecentIssueIdForWorkspace(storage, workspaceId);
  if (issueId === null) return { state: { state: "none" }, issueIdToOpen: null };
  const candidate = candidates.find((item) => item.id === issueId);
  if (candidate === undefined) {
    clearRecentIssueIdForWorkspace(storage, workspaceId);
    return { state: { state: "missing", issueId }, issueIdToOpen: null };
  }
  if (!isRecentIssueReopenableStatus(candidate.status)) {
    clearRecentIssueIdForWorkspace(storage, workspaceId);
    return { state: { state: "archived", issueId }, issueIdToOpen: null };
  }
  return { state: { state: "restored", issueId }, issueIdToOpen: issueId };
}
