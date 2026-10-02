"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, CheckCircle2, UploadCloud, Link as LinkIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { AREA_NAMES, AreaName, EvalItem } from "@/lib/types";
import { classifySubmission } from "@/lib/ai";

export default function SubmitPage() {
  const { user } = useAuth();
  const { criteria, addSubmission } = useData();
  const router = useRouter();

  const year = criteria.find((c) => c.active);
  const gradeCriteria = year?.gradeCriteria.find((g) => g.grade === user?.grade);

  const areaItems = useMemo(() => {
    const map: Record<AreaName, EvalItem[]> = {} as Record<AreaName, EvalItem[]>;
    for (const a of gradeCriteria?.areas ?? []) {
      map[a.area] = a.items.filter((i) => i.active);
    }
    return map;
  }, [gradeCriteria]);

  const [area, setArea] = useState<AreaName>(AREA_NAMES[1]);
  const [itemId, setItemId] = useState("");
  const [detail, setDetail] = useState("");
  const [activityDate, setActivityDate] = useState("");
  const [fileName, setFileName] = useState("");
  const [link, setLink] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [aiApplied, setAiApplied] = useState(false);

  const items = areaItems[area] ?? [];

  const suggestions = useMemo(() => {
    if (!detail && !description) return [];
    return classifySubmission(detail, description, areaItems);
  }, [detail, description, areaItems]);

  function applySuggestion(sugArea: AreaName, itemName: string) {
    setArea(sugArea);
    const match = areaItems[sugArea]?.find((i) => i.name === itemName);
    setItemId(match?.id ?? "");
    setAiApplied(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!user || !year) {
      setError("활성화된 학년도가 없습니다. 관리자에게 문의해 주세요.");
      return;
    }
    const item = items.find((i) => i.id === itemId);
    if (!item) {
      setError("평가 항목을 선택해 주세요.");
      return;
    }
    if (!activityDate) {
      setError("활동일을 입력해 주세요.");
      return;
    }
    if (item.requiresEvidence && !fileName && !link.trim()) {
      setError("파일 첨부 또는 링크 첨부 중 최소 하나는 입력해야 합니다.");
      return;
    }
    if (!description.trim()) {
      setError("제출 자료에 대한 설명을 입력해 주세요.");
      return;
    }

    if (link.trim()) {
      try {
        const url = new URL(link.trim());
        if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid protocol");
      } catch {
        setError("http:// 또는 https://로 시작하는 올바른 링크를 입력해 주세요.");
        return;
      }
    }
    const now = new Date().toISOString().slice(0, 10);

    addSubmission({
      id: `sub-${Date.now()}`,
      studentId: user.id,
      year: year.year,
      area,
      itemId,
      itemName: item.name,
      detail,
      activityDate,
      fileName: fileName || undefined,
      link: link.trim() || undefined,
      description,
      status: "제출완료",
      submittedAt: now,
      aiSuggestion: suggestions[0]
        ? { area: suggestions[0].area, itemName: suggestions[0].itemGuess, confidence: suggestions[0].confidence }
        : undefined,
    });

    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-line bg-paper-raised px-8 py-16 text-center">
        <CheckCircle2 size={36} className="mb-4 text-certified" strokeWidth={1.5} />
        <h2 className="font-display text-xl font-semibold text-ink">증빙자료가 제출되었습니다</h2>
        <p className="mt-2 text-sm text-ink-soft">제출 상태는 &lsquo;제출완료&rsquo;로 등록되었으며, 교사 검토 후 결과가 반영됩니다.</p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => router.push("/student/submissions")}
            className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-ink"
          >
            제출 내역 보기
          </button>
          <button
            onClick={() => {
              setDone(false);
              setDetail("");
              setDescription("");
              setFileName("");
              setLink("");
              setItemId("");
              setActivityDate("");
              setAiApplied(false);
            }}
            className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-navy-soft"
          >
            새 자료 제출
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="증빙자료 제출"
        description="인정받고 싶은 활동의 증빙자료를 제출하세요. AI가 입력 내용을 분석해 적절한 인증 영역을 추천합니다."
      />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-5 rounded-lg border border-line bg-paper-raised p-6 lg:col-span-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">인증 영역</label>
              <select
                value={area}
                onChange={(e) => {
                  setArea(e.target.value as AreaName);
                  setItemId("");
                }}
                className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brass focus:ring-1 focus:ring-brass"
              >
                {AREA_NAMES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">평가 항목</label>
              <select
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brass focus:ring-1 focus:ring-brass"
              >
                <option value="">선택하세요</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} (최대 {i.maxScore}점)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">세부 항목 정보</label>
            <input
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="예: 정보처리기능사, 교내 대회, 봉사 30시간 등"
              className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brass focus:ring-1 focus:ring-brass"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">활동일</label>
            <input
              type="date"
              value={activityDate}
              onChange={(e) => setActivityDate(e.target.value)}
              className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brass focus:ring-1 focus:ring-brass sm:w-56"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink">
                <UploadCloud size={15} strokeWidth={1.75} /> 파일 첨부
              </label>
              <input
                type="file"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none file:mr-3 file:rounded file:border-0 file:bg-navy-soft file:px-2.5 file:py-1 file:text-xs"
              />
              <p className="mt-1 text-xs text-ink-soft">데모에서는 파일명만 저장됩니다. 실제 증빙 확인은 링크를 이용해 주세요.</p>
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink">
                <LinkIcon size={15} strokeWidth={1.75} /> 링크 첨부
              </label>
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://github.com/..."
                className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brass focus:ring-1 focus:ring-brass"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="제출 자료에 대해 간단히 설명해 주세요."
              className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brass focus:ring-1 focus:ring-brass"
            />
          </div>

          {error && <p className="rounded-md bg-alert-soft px-3 py-2 text-sm text-alert">{error}</p>}

          <button
            type="submit"
            className="w-full rounded-md bg-navy py-2.5 text-sm font-medium text-white hover:bg-ink sm:w-auto sm:px-6"
          >
            증빙자료 제출
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-brass/40 bg-brass-soft/40 p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles size={17} className="text-brass" strokeWidth={1.75} />
              <p className="text-sm font-semibold text-ink">AI 자동 분류 추천</p>
            </div>
            {suggestions.length === 0 ? (
              <p className="text-sm text-ink-soft">
                세부 항목 정보나 설명을 입력하면, AI가 활동 내용을 분석해 어울리는 인증 영역과 평가 항목을 추천합니다.
              </p>
            ) : (
              <div className="space-y-2.5">
                {suggestions.map((s) => (
                  <button
                    type="button"
                    key={s.area}
                    onClick={() => applySuggestion(s.area, s.itemGuess)}
                    className="block w-full rounded-md border border-brass/50 bg-white px-3 py-2.5 text-left text-sm transition-colors hover:bg-brass-soft"
                  >
                    <p className="font-medium text-ink">
                      {s.area} <span className="text-ink-soft">· {s.itemGuess}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      일치 키워드: {s.matchedKeywords.join(", ")} · 신뢰도 {(s.confidence * 100).toFixed(0)}%
                    </p>
                    {s.scoreHint && <p className="mt-0.5 text-xs text-brass">{s.scoreHint}</p>}
                  </button>
                ))}
                {aiApplied && (
                  <p className="text-xs text-certified">AI 추천이 왼쪽 양식에 적용되었습니다.</p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-line bg-paper-raised p-5">
            <p className="mb-2 text-sm font-medium text-ink">제출 안내</p>
            <ul className="space-y-1.5 text-xs text-ink-soft">
              <li>· 증빙 필수 항목은 파일 또는 링크를 첨부해야 합니다.</li>
              <li>· 제출 직후 상태는 &lsquo;제출완료&rsquo;로 등록됩니다.</li>
              <li>· 반려된 자료는 보완 후 재제출할 수 있습니다.</li>
              <li>· 다른 학생의 제출 자료는 확인할 수 없습니다.</li>
            </ul>
          </div>
        </div>
      </form>
    </div>
  );
}
