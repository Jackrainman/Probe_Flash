// apps/server/src/repositories/recordRepository.mjs
// TECH-08: investigation record repository.

export function createRecordRepository(store) {
  return {
    list: (workspaceId, issueId) => store.listRecords(workspaceId, issueId),
    create: (workspaceId, issueId, payload) => store.createRecord(workspaceId, issueId, payload),
  };
}
