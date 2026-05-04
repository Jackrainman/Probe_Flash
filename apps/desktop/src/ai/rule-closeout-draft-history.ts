import { z } from "zod";
import type { RuleCloseoutDraft } from "./rule-closeout-draft.ts";

export interface CloseoutDraftHistoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const CLOSEOUT_DRAFT_HISTORY_LIMIT = 8;
export const CLOSEOUT_DRAFT_HISTORY_SOURCE = "local-rule";
export const CLOSEOUT_DRAFT_HISTORY_SOURCES = ["local-rule", "deepseek"] as const;
export const CLOSEOUT_DRAFT_HISTORY_STORAGE_KEY_PREFIX = "probeflash:closeout-draft-history:";

const RuleCloseoutDraftSchema = z.object({
  problemSummary: z.string(),
  category: z.string(),
  rootCause: z.string(),
  resolution: z.string(),
  prevention: z.string(),
  keySignals: z.array(z.string()),
  checklistItems: z.array(z.string()),
  caveats: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"]),
});

const CloseoutDraftHistoryEntrySchema = z.object({
  id: z.string().trim().min(1),
  issueId: z.string().trim().min(1),
  issueTitle: z.string(),
  generatedAt: z.string().trim().min(1),
  source: z.enum(CLOSEOUT_DRAFT_HISTORY_SOURCES),
  recordCount: z.number().int().nonnegative(),
  draft: RuleCloseoutDraftSchema,
});

const CloseoutDraftHistorySchema = z.array(CloseoutDraftHistoryEntrySchema);

export type CloseoutDraftHistoryEntry = z.infer<typeof CloseoutDraftHistoryEntrySchema>;
export type CloseoutDraftHistorySource = CloseoutDraftHistoryEntry["source"];

export function getBrowserCloseoutDraftHistoryStorage(): CloseoutDraftHistoryStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function closeoutDraftHistoryStorageKey(issueId: string): string {
  return `${CLOSEOUT_DRAFT_HISTORY_STORAGE_KEY_PREFIX}${encodeURIComponent(issueId)}`;
}

function withStorage<T>(
  storage: CloseoutDraftHistoryStorage | null,
  fn: (storage: CloseoutDraftHistoryStorage) => T,
  fallback: T,
): T {
  if (storage === null) return fallback;
  try {
    return fn(storage);
  } catch {
    return fallback;
  }
}

export function createCloseoutDraftHistoryEntry({
  issueId,
  issueTitle,
  generatedAt,
  source = CLOSEOUT_DRAFT_HISTORY_SOURCE,
  recordCount,
  draft,
  sequence,
}: {
  issueId: string;
  issueTitle: string;
  generatedAt: string;
  source?: CloseoutDraftHistorySource;
  recordCount: number;
  draft: RuleCloseoutDraft;
  sequence: number;
}): CloseoutDraftHistoryEntry {
  return CloseoutDraftHistoryEntrySchema.parse({
    id: `${issueId}:${generatedAt}:${sequence}`,
    issueId,
    issueTitle,
    generatedAt,
    source,
    recordCount,
    draft,
  });
}

export function readCloseoutDraftHistory(
  storage: CloseoutDraftHistoryStorage | null,
  issueId: string,
): CloseoutDraftHistoryEntry[] {
  return withStorage(storage, (s) => {
    const raw = s.getItem(closeoutDraftHistoryStorageKey(issueId));
    if (raw === null) return [];
    const parsed = CloseoutDraftHistorySchema.safeParse(JSON.parse(raw));
    return parsed.success
      ? parsed.data.filter((entry) => entry.issueId === issueId).slice(0, CLOSEOUT_DRAFT_HISTORY_LIMIT)
      : [];
  }, []);
}

export function writeCloseoutDraftHistory(
  storage: CloseoutDraftHistoryStorage | null,
  issueId: string,
  entries: CloseoutDraftHistoryEntry[],
): boolean {
  const scopedEntries = entries
    .filter((entry) => entry.issueId === issueId)
    .slice(0, CLOSEOUT_DRAFT_HISTORY_LIMIT);
  const parsed = CloseoutDraftHistorySchema.safeParse(scopedEntries);
  if (!parsed.success) return false;
  return withStorage(storage, (s) => {
    s.setItem(closeoutDraftHistoryStorageKey(issueId), JSON.stringify(parsed.data));
    return true;
  }, false);
}

export function appendCloseoutDraftHistoryEntry(
  storage: CloseoutDraftHistoryStorage | null,
  entry: CloseoutDraftHistoryEntry,
): { entries: CloseoutDraftHistoryEntry[]; persisted: boolean } {
  const previousEntries = readCloseoutDraftHistory(storage, entry.issueId).filter(
    (previousEntry) => previousEntry.id !== entry.id,
  );
  const entries = [entry, ...previousEntries].slice(0, CLOSEOUT_DRAFT_HISTORY_LIMIT);
  return { entries, persisted: writeCloseoutDraftHistory(storage, entry.issueId, entries) };
}

export function clearCloseoutDraftHistory(
  storage: CloseoutDraftHistoryStorage | null,
  issueId: string,
): boolean {
  return withStorage(storage, (s) => {
    s.removeItem(closeoutDraftHistoryStorageKey(issueId));
    return true;
  }, false);
}

const CLOSEOUT_DRAFT_HISTORY_SOURCE_LABELS: Record<CloseoutDraftHistorySource, string> = {
  "local-rule": "本地规则生成（未调用 AI）",
  deepseek: "DeepSeek 生成（草稿，未自动写库）",
};

export function labelCloseoutDraftHistorySource(source: CloseoutDraftHistoryEntry["source"]): string {
  return CLOSEOUT_DRAFT_HISTORY_SOURCE_LABELS[source];
}
