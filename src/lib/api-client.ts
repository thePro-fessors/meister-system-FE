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
    if (record(value.error) && typeof value.error.message === "string") {
      const remaining = record(value.data) && typeof value.data.remainingAttempts === "number"
        ? ` (남은 시도: ${value.data.remainingAttempts}회)`
        : "";
      return `${value.error.message}${remaining}`;
    }
    for (const key of ["detail", "message", "msg", "reason"]) {
      if (value[key] !== undefined) return apiErrorMessage(value[key]);
    }
    if (value.error !== undefined) return apiErrorMessage(value.error);
    return "요청을 처리하지 못했습니다.";
  }
  return "요청을 처리하지 못했습니다.";
}

export function unwrapSrFormat<T>(value: unknown, status = 200): T {
  if (record(value) && value.success === false) {
    const errorObj = record(value.error) ? value.error : {};
    const errorCode = typeof errorObj.code === "string" ? errorObj.code : (typeof value.error_code === "string" ? value.error_code : "API_ERROR");
    throw new ApiError(apiErrorMessage(value), status, errorCode, value);
  }
  if (record(value) && value.success === true && Object.hasOwn(value, "data")) return value.data as T;
  return value as T;
}

export function createApiClient(options: { baseUrl?: string; getToken?: TokenGetter } = {}) {
  function baseUrl() {
    const configured = (options.baseUrl ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();
    if (configured) {
      let url: URL;
      try { url = new URL(configured); } catch { throw new ApiError("API 주소는 절대 HTTP(S) URL이어야 합니다.", 0, "INVALID_BASE_URL"); }
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new ApiError("API 주소 설정을 확인해 주세요.", 0, "INVALID_BASE_URL");
      }
      return url.toString().replace(/\/$/, "");
    }
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return (process.env.BACKEND_URL ?? "http://localhost").replace(/\/$/, "");
  }

  async function availability() {
    try {
      baseUrl();
      const token = await options.getToken?.();
      if (!token?.trim()) return { available: false, reason: "서버 연동 대기: 로그인이 필요합니다." };
      return { available: true, reason: "백엔드 API 서버 연결 및 인증 상태 정상." };
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

let tokenGetter: TokenGetter | undefined = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("meister_access_token");
  }
  return null;
};
export function setApiTokenGetter(getter: TokenGetter | undefined) { tokenGetter = getter; }
export async function getApiToken(): Promise<string | null> {
  const token = await tokenGetter?.();
  if (token && typeof token === "string" && token.trim()) return token.trim();
  if (typeof window !== "undefined") {
    const local = localStorage.getItem("meister_access_token");
    if (local && local.trim()) return local.trim();
    const session = sessionStorage.getItem("meister_access_token");
    if (session && session.trim()) return session.trim();
  }
  return null;
}
export const apiClient = createApiClient({ getToken: () => tokenGetter?.() });

export async function downloadSubmissionFile(submissionId: number | string, fallbackFilePath?: string): Promise<{ ok: boolean; message?: string }> {
  try {
    let downloadUrl: string | undefined;
    const numId = Number(submissionId);
    if (Number.isFinite(numId) && numId > 0) {
      const res = await apiClient.request<{ downloadUrl?: string; fileUrl?: string; ticket?: string }>(
        `/api/submissions/${numId}/download-ticket`,
        { method: "POST" }
      );
      downloadUrl = res?.downloadUrl || res?.fileUrl;
    } else if (fallbackFilePath) {
      const res = await apiClient.request<{ downloadUrl?: string; fileUrl?: string; ticket?: string }>(
        `/api/uploads/ticket`,
        { method: "POST", query: { file_path: fallbackFilePath } }
      );
      downloadUrl = res?.downloadUrl || res?.fileUrl;
    }
    if (downloadUrl) {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const fullUrl = downloadUrl.startsWith("http") ? downloadUrl : `${base}${downloadUrl.startsWith("/") ? "" : "/"}${downloadUrl}`;
      const link = document.createElement("a");
      link.href = fullUrl;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return { ok: true };
    }
    return { ok: false, message: "다운로드 주소를 발급받지 못했습니다." };
  } catch (cause) {
    return { ok: false, message: apiErrorMessage(cause) };
  }
}

export interface BatchReport {
  total_count?: number;
  totalProcessed?: number;
  success_count?: number;
  successCount?: number;
  failed_count?: number;
  failureCount?: number;
  imported_count?: number;
  total_teachers?: number;
  createdStudentsCount?: number;
  createdTeachersCount?: number;
  class_mappings?: unknown;
  assigned_classes?: unknown;
  errors?: { row: number | string; reason: unknown }[];
}
export interface AuditLogs {
  total?: number;
  pagination?: {
    totalCount?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
  logs: { log_id?: number | string; logId?: number | string; id?: string; user_id?: string; actor_role?: string; actorRole?: string; role?: string; action?: string; actionType?: string; ip_address?: string; ipAddress?: string; created_at?: string; createdAt?: string; details?: unknown; changes?: unknown; reason?: unknown }[];
}
export interface AnomalyReport {
  anomaly_count: number;
  high_risk_submissions: { submission_id: number; student_name: string; reason: string; risk_score: number }[];
}
export interface RecalculationReport {
  processed_students?: number;
  totalProcessedStudents?: number;
  recalculated_scores?: number;
  anomaliesFixedCount?: number;
  duration_ms?: number;
  averageTotalScore?: number;
}
