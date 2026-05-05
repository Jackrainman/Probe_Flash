// apps/server/src/db/storage-error.mjs
// TECH-10: structured error/factory + sqlite-specific helpers shared by all
// entity ops. Pure module — no DB connection required.

import { basename } from "node:path";

export function createValidationError(message) {
  const error = new Error(message);
  error.code = "VALIDATION_ERROR";
  return error;
}

export function createStorageError(message, code = "STORAGE_ERROR") {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function isUniqueConstraintError(error) {
  return error && typeof error === "object" && String(error.message).includes("UNIQUE");
}

export function parsePayload(row) {
  return JSON.parse(row.payload_json);
}

export function classifyDbPath(dbPath) {
  const normalized = dbPath.replaceAll("\\", "/");
  if (normalized.includes("/.runtime/")) return "app_runtime";
  if (normalized.includes("/shared/data/")) return "deploy_shared_data";
  if (normalized.includes("/tmp/")) return "temporary";
  return "custom";
}

export function dbFileName(dbPath) {
  return basename(dbPath);
}
