"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Link as LinkIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { isInTeacherScope } from "@/lib/teacherScope";
import { AiServicePanel } from "@/components/AiServicePanel";
import { computeAreaResults } from "@/lib/grading";

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { users, submissions, points, criteria, updateSubmission } = useData();

  const submission = submissions.find((s) => s.id === id);
  const student = users.find((u) => u.id === submission?.studentId);
  const canReview = !!user && !!student && isInTeacherScope(user, student);
  const year = criteria.find((c) => c.year === submission?.year);
  const item = year?.gradeCriteria
    .find((g) => g.grade === student?.grade)
    ?.areas.find((a) => a.area === submission?.area)
    ?.items.find((i) => i.id === submission?.itemId);

  const [scoreInput, setScoreInput] = useState(submission?.score?.toString() ?? item?.maxScore.toString() ?? "");
  const [comment, setComment] = useState(submission?.teacherComment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"approve" | "reject">("approve");
  const [rejectStatus, setRejectStatus] = useState<"반려" | "재제출요청">("반려");
  const [notice, setNotice] = useState("");

  const alreadyApproved = submission?.status === "인정완료";

  const maxScore = item?.maxScore ?? 0;

  function approve() {
    if (!submission || !canReview || !item) return;
    if (alreadyApproved && !comment.trim()) { setError("점수 수정 사유를 입력해 주세요."); return; }
    const score = Number(scoreInput);
    if (!scoreInput.trim() || !Number.isFinite(score) || score < 0) {
      setError("올바른 점수를 입력해 주세요.");
      return;
    }
    if (score > maxScore) {
      setError(`이 항목의 최대점(${maxScore}점)을 초과할 수 없습니다.`);
      return;
    }
    setError(null);
    updateSubmission(submission.id, {
      status: "인정완료",
      score,
      teacherComment: comment || "제출 자료를 확인하여 인정 처리했습니다.",
      reviewedAt: new Date().toISOString().slice(0, 10),
      reviewerId: user?.id,
      scoreHistory: [
        ...(submission.scoreHistory ?? []),
        { before: submission.score, after: score, reason: comment || "승인", at: new Date().toISOString() },
      ],
    });
    setNotice("저장했습니다. 학생 점수를 다시 계산했습니다 (로컬 데모).");
    setComment("");
  }

  function reject() {
    if (!submission || !canReview || alreadyApproved) return;
    if (!comment.trim()) {
      setError("반려 사유를 반드시 입력해야 합니다.");
      return;
    }
    setError(null);
    updateSubmission(submission.id, {
      status: rejectStatus,
      teacherComment: comment,
      reviewedAt: new Date().toISOString().slice(0, 10),
      reviewerId: user?.id,
    });
    setNotice(`${rejectStatus} 처리했습니다.`);
  }

  const scoreRatio = maxScore > 0 && Number.isFinite(Number(scoreInput))
    ? Math.max(0, Math.min(1, Number(scoreInput) / maxScore)) : 0;

  if (!submission || !student || !canReview) {
    return (
      <div>
        <p className="text-ink-soft">해당 제출 자료를 찾을 수 없습니다.</p>
        <Link href="/teacher/dashboard" className="text-brass hover:underline">
          대시보드로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/teacher/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft size={15} strokeWidth={1.75} /> 대시보드로
      </Link>

      <PageHeader
        title="증빙자료 검토"
        description={`${student.name} · ${student.grade}학년 ${student.classNo}반 ${student.number}번`}
      />
      {notice && <p role="status" className="mb-4 text-sm text-certified">{notice}</p>}
      <AiServicePanel title="AI 심사 Copilot" endpoint="/api/ai/teacher/review-draft" description="평가 기준에 따른 추천 상태, 점수와 검토 의견 초안을 제안합니다. 자동 승인 없이 교사가 검토 후 적용합니다." action="심사 초안 생성" />
      <section aria-live="polite" className="mb-5 rounded-lg border border-line p-4 text-sm">
        <h2 className="font-semibold">학생 영역별 점수 · 로컬 계산</h2>
        {year && student.grade && computeAreaResults(student.id, year.year, student.grade, year, submissions, points).map((r) => <p key={r.area}>{r.area}: {r.score} / {r.maxScore}</p>)}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-line bg-paper-raised p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-ink-soft">{submission.area}</p>
                <p className="font-display text-lg font-semibold text-ink">
                  {submission.itemName} · {submission.detail}
                </p>
              </div>
              <StatusPill label={submission.status} />
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-ink-soft">활동일</dt>
                <dd className="text-ink">{submission.activityDate}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">제출일</dt>
                <dd className="text-ink">{submission.submittedAt}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">항목 기준</dt>
                <dd className="text-ink">
                  {item?.scoringType} · 최대 {maxScore}점
                  {item?.description && <span className="text-ink-soft"> ({item.description})</span>}
                </dd>
              </div>
            </dl>

            <p className="mt-4 rounded-md bg-navy-soft px-3 py-2.5 text-sm text-ink">{submission.description}</p>

            <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-soft">
              {submission.fileName && (
                <span className="inline-flex items-center gap-1">
                  <FileText size={13} strokeWidth={1.75} /> {submission.fileName}
                </span>
              )}
              {submission.link && (
                <span className="inline-flex items-center gap-1">
                  <LinkIcon size={13} strokeWidth={1.75} /> {submission.link}
                </span>
              )}
            </div>
          </div>

          {alreadyApproved && (
            <div className="rounded-lg border border-certified/40 bg-certified-soft p-5 text-sm text-certified">
              이미 인정완료 처리된 자료입니다. 부여 점수: {submission.score}점
            </div>
          )}
          {(
            <div className="rounded-lg border border-line bg-paper-raised p-6">
              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => setMode("approve")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    mode === "approve" ? "bg-navy text-white" : "border border-line text-ink-soft"
                  }`}
                >
                  승인 · 점수 부여
                </button>
                <button
                  onClick={() => setMode("reject")}
                  disabled={alreadyApproved}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    mode === "reject" ? "bg-alert text-white" : "border border-line text-ink-soft"
                  }`}
                >
                  반려
                </button>
              </div>

              {mode === "approve" ? (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-ink">인정 점수 (최대 {maxScore}점)</label>
                  <input
                    type="number"
                    value={scoreInput}
                    onChange={(e) => setScoreInput(e.target.value)}
                    max={maxScore}
                    min={0}
                    className="w-32 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brass focus:ring-1 focus:ring-brass"
                  />
                  <div className="h-2 w-full overflow-hidden rounded-full bg-navy-soft">
                    <div className="h-full bg-brass" style={{ width: `${scoreRatio * 100}%` }} />
                  </div>
                  <label className="block text-sm font-medium text-ink">{alreadyApproved ? "점수 수정 사유 (필수)" : "승인 의견 (선택)"}</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brass focus:ring-1 focus:ring-brass"
                  />
                  {error && <p className="rounded-md bg-alert-soft px-3 py-2 text-sm text-alert">{error}</p>}
                  <button
                    onClick={approve}
                    className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-ink"
                  >
                    {alreadyApproved ? "점수 수정" : "인정 처리"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-sm">처리 유형 <select value={rejectStatus} onChange={(e) => setRejectStatus(e.target.value as "반려" | "재제출요청")} className="rounded border border-line p-2"><option>반려</option><option>재제출요청</option></select></label>
                  <label className="block text-sm font-medium text-ink">반려 사유 (필수)</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="학생에게 보완할 내용을 안내해 주세요."
                    className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brass focus:ring-1 focus:ring-brass"
                  />
                  {error && <p className="rounded-md bg-alert-soft px-3 py-2 text-sm text-alert">{error}</p>}
                  <button
                    onClick={reject}
                    className="rounded-md bg-alert px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
                  >
                    반려 처리
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-line bg-paper-raised p-5">
          <p className="mb-2 text-sm font-medium text-ink">검토 체크리스트</p>
          <ul className="space-y-1.5 text-xs text-ink-soft">
            <li>· 첨부된 파일 또는 링크가 실제 활동을 증명하는지 확인</li>
            <li>· 항목 기준과 최대점을 초과하지 않는지 확인</li>
            <li>· 반려 시 학생이 이해할 수 있는 구체적인 사유 작성</li>
            <li>· 승인 시 점수가 자동으로 학생 총점에 반영됩니다</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
