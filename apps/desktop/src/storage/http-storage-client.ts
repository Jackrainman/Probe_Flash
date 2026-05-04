const DEFAULT_HTTP_STORAGE_BASE_URL = "/api";
const DEFAULT_HTTP_STORAGE_TIMEOUT_MS = 3000;

export interface HttpStorageClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export type HttpStorageRequestError =
  | {
      type: "server_unreachable";
      message: string;
      checkedAt: string;
    }
  | {
      type: "timeout";
      message: string;
      checkedAt: string;
    }
  | {
      type: "http_error";
      status: number;
      code: string;
      message: string;
      retryable: boolean;
      checkedAt: string;
      details?: unknown;
      operation?: string;
    }
  | {
      type: "invalid_envelope";
      status: number;
      message: string;
      checkedAt: string;
    };

interface ApiSuccessEnvelope<T> {
  ok: true;
  data: T;
}

interface ApiErrorEnvelope {
  ok: false;
  error: {
    code?: string;
    message?: string;
    operation?: string;
    retryable?: boolean;
    details?: unknown;
  };
}

export interface HttpStorageClient {
  baseUrl: string;
  timeoutMs: number;
  request<T>(path: string, init?: RequestInit): Promise<T>;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function buildUrl(baseUrl: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.length === 0) return baseUrl;
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isApiSuccessEnvelope<T>(payload: unknown): payload is ApiSuccessEnvelope<T> {
  return isObject(payload) && payload.ok === true && "data" in payload;
}

function isApiErrorEnvelope(payload: unknown): payload is ApiErrorEnvelope {
  return isObject(payload) && payload.ok === false && isObject(payload.error);
}

const API_ERROR_CODE_BY_STATUS: Record<number, string> = {
  400: "BAD_REQUEST",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "VALIDATION_ERROR",
  503: "SERVICE_UNAVAILABLE",
};

function normalizeApiErrorCode(status: number, code: unknown): string {
  if (typeof code === "string" && code.trim().length > 0) return code;
  return API_ERROR_CODE_BY_STATUS[status] ?? "STORAGE_ERROR";
}

function normalizeApiErrorMessage(status: number, message: unknown): string {
  if (typeof message === "string" && message.trim().length > 0) return message;
  return status >= 500 ? "server storage request failed" : "request failed";
}

function normalizeNetworkMessage(error: unknown): string {
  const candidate = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return candidate.trim().length > 0 ? candidate : "network request failed";
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) return error.name === "AbortError";
  return error instanceof Error && error.name === "AbortError";
}

function resolveTimeoutMs(timeoutMs?: number): number {
  if (typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    return timeoutMs;
  }
  const envTimeout = Number(
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
      ?.PROBEFLASH_STORAGE_HTTP_TIMEOUT_MS ?? "",
  );
  if (Number.isFinite(envTimeout) && envTimeout > 0) {
    return envTimeout;
  }
  return DEFAULT_HTTP_STORAGE_TIMEOUT_MS;
}

function createJsonHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }
  if (init.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  return headers;
}

export function createHttpStorageClient(
  options: HttpStorageClientOptions = {},
): HttpStorageClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_HTTP_STORAGE_BASE_URL);
  const timeoutMs = resolveTimeoutMs(options.timeoutMs);
  const fetchFn = options.fetchFn ?? globalThis.fetch;

  if (typeof fetchFn !== "function") {
    throw new Error("fetch API is not available for HttpStorageClient");
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const checkedAt = new Date().toISOString();
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => {
      controller.abort("timeout");
    }, timeoutMs);

    try {
      const response = await fetchFn(buildUrl(baseUrl, path), {
        ...init,
        headers: createJsonHeaders(init),
        signal: controller.signal,
      });

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw {
          type: "invalid_envelope",
          status: response.status,
          message: "response is not valid JSON",
          checkedAt,
        } satisfies HttpStorageRequestError;
      }

      if (isApiSuccessEnvelope<T>(payload)) {
        if (!response.ok) {
          throw {
            type: "invalid_envelope",
            status: response.status,
            message: "received ok=true with non-2xx status",
            checkedAt,
          } satisfies HttpStorageRequestError;
        }
        return payload.data;
      }

      if (isApiErrorEnvelope(payload)) {
        throw {
          type: "http_error",
          status: response.status,
          code: normalizeApiErrorCode(response.status, payload.error.code),
          message: normalizeApiErrorMessage(response.status, payload.error.message),
          retryable: payload.error.retryable ?? response.status >= 500,
          checkedAt,
          details: payload.error.details,
          operation: payload.error.operation,
        } satisfies HttpStorageRequestError;
      }

      throw {
        type: "invalid_envelope",
        status: response.status,
        message: "response envelope must be {ok:true,data} or {ok:false,error}",
        checkedAt,
      } satisfies HttpStorageRequestError;
    } catch (error) {
      if (
        isObject(error) &&
        typeof error.type === "string" &&
        ["server_unreachable", "timeout", "http_error", "invalid_envelope"].includes(error.type)
      ) {
        throw error as HttpStorageRequestError;
      }

      if (isAbortError(error) || controller.signal.aborted) {
        throw {
          type: "timeout",
          message: `HTTP request timed out after ${timeoutMs}ms`,
          checkedAt,
        } satisfies HttpStorageRequestError;
      }

      throw {
        type: "server_unreachable",
        message: normalizeNetworkMessage(error),
        checkedAt,
      } satisfies HttpStorageRequestError;
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }

  return {
    baseUrl,
    timeoutMs,
    request,
  };
}
