"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { AREA_NAMES, AreaName, EvalItem } from "@/lib/types";
import { classifySubmission } from "@/lib/ai";
import { apiClient, apiErrorMessage } from "@/lib/api-client";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const fieldClass = "w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brass focus:ring-1 focus:ring-brass";

export default function NewSubmissionPage() {
  const { user } = useAuth();
  const { criteria, addSubmission } = useData();
  const year = criteria.find((c) => c.active);
  const grade = year?.gradeCriteria.find((g) => g.grade === user?.grade);
  const areaItems = useMemo(() => Object.fromEntries((grade?.areas ?? []).map((a) =>
    [a.area, a.items.filter((i) => i.active && !i.autoCalculated)])) as Record<AreaName, EvalItem[]>, [grade]);
  const [area, setArea] = useState<AreaName>(AREA_NAMES[0]);
  const [itemId, setItemId] = useState("");
  const [detail, setDetail] = useState("");
  const [description, setDescription] = useState("");
  const [activityDate, setActivityDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

  const [aiResult, setAiResult] = useState<{
    area?: string;
    itemId?: number;
    itemName?: string;
    confidence?: number;
    reason?: string;
  } | null>(null);

  // Real backend AI auto-classification
  useEffect(() => {
    if (!detail.trim() && !description.trim()) {
      setAiResult(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.request<{
          area?: string;
          itemId?: number;
          itemName?: string;
          confidence?: number;
          reason?: string;
        }>("/api/ai/classify-submission", {
          method: "POST",
          body: { detail: detail.trim(), description: description.trim() },
        });
        if (res && res.area) {
          setAiResult(res);
        }
      } catch {
        // Fallback to local heuristic
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [detail, description]);

  const fallbackSuggestions = useMemo(() => classifySubmission(detail, description, areaItems)
    .filter((s) => areaItems[s.area]?.some((i) => i.name === s.itemGuess)), [detail, description, areaItems]);

  const items = areaItems[area] ?? [];
  const item = items.find((i) => i.id === itemId);
  const ready = user?.role === "student" && !!year && !!grade;

  const previewScore = useMemo(() => {
    if (!item) return null;
    const max = item.maxScore || 10;
    const rules = item.scoringRules || [];
    const scType = item.scoringType;
    if (scType === "고정점수형") {
      if (rules.length && detail.trim()) {
        const match = rules.find((r) => detail.toLowerCase().includes(r.conditionValue.toLowerCase()));
        if (match) return Math.min(match.score, max);
      }
      return max;
    }
    if (scType === "등급환산형") {
      const m = detail.match(/\b([SABCDsabcd])\b|([1-9])\s*등급/);
      if (m) {
        const gr = (m[1] ? m[1].toUpperCase() : `${m[2]}등급`);
        const match = rules.find((r) => r.conditionValue.toUpperCase() === gr);
        if (match) return Math.min(match.score, max);
        const defs: Record<string, number> = { S: 1.0, A: 0.8, B: 0.6, C: 0.4, D: 0.2, "1등급": 1.0, "2등급": 0.8, "3등급": 0.6 };
        return Math.min(Math.round(max * (defs[gr] || 0.5) * 10) / 10, max);
      }
      return null;
    }
    if (scType === "구간점수형") {
      const clean = detail.replace(/\d{4}[-./]\d{1,2}[-./]\d{1,2}/g, "");
      const nums = clean.match(/\d+(?:\.\d+)?/g);
      if (nums && nums.length > 0) {
        const val = parseFloat(nums[nums.length - 1]);
        for (const r of rules) {
          const c = r.conditionValue.replace(/\s/g, "");
          if (c.includes(">=") || c.includes("이상")) {
            const mNum = parseFloat(c.replace(/[^0-9.]/g, ""));
            if (val >= mNum) return Math.min(r.score, max);
          } else if (c.includes("<=") || c.includes("이하")) {
            const mNum = parseFloat(c.replace(/[^0-9.]/g, ""));
            if (val <= mNum) return Math.min(r.score, max);
          } else if (c.includes("~") || c.includes("-")) {
            const parts = c.split(/[~-]/).map((x) => parseFloat(x));
            if (parts.length === 2 && val >= parts[0] && val <= parts[1]) return Math.min(r.score, max);
          }
        }
        return Math.min(val, max);
      }
      return null;
    }
    if (scType === "시간계산형") {
      const m = detail.match(/(\d+(?:\.\d+)?)\s*(?:시간|hr|hours|h)?/i);
      if (m) {
        const hrs = parseFloat(m[1]);
        const rate = item.ruleConfig?.unit_rate || (rules[0]?.score ?? 0.3);
        return Math.min(Math.round(hrs * rate * 10) / 10, max);
      }
      return null;
    }
    if (scType === "감점형") {
      const m = detail.match(/\d+/);
      const cnt = m ? parseInt(m[0]) : 1;
      const penalty = item.ruleConfig?.penalty_per_unit || (rules[0]?.score ?? 2.0);
      return Math.max(0, Math.round((max - cnt * penalty) * 10) / 10);
    }
    if (scType === "가산점형") {
      const base = item.ruleConfig?.base_score || 0;
      const bonus = item.ruleConfig?.bonus || (rules[0]?.score ?? 5.0);
      return Math.min(base + bonus, max);
    }
    return max;
  }, [item, detail]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving.current) return;
    setError("");
    if (!ready || !user || !year) { setError("활성 학년도 또는 학생 평가 기준이 없습니다. 관리자에게 문의해 주세요."); return; }
    if (!item) { setError("평가 항목을 선택해 주세요."); return; }
    if (!detail.trim() || !description.trim() || !activityDate || !Number.isFinite(Date.parse(activityDate))) {
      setError("활동일, 활동상세와 설명을 입력해 주세요."); return; }
    if (file && file.size > MAX_FILE_SIZE) { setError("파일은 50MB 이하여야 합니다."); return; }
    if (item.requiresEvidence && !file && !link.trim()) { setError("이 항목은 파일 또는 링크 증빙이 필수입니다."); return; }
    if (link.trim()) {
      try {
        if (!["http:", "https:"].includes(new URL(link.trim()).protocol)) throw new Error();
      } catch { setError("http:// 또는 https://로 시작하는 올바른 링크를 입력해 주세요."); return; }
    }
    saving.current = true;
    setBusy(true);
    try {
      await addSubmission({
        studentId: user.studentId || user.id,
        year: year.year,
        area,
        itemId: item.id,
        itemName: item.name,
        detail: detail.trim(),
        description: description.trim(),
        activityDate,
        fileName: file?.name,
        file,
        link: link.trim() || undefined,
        status: "제출완료",
        submittedAt: new Date().toISOString().slice(0, 10),
      });
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err) || "제출하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  if (done) return <div className="flex flex-col items-center rounded-lg border border-line bg-paper-raised px-8 py-16 text-center">
    <CheckCircle2 size={36} className="mb-4 text-certified" />
    <h2 className="font-display text-xl font-semibold">증빙자료가 제출되었습니다</h2>
    <p className="mt-2 text-sm text-ink-soft">증빙자료가 성공적으로 등록되었습니다. 담당 교사의 심사 후 결과가 반영됩니다.</p>
    <Link href="/student/submissions" className="mt-6 rounded-md bg-navy px-4 py-2 text-sm text-white">제출 내역 보기</Link>
  </div>;

  return <div>
    <PageHeader title="증빙자료 제출" description="인정받고 싶은 활동의 증빙자료를 제출하세요. AI가 추천하는 인증 영역과 항목을 바로 적용할 수 있습니다." />
    {!ready && <p role="alert" className="mb-4 rounded-md bg-alert-soft p-3 text-sm text-alert">활성 학년도 또는 학생 평가 기준이 없습니다. 관리자에게 문의해 주세요.</p>}
    <form onSubmit={submit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <fieldset disabled={!ready || busy} className="min-w-0 space-y-5 rounded-lg border border-line bg-paper-raised p-6 lg:col-span-2">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">인증 영역<select className={fieldClass} value={area} onChange={(e) => { setArea(e.target.value as AreaName); setItemId(""); }}>
            {(grade?.areas ?? []).map((a) => <option key={a.area}>{a.area}</option>)}
          </select></label>
          <label className="text-sm font-medium">평가 항목<select required className={fieldClass} value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">선택하세요</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name} (최대 {i.maxScore}점)</option>)}
          </select></label>
        </div>
        {item && (
          <div className="rounded-md border border-line bg-paper px-3 py-2 text-xs space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="font-semibold text-ink">
                배점 유형: <span className="text-brass">{item.scoringType}</span> (최대 {item.maxScore}점)
              </span>
              {previewScore !== null && (
                <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  예상 인정 점수: {previewScore}점
                </span>
              )}
            </div>
            {item.scoringType === "등급환산형" && (
              <div className="flex flex-wrap items-center gap-1.5 text-ink-soft">
                <span>등급 퀵 선택:</span>
                {(item.scoringRules?.length ? item.scoringRules.map((r) => r.conditionValue) : ["S", "A", "B", "C"]).map((gr) => (
                  <button
                    key={gr}
                    type="button"
                    onClick={() => setDetail((prev) => prev ? `${prev} ${gr}등급` : `${gr}등급`)}
                    className="rounded border border-line bg-white px-2 py-0.5 font-medium text-ink hover:border-brass hover:bg-brass-soft/40"
                  >
                    {gr}
                  </button>
                ))}
              </div>
            )}
            {item.scoringType === "구간점수형" && item.scoringRules && item.scoringRules.length > 0 && (
              <div className="text-ink-soft">
                성적 구간표: {item.scoringRules.map((r) => `${r.conditionValue}: ${r.score}점`).join(" / ")}
              </div>
            )}
            {item.scoringType === "시간계산형" && (
              <div className="text-ink-soft">
                활동 시간(시간 단위)을 세부 항목 정보에 숫자로 입력하세요. (시간 × {item.ruleConfig?.unit_rate || item.scoringRules?.[0]?.score || 0.3}점)
              </div>
            )}
          </div>
        )}
        <label className="block text-sm font-medium">세부 항목 정보<input required className={fieldClass} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="예: 전공 프로젝트, 자격증, 봉사활동" /></label>
        <label className="block text-sm font-medium">활동일<input required type="date" className={fieldClass} value={activityDate} onChange={(e) => setActivityDate(e.target.value)} /></label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">파일 첨부 (최대 50MB)<input type="file" className={fieldClass} onChange={(e) => {
            const selected = e.target.files?.[0] ?? null;
            if (selected && selected.size > MAX_FILE_SIZE) { e.target.value = ""; setFile(null); setError("50MB를 초과한 파일은 첨부할 수 없습니다."); return; }
            setFile(selected); setError("");
          }} /></label>
          <label className="text-sm font-medium">링크 첨부<input className={fieldClass} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://github.com/..." /></label>
        </div>
        <p className="text-xs text-ink-soft">{item?.requiresEvidence ? "파일 또는 링크 증빙 필수." : "증빙은 선택 사항입니다."}</p>
        <label className="block text-sm font-medium">설명<textarea required rows={4} className={fieldClass} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        {error && <p role="alert" className="rounded-md bg-alert-soft p-3 text-sm text-alert">{error}</p>}
        <div className="flex items-center gap-4">
          <button disabled={busy || !ready} type="submit" className="rounded-md bg-navy px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50">{busy ? "등록 중..." : "증빙자료 제출"}</button>
          {previewScore !== null && (
            <span className="text-sm font-semibold text-emerald-700">
              실시간 예상 점수: {previewScore}점 / {item?.maxScore}점
            </span>
          )}
        </div>
      </fieldset>
      <aside className="space-y-4">
        <div className="rounded-lg border border-brass/40 bg-brass-soft/40 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Sparkles size={17} /> AI 항목 추천</h2>
          <p className="mb-3 text-sm text-ink-soft">입력 내용을 분석하여 적합한 인증 영역과 항목을 추천합니다.</p>
          {aiResult && aiResult.area && (
            <button
              type="button"
              disabled={busy || !ready}
              onClick={() => {
                if (aiResult.area) {
                  const aliasMap: Record<string, AreaName> = {
                    "전문기술역량": "전공역량",
                    "직업기초능력": "전공역량",
                    "인성/직업의식": "인성/봉사",
                    "인문학적 소양": "창체/독서",
                    "외국어 능력": "외국어역량",
                  };
                  const mappedArea = (areaItems[aiResult.area as AreaName] ? aiResult.area : aliasMap[aiResult.area] ?? aiResult.area) as AreaName;
                  if (areaItems[mappedArea]) {
                    setArea(mappedArea);
                  }
                  if (aiResult.itemId) {
                    const exists = areaItems[mappedArea]?.some((i) => i.id === String(aiResult.itemId));
                    if (exists) {
                      setItemId(String(aiResult.itemId));
                    } else if (aiResult.itemName) {
                      const matched = areaItems[mappedArea]?.find((i) => i.name.includes(aiResult.itemName!));
                      if (matched) setItemId(matched.id);
                    }
                  } else if (aiResult.itemName) {
                    const matched = areaItems[mappedArea]?.find((i) => i.name.includes(aiResult.itemName!));
                    if (matched) setItemId(matched.id);
                  }
                }
              }}
              className="mb-2 block w-full rounded-md border border-brass bg-white p-3 text-left text-sm transition-shadow hover:shadow"
            >
              <div className="font-semibold text-ink">
                {(() => {
                  const aliasMap: Record<string, string> = {
                    "전문기술역량": "전공역량",
                    "직업기초능력": "전공역량",
                    "인성/직업의식": "인성/봉사",
                    "인문학적 소양": "창체/독서",
                    "외국어 능력": "외국어역량",
                  };
                  return (areaItems[aiResult.area as AreaName] ? aiResult.area : aliasMap[aiResult.area ?? ""] ?? aiResult.area);
                })()} · {aiResult.itemName || "추천 항목"}
              </div>
              {aiResult.reason && <p className="mt-1 text-xs text-ink-soft">{aiResult.reason}</p>}
              <span className="mt-2 inline-block rounded bg-brass/20 px-1.5 py-0.5 text-xs font-medium text-brass">
                적용하기 {aiResult.confidence ? `(${(aiResult.confidence * 100).toFixed(0)}% 일치)` : ""}
              </span>
            </button>
          )}
          {!aiResult && fallbackSuggestions.map((s) => <button key={`${s.area}-${s.itemGuess}`} type="button" disabled={busy || !ready} onClick={() => {
            setArea(s.area); setItemId(areaItems[s.area]?.find((i) => i.name === s.itemGuess)?.id ?? "");
          }} className="mb-2 block w-full rounded-md border border-brass/50 bg-white p-3 text-left text-sm">
            {s.area} · {s.itemGuess}<span className="mt-1 block text-xs text-ink-soft">일치 키워드: {s.matchedKeywords.join(", ")}</span>
          </button>)}
        </div>
        <div className="rounded-lg border border-line bg-paper-raised p-5 text-xs text-ink-soft">자동연동 항목은 직접 제출할 수 없습니다. 반려 또는 재제출요청 자료만 보완할 수 있으며, 제출완료 상태에서만 삭제할 수 있습니다.</div>
      </aside>
    </form>
  </div>;
}
