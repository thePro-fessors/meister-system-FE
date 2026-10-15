import type { User } from "./types";
import { apiClient, ApiError, apiErrorMessage } from "./api-client";
import { parseLoginResponse, parseMeResponse } from "./auth-contract";

export interface LoginInput {
  username: string;
  password: string;
}

export interface AuthService {
  restore(): Promise<User | null>;
  login(input: LoginInput): Promise<User>;
  logout(): Promise<void>;
}

export class AuthError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export function publicUser(user: any): User {
  return {
    id: String(user.id),
    name: user.name,
    role: user.role,
    uuid: user.uuid,
    studentId: user.studentId,
    teacherId: user.teacherId,
    grade: user.grade,
    classNo: user.classNo,
    number: user.number,
    homeroom: user.homeroom,
    teacherDuty: user.teacherDuty,
    teacherScope: user.teacherScope ? {
      ...user.teacherScope,
      classrooms: user.teacherScope.classrooms?.slice(),
      areas: user.teacherScope.areas?.slice(),
      itemIds: user.teacherScope.itemIds?.slice(),
      studentIds: user.teacherScope.studentIds?.slice(),
    } : undefined,
    email: user.email,
  };
}

export const TOKEN_STORAGE_KEY = "meister_access_token";

export function createBackendAuthService(client = apiClient): AuthService {
  return {
    async restore() {
      if (typeof window === "undefined") return null;
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token || !token.trim()) return null;
      try {
        const raw = await client.request<unknown>("/api/auth/me", {
          method: "GET",
          authenticated: true,
        });
        const envelope = { status_code: 200, success: true, data: raw };
        return parseMeResponse(envelope);
      } catch {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        return null;
      }
    },
    async login({ username, password }) {
      try {
        const raw = await client.request<unknown>("/api/auth/login", {
          method: "POST",
          body: { username, password },
          authenticated: false,
        });
        const envelope = { status_code: 200, success: true, data: raw };
        const parsed = parseLoginResponse(envelope);
        if (typeof window !== "undefined") {
          localStorage.setItem(TOKEN_STORAGE_KEY, parsed.token);
        }
        return parsed.user;
      } catch (err) {
        if (err instanceof ApiError) {
          throw new AuthError(err.code, err.message);
        }
        throw new AuthError("LOGIN_FAILED", apiErrorMessage(err));
      }
    },
    async logout() {
      try {
        await client.request("/api/auth/logout", {
          method: "POST",
          authenticated: true,
        });
      } catch {
        // Proceed with local logout regardless of network error
      } finally {
        if (typeof window !== "undefined") {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      }
    },
  };
}
