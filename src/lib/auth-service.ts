import type { DemoUser, User } from "./types";

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

export function publicUser(user: DemoUser): User {
  return {
    id: user.id, name: user.name, role: user.role,
    uuid: user.uuid, studentId: user.studentId, teacherId: user.teacherId,
    grade: user.grade, classNo: user.classNo, number: user.number, homeroom: user.homeroom,
  };
}

const SESSION_KEY = "meister-app-session-v1";

// Storage is injected so importing this module never accesses browser APIs.
export function createDemoAuthService(
  getUsers: () => readonly DemoUser[],
  getStorage: () => Pick<Storage, "getItem" | "setItem" | "removeItem">,
): AuthService {
  return {
    async restore() {
      try {
        const raw = getStorage().getItem(SESSION_KEY);
        if (!raw) return null;
        const id: unknown = JSON.parse(raw);
        const found = getUsers().find((user) => user.id === id);
        return found ? publicUser(found) : null;
      } catch {
        return null;
      }
    },
    async login({ username, password }) {
      const found = getUsers().find((user) => user.id === username && user.password === password);
      if (!found) throw new AuthError("INVALID_CREDENTIAL", "아이디 또는 비밀번호가 올바르지 않습니다.");
      try {
        getStorage().setItem(SESSION_KEY, JSON.stringify(found.id));
      } catch {
        throw new AuthError("STORAGE_UNAVAILABLE", "브라우저의 세션 저장소를 사용할 수 없습니다. 저장소 설정을 확인해 주세요.");
      }
      return publicUser(found);
    },
    async logout() {
      try {
        getStorage().removeItem(SESSION_KEY);
      } catch {
        throw new AuthError("STORAGE_UNAVAILABLE", "세션을 삭제하지 못했습니다. 브라우저 저장소 설정을 확인한 뒤 다시 시도해 주세요.");
      }
    },
  };
}
