// apps/server/src/routes/index.mjs
// TECH-09: registry of HTTP route descriptors. server.mjs walks this list in order
// for every incoming /api/* request and short-circuits on the first match. Routes
// keep their original ordering: /api/version + /api/health (both pre-storage gate)
// fire before any storage-backed route, then per-entity collections in the same
// sequence the previous inline-handler implementation used.
//
// Each route descriptor:
//   { method: "GET" | "POST" | "PUT" | "DELETE",
//     pattern: RegExp,
//     requiresStorage?: boolean = true,
//     handle({ req, res, url, match, repositories, releaseMetadata, storeInitError }) }
//
// New entities should add their routes by creating a peer file under
// apps/server/src/routes/<entity>.mjs and importing it here.

import { aiRoutes } from "./ai.mjs";
import { archiveRoutes } from "./archives.mjs";
import { closeoutRecoveryRoutes } from "./closeoutRecovery.mjs";
import { errorEntryRoutes } from "./errorEntries.mjs";
import { formDraftRoutes } from "./formDrafts.mjs";
import { healthRoutes } from "./health.mjs";
import { issueRoutes } from "./issues.mjs";
import { recordRoutes } from "./records.mjs";
import { searchRoutes } from "./search.mjs";
import { versionRoutes } from "./version.mjs";
import { workspaceRoutes } from "./workspaces.mjs";

export const apiRoutes = [
  // Pre-storage gate
  ...versionRoutes,
  ...healthRoutes,
  // Workspace CRUD
  ...workspaceRoutes,
  // AI
  ...aiRoutes,
  // Issues + atomic closeout
  ...issueRoutes,
  // Investigation records
  ...recordRoutes,
  // Search (cross-entity facade)
  ...searchRoutes,
  // Archive documents
  ...archiveRoutes,
  // Error entries
  ...errorEntryRoutes,
  // TECH-02 closeout recovery
  ...closeoutRecoveryRoutes,
  // Form drafts
  ...formDraftRoutes,
];
