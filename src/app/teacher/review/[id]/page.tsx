"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Link as LinkIcon, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { canManageStudent, canReviewSubmission, isSubmissionOfStudent } from "@/lib/teacherScope";
import { academicYear, computeAreaResults, matchesStudentId } from "@/lib/grading";
import { apiClient, apiErrorMessage, downloadSubmissionFile } from "@/lib/api-client";
import { Submission, User } from "@/lib/types";

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { users, submissions, points, criteria, updateSubmission } = useData();
  const [remoteSubmission, setRemoteSubmission] = useState<Submission | null>(null);
  const [remoteStudent, setRemoteStudent] = useState<User | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const localSubmission = submissions.find(
    (s) => s.id === id || String(s.id).replace(/^sub-/, "") === id.replace(/^sub-/, "")
  );
  const submission = localSubmission ?? remoteSubmission ?? undefined;

  useEffect(() => {
    let ignore = false;
    const rawId = id.replace(/^sub-/, "");
    setLoadingDetail(true);
    apiClient
      .request<any>(`/api/submissions/${rawId}`)
      .then((s) => {
        if (ignore || !s) return;
        const actDate = s.activityDate || s.activity_date || (s.createdAt ? String(s.createdAt).slice(0, 10) : new Date().toISOString().slice(0, 10));
        const rawStudentId = String(s.studentId ?? s.student_id ?? "");
        const matchedUser = users.find((u) => u.id === rawStudentId || (u.studentId !== undefined && String(u.studentId) === rawStudentId));
        const mappedSub: Submission = {
          id: String(s.id ?? s.submission_id ?? rawId),
          studentId: matchedUser ? matchedUser.id : rawStudentId,
          rawStudentId,
          studentName: s.studentName ?? s.student_name ?? matchedUser?.name,
          year: s.year || academicYear(actDate),
          area: s.areaName || s.area || s.area_name || "전공",
          itemId: String(s.itemId ?? s.item_id ?? ""),
          itemName: s.itemName || s.item_name || "항목",
          detail: s.detail || s.title || "",
          activityDate: actDate,
          description: s.description || s.content || "",
          fileName: s.originalFilename || s.fileName || s.original_filename || undefined,
          filePath: s.filePath || s.file_path || undefined,
          fileUrl: s.fileUrl || s.file_url || undefined,
          link: s.linkUrl || s.link || s.link_url || undefined,
          status: s.status || "제출완료",
          score: s.grantedScore !== null && s.grantedScore !== undefined ? Number(s.grantedScore) : (s.score !== null && s.score !== undefined ? Number(s.score) : undefined),
          maxScore: s.maxScore !== null && s.maxScore !== undefined ? Number(s.maxScore) : undefined,
          teacherComment: s.teacherComment || s.teacher_comment || undefined,
          submittedAt: s.submittedAt ? String(s.submittedAt).slice(0, 10) : (s.createdAt ? String(s.createdAt).slice(0, 10) : actDate),
          reviewedAt: s.reviewedAt ? String(s.reviewedAt).slice(0, 10) : undefined,
          reviewerId: s.reviewerId ? String(s.reviewerId) : undefined,
        };
        setRemoteSubmission(mappedSub);
        if (!matchedUser && (s.studentName || s.grade)) {
          setRemoteStudent({
            id: rawStudentId,
            studentId: Number(rawStudentId) || undefined,
            name: s.studentName || "학생",
            role: "student",
            grade: (Number(s.grade) || 1) as 1 | 2 | 3,
            classNo: Number(s.classNo) || 1,
            number: Number(s.number) || 1,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!ignore) setLoadingDetail(false);
      });
    return () => {
      ignore = true;
    };
  }, [id, users]);

  const student =
    users.find(
      (u) =>
        u.role === "student" &&
        submission &&
        isSubmissionOfStudent(submission, u)
    ) ?? remoteStudent ?? undefined;

  const canReview = !!user && !!student && !!submission && canReviewSubmission(user, student, submission);
  const year = criteria.find((c) => c.year === submission?.year) ?? criteria.find((c) => c.active) ?? criteria[0];
  const normId = (v: string | number) => String(v).replace(/^item-/, "");
  const item = year?.gradeCriteria
    .find((g) => g.grade === student?.grade)
    ?.areas.find((a) => a.area === submission?.area)
    ?.items.find((i) => normId(i.id) === normId(submission?.itemId ?? "") || i.name === submission?.itemName);

  const [scoreInput, setScoreInput] = useState(submission?.score?.toString() ?? item?.maxScore.toString() ?? submission?.maxScore?.toString() ?? "");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"approve" | "reject">("approve");
  const [rejectStatus, setRejectStatus] = useState<"반려" | "재제출요청">("반려");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDraftInfo, setAiDraftInfo] = useState<{
    guideline?: string;
    checkPoints?: string[];
    confidence?: number;
  } | null>(null);
  const saving = useRef(false);

  useEffect(() => {
    if (!scoreInput && (submission?.score !== undefined || item?.maxScore !== undefined || submission?.maxScore !== undefined)) {
      setScoreInput(String(submission?.score ?? item?.maxScore ?? submission?.maxScore ?? ""));
    }
  }, [submission?.score, submission?.maxScore, item?.maxScore, scoreInput]);

  const alreadyApproved = submission?.status === "인정완료";
  const pending = submission?.status === "제출완료" || submission?.status === "검토중";
  const editable = (!item || !item.autoCalculated) && (!year || !!year.active) && (pending || alreadyApproved) && !!user && !!student && !!submission && canReviewSubmission(user, student, submission, alreadyApproved);
  let evidenceLink: string | undefined;
  try {
    const url = new URL(submission?.link?.trim() ?? "");
    if (["http:", "https:"].includes(url.protocol)) evidenceLink = url.href;
  } catch { /* Legacy demo links may not be valid URLs. */ }

  const maxScore = item?.maxScore ?? submission?.maxScore ?? 100;

  async function requestAiDraft() {
    if (!submission) return;
    setAiLoading(true);
    setError(null);
    try {
      const numId = Number(submission.id.replace(/^sub-/, ""));
      const res = await apiClient.request<{
        recommendedStatus?: string;
        recommendedScore?: number;
        score?: number;
        teacherCommentDraft?: string;
        draftComment?: string;
        guidelineSummary?: string;
        checkPoints?: string[];
        confidence?: number;
      }>("/api/ai/teacher/review-draft", {
        method: "POST",
        body: {
          submissionId: Number.isFinite(numId) && numId > 0 ? numId : undefined,
          area: submission.area,
          itemName: submission.itemName,
          detail: submission.detail,
          description: submission.description,
          criteria: item?.description || item?.scoringType || "배점 기준에 따른 심사",
          maxScore,
        },
      });
      const draft = res.teacherCommentDraft || res.draftComment;
      if (draft) setComment(draft);
      const recScore = res.recommendedScore ?? res.score;
      if (recScore !== undefined && recScore !== null) setScoreInput(String(recScore));
      setAiDraftInfo({
        guideline: res.guidelineSummary,
        checkPoints: res.checkPoints,
        confidence: res.confidence,
      });
      setNotice("AI 심사 초안 및 추천 점수를 불러왔습니다. 검토 후 확정해 주세요.");
    } catch (e) {
      setError(`AI 초안 생성 실패: ${apiErrorMessage(e)}`);
    } finally {
      setAiLoading(false);
    }
  }

  async function approve() {
    if (saving.current) return;
    setNotice("");
    if (!submission || !canReview || !editable) { setError("현재 상태 또는 학년도에서는 심사할 수 없습니다."); return; }
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
    setRemoteSubmission((prev) => prev ? { ...prev, status: "인정완료", score, teacherComment: comment.trim() || "제출 자료를 확인하여 인정 처리했습니다." } : prev);
    setNotice("저장했습니다. 심사 결과가 성공적으로 반영되었습니다.");
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
    setRemoteSubmission((prev) => prev ? { ...prev, status: rejectStatus, score: undefined, teacherComment: comment.trim() } : prev);
    setNotice(`${rejectStatus} 처리했습니다.`);
    setComment("");
    } catch { setError("처리하지 못했습니다. 다시 시도해 주세요."); }
    finally { saving.current = false; setBusy(false); }
  }

  const scoreRatio = maxScore > 0 && Number.isFinite(Number(scoreInput))
    ? Math.max(0, Math.min(1, Number(scoreInput) / maxScore)) : 0;

  if (loadingDetail && (!submission || !student)) {
    return (
      <div className="py-12 text-center text-sm text-ink-soft">
        제출 자료를 불러오는 중입니다...
      </div>
    );
  }

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
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Sparkles size={16} className="text-brass" /> AI 심사 Copilot
          </h2>
          {aiDraftInfo?.confidence !== undefined && (
            <span className="text-xs font-medium text-brass">신뢰도: {Math.round(aiDraftInfo.confidence * 100)}%</span>
          )}
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          제출 내용과 평가 기준을 AI가 분석하여 검토 의견 초안과 권장 점수를 제안합니다. 최종 심사 결과는 교사가 확인 후 결정합니다.
        </p>
        {aiDraftInfo?.guideline && (
          <div className="mt-3 rounded-md bg-paper-raised p-3 text-xs text-ink">
            <p className="font-semibold text-brass">심사 가이드 요약</p>
            <p className="mt-1">{aiDraftInfo.guideline}</p>
            {aiDraftInfo.checkPoints && aiDraftInfo.checkPoints.length > 0 && (
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-ink-soft">
                {aiDraftInfo.checkPoints.map((cp, idx) => (
                  <li key={idx}>{cp}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <button
          disabled={busy || !editable || aiLoading}
          onClick={requestAiDraft}
          className="mt-3 rounded-md border border-line bg-paper-raised px-3 py-1.5 text-sm font-medium text-ink hover:bg-paper disabled:opacity-50"
        >
          {aiLoading ? "AI 분석 중..." : "AI 심사 초안 생성"}
        </button>
      </section>
      <section aria-live="polite" className="mb-5 rounded-lg border border-line p-4 text-sm">
        <h2 className="font-semibold">학생 영역별 점수</h2>
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
                <button
                  type="button"
                  onClick={async () => {
                    const res = await downloadSubmissionFile(submission.id, submission.filePath);
                    if (!res.ok) setNotice(res.message || "파일 다운로드 실패");
                  }}
                  className="inline-flex items-center gap-1 text-left text-brass hover:underline"
                >
                  <FileText size={13} strokeWidth={1.75} /> {submission.fileName} (다운로드)
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
