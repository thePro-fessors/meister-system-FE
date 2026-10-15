"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { GradeBadge } from "@/components/GradeBadge";
import { StatusPill } from "@/components/StatusPill";
import { computeAreaResults, computeCertStatus, PROVISIONAL_GRADING_NOTICE } from "@/lib/grading";
import { generateCoachingTip } from "@/lib/ai";

export default function StudentDashboard() {
  const { user } = useAuth();
  const { criteria, submissions, points } = useData();

  const year = criteria.find((c) => c.active) ?? criteria[0];

  const mySubmissions = useMemo(
    () => submissions.filter((s) => s.studentId === user?.id && s.year === year?.year),
    [submissions, user, year]
  );
  const myPoints = useMemo(
    () => points.filter((p) => p.studentId === user?.id),
    [points, user]
  );

  const results = useMemo(() => {
    if (!user?.grade || !year) return [];
    return computeAreaResults(user.id, year.year, user.grade, year, submissions, points);
  }, [user, year, submissions, points]);

  const hasUnderReview = mySubmissions.some((s) => ["제출완료", "검토중", "재제출요청"].includes(s.status));
  const certStatus = computeCertStatus(results, hasUnderReview);
  const totalScore = results.reduce((sum, r) => sum + r.score, 0);
  const pointTotal = myPoints.reduce((sum, p) => sum + p.score, 0);

  const weakestArea = [...results].sort((a, b) => a.score / a.maxScore - b.score / b.maxScore)[0];

  if (!user || !year) return null;

  return (
    <div>
      <p role="note" className="mb-4 rounded border border-line p-3 text-sm text-ink-soft">{PROVISIONAL_GRADING_NOTICE}</p>
      <PageHeader
        eyebrow={`${year.year}학년도`}
        title="내 인증 현황"
        description={`${user.grade}학년 ${user.classNo}반 ${user.number}번 · ${user.name}`}
      />

      <div className="record-summary mb-8">
        <div>
          <p className="text-xs text-ink-soft">총점</p>
          <p className="mt-1.5 font-display text-3xl font-semibold text-ink">{totalScore.toFixed(1)}점</p>
        </div>
        <div>
          <p className="text-xs text-ink-soft">전체 인증 상태</p>
          <div className="mt-2.5">
            <StatusPill label={certStatus} />
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

      <section className="competency-panel mb-6" aria-labelledby="competency-title">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-5 sm:px-7">
          <div>
            <h2 id="competency-title" className="text-lg font-bold text-ink">영역별 성장 기록</h2>
            <p className="mt-1 text-xs text-ink-soft">모든 영역에서 A등급 이상이면 인증할 수 있어요.</p>
          </div>
          <span className="flex items-center gap-2 text-xs text-ink-soft"><span className="h-4 border-l-2 border-[#8998ab]" aria-hidden="true" />인증 기준 80%</span>
        </div>
        {results.map((r) => (
          <div key={r.area} className="competency-row">
            <p className="text-sm font-semibold text-ink">{r.area}</p>
            <div className="competency-track" role="img" aria-label={`${r.area}: ${r.score}점 / ${r.maxScore}점, ${r.grade}`}>
              <div className="competency-fill" style={{ width: `${r.maxScore > 0 ? Math.min(100, Math.max(0, r.score / r.maxScore * 100)) : 0}%` }} />
            </div>
            <p className="text-right text-sm tabular-nums"><strong>{r.score}</strong><span className="text-ink-soft"> / {r.maxScore}</span></p>
            <GradeBadge grade={r.grade} />
          </div>
        ))}
        {results.length === 0 && <p className="p-7 text-sm text-ink-soft">등록된 학년 기준이 없습니다. 담당 선생님에게 문의해 주세요.</p>}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line bg-[#f8faff] px-5 py-5 sm:px-7">
          <p className="text-sm text-ink-soft">새로운 활동을 마쳤나요? 기록을 남겨보세요.</p>
          <Link href="/student/submit" className="rounded-lg bg-brass px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy">증빙자료 제출</Link>
        </div>
      </section>

      {weakestArea && (
        <div className="flex items-start gap-3 px-2 py-5">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-brass" strokeWidth={1.75} />
          <div>
            <p className="text-sm font-medium text-ink">AI 보완 추천</p>
            <p className="mt-1 text-sm text-ink-soft">
              {generateCoachingTip(weakestArea.area, weakestArea.score / weakestArea.maxScore)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
