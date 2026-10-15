"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiClient, apiErrorMessage } from "@/lib/api-client";

export const specButton = "rounded-md bg-navy px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50";
export const specInput = "w-full rounded-md border border-line bg-paper-raised px-3 py-2 text-sm text-ink";

export function SpecAdminPanel({ children }: { children: React.ReactNode }) {
  return <section className="my-5 space-y-4 rounded-lg border border-line bg-paper-raised p-5">{children}</section>;
}

export function SpecAdminLinks() {
  return <nav aria-label="관리 도구" className="flex flex-wrap gap-4 text-sm text-brass">
    <Link href="/admin/overview">전체 현황</Link><Link href="/admin/batch">명단 일괄 등록</Link><Link href="/admin/audit">감사로그 및 이상탐지</Link>
  </nav>;
}

export function useApiAvailability() {
  const { user } = useAuth();
  const [state, setState] = useState({ available: false, reason: "API 설정 확인 중..." });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void apiClient.availability().then((result) => { if (active) setState(result); });
    return () => { active = false; };
  }, [user, revision]);
  return { ...state, recheck: () => setRevision((value) => value + 1) };
}

export function ApiAvailability({ state }: { state: ReturnType<typeof useApiAvailability> }) {
  return <div role="status" className="my-5 space-y-2 rounded-lg bg-brass-soft p-4 text-sm text-ink">
    <p>{state.reason}</p>
    <button className="text-brass underline" onClick={state.recheck}>연동 설정 다시 확인</button>
  </div>;
}

// Each operation owns its controller and generation; stale results never replace a newer request.
export function useApiTask<T>() {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const reset = useCallback(() => {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
    setData(null); setError(null); setLoading(false);
  }, []);
  useEffect(() => () => { generation.current++; controller.current?.abort(); }, []);
  const run = useCallback(async (operation: (signal: AbortSignal) => Promise<T>, replace = false) => {
    if (controller.current && !replace) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const version = ++generation.current;
    setLoading(true); setError(null); setData(null);
    try {
      const result = await operation(current.signal);
      if (version === generation.current) setData(result);
    } catch (cause) {
      if (version === generation.current && !current.signal.aborted) setError(apiErrorMessage(cause));
    } finally {
      if (version === generation.current) { setLoading(false); controller.current = null; }
    }
  }, []);
  return { data, error, loading, run, reset };
}

export function TaskStatus({ loading, error }: { loading: boolean; error: string | null }) {
  return <>{loading && <p role="status" className="text-sm text-ink-soft">처리 중입니다...</p>}
    {error && <p role="alert" className="rounded-md bg-alert-soft p-3 text-sm text-alert">{error}</p>}</>;
}
