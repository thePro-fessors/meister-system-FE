"use client";

import { useState } from "react";
import { Copy, Plus } from "lucide-react";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { apiClient, apiErrorMessage } from "@/lib/api-client";

export default function AdminYearsPage() {
  const { criteria, refresh } = useData();
  const [newYear, setNewYear] = useState(() => Math.max(...criteria.map((c) => c.year), 2026) + 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activate(year: number) {
    setBusy(true);
    setError(null);
    try {
      await apiClient.request(`/api/years/${year}`, {
        method: "PATCH",
        body: { isActivated: true, active: true },
      });
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(year: number) {
    setBusy(true);
    setError(null);
    try {
      await apiClient.request(`/api/years/${year}`, {
        method: "PATCH",
        body: { isActivated: false, active: false },
      });
      await refresh();
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
    try {
      await apiClient.request("/api/years", {
        method: "POST",
        body: { year: newYear, isActivated: false },
      });
      await refresh();
      setNewYear((y) => y + 1);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyFromPrevious(sourceYear: number) {
    if (!Number.isInteger(newYear) || newYear < 1900 || newYear > 9999) return;
    setBusy(true);
    setError(null);
    try {
      // Create target year first if not yet created, then copy
      await apiClient.request("/api/years", {
        method: "POST",
        body: { year: newYear, isActivated: false },
      }).catch(() => {});

      await apiClient.request(`/api/years/${newYear}/copy-from/${sourceYear}`, {
        method: "POST",
      });
      await refresh();
      setNewYear((y) => y + 1);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const sorted = [...criteria].sort((a, b) => b.year - a.year);

  return (
    <div>
      <PageHeader title="학년도 관리" description="학년도별 인증 기준을 생성하고 활성화 상태를 관리합니다." />
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
        {sorted.map((c) => (
          <div key={c.year} className="flex items-center justify-between rounded-lg border border-line bg-paper-raised p-5">
            <div>
              <p className="font-display text-lg font-semibold text-ink">{c.year}학년도</p>
              <p className="text-xs text-ink-soft">
                {c.gradeCriteria.length}개 학년 기준 등록됨
                {c.active && <span className="ml-2 rounded-full bg-certified-soft px-2 py-0.5 text-certified">사용 중</span>}
              </p>
            </div>
            <div className="flex gap-2">
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
