import { AuthError } from "./auth-service";
import type { User } from "./types";

// Pure boundary helpers for BE/routers/auth.py. No network or token storage here.
function invalid(): never {
  throw new AuthError("INVALID_RESPONSE", "로그인 응답 형식이 올바르지 않습니다. 다시 시도해 주세요.");
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string" || !value.trim()) return invalid();
  return value.trim();
}

function optionalNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < 0) return undefined;
  return Math.round(num);
}

function dataFromEnvelope(value: unknown): Record<string, unknown> {
  const response = object(value);
  if (response.success === false) {
    const error = response.error ? object(response.error) : {};
    throw new AuthError(error.code ? text(error.code) : "AUTH_ERROR", error.message ? text(error.message) : "인증에 실패했습니다.");
  }
  if (response.success !== true && response.status_code !== 200 && response.status_code !== 201) return invalid();
  return object(response.data);
}

export function parseBackendUser(value: unknown): User {
  const user = object(value);
  const role = user.role;
  if (role !== "student" && role !== "teacher" && role !== "admin") return invalid();
  return {
    id: text(user.id),
    uuid: user.uuid ? text(user.uuid) : undefined,
    name: text(user.name),
    role,
    studentId: optionalNumber(user.studentId ?? user.student_id),
    teacherId: optionalNumber(user.teacherId ?? user.teachers_id),
    grade: optionalNumber(user.grade),
    classNo: optionalNumber(user.classNo ?? user.class_no ?? user.class),
    number: optionalNumber(user.number ?? user.student_number ?? user.studentNo),
    homeroom: user.homeroom == null ? undefined : String(user.homeroom),
    teacherDuty: user.teacherDuty as any,
    teacherScope: user.teacherScope as any,
    email: typeof user.email === "string" ? user.email : undefined,
    schoolEmail: typeof user.schoolEmail === "string" ? user.schoolEmail : undefined,
  };
}

export function parseLoginResponse(value: unknown) {
  const data = dataFromEnvelope(value);
  const currentYear = optionalNumber(data.currentYear ?? data.current_year) ?? 2026;
  const token = text(data.token ?? data.access_token ?? data.accessToken);
  return { token, currentYear, user: parseBackendUser(data.user) };
}

export function parseMeResponse(value: unknown): User {
  const data = dataFromEnvelope(value);
  return parseBackendUser(data.user ?? data);
}
