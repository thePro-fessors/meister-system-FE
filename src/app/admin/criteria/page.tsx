"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { EvalItem, ScoringType } from "@/lib/types";
import { apiClient, apiErrorMessage } from "@/lib/api-client";

const SCORING_TYPES: ScoringType[] = [
  "누적합산형",
  "최고점수반영형",
  "고정점수형",
  "등급환산형",
  "구간점수형",
  "시간계산형",
  "감점형",
  "가산점형",
  "최대점제한형",
  "최상위인정형",
];

const SCORING_TYPE_CODE_MAP: Record<string, number> = {
  "고정점수형": 1,
  "등급환산형": 2,
  "구간점수형": 3,
  "시간계산형": 4,
  "감점형": 5,
  "가산점형": 6,
  "최대점제한형": 7,
  "최상위인정형": 8,
  "누적합산형": 1,
  "최고점수반영형": 8,
};

function getDefaultRulesForType(type: ScoringType, maxScore: number) {
  if (type === "등급환산형") {
    return [
      { conditionValue: "S", score: maxScore },
      { conditionValue: "A", score: Math.round(maxScore * 0.8 * 10) / 10 },
      { conditionValue: "B", score: Math.round(maxScore * 0.6 * 10) / 10 },
      { conditionValue: "C", score: Math.round(maxScore * 0.4 * 10) / 10 },
    ];
  }
  if (type === "구간점수형") {
    return [
      { conditionValue: ">=800", score: maxScore },
      { conditionValue: "700~795", score: Math.round(maxScore * 0.8 * 10) / 10 },
      { conditionValue: "600~695", score: Math.round(maxScore * 0.6 * 10) / 10 },
    ];
  }
  if (type === "시간계산형") {
    return [{ conditionValue: "시간당", score: 0.3 }];
  }
  if (type === "감점형") {
    return [{ conditionValue: "1회당", score: 2.0 }];
  }
  if (type === "가산점형") {
    return [{ conditionValue: "입상1건당", score: 3.0 }];
  }
  return [];
}

