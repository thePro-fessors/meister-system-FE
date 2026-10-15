export class ApiError extends Error {
  constructor(message: string, public readonly status = 0, public readonly code = "API_ERROR", public readonly details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export type TokenGetter = () => string | null | undefined | Promise<string | null | undefined>;
type Query = Record<string, string | number | boolean | undefined>;
export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  authenticated?: boolean;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function apiErrorMessage(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  if (Array.isArray(value)) return value.map(apiErrorMessage).join("; ");
  if (record(value)) {
    for (const key of ["detail", "message", "msg", "reason"]) {
      if (value[key] !== undefined) return apiErrorMessage(value[key]);
    }
    return JSON.stringify(value);
  }
  return "요청을 처리하지 못했습니다.";
}

export function unwrapSrFormat<T>(value: unknown, status = 200): T {
  if (record(value) && value.success === false) {
    throw new ApiError(apiErrorMessage(value.detail ?? value.message), status,
      typeof value.error_code === "string" ? value.error_code : "API_ERROR", value);
  }
  if (record(value) && value.success === true && Object.hasOwn(value, "data")) return value.data as T;
  return value as T;
}

export function createApiClient(options: { baseUrl?: string; getToken?: TokenGetter } = {}) {
  function baseUrl() {
    const configured = (options.baseUrl ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();
    if (!configured) throw new ApiError("서버 연동 대기: NEXT_PUBLIC_API_BASE_URL이 설정되지 않았습니다.", 0, "NOT_CONFIGURED");
    let url: URL;
    try { url = new URL(configured); } catch { throw new ApiError("API 주소는 절대 HTTP(S) URL이어야 합니다.", 0, "INVALID_BASE_URL"); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new ApiError("API 주소 설정을 확인해 주세요.", 0, "INVALID_BASE_URL");
    }
    return url.toString().replace(/\/$/, "");
  }

  async function availability() {
    try {
      baseUrl();
      if (!(await options.getToken?.())?.trim()) return { available: false, reason: "서버 연동 대기: 백엔드 인증 토큰이 없습니다. 로컬 데모 로그인은 서버 인증이 아닙니다." };
      return { available: true, reason: "API 설정 및 인증 토큰 확인됨 (서버 연결은 요청 시 확인)." };
    } catch (error) { return { available: false, reason: apiErrorMessage(error) }; }
  }

  async function transport(path: string, request: RequestOptions, blob: boolean) {
    const base = baseUrl();
    if (!path.startsWith("/api/") || /[?#\\]/.test(path) || path.split("/").includes("..")) {
      throw new ApiError("API 경로가 올바르지 않습니다.", 0, "INVALID_PATH");
    }
    const url = new URL(`${base}${base.endsWith("/api") ? path.slice(4) : path}`);
    Object.entries(request.query ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    });
    const headers = new Headers({ Accept: blob ? "*/*" : "application/json" });
    if (request.authenticated !== false) {
      const token = (await options.getToken?.())?.trim();
      if (!token) throw new ApiError("백엔드 인증 토큰이 없습니다. 다시 로그인해 주세요.", 0, "TOKEN_UNAVAILABLE");
      headers.set("Authorization", `Bearer ${token}`);
    }
    const multipart = typeof FormData !== "undefined" && request.body instanceof FormData;
    if (request.body !== undefined && !multipart) headers.set("Content-Type", "application/json");
    let response: Response;
    try {
      response = await fetch(url, {
        method: request.method ?? "GET", headers, signal: request.signal,
        body: request.body === undefined ? undefined : multipart ? request.body as FormData : JSON.stringify(request.body),
        cache: "no-store", credentials: "omit", redirect: "error",
      });
    } catch (error) {
      if (request.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
      throw new ApiError("서버에 연결하지 못했습니다. 네트워크와 API 설정을 확인해 주세요.", 0, "NETWORK_ERROR");
    }
    if (response.ok && blob && !response.headers.get("content-type")?.includes("json")) return response.blob();
    const text = await response.text();
    let data: unknown;
    try { data = text ? JSON.parse(text) : undefined; } catch {
      throw new ApiError(`서버 응답 형식이 올바르지 않습니다. (HTTP ${response.status})`, response.status, "INVALID_RESPONSE");
    }
    if (!response.ok) throw new ApiError(apiErrorMessage(data), response.status,
      record(data) && typeof data.error_code === "string" ? data.error_code : `HTTP_${response.status}`, data);
    const result = unwrapSrFormat<unknown>(data, response.status);
    if (blob) throw new ApiError("다운로드 파일 대신 JSON 응답을 받았습니다.", response.status, "INVALID_RESPONSE", result);
    return result;
  }

  return {
    availability,
    request: <T>(path: string, request: RequestOptions = {}) => transport(path, request, false) as Promise<T>,
    blob: (path: string, request: RequestOptions = {}) => transport(path, request, true) as Promise<Blob>,
    exportStats: (format: "csv" | "xlsx" | "pdf", year?: number, signal?: AbortSignal) =>
      transport("/api/admin/export/stats", { query: { format, year }, signal }, true) as Promise<Blob>,
  };
}

// Demo auth stores a user ID only. Never interpret that ID as a bearer token.
let tokenGetter: TokenGetter | undefined;
export function setApiTokenGetter(getter: TokenGetter | undefined) { tokenGetter = getter; }
export const apiClient = createApiClient({ getToken: () => tokenGetter?.() });

export interface BatchReport {
  total_count?: number;
  success_count?: number;
  failed_count?: number;
  imported_count?: number;
  total_teachers?: number;
  class_mappings?: unknown;
  assigned_classes?: unknown;
  errors?: { row: number | string; reason: unknown }[];
}
export interface AuditLogs {
  total: number;
  logs: { log_id: number | string; user_id: string; action: string; ip_address?: string; created_at: string; details: unknown }[];
}
export interface AnomalyReport {
  anomaly_count: number;
  high_risk_submissions: { submission_id: number; student_name: string; reason: string; risk_score: number }[];
}
export interface RecalculationReport { processed_students: number; recalculated_scores: number; duration_ms: number }
