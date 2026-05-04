import { join } from "node:path";

import { startProbeFlashServer } from "../../server/src/server.mjs";
import { buildIssueCardFromIntake, defaultIntakeOptions } from "../src/domain/issue-intake.ts";
import {
  buildInvestigationRecordFromIntake,
  defaultInvestigationIntakeOptions,
} from "../src/domain/investigation-intake.ts";
import { createHttpStorageRepository } from "../src/storage/http-storage-repository.ts";
import type { StorageRepository, StorageSearchResult } from "../src/storage/storage-repository.ts";
import { orchestrateIssueCloseout } from "../src/use-cases/closeout-orchestrator.ts";
import { createReporter, createTempDir } from "./verify-helpers.mts";

const WORKSPACE_ID = "workspace-26-r1";
const NOW = "2026-04-27T18:15:00+08:00";

const { fail, assert } = createReporter("SEARCH-BASIC-FULL-TEXT desktop verify");

function buildIssue(workspaceId: string, id: string, title: string, description: string) {
  const result = buildIssueCardFromIntake(
    {
      title,
      description,
      severity: "medium",
    },
    defaultIntakeOptions(NOW, id, workspaceId),
  );
  assert(result.ok, "issue fixture should build", result);
  return result.card;
}

function buildRecord(issueId: string, id: string, note: string) {
  const result = buildInvestigationRecordFromIntake(
    {
      issueId,
      type: "observation",
      note,
    },
    defaultInvestigationIntakeOptions(NOW, id),
  );
  assert(result.ok, "record fixture should build", result);
  return result.record;
}

async function saveIssue(repository: StorageRepository, issue: ReturnType<typeof buildIssue>) {
  const saved = await repository.issueCards.save(issue);
  assert(saved.ok, "issue save should succeed", saved);
}

async function appendRecord(repository: StorageRepository, issueId: string, recordId: string, note: string) {
  const saved = await repository.investigationRecords.append(buildRecord(issueId, recordId, note));
  assert(saved.ok, "record append should succeed", saved);
}

async function closeIssue(repository: StorageRepository, issueId: string) {
  const closeout = await orchestrateIssueCloseout(
    issueId,
    {
      category: "CAN",
      rootCause: "transceiver termination mismatch",
      resolution: "Reworked the CAN termination and verified packet stability.",
      prevention: "Add termination resistance check to pre-match checklist.",
    },
    {
      repository,
      now: () => NOW,
      closeoutOptionsOverrides: {
        errorEntryId: "error-entry-search-basic-desktop-0001",
        errorCode: "DBG-20260427-402",
        generatedBy: "hybrid",
      },
    },
  );
  assert(closeout.ok, "closeout should create searchable archive and error entry", closeout);
}

async function expectSearch(repository: StorageRepository, query: string): Promise<StorageSearchResult> {
  const result = await repository.search.query(query);
  assert(result.readError === null, `search ${query} should not return readError`, result.readError);
  return result;
}

function hasKind(result: StorageSearchResult, kind: string, text: string): boolean {
  return result.items.some(
    (item) =>
      item.kind === kind &&
      JSON.stringify(item).toLocaleLowerCase().includes(text.toLocaleLowerCase()),
  );
}

const workdir = createTempDir("probeflash-search-basic-desktop").path;
const dbPath = join(workdir, "probeflash.search.sqlite");
const server = await startProbeFlashServer({ host: "127.0.0.1", port: 0, dbPath });

try {
  const baseUrl = `${server.baseUrl}/api`;
  const repository = createHttpStorageRepository({ baseUrl, workspaceId: WORKSPACE_ID });
  const issue = buildIssue(
    WORKSPACE_ID,
    "issue-search-basic-desktop-0001",
    "Search CAN heartbeat dropout",
    "Default workspace issue description mentions bring-up heartbeat loss.",
  );
  await saveIssue(repository, issue);
  await appendRecord(
    repository,
    issue.id,
    "record-search-basic-desktop-0001",
    "Oscilloscope ripple appears when motor enable toggles.",
  );
  await closeIssue(repository, issue.id);

  const createdWorkspace = await repository.workspaces.create({ name: "Search Isolation Workspace" });
  assert(createdWorkspace.ok, "secondary workspace should be created", createdWorkspace);
  const otherRepository = createHttpStorageRepository({
    baseUrl,
    workspaceId: createdWorkspace.workspace.id,
  });
  await saveIssue(
    otherRepository,
    buildIssue(
      createdWorkspace.workspace.id,
      "issue-search-basic-other-0001",
      "Other workspace leakage sentinel",
      "This other workspace issue must not leak into default search.",
    ),
  );

  const issueResults = await expectSearch(repository, "CAN heartbeat");
  assert(hasKind(issueResults, "issue", issue.id), "repository search should return issue title matches", issueResults);

  const recordResults = await expectSearch(repository, "oscilloscope ripple");
  assert(hasKind(recordResults, "record", "record-search-basic-desktop"), "repository search should return record matches", recordResults);

  const closeoutResults = await expectSearch(repository, "termination mismatch");
  assert(hasKind(closeoutResults, "archive", "search-can-heartbeat"), "repository search should return archive matches", closeoutResults);
  assert(hasKind(closeoutResults, "error_entry", "DBG-20260427-402"), "repository search should return error-entry matches", closeoutResults);

  const emptyResults = await expectSearch(repository, "no-such-search-keyword");
  assert(emptyResults.items.length === 0, "repository search should show no-result state", emptyResults);

  const defaultIsolation = await expectSearch(repository, "leakage sentinel");
  assert(defaultIsolation.items.length === 0, "default workspace must not search other workspace data", defaultIsolation);
  const otherIsolation = await expectSearch(otherRepository, "leakage sentinel");
  assert(hasKind(otherIsolation, "issue", "issue-search-basic-other"), "other workspace should search its own data", otherIsolation);

  const blankQuery = await expectSearch(repository, "   ");
  assert(blankQuery.items.length === 0 && blankQuery.query === "", "blank query should be handled client-side", blankQuery);
} finally {
  await server.close();
}

console.log("[SEARCH-BASIC-FULL-TEXT desktop verify] PASS: repository search returns issue, record, archive, and error-entry matches");
console.log("[SEARCH-BASIC-FULL-TEXT desktop verify] PASS: repository search returns stable no-result state");
console.log("[SEARCH-BASIC-FULL-TEXT desktop verify] PASS: workspace-scoped repository search does not leak other workspace data");
