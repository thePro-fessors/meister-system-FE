"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { EvalItem, ScoringType } from "@/lib/types";

const SCORING_TYPES: ScoringType[] = [
  "고정점수형",
  "등급환산형",
  "구간점수형",
  "시간계산형",
  "감점형",
  "가산점형",
  "최대점제한형",
  "최상위인정형",
];

export default function AdminCriteriaPage() {
  const { criteria, updateCriteria } = useData();
  const years = criteria.map((c) => c.year).sort((a, b) => b - a);
  const [year, setYear] = useState(criteria.find((c) => c.active)?.year ?? years[0]);
  const yearCriteria = criteria.find((c) => c.year === year);
  const grades = yearCriteria?.gradeCriteria.map((g) => g.grade) ?? [];
  const [grade, setGrade] = useState(grades[0] ?? 1);

  const gradeCriteria = yearCriteria?.gradeCriteria.find((g) => g.grade === grade);

  function patchItem(areaName: string, itemId: string, patch: Partial<EvalItem>) {
    if (patch.maxScore !== undefined && (!Number.isFinite(patch.maxScore) || patch.maxScore < 0)) return;
    updateCriteria(
      criteria.map((c) =>
        c.year !== year
          ? c
          : {
              ...c,
              gradeCriteria: c.gradeCriteria.map((g) =>
                g.grade !== grade
                  ? g
                  : {
                      ...g,
                      areas: g.areas.map((a) =>
                        a.area !== areaName
                          ? a
                          : { ...a, items: a.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }
                      ),
                    }
              ),
            }
      )
    );
  }

  function patchAreaMax(areaName: string, maxScore: number) {
    if (!Number.isFinite(maxScore) || maxScore < 0) return;
    updateCriteria(
      criteria.map((c) =>
        c.year !== year
          ? c
          : {
              ...c,
              gradeCriteria: c.gradeCriteria.map((g) =>
                g.grade !== grade
                  ? g
                  : { ...g, areas: g.areas.map((a) => (a.area !== areaName ? a : { ...a, maxScore })) }
              ),
            }
      )
    );
  }

  function addItem(areaName: string) {
    const id = `item-${Date.now()}`;
    updateCriteria(
      criteria.map((c) =>
        c.year !== year
          ? c
          : {
              ...c,
              gradeCriteria: c.gradeCriteria.map((g) =>
                g.grade !== grade
                  ? g
                  : {
                      ...g,
                      areas: g.areas.map((a) =>
                        a.area !== areaName
                          ? a
                          : {
                              ...a,
                              items: [
                                ...a.items,
                                {
                                  id,
                                  name: "새 평가 항목",
                                  maxScore: 10,
                                  scoringType: "고정점수형",
                                  active: true,
                                  requiresEvidence: true,
                                },
                              ],
                            }
                      ),
                    }
              ),
            }
      )
    );
  }

  function removeItem(areaName: string, itemId: string) {
    updateCriteria(
      criteria.map((c) =>
        c.year !== year
          ? c
          : {
              ...c,
              gradeCriteria: c.gradeCriteria.map((g) =>
                g.grade !== grade
                  ? g
                  : {
                      ...g,
                      areas: g.areas.map((a) =>
                        a.area !== areaName ? a : { ...a, items: a.items.filter((i) => i.id !== itemId) }
                      ),
                    }
              ),
            }
      )
    );
  }

  const gradeThresholds = useMemo(
    () => [
      { grade: "S", rule: "영역 최대점의 90% 이상" },
      { grade: "A", rule: "영역 최대점의 80% 이상" },
      { grade: "B", rule: "영역 최대점의 70% 이상" },
      { grade: "미달성", rule: "B 기준 미만" },
    ],
    []
  );

  return (
    <div>
      <PageHeader title="기준 · 배점 관리" description="학년도 · 학년별 인증 영역, 평가 항목, 배점과 산정 방식을 관리합니다." />

      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-md border border-line bg-paper-raised px-3 py-2 text-sm outline-none focus:border-brass"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}학년도
            </option>
          ))}
        </select>
        <select
          value={grade}
          onChange={(e) => setGrade(Number(e.target.value))}
          className="rounded-md border border-line bg-paper-raised px-3 py-2 text-sm outline-none focus:border-brass"
        >
          {(grades.length ? grades : [1, 2, 3]).map((g) => (
            <option key={g} value={g}>
              {g}학년
            </option>
          ))}
        </select>
      </div>

      {!gradeCriteria && (
        <p className="rounded-lg border border-line bg-paper-raised p-8 text-center text-sm text-ink-soft">
          해당 학년도 · 학년의 기준이 아직 등록되지 않았습니다. 학년도 관리에서 이전 기준을 복사해 생성해 보세요.
        </p>
      )}

      {gradeCriteria && (
        <div className="space-y-6">
          {gradeCriteria.areas.map((area) => (
            <div key={area.area} className="overflow-hidden rounded-lg border border-line bg-paper-raised">
              <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <p className="font-display text-sm font-semibold text-ink">{area.area}</p>
                <label className="flex items-center gap-2 text-xs text-ink-soft">
                  영역 최대점
                  <input
                    type="number"
                    value={area.maxScore}
                    onChange={(e) => patchAreaMax(area.area, Number(e.target.value))}
                    className="w-20 rounded-md border border-line px-2 py-1 text-sm outline-none focus:border-brass"
                  />
                </label>
              </div>
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>평가 항목</th>
                    <th>산정 방식</th>
                    <th>최대점</th>
                    <th>사용</th>
                    <th>증빙 필요</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {area.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <input
                          value={item.name}
                          onChange={(e) => patchItem(area.area, item.id, { name: e.target.value })}
                          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm outline-none hover:border-line focus:border-brass"
                        />
                      </td>
                      <td>
                        <select
                          value={item.scoringType}
                          onChange={(e) => patchItem(area.area, item.id, { scoringType: e.target.value as ScoringType })}
                          className="rounded-md border border-line px-2 py-1 text-xs outline-none focus:border-brass"
                        >
                          {SCORING_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          value={item.maxScore}
                          onChange={(e) => patchItem(area.area, item.id, { maxScore: Number(e.target.value) })}
                          className="w-16 rounded-md border border-line px-2 py-1 text-sm outline-none focus:border-brass"
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={item.active}
                          onChange={(e) => patchItem(area.area, item.id, { active: e.target.checked })}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={item.requiresEvidence}
                          onChange={(e) => patchItem(area.area, item.id, { requiresEvidence: e.target.checked })}
                        />
                      </td>
                      <td>
                        <button onClick={() => removeItem(area.area, item.id)} className="text-ink-soft hover:text-alert">
                          <Trash2 size={15} strokeWidth={1.75} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3">
                <button
                  onClick={() => addItem(area.area)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-brass hover:underline"
                >
                  <Plus size={13} strokeWidth={2} /> 평가 항목 추가
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 overflow-hidden rounded-lg border border-line bg-paper-raised">
        <div className="border-b border-line px-5 py-3">
          <p className="font-display text-sm font-semibold text-ink">자동 등급 환산 기준</p>
        </div>
        <table className="ledger-table">
          <thead>
            <tr>
              <th>등급</th>
              <th>기준</th>
            </tr>
          </thead>
          <tbody>
            {gradeThresholds.map((g) => (
              <tr key={g.grade}>
                <td className="font-medium text-ink">{g.grade}</td>
                <td className="text-ink-soft">{g.rule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
