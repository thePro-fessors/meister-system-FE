"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { DemoUser, PointRecord, Submission, User, YearCriteria } from "@/lib/types";
import { AuthError, createDemoAuthService, publicUser, type AuthService } from "@/lib/auth-service";
import { SEED_CRITERIA, SEED_POINTS, SEED_SUBMISSIONS, SEED_USERS } from "@/lib/seed";
import { canModifyPoint, softDeletePoint, validPointMagnitude } from "@/lib/point-actions";

interface DataShape {
  users: DemoUser[];
  criteria: YearCriteria[];
  submissions: Submission[];
  points: PointRecord[];
}

// Keep legacy data intact; the new criteria use different item IDs and scores.
const STORAGE_KEY = "meister-app-data-spec-2026-v2";

function loadInitial(): DataShape {
  if (typeof window === "undefined") {
    return {
      users: SEED_USERS,
      criteria: SEED_CRITERIA,
      submissions: SEED_SUBMISSIONS,
      points: SEED_POINTS,
    };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (matchesShape(parsed, {
        users: [{ id: "", password: "", name: "", role: "" }],
        criteria: [{ year: 0, active: false, gradeCriteria: [{ grade: 0, areas: [{ area: "", maxScore: 0, items: [{ id: "", name: "", maxScore: 0, scoringType: "", active: false, requiresEvidence: false }] }] }] }],
        submissions: [{ id: "", studentId: "", year: 0, area: "", itemId: "", itemName: "", detail: "", activityDate: "", description: "", status: "", submittedAt: "" }],
        points: [{ id: "", studentId: "", type: "", score: 0, reason: "", date: "", teacherId: "", reflected: false }],
      })) {
        const data = parsed as DataShape;
        if (data.users.every((u) => ["student", "teacher", "admin"].includes(u.role))) return data;
      }
      throw new Error("저장 데이터 형식이 올바르지 않습니다. 원본 데이터는 보존되었습니다.");
    }
  } catch (cause) {
    throw cause instanceof Error ? cause : new Error("브라우저 저장 데이터를 읽을 수 없습니다.");
  }
  return {
    users: SEED_USERS,
    criteria: SEED_CRITERIA,
    submissions: SEED_SUBMISSIONS,
    points: SEED_POINTS,
  };
}

interface DataContextValue extends Omit<DataShape, "users"> {
  users: User[];
  authService: AuthService;
  registerStudent: (input: Pick<DemoUser, "id" | "password" | "name" | "grade" | "classNo" | "number">) => void;
  addSubmission: (s: Submission) => void;
  updateSubmission: (id: string, patch: Partial<Submission>) => void;
  deleteSubmission: (id: string, studentId: string) => void;
  deletePoint: (id: string, actorId: string) => void;
  addPoint: (p: PointRecord) => void;
  updatePoint: (id: string, patch: Partial<PointRecord>, editorId: string, reason: string) => void;
  updateCriteria: (criteria: YearCriteria[]) => void;
  resetToSeed: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

// Validate nested collections before exposing browser-controlled data to views.
function matchesShape(value: unknown, template: unknown): boolean {
  if (Array.isArray(template)) {
    return Array.isArray(value) && value.every((entry) => matchesShape(entry, template[0]));
  }
  if (template !== null && typeof template === "object") {
    return value !== null && typeof value === "object" && Object.entries(template).every(
      ([key, expected]) => matchesShape((value as Record<string, unknown>)[key], expected)
    );
  }
  return typeof value === typeof template && (typeof value !== "number" || Number.isFinite(value));
}

const subscribeToHydration = () => () => {};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  if (!hydrated) return <div role="status">불러오는 중...</div>;
  return <SingleWriter>{children}</SingleWriter>;
}

function SingleWriter({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"waiting" | "ready" | "unsupported">("waiting");
  useEffect(() => {
    if (!navigator.locks) {
      queueMicrotask(() => setState("unsupported"));
      return;
    }
    const controller = new AbortController();
    let release: (() => void) | undefined;
    let disposed = false;
    void navigator.locks.request("meister-app-data-writer", { signal: controller.signal }, async () => {
      if (disposed) return;
      await new Promise<void>((resolve) => {
        release = resolve;
        setState("ready");
      });
    }).catch(() => { if (!disposed) setState("unsupported"); });
    return () => { disposed = true; controller.abort(); release?.(); };
  }, []);
  if (state !== "ready") return <main className="p-8" role="status">
    {state === "waiting" ? "다른 탭에서 사용 중이면 그 탭을 닫아 주세요. 최신 데이터를 불러오기 위해 기다리는 중입니다." : "이 브라우저에서는 안전한 데모 저장을 지원하지 않습니다. HTTPS 또는 localhost에서 최신 브라우저를 사용해 주세요."}
  </main>;
  return <StorageRecovery><HydratedDataProvider>{children}</HydratedDataProvider></StorageRecovery>;
}

class StorageRecovery extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="space-y-4 p-8" role="alert">
      <h1 className="text-xl font-semibold">데모 데이터를 불러오지 못했습니다</h1>
      <p>저장 데이터는 자동 초기화하지 않았습니다. 브라우저 저장소 설정을 확인하거나 개발자 도구에서 데이터를 백업한 후 다시 시도해 주세요. 백업에는 데모 비밀번호가 포함되므로 공유하지 마세요.</p>
      <button className="rounded border p-2" onClick={() => window.location.reload()}>다시 시도</button>
      <button className="ml-3 rounded border p-2" onClick={() => {
        if (!window.confirm("백업하지 않은 데모 데이터가 모두 삭제됩니다. 초기화할까요?")) return;
        try { window.localStorage.removeItem(STORAGE_KEY); window.location.reload(); }
        catch { window.alert("저장소에 접근할 수 없습니다. 브라우저 설정을 확인해 주세요."); }
      }}>데모 데이터 초기화</button>
    </main>;
  }
}

function HydratedDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<DataShape>(loadInitial);
  const [storageError, setStorageError] = useState(false);
  const authService = useMemo(
    () => createDemoAuthService(() => data.users, () => window.sessionStorage),
    [data.users]
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage can be disabled or full; keep the current session usable.
      queueMicrotask(() => setStorageError(true));
    }
  }, [data]);

  const value = useMemo<DataContextValue>(
    () => ({
      ...data,
      points: data.points.filter((p) => !p.deletedAt),
      deletePoint: (id, actorId) => {
        const actor = data.users.find((u) => u.id === actorId);
        if (!actor) throw new Error("로그인이 필요합니다.");
        const points = softDeletePoint(data.points, id, actor, data.users, new Date().toISOString());
        setData({ ...data, points });
      },
      users: data.users.map(publicUser),
      authService,
      registerStudent: (input) => {
        const id = input.id.trim();
        const name = input.name.trim();
        if (!/^[A-Za-z0-9_]{4,20}$/.test(id) || !name || name.length > 50 || input.password.length < 8 || input.password.length > 128) {
          throw new AuthError("INVALID_INPUT", "이름, 아이디 및 비밀번호 입력 조건을 확인해 주세요.");
        }
        if (![input.grade, input.classNo, input.number].every((value) => Number.isInteger(value) && value! >= 1)
          || input.grade! > 3 || input.classNo! > 99 || input.number! > 99) {
          throw new AuthError("INVALID_INPUT", "학년, 반, 번호를 올바르게 입력해 주세요.");
        }
        if (data.users.some((user) => user.id.toLowerCase() === id.toLowerCase())) {
          throw new AuthError("DUPLICATE_ID", "이미 사용 중인 아이디입니다.");
        }
        const next = { ...data, users: [...data.users, {
          id, name, password: input.password, role: "student" as const,
          grade: input.grade, classNo: input.classNo, number: input.number,
        }] };
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          throw new AuthError("STORAGE_UNAVAILABLE", "계정을 저장하지 못했습니다. 브라우저 저장소 설정을 확인해 주세요.");
        }
        setData(next);
      },
      addSubmission: (s) => setData((d) => ({ ...d, submissions: [s, ...d.submissions] })),
      deleteSubmission: (id, studentId) => setData((d) => ({
        ...d,
        submissions: d.submissions.filter((s) => !(s.id === id && s.studentId === studentId && s.status === "제출완료")),
      })),
      updateSubmission: (id, patch) =>
        setData((d) => ({
          ...d,
          submissions: d.submissions.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        })),
      addPoint: (p) => setData((d) => ({ ...d, points: [p, ...d.points] })),
      updatePoint: (id, patch, editorId, reason) => {
        const actor = data.users.find((u) => u.id === editorId);
        const point = data.points.find((p) => p.id === id);
        const student = data.users.find((u) => u.id === point?.studentId);
        if (!actor || !point || !student || !canModifyPoint(actor, point, student) || !reason.trim()) throw new Error("수정 권한과 사유를 확인해 주세요.");
        if (patch.score !== undefined && (!validPointMagnitude(Math.abs(patch.score)) || (point.type === "상점" ? patch.score <= 0 : patch.score >= 0))) throw new Error("점수는 1~5점이어야 합니다.");
        setData((d) => ({
          ...d,
          points: d.points.map((p) =>
            p.id === id
              ? {
                  ...p,
                   score: patch.score ?? p.score,
                  editHistory: [...(p.editHistory ?? []), { editorId, reason, at: new Date().toISOString() }],
                }
              : p
          ),
        }));
      },
      updateCriteria: (criteria) => setData((d) => ({ ...d, criteria })),
      resetToSeed: () =>
        setData({
          users: SEED_USERS,
          criteria: SEED_CRITERIA,
          submissions: SEED_SUBMISSIONS,
          points: SEED_POINTS,
        }),
    }),
    [data, authService]
  );

  return <DataContext.Provider value={value}>
    {storageError && <p role="alert" className="bg-alert-soft p-3 text-sm text-alert">브라우저에 데이터를 저장할 수 없습니다. 현재 변경 사항은 새로고침하면 사라질 수 있습니다.</p>}
    {children}
  </DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
