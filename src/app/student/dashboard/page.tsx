"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, Printer, Award } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { GradeBadge } from "@/components/GradeBadge";
import { StatusPill } from "@/components/StatusPill";
import { computeAreaResults, computeCertStatus } from "@/lib/grading";
import { generateCoachingTip } from "@/lib/ai";
import { apiClient } from "@/lib/api-client";
import { AreaResult, CertStatus } from "@/lib/types";

interface ServerCertStatus {
  totalScore?: number;
  pointTotal?: number;
  certStatus?: CertStatus;
  isAllS?: boolean;
  canPrintEvaluation?: boolean;
  unmetAreas?: {
    areaId?: number;
    area: string;
    grade: string;
    score: number;
    maxScore: number;
  }[];
  areas?: {
    area: string;
    score: number;
    maxScore: number;
    grade: "S" | "A" | "B" | "미달성";
    status: "충족" | "보완 필요";
  }[];
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const { criteria, submissions, points } = useData();
  const [serverStatus, setServerStatus] = useState<ServerCertStatus | null>(null);

  const year = criteria.find((c) => c.active) ?? criteria[0];

  useEffect(() => {
    if (!user) return;
    const studentIdentifier = user.studentId || "me";
    apiClient.request<ServerCertStatus>(`/api/students/${studentIdentifier}/certification-status`, {
      method: "GET",
    }).then((res) => {
      if (res && typeof res === "object") setServerStatus(res);
    }).catch(() => {
      // Fallback to local computation
    });
  }, [user]);

  const mySubmissions = useMemo(
    () => submissions.filter((s) => (String(s.studentId) === String(user?.id) || String(s.studentId) === String(user?.studentId)) && s.year === year?.year),
    [submissions, user, year]
  );
  const myPoints = useMemo(
    () => points.filter((p) => String(p.studentId) === String(user?.id) || String(p.studentId) === String(user?.studentId)),
    [points, user]
  );

  const fallbackResults = useMemo(() => {
    if (!user?.grade || !year) return [];
    return computeAreaResults(user.id, year.year, user.grade, year, submissions, points);
  }, [user, year, submissions, points]);

  const results: AreaResult[] = useMemo(() => {
    if (serverStatus?.areas && Array.isArray(serverStatus.areas) && serverStatus.areas.length > 0) {
      return serverStatus.areas.map((a) => ({
        area: a.area as any,
        score: a.score,
        maxScore: a.maxScore,
        grade: a.grade,
        status: a.status,
      }));
    }
    return fallbackResults;
  }, [serverStatus, fallbackResults]);

  const hasUnderReview = mySubmissions.some((s) => ["제출완료", "검토중", "재제출요청"].includes(s.status));
  const certStatus = serverStatus?.certStatus ?? computeCertStatus(results, hasUnderReview);
  const totalScore = serverStatus?.totalScore ?? results.reduce((sum, r) => sum + r.score, 0);
  const maxTotalScore = results.reduce((sum, r) => sum + r.maxScore, 0);
  const pointTotal = serverStatus?.pointTotal ?? myPoints.reduce((sum, p) => sum + p.score, 0);

  const weakestArea = [...results].sort((a, b) => a.score / (a.maxScore || 1) - b.score / (b.maxScore || 1))[0];

  if (!user || !year) return null;

