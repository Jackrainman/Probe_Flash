// apps/server/src/http/static.mjs
// TECH-09: static asset serving for the SPA dist directory. Lifted out of
// server.mjs so route registration can stay focused on /api/* concerns.

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve } from "node:path";

import { text } from "./responses.mjs";

const STATIC_CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".webp", "image/webp"],
]);

function getStaticContentType(filePath) {
  return STATIC_CONTENT_TYPES.get(extname(filePath).toLowerCase()) ?? "application/octet-stream";
}

function isPathInside(parentDir, candidatePath) {
  const relativePath = relative(parentDir, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function decodeStaticPathname(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

async function resolveStaticFile(staticDir, candidatePath) {
  try {
    const fileStat = await stat(candidatePath);
    if (fileStat.isDirectory()) {
      return resolveStaticFile(staticDir, join(candidatePath, "index.html"));
    }
    if (!fileStat.isFile()) return null;
    if (!isPathInside(staticDir, candidatePath)) return null;
    return { filePath: candidatePath, fileStat };
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
    throw error;
  }
}

function sendStaticFile(req, res, filePath, fileStat) {
  res.writeHead(200, {
    "cache-control": "no-cache",
    "content-length": fileStat.size,
    "content-type": getStaticContentType(filePath),
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  const stream = createReadStream(filePath);
  stream.on("error", (error) => {
    if (!res.headersSent) {
      text(res, 500, "static file read failed");
      return;
    }
    res.destroy(error);
  });
  stream.pipe(res);
}

export async function serveStaticRequest(req, res, url, staticDir) {
  const method = req.method ?? "GET";
  if (method !== "GET" && method !== "HEAD") {
    return text(res, 405, "method not allowed", { allow: "GET, HEAD" });
  }

  const decodedPathname = decodeStaticPathname(url.pathname);
  if (!decodedPathname || decodedPathname.includes("\0")) {
    return text(res, 400, "bad static path");
  }

  const candidatePath = resolve(staticDir, `.${decodedPathname}`);
  if (!isPathInside(staticDir, candidatePath)) {
    return text(res, 403, "static path is outside configured dist directory");
  }

  const staticFile = await resolveStaticFile(staticDir, candidatePath);
  if (staticFile) {
    sendStaticFile(req, res, staticFile.filePath, staticFile.fileStat);
    return;
  }

  if (!extname(decodedPathname)) {
    const indexFile = await resolveStaticFile(staticDir, resolve(staticDir, "index.html"));
    if (indexFile) {
      sendStaticFile(req, res, indexFile.filePath, indexFile.fileStat);
      return;
    }
  }

  return text(res, 404, "static file not found");
}
