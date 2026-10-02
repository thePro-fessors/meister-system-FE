"use client";

import { useState } from "react";
import { Copy, Plus } from "lucide-react";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { AREA_NAMES, YearCriteria } from "@/lib/types";

export default function AdminYearsPage() {
  const { criteria, updateCriteria } = useData();
  const [newYear, setNewYear] = useState(() => Math.max(...criteria.map((c) => c.year), 2026) + 1);

  function activate(year: number) {
    updateCriteria(criteria.map((c) => ({ ...c, active: c.year === year })));
  }

  function createBlank() {
    if (!Number.isInteger(newYear) || newYear < 1900 || newYear > 9999 || criteria.some((c) => c.year === newYear)) return;
    const fresh: YearCriteria = {
      year: newYear, active: false,
      gradeCriteria: [1, 2, 3].map((grade) => ({
        grade, areas: AREA_NAMES.map((area) => ({ area, maxScore: 0, items: [] })),
      })),
    };
    updateCriteria([...criteria, fresh]);
    setNewYear((y) => y + 1);
  }

  function copyFromPrevious(year: number) {
    const source = criteria.find((c) => c.year === year);
    if (!source) return;
    if (!Number.isInteger(newYear) || newYear < 1900 || newYear > 9999 || criteria.some((c) => c.year === newYear)) return;
    const copy: YearCriteria = {
      year: newYear,
      active: false,
      gradeCriteria: source.gradeCriteria.map((g) => ({
        grade: g.grade,
        areas: g.areas.map((a) => ({
          area: a.area,
          maxScore: a.maxScore,
          items: a.items.map((i) => ({ ...i, id: `${i.id}-${newYear}` })),
        })),
      })),
    };
    updateCriteria([...criteria, copy]);
    setNewYear((y) => y + 1);
  }

  const sorted = [...criteria].sort((a, b) => b.year - a.year);

  return (
    <div>
      <PageHeader title="학년도 관리" description="학년도별 인증 기준을 생성하고 활성화 상태를 관리합니다." />

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
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-navy-soft"
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
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-navy-soft"
              >
                <Copy size={13} strokeWidth={1.75} /> 이 기준 복사해 새 학년도 만들기
              </button>
              {!c.active && (
                <button
                  onClick={() => activate(c.year)}
                  className="rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-ink"
                >
                  활성화
                </button>
              )}
              {c.active && (
                <button
                  onClick={() => updateCriteria(criteria.map((cc) => (cc.year === c.year ? { ...cc, active: false } : cc)))}
                  className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-alert-soft hover:text-alert"
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
