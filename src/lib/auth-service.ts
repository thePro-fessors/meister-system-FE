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
const DEMO_USER_STORAGE_KEY = "meister_current_user";

export interface StorageLike {
  getItem(key: string): string | null | undefined;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createDemoAuthService(
  getUsers: () => Array<User & { password?: string }>,
  getStorage: () => StorageLike | null = () => (typeof window !== "undefined" ? window.localStorage : null),
): AuthService {
  return {
    async restore() {
      try {
        const storage = getStorage();
        const storedId = storage?.getItem(DEMO_USER_STORAGE_KEY);
        if (!storedId) return null;
        const found = getUsers().find((u) => u.id === storedId);
        return found ? publicUser(found) : null;
      } catch {
        return null;
      }
    },
    async login({ username, password }) {
      const found = getUsers().find((u) => u.id === username && u.password === password);
      if (!found) {
        throw new AuthError("INVALID_CREDENTIAL", "아이디 또는 비밀번호가 올바르지 않습니다.");
      }
      try {
        const storage = getStorage();
        if (!storage) throw new Error("No storage");
        storage.setItem(DEMO_USER_STORAGE_KEY, found.id);
      } catch {
        throw new AuthError("STORAGE_UNAVAILABLE", "브라우저 저장소에 접근할 수 없습니다.");
      }
      return publicUser(found);
    },
    async logout() {
      try {
        const storage = getStorage();
        if (!storage) throw new Error("No storage");
        storage.removeItem(DEMO_USER_STORAGE_KEY);
      } catch {
        throw new AuthError("STORAGE_UNAVAILABLE", "브라우저 저장소에 접근할 수 없습니다.");
      }
    },
  };
}

export function createBackendAuthService(
  client = apiClient,
  getStorage: () => StorageLike | null = () => (typeof window !== "undefined" ? window.localStorage : null),
): AuthService {
  return {
    async restore() {
      let storage: StorageLike | null = null;
      try {
        storage = getStorage();
      } catch {
        return null;
      }
      if (!storage) return null;
      const token = storage.getItem(TOKEN_STORAGE_KEY);
      if (!token || !token.trim()) return null;
      try {
        const raw = await client.request<unknown>("/api/auth/me", {
          method: "GET",
          authenticated: true,
        });
        const envelope = { status_code: 200, success: true, data: raw };
        return parseMeResponse(envelope);
      } catch (err) {
        const status = err instanceof ApiError ? err.status : (err && typeof err === "object" && "status" in err ? (err as { status?: number }).status : undefined);
        if (status === 401) {
          storage.removeItem(TOKEN_STORAGE_KEY);
        }
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
        const storage = getStorage();
        storage?.setItem(TOKEN_STORAGE_KEY, parsed.token);
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
        try {
          getStorage()?.removeItem(TOKEN_STORAGE_KEY);
        } catch {
          // Ignore storage error during logout cleanup
        }
      }
    },
  };
}
