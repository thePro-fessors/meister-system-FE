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
  if (typeof value !== "string" || !value.trim()) return invalid();
  return value;
}

function optionalNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) return invalid();
  return value;
}

function dataFromEnvelope(value: unknown): Record<string, unknown> {
  const response = object(value);
  if (response.success === false) {
    const error = object(response.error);
    throw new AuthError(text(error.code), text(error.message));
  }
  if (response.success !== true || response.status_code !== 200) return invalid();
  return object(response.data);
}

export function parseBackendUser(value: unknown): User {
  const user = object(value);
  const role = user.role;
  if (role !== "student" && role !== "teacher" && role !== "admin") return invalid();
  return {
    id: text(user.id), uuid: text(user.uuid), name: text(user.name), role,
    studentId: optionalNumber(user.studentId), teacherId: optionalNumber(user.teacherId),
    grade: optionalNumber(user.grade), classNo: optionalNumber(user.classNo),
    number: optionalNumber(user.number),
    homeroom: user.homeroom == null ? undefined : text(user.homeroom),
  };
}

export function parseLoginResponse(value: unknown) {
  const data = dataFromEnvelope(value);
  const currentYear = optionalNumber(data.currentYear);
  if (currentYear === undefined) return invalid();
  return { token: text(data.token), currentYear, user: parseBackendUser(data.user) };
}

export function parseMeResponse(value: unknown): User {
  return parseBackendUser(dataFromEnvelope(value).user);
}
