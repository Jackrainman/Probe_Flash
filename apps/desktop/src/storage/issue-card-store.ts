import type { z, ZodIssue } from "zod";
import {
  IssueCardSchema,
  IssueSeverity,
  IssueStatus,
  type IssueCard,
} from "../domain/schemas/issue-card.ts";
import {
  ascByString,
  descByString,
  listValidatedEntities,
  loadValidatedEntity,
  persistValidatedEntity,
} from "./local-storage-store-helpers.ts";
import type { StorageReadError, StorageWriteResult } from "./storage-result.ts";

const KEY_PREFIX = "repo-debug:issue-card:";

export type LoadIssueCardError =
  | { kind: "not_found"; id: string }
  | { kind: "parse_error"; id: string; message: string }
  | { kind: "validation_error"; id: string; issues: ZodIssue[] }
  | StorageReadError;

export type LoadIssueCardResult =
  | { ok: true; card: IssueCard }
  | { ok: false; error: LoadIssueCardError };

export interface IssueCardSummary {
  id: string;
  title: string;
  severity: z.infer<typeof IssueSeverity>;
  status: z.infer<typeof IssueStatus>;
  createdAt: string;
  updatedAt: string;
}

export type IssueCardListInvalidEntry =
  | { kind: "parse_error"; key: string; id: string; message: string }
  | { kind: "validation_error"; key: string; id: string; issues: ZodIssue[] };

export interface IssueCardListResult {
  valid: IssueCardSummary[];
  invalid: IssueCardListInvalidEntry[];
  readError: StorageReadError | null;
}

const storageKey = (id: string): string => KEY_PREFIX + id;

const toSummary = ({ id, title, severity, status, createdAt, updatedAt }: IssueCard): IssueCardSummary =>
  ({ id, title, severity, status, createdAt, updatedAt });

export function saveIssueCard(card: IssueCard): StorageWriteResult {
  return persistValidatedEntity({
    entity: "issue_card",
    target: card.id,
    key: storageKey(card.id),
    value: card,
    schema: IssueCardSchema,
  });
}

export function loadIssueCard(id: string): LoadIssueCardResult {
  const result = loadValidatedEntity<IssueCard>({
    entity: "issue_card",
    id,
    key: storageKey(id),
    schema: IssueCardSchema,
  });
  return result.ok ? { ok: true, card: result.data } : { ok: false, error: result.error };
}

export function listIssueCards(): IssueCardListResult {
  const result = listValidatedEntities<IssueCard>({
    entity: "issue_card",
    prefix: KEY_PREFIX,
    schema: IssueCardSchema,
  });
  return {
    valid: result.valid.map(toSummary).sort(descByString<IssueCardSummary, "createdAt">("createdAt")),
    invalid: [...result.invalid].sort(ascByString<IssueCardListInvalidEntry, "id">("id")),
    readError: result.readError,
  };
}
