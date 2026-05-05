// apps/server/src/repositories/index.mjs
// TECH-08: aggregate factory. server.mjs takes one `repositories` object and routes
// per-entity handlers through `repositories.<entity>.<method>` rather than reaching
// into the SQLite-backed `store` directly.
//
// All sub-repositories are 1:1 facades over the store today (TECH-10 will split
// the store itself). Introducing the factory now lets server.mjs stop coupling on
// store internals and lets TECH-09 refactor routes without re-touching data calls.

import { createArchiveRepository } from "./archiveRepository.mjs";
import { createCloseoutRecoveryRepository } from "./closeoutRecoveryRepository.mjs";
import { createErrorEntryRepository } from "./errorEntryRepository.mjs";
import { createFormDraftRepository } from "./formDraftRepository.mjs";
import { createIssueRepository } from "./issueRepository.mjs";
import { createRecordRepository } from "./recordRepository.mjs";
import { createSearchRepository } from "./searchRepository.mjs";
import { createWorkspaceRepository } from "./workspaceRepository.mjs";

export function createRepositories(store) {
  return {
    workspace: createWorkspaceRepository(store),
    issue: createIssueRepository(store),
    record: createRecordRepository(store),
    archive: createArchiveRepository(store),
    errorEntry: createErrorEntryRepository(store),
    formDraft: createFormDraftRepository(store),
    closeoutRecovery: createCloseoutRecoveryRepository(store),
    search: createSearchRepository(store),
  };
}
