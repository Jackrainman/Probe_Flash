import { readFileSync } from "node:fs";
import { join } from "node:path";

import { startProbeFlashServer } from "../../server/src/server.mjs";
import type { IssueCard } from "../src/domain/schemas/issue-card.ts";
import {
  addRelatedHistoricalIssue,
  removeRelatedHistoricalIssue,
} from "../src/search/related-historical-issues.ts";
import { createHttpStorageRepository } from "../src/storage/http-storage-repository.ts";
import { createStorageRepository, type StorageRepository } from "../src/storage/storage-repository.ts";
import {
  buildSearchIssue,
  installSearchVerifyLocalStorage,
  SEARCH_VERIFY_WORKSPACE_ID,
} from "./search-verify-fixtures.mts";
import { createTempDir } from "./verify-helpers.mts";

const WORKSPACE_ID = SEARCH_VERIFY_WORKSPACE_ID;
const NOW = "2026-04-28T22:15:00+08:00";
const LINKED_AT = "2026-04-28T22:16:00+08:00";
const UNLINKED_AT = "2026-04-28T22:17:00+08:00";

function fail(reason: string, detail?: unknown): never {
  console.error(`[SEARCH-LINKING desktop verify] FAIL: ${reason}`);
  if (detail !== undefined) {
    console.error(JSON.stringify(detail, null, 2));
  }
  throw new Error(reason);
}

function assert(condition: unknown, reason: string, detail?: unknown): asserts condition {
  if (!condition) fail(reason, detail);
}

function buildIssue(
  workspaceId: string,
  id: string,
  title: string,
  description: string,
  status: IssueCard["status"] = "open",
): IssueCard {
  return buildSearchIssue({
    workspaceId,
    id,
    title,
    description,
    tags: ["CAN", "历史关联"],
    status,
    now: NOW,
  });
}

async function saveIssue(repository: StorageRepository, issue: IssueCard) {
  const saved = await repository.issueCards.save(issue);
  assert(saved.ok, `issue ${issue.id} should save`, saved);
}

async function loadIssue(repository: StorageRepository, issueId: string): Promise<IssueCard> {
  const loaded = await repository.issueCards.load(issueId);
  assert(loaded.ok, `issue ${issueId} should load`, loaded);
  return loaded.card;
}

async function verifyRepositoryLinking(repository: StorageRepository, label: string) {
  const current = buildIssue(
    WORKSPACE_ID,
    `issue-link-current-${label}`,
    "Current CAN timeout needs historical reference",
    "Search result linking should attach a known historical issue.",
  );
  const historical = buildIssue(
    WORKSPACE_ID,
    `issue-link-history-${label}`,
    "Historical CAN timeout reference",
    "Resolved historical issue that should be linked and unlinked.",
    "archived",
  );

  await saveIssue(repository, current);
  await saveIssue(repository, historical);

  const linked = addRelatedHistoricalIssue(current, historical.id, LINKED_AT);
  assert(linked.relatedHistoricalIssueIds.includes(historical.id), `${label}: helper should add relation`, linked);
  assert(linked.updatedAt === LINKED_AT, `${label}: helper should update timestamp on link`, linked);
  await saveIssue(repository, linked);

  const reloadedLinked = await loadIssue(repository, current.id);
  assert(
    reloadedLinked.relatedHistoricalIssueIds.length === 1 &&
      reloadedLinked.relatedHistoricalIssueIds[0] === historical.id,
    `${label}: relation should persist after reload`,
    reloadedLinked,
  );

  const duplicate = addRelatedHistoricalIssue(reloadedLinked, historical.id, "2026-04-28T22:16:30+08:00");
  assert(
    duplicate.relatedHistoricalIssueIds.length === 1 && duplicate.updatedAt === reloadedLinked.updatedAt,
    `${label}: duplicate link should not rewrite relation`,
    duplicate,
  );
  const selfLinked = addRelatedHistoricalIssue(reloadedLinked, current.id, "2026-04-28T22:16:40+08:00");
  assert(!selfLinked.relatedHistoricalIssueIds.includes(current.id), `${label}: self link should be ignored`, selfLinked);

  const unlinked = removeRelatedHistoricalIssue(reloadedLinked, historical.id, UNLINKED_AT);
  assert(unlinked.relatedHistoricalIssueIds.length === 0, `${label}: helper should remove relation`, unlinked);
  assert(unlinked.updatedAt === UNLINKED_AT, `${label}: helper should update timestamp on unlink`, unlinked);
  await saveIssue(repository, unlinked);

  const reloadedUnlinked = await loadIssue(repository, current.id);
  assert(
    reloadedUnlinked.relatedHistoricalIssueIds.length === 0,
    `${label}: unlink should persist after reload`,
    reloadedUnlinked,
  );
}

const pureCurrent = buildIssue(
  WORKSPACE_ID,
  "issue-link-pure-current",
  "Pure current issue",
  "Pure helper current issue.",
);
const pureLinked = addRelatedHistoricalIssue(pureCurrent, " issue-link-pure-history ", LINKED_AT);
assert(
  pureLinked.relatedHistoricalIssueIds[0] === "issue-link-pure-history",
  "pure helper should trim linked issue id",
  pureLinked,
);
const pureUnlinked = removeRelatedHistoricalIssue(pureLinked, "issue-link-pure-history", UNLINKED_AT);
assert(pureUnlinked.relatedHistoricalIssueIds.length === 0, "pure helper should unlink issue id", pureUnlinked);

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const knowledgeSource = readFileSync(new URL("../src/components/knowledge/KnowledgePanels.tsx", import.meta.url), "utf8");
const uiSource = [appSource, knowledgeSource].join("\n");
assert(uiSource.includes("knowledge-search-link-result"), "UI should expose search result link action marker");
assert(uiSource.includes("similar-issues-link-result"), "UI should expose similar result link action marker");
assert(uiSource.includes("related-history-unlink"), "UI should expose unlink action marker");

installSearchVerifyLocalStorage();

const localRepository = createStorageRepository({ workspaceId: WORKSPACE_ID });
await verifyRepositoryLinking(localRepository, "local");

const workdir = createTempDir("probeflash-search-linking-desktop").path;
const dbPath = join(workdir, "probeflash.search-linking.sqlite");
const server = await startProbeFlashServer({ host: "127.0.0.1", port: 0, dbPath });

try {
  const repository = createHttpStorageRepository({ baseUrl: `${server.baseUrl}/api`, workspaceId: WORKSPACE_ID });
  await verifyRepositoryLinking(repository, "http");
} finally {
  await server.close();
}

console.log("[SEARCH-LINKING desktop verify] PASS: pure helper handles add, duplicate, self-link, and unlink");
console.log("[SEARCH-LINKING desktop verify] PASS: localStorage fallback and HTTP repository persist link/unlink after reload");
console.log("[SEARCH-LINKING desktop verify] PASS: search, similar, and unlink UI markers are present");
