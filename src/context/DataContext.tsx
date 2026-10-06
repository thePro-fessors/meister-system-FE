"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { DemoUser, PointRecord, Submission, User, YearCriteria } from "@/lib/types";
import { createDemoAuthService, publicUser, type AuthService } from "@/lib/auth-service";
import { SEED_CRITERIA, SEED_POINTS, SEED_SUBMISSIONS, SEED_USERS } from "@/lib/seed";
import { softDeletePoint } from "@/lib/point-actions";

interface DataShape {
  users: DemoUser[];
  criteria: YearCriteria[];
  submissions: Submission[];
  points: PointRecord[];
}

const STORAGE_KEY = "meister-app-data-v1";

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
    if (raw) {
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
    }
  } catch {
    // ignore corrupt storage
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
  return <HydratedDataProvider>{children}</HydratedDataProvider>;
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
      addSubmission: (s) => setData((d) => ({ ...d, submissions: [s, ...d.submissions] })),
      deleteSubmission: (id, studentId) => setData((d) => ({
        ...d,
        submissions: d.submissions.filter((s) => !(s.id === id && s.studentId === studentId && s.status !== "인정완료")),
      })),
      updateSubmission: (id, patch) =>
        setData((d) => ({
          ...d,
          submissions: d.submissions.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        })),
      addPoint: (p) => setData((d) => ({ ...d, points: [p, ...d.points] })),
      updatePoint: (id, patch, editorId, reason) =>
        setData((d) => ({
          ...d,
          points: d.points.map((p) =>
            p.id === id
              ? {
                  ...p,
                  ...patch,
                  editHistory: [...(p.editHistory ?? []), { editorId, reason, at: new Date().toISOString() }],
                }
              : p
          ),
        })),
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
