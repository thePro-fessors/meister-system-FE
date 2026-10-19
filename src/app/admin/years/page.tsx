"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Plus } from "lucide-react";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { apiClient, apiErrorMessage } from "@/lib/api-client";

interface ServerYearItem {
  year: number;
  isActivated?: boolean;
  active?: boolean;
}

export default function AdminYearsPage() {
  const { criteria, refresh } = useData();
  const [serverYears, setServerYears] = useState<ServerYearItem[]>([]);
  const [newYear, setNewYear] = useState(() => Math.max(...criteria.map((c) => c.year), 2026) + 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadYears() {
    try {
      const res = await apiClient.request<{ years?: any[] } | any[]>("/api/years");
      const raw = Array.isArray(res) ? res : (res?.years ?? []);
      if (Array.isArray(raw)) {
        const mapped = raw
          .map((y) => ({
            year: Number(y.year),
            active: Boolean(y.isActivated ?? y.is_activated ?? y.active),
          }))
          .filter((y) => Number.isFinite(y.year));
        setServerYears(mapped);
        if (mapped.length > 0) {
          const maxY = Math.max(...mapped.map((m) => m.year), ...criteria.map((c) => c.year), 2026);
          setNewYear((prev) => (mapped.some((m) => m.year === prev) ? maxY + 1 : prev));
        }
      }
    } catch {
      // Fallback to criteria from DataContext
    }
  }

  useEffect(() => {
    void loadYears();
  }, [criteria]);

  const mergedYears = useMemo(() => {
    const map = new Map<number, { year: number; active: boolean; gradeCount: number }>();
    for (const c of criteria) {
      map.set(c.year, { year: c.year, active: c.active, gradeCount: c.gradeCriteria.length });
    }
    for (const sy of serverYears) {
      const existing = map.get(sy.year);
      if (existing) {
        map.set(sy.year, { ...existing, active: Boolean(sy.active) });
      } else {
        map.set(sy.year, { year: sy.year, active: Boolean(sy.active), gradeCount: 3 });
      }
    }
    return [...map.values()].sort((a, b) => b.year - a.year);
  }, [criteria, serverYears]);

  async function activate(year: number) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiClient.request(`/api/years/${year}`, {
        method: "PATCH",
        body: { isActivated: true, active: true },
      });
      await Promise.all([refresh(), loadYears()]);
      setNotice(`${year}학년도가 활성화되었습니다.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(year: number) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiClient.request(`/api/years/${year}`, {
        method: "PATCH",
        body: { isActivated: false, active: false },
      });
      await Promise.all([refresh(), loadYears()]);
      setNotice(`${year}학년도가 비활성화되었습니다.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function createBlank() {
    if (!Number.isInteger(newYear) || newYear < 1900 || newYear > 9999) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiClient.request("/api/years", {
        method: "POST",
        body: { year: newYear, isActivated: false },
      });
      await Promise.all([refresh(), loadYears()]);
      setNotice(`${newYear}학년도가 생성되었습니다.`);
      setNewYear((y) => y + 1);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyFromPrevious(sourceYear: number) {
    const existingSet = new Set(mergedYears.map((y) => y.year));
    const targetYear =
      Number.isInteger(newYear) && newYear >= 1900 && newYear <= 9999 && !existingSet.has(newYear)
        ? newYear
        : Math.max(...mergedYears.map((y) => y.year), 2026) + 1;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiClient.request("/api/years", {
        method: "POST",
        body: { year: targetYear, isActivated: false },
      }).catch(() => {});

      await apiClient.request(`/api/years/${targetYear}/copy-from/${sourceYear}`, {
        method: "POST",
      });
      await Promise.all([refresh(), loadYears()]);
      setNotice(`${sourceYear}학년도 기준을 복사하여 ${targetYear}학년도를 생성했습니다.`);
      setNewYear(targetYear + 1);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="학년도 관리" description="학년도별 인증 기준을 생성하고 활성화 상태를 관리합니다." />
      {notice && <p role="status" className="mb-4 rounded-md bg-certified-soft p-3 text-sm text-certified">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded-md bg-alert-soft p-3 text-sm text-alert">{error}</p>}

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-paper-raised p-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">새 학년도</label>
          <input
            type="number"
            value={newYear}
            onChange={(e) => setNewYear(Number(e.target.value))}
            className="w-32 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brass"
          />
        </div>
        <button
          onClick={createBlank}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-navy-soft disabled:opacity-50"
        >
          <Plus size={15} strokeWidth={2} /> 빈 기준으로 생성
        </button>
      </div>

      <div className="space-y-3">
        {mergedYears.map((c) => (
          <div key={c.year} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-paper-raised p-5">
            <div>
              <p className="font-display text-lg font-semibold text-ink">{c.year}학년도</p>
              <p className="text-xs text-ink-soft">
                {c.gradeCount}개 학년 기준 등록됨
                {c.active && <span className="ml-2 rounded-full bg-certified-soft px-2 py-0.5 text-certified">사용 중</span>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => copyFromPrevious(c.year)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-navy-soft disabled:opacity-50"
              >
                <Copy size={13} strokeWidth={1.75} /> 이 기준 복사해 새 학년도 만들기
              </button>
              {!c.active && (
                <button
                  onClick={() => activate(c.year)}
                  disabled={busy}
                  className="rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-ink disabled:opacity-50"
                >
                  활성화
                </button>
              )}
              {c.active && (
                <button
                  onClick={() => deactivate(c.year)}
                  disabled={busy}
                  className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-alert-soft hover:text-alert disabled:opacity-50"
                >
                  비활성화
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
