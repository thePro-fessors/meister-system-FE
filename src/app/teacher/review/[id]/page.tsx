"use client";

import { use, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Link as LinkIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { canManageStudent, canReviewSubmission } from "@/lib/teacherScope";
import { computeAreaResults } from "@/lib/grading";

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { users, submissions, points, criteria, updateSubmission } = useData();

  const submission = submissions.find((s) => s.id === id);
  const student = users.find((u) => u.id === submission?.studentId);
  const canReview = !!user && !!student && !!submission && canReviewSubmission(user, student, submission);
  const year = criteria.find((c) => c.year === submission?.year);
  const item = year?.gradeCriteria
    .find((g) => g.grade === student?.grade)
    ?.areas.find((a) => a.area === submission?.area)
    ?.items.find((i) => i.id === submission?.itemId);

  const [scoreInput, setScoreInput] = useState(submission?.score?.toString() ?? item?.maxScore.toString() ?? "");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"approve" | "reject">("approve");
  const [rejectStatus, setRejectStatus] = useState<"반려" | "재제출요청">("반려");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

  const alreadyApproved = submission?.status === "인정완료";
  const pending = submission?.status === "제출완료" || submission?.status === "검토중";
  const editable = !!item && !item.autoCalculated && !!year?.active && (pending || alreadyApproved) && !!user && !!student && !!submission && canReviewSubmission(user, student, submission, alreadyApproved);
  let evidenceLink: string | undefined;
  try {
    const url = new URL(submission?.link?.trim() ?? "");
    if (["http:", "https:"].includes(url.protocol)) evidenceLink = url.href;
  } catch { /* Legacy demo links may not be valid URLs. */ }

  const maxScore = item?.maxScore ?? 0;

  async function approve() {
    if (saving.current) return;
    setNotice("");
    if (!submission || !canReview || !editable || !item) { setError("현재 상태 또는 학년도에서는 심사할 수 없습니다."); return; }
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
    saving.current = true; setBusy(true);
    try {
    await updateSubmission(submission.id, {
      status: "인정완료",
      score,
      teacherComment: comment.trim() || "제출 자료를 확인하여 인정 처리했습니다.",
      reviewedAt: new Date().toISOString().slice(0, 10),
      reviewerId: user?.id,
      scoreHistory: [
        ...(submission.scoreHistory ?? []),
        { before: submission.score, after: score, reason: comment.trim() || "승인", at: new Date().toISOString() },
      ],
    });
    setNotice("저장했습니다. 학생 점수를 다시 계산했습니다 (로컬 데모).");
    setComment("");
    } catch { setError("저장하지 못했습니다. 다시 시도해 주세요."); }
    finally { saving.current = false; setBusy(false); }
  }

  async function reject() {
    if (saving.current) return;
    setNotice("");
    if (!submission || !canReview || !editable || !pending) { setError("심사 대기 자료만 반려할 수 있습니다."); return; }
    if (!comment.trim()) {
      setError("반려 사유를 반드시 입력해야 합니다.");
      return;
    }
    setError(null);
    saving.current = true; setBusy(true);
    try {
    await updateSubmission(submission.id, {
      status: rejectStatus,
      teacherComment: comment.trim(),
      score: undefined,
      reviewedAt: new Date().toISOString().slice(0, 10),
      reviewerId: user?.id,
    });
    setNotice(`${rejectStatus} 처리했습니다.`);
    setComment("");
    } catch { setError("처리하지 못했습니다. 다시 시도해 주세요."); }
    finally { saving.current = false; setBusy(false); }
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
      <section className="mb-5 rounded-lg border border-brass/40 bg-brass-soft/40 p-5">
        <h2 className="text-sm font-semibold">AI 심사 Copilot · 로컬 데모</h2>
        <p className="mt-2 text-sm text-ink-soft">서버 AI가 아닌 로컬 검토 문구 템플릿입니다. 파일 내용을 분석하거나 진위를 확인하지 않으며 점수를 자동 부여하지 않습니다.</p>
        <button disabled={busy || !editable} onClick={() => {
          setComment(alreadyApproved ? "" : `${submission.itemName}의 인정 기준과 활동일을 확인해 주세요. ${submission.fileName ? "데모 파일은 원본이 저장되지 않으므로 실제 증빙을 별도로 확인해야 합니다." : "첨부 링크와 증빙 요건을 확인해 주세요."}`);
          setNotice(alreadyApproved ? "점수 수정 사유는 실제 변경 이유를 직접 입력해 주세요." : "로컬 검토 초안을 입력했습니다. 실제 증빙 확인 후 수정해 주세요.");
        }} className="mt-3 rounded-md border border-line px-3 py-2 text-sm disabled:opacity-50">로컬 심사 초안 생성</button>
      </section>
      <section aria-live="polite" className="mb-5 rounded-lg border border-line p-4 text-sm">
        <h2 className="font-semibold">학생 영역별 점수 · 로컬 계산</h2>
        {user && canManageStudent(user, student) && year && student.grade && computeAreaResults(student.id, year.year, student.grade, year, submissions, points).map((r) => <p key={r.area}>{r.area}: {r.score} / {r.maxScore}</p>)}
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
                <button type="button" onClick={() => setNotice("로컬 데모는 파일명만 저장합니다. 원본 다운로드 및 1회용 티켓 발급을 제공하지 않습니다.")} className="inline-flex items-center gap-1 text-left">
                  <FileText size={13} strokeWidth={1.75} /> {submission.fileName} · 다운로드 불가 (데모)
                </button>
              )}
              {submission.link && (
                <span className="inline-flex items-center gap-1">
                  <LinkIcon size={13} strokeWidth={1.75} /> {evidenceLink ? <a href={evidenceLink} target="_blank" rel="noopener noreferrer" className="break-all underline">{submission.link}</a> : <span>유효하지 않은 링크</span>}
                </span>
              )}
            </div>
          </div>

          {alreadyApproved && (
            <div className="rounded-lg border border-certified/40 bg-certified-soft p-5 text-sm text-certified">
              이미 인정완료 처리된 자료입니다. 부여 점수: {submission.score}점
              {submission.teacherComment && <p className="mt-2">기존 의견: {submission.teacherComment}</p>}
            </div>
          )}
          {(
            <div className="rounded-lg border border-line bg-paper-raised p-6">
              {!editable && <p role="status" className="mb-4 text-sm text-alert">활성 학년도의 심사 대기 또는 인정완료 자료만 처리할 수 있습니다. 평가 기준이 없거나 자동연동 항목이면 관리자에게 문의해 주세요.</p>}
              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => { setMode("approve"); setError(null); }}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    mode === "approve" ? "bg-navy text-white" : "border border-line text-ink-soft"
                  }`}
                >
                  {alreadyApproved ? "사후 점수 수정" : "승인 · 점수 부여"}
                </button>
                <button
                  onClick={() => { setMode("reject"); setError(null); }}
                  disabled={alreadyApproved || !editable || busy}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    mode === "reject" ? "bg-alert text-white" : "border border-line text-ink-soft"
                  }`}
                >
                  반려
                </button>
              </div>

              {mode === "approve" || alreadyApproved ? (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-ink">인정 점수 (최대 {maxScore}점)</label>
                  <input
                    type="number"
                    step="any"
                    aria-label="인정 점수"
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
                  {error && <p role="alert" className="rounded-md bg-alert-soft px-3 py-2 text-sm text-alert">{error}</p>}
                  <button
                    disabled={busy || !editable}
                    onClick={approve}
                    className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-ink"
                  >
                    {busy ? "저장 중..." : alreadyApproved ? "점수 수정" : "인정 처리"}
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
                  {error && <p role="alert" className="rounded-md bg-alert-soft px-3 py-2 text-sm text-alert">{error}</p>}
                  <button
                    disabled={busy || !editable || !pending}
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