export default function AdminCriteriaPage() {
  const { criteria, submissions, updateCriteria, refresh } = useData();
  const [error, setError] = useState("");
  const idRef = useRef(0);
  const years = criteria.map((c) => c.year).sort((a, b) => b - a);
  const [year, setYear] = useState(criteria.find((c) => c.active)?.year ?? years[0]);
  const yearCriteria = criteria.find((c) => c.year === year);
  const grades = yearCriteria?.gradeCriteria.map((g) => g.grade) ?? [];
  const [grade, setGrade] = useState(grades[0] ?? 1);

  const gradeCriteria = yearCriteria?.gradeCriteria.find((g) => g.grade === grade);
  const patchTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [editingRulesItem, setEditingRulesItem] = useState<{ areaName: string; item: EvalItem } | null>(null);
  const [ruleDrafts, setRuleDrafts] = useState<Array<{ conditionValue: string; score: number }>>([]);

  function schedulePatch(key: string, fn: () => Promise<void>) {
    if (patchTimersRef.current[key]) {
      clearTimeout(patchTimersRef.current[key]);
    }
    patchTimersRef.current[key] = setTimeout(() => {
      void fn();
    }, 350);
  }

  async function patchItem(areaName: string, itemId: string, patch: Partial<EvalItem>) {
    if (patch.maxScore !== undefined && (!Number.isFinite(patch.maxScore) || patch.maxScore < 0)) return;
    setError("");
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
    const numId = Number(itemId.replace(/^item-/, ""));
    if (Number.isFinite(numId) && numId > 0) {
      schedulePatch(`item-${numId}`, async () => {
        try {
          await apiClient.request(`/api/admin/criteria/items/${numId}`, {
            method: "PATCH",
            body: {
              name: patch.name,
              maxScore: patch.maxScore,
              scoringType: patch.scoringType ? SCORING_TYPE_CODE_MAP[patch.scoringType] : undefined,
              scoringRules: patch.scoringRules,
              isActive: patch.active,
              requiresEvidence: patch.requiresEvidence,
            },
          });
        } catch (err) {
          setError(apiErrorMessage(err));
        }
      });
    }
  }

  async function patchAreaMax(areaName: string, maxScore: number) {
    if (!Number.isFinite(maxScore) || maxScore < 0) return;
    setError("");
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
    const currentArea = gradeCriteria?.areas.find((a) => a.area === areaName);
    if (currentArea?.areaId) {
      const areaId = currentArea.areaId;
      schedulePatch(`area-${areaId}`, async () => {
        try {
          await apiClient.request(`/api/admin/criteria/areas/${areaId}`, {
            method: "PATCH",
            body: { maxScore },
          });
        } catch (err) {
          setError(apiErrorMessage(err));
        }
      });
    }
  }

  async function addItem(areaName: string) {
    setError("");
    const currentArea = gradeCriteria?.areas.find((a) => a.area === areaName);
    if (currentArea?.areaId) {
      try {
        await apiClient.request(`/api/admin/criteria/areas/${currentArea.areaId}/items`, {
          method: "POST",
          body: {
            name: "새 평가 항목",
            maxScore: 10,
            targetGrade: grade,
            scoringType: 1,
            requiresEvidence: true,
          },
        });
        await refresh();
        return;
      } catch (err) {
        setError(apiErrorMessage(err));
      }
    }
    idRef.current += 1;
    const id = `item-new-${idRef.current}`;
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
                                  scoringType: "누적합산형",
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

  async function removeItem(areaName: string, itemId: string) {
    if (submissions.some((s) => s.year === year && s.area === areaName && s.itemId === itemId)) {
      setError("제출 자료가 있는 항목은 삭제할 수 없습니다. 기존 점수를 보존하려면 항목을 비활성화해 주세요.");
      return;
    }
    setError("");
    const numId = Number(itemId.replace(/^item-/, ""));
    if (Number.isFinite(numId) && numId > 0) {
      try {
        await apiClient.request(`/api/admin/criteria/items/${numId}`, {
          method: "DELETE",
        });
        await refresh();
      } catch (err) {
        setError(apiErrorMessage(err));
      }
    }
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
      {error && <p role="alert" className="mb-4 rounded-md bg-alert-soft p-3 text-sm text-alert">{error}</p>}

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
                        {["등급환산형", "구간점수형", "시간계산형", "감점형", "가산점형"].includes(item.scoringType) && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRulesItem({ areaName: area.area, item });
                              setRuleDrafts(item.scoringRules?.length ? [...item.scoringRules] : getDefaultRulesForType(item.scoringType, item.maxScore));
                            }}
                            className="mt-1 block text-left text-xs font-medium text-brass hover:underline"
                          >
                            규칙 설정 ({item.scoringRules?.length || 0}건)
                          </button>
                        )}
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
                        <button
                          type="button"
                          aria-label={`${item.name} 항목 삭제`}
                          title="항목 삭제"
                          onClick={() => removeItem(area.area, item.id)}
                          className="text-ink-soft hover:text-alert"
                        >
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
          <p className="font-display text-sm font-semibold text-ink">영역별 등급 환산 기준</p>
          <p className="mt-2 text-sm text-ink-soft">학교 마이스터역량인증제 평가 기준에 따른 영역별 환산 기준표입니다.</p>
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

      {editingRulesItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg border border-line bg-paper-raised p-6 shadow-xl">
            <h3 className="font-display text-base font-semibold text-ink">
              {editingRulesItem.item.name} · 배점 규칙 설정
            </h3>
            <p className="mt-1 text-xs text-ink-soft">
              배점 유형: {editingRulesItem.item.scoringType} (항목 최대점 {editingRulesItem.item.maxScore}점)
            </p>
            <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
              {ruleDrafts.map((rd, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    placeholder="조건값 (예: S, >=800, 시간당)"
                    value={rd.conditionValue}
                    onChange={(e) => {
                      const updated = [...ruleDrafts];
                      updated[idx].conditionValue = e.target.value;
                      setRuleDrafts(updated);
                    }}
                    className="flex-1 rounded-md border border-line px-2 py-1 text-xs outline-none focus:border-brass"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="부여 점수"
                    value={rd.score}
                    onChange={(e) => {
                      const updated = [...ruleDrafts];
                      updated[idx].score = Number(e.target.value);
                      setRuleDrafts(updated);
                    }}
                    className="w-20 rounded-md border border-line px-2 py-1 text-xs outline-none focus:border-brass"
                  />
                  <button
                    type="button"
                    onClick={() => setRuleDrafts(ruleDrafts.filter((_, i) => i !== idx))}
                    className="text-ink-soft hover:text-alert p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setRuleDrafts([...ruleDrafts, { conditionValue: "", score: 0 }])}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brass hover:underline"
            >
              <Plus size={12} /> 규칙 행 추가
            </button>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingRulesItem(null)}
                className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-paper"
              >
                취소
              </button>
              <button
                type="button"
                onClick={async () => {
                  const cleaned = ruleDrafts.filter((r) => r.conditionValue.trim());
                  await patchItem(editingRulesItem.areaName, editingRulesItem.item.id, { scoringRules: cleaned });
                  setEditingRulesItem(null);
                }}
                className="rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-ink"
              >
                규칙 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