  return (
    <div>
      <PageHeader
        eyebrow={`${year.year}학년도`}
        title="내 인증 현황"
        description={`${user.grade ?? "-"}학년 ${user.classNo ?? "-"}반 ${user.number ?? "-"}번 · ${user.name}`}
      />

      <div className="record-summary mb-8">
        <div>
          <p className="text-xs text-ink-soft">총점</p>
          <p className="mt-1.5 font-display text-3xl font-semibold text-ink">
            {totalScore.toFixed(1)}점
            {maxTotalScore > 0 && <span className="ml-1.5 text-base font-normal text-ink-soft">/ {maxTotalScore}점</span>}
          </p>
        </div>
        <div>
          <p className="text-xs text-ink-soft">전체 인증 상태</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <StatusPill label={certStatus} />
            {serverStatus?.isAllS && (
              <span className="inline-flex items-center gap-1 rounded-full border border-brass/40 bg-brass-soft/40 px-2 py-0.5 text-[11px] font-semibold text-brass">
                <Award size={12} /> 전 영역 S
              </span>
            )}
          </div>
          <div className="mt-2">
            {serverStatus?.canPrintEvaluation ? (
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink shadow-sm hover:bg-brass-soft/40 print:hidden"
                title="인증평가표 출력 (인쇄/PDF)"
              >
                <Printer size={13} className="text-brass" />
                <span>인증평가표 출력</span>
              </button>
            ) : (
              <span className="text-[11px] text-ink-soft">
                인증평가표: 단계별 미달성
              </span>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-ink-soft">누적 상벌점</p>
          <p
            className={`mt-1.5 font-display text-3xl font-semibold ${
              pointTotal < 0 ? "text-alert" : "text-ink"
            }`}
          >
            {pointTotal > 0 ? `+${pointTotal}` : pointTotal}점
          </p>
        </div>
      </div>

      {serverStatus?.unmetAreas && serverStatus.unmetAreas.length > 0 && (
        <div className="mb-6 rounded-lg border border-line bg-paper px-5 py-4 text-xs print:hidden">
          <p className="font-semibold text-alert">단계별 인증 미달 영역 안내 (A 미만)</p>
          <p className="mt-1 text-ink-soft">
            단계별 인증 충족 및 인증평가표 출력을 위해 다음 영역의 보완이 필요합니다:{" "}
            <span className="font-medium text-ink">
              {serverStatus.unmetAreas.map((a) => `${a.area} (${a.grade}등급, ${a.score}/${a.maxScore}점)`).join(", ")}
            </span>
          </p>
        </div>
      )}

      <section className="competency-panel mb-6" aria-labelledby="competency-title">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-5 sm:px-7">
          <div>
            <h2 id="competency-title" className="text-lg font-bold text-ink">영역별 성장 기록</h2>
            <p className="mt-1 text-xs text-ink-soft">영역별 취득 점수 및 달성 현황입니다.</p>
          </div>
          <span className="flex items-center gap-2 text-xs text-ink-soft"><span className="h-4 border-l-2 border-[#8998ab]" aria-hidden="true" />인증 기준 80%</span>
        </div>
        {results.map((r) => (
          <div key={r.area} className="competency-row">
            <p className="text-sm font-semibold text-ink">{r.area}</p>
            <div className="competency-track" role="img" aria-label={`${r.area}: ${r.score}점 / ${r.maxScore}점, ${r.grade}`}>
              <div className="competency-fill" style={{ width: `${r.maxScore > 0 ? Math.min(100, Math.max(0, (r.score / r.maxScore) * 100)) : 0}%` }} />
            </div>
            <p className="text-right text-sm tabular-nums"><strong>{r.score}</strong><span className="text-ink-soft"> / {r.maxScore}</span></p>
            <GradeBadge grade={r.grade} />
          </div>
        ))}
        {results.length === 0 && <p className="p-7 text-sm text-ink-soft">등록된 학년 기준이 없습니다. 담당 선생님에게 문의해 주세요.</p>}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line bg-[#f8faff] px-5 py-5 sm:px-7">
          <p className="text-sm text-ink-soft">새로운 활동을 마쳤나요? 기록을 남겨보세요.</p>
          <Link href="/student/submissions/new" className="rounded-lg bg-brass px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy">증빙자료 제출</Link>
        </div>
      </section>

      {weakestArea && (
        <div className="flex items-start gap-3 px-2 py-5">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-brass" strokeWidth={1.75} />
          <div>
            <p className="text-sm font-medium text-ink">AI 보완 추천</p>
            <p className="mt-1 text-sm text-ink-soft">
              {generateCoachingTip(weakestArea.area, weakestArea.score / (weakestArea.maxScore || 1))}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
