"use client";

import { useMemo, useRef, useState } from "react";
import { FileText, Link as LinkIcon, RotateCcw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { Submission, SubmissionStatus } from "@/lib/types";
import { downloadSubmissionFile, apiClient } from "@/lib/api-client";

const STATUSES: SubmissionStatus[] = ["제출완료", "검토중", "인정완료", "반려", "재제출요청", "이의신청"];

function safeLink(value: string) {
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}

function decodeHtmlEntities(value?: string | null) {
  if (!value) return "";
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

export default function StudentSubmissionsPage() {
  const { user } = useAuth();
  const { submissions, criteria, updateSubmission, deleteSubmission, refresh } = useData();
  const [year, setYear] = useState(() => String(criteria.find((c) => c.active)?.year ?? ""));
  const [status, setStatus] = useState<SubmissionStatus | "">("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [appealingId, setAppealingId] = useState<string | null>(null);
  const [appealReason, setAppealReason] = useState("");
  const [draft, setDraft] = useState({ detail: "", description: "", fileName: "", link: "" });
  const [replacement, setReplacement] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

  const mine = useMemo(
    () =>
      submissions
        .filter((s) => s.studentId === user?.id || (user?.studentId && String(s.rawStudentId ?? s.studentId) === String(user.studentId)))
        .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)),
    [submissions, user]
  );
  const years = [...new Set([...criteria.map((c) => c.year), ...mine.map((s) => s.year)])].sort((a, b) => b - a);
  const inYear = mine.filter((s) => !year || s.year === Number(year));
  const visible = inYear.filter((s) => !status || s.status === status);

  function startResubmit(s: Submission) {
    if (busy || !["반려", "재제출요청"].includes(s.status)) return;
    setError("");
    setNotice("");
    setReplacement(null);
    setConfirmDeleteId(null);
    setAppealingId(null);
    setEditing(s.id);
    setDraft({ detail: s.detail, description: s.description, fileName: s.fileName ?? "", link: s.link ?? "" });
  }

  function startAppeal(s: Submission) {
    if (busy || s.status !== "반려") return;
    setError("");
    setNotice("");
    setEditing(null);
    setConfirmDeleteId(null);
    setAppealingId(s.id);
    setAppealReason("");
  }

  async function saveAppeal(id: string) {
    if (!appealReason.trim()) {
      setError("이의신청 사유를 입력해주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const numId = Number(id.replace(/^sub-/, ""));
      await apiClient.request(`/api/submissions/${numId}/appeal`, {
        method: "POST",
        body: JSON.stringify({ appeal_reason: appealReason.trim() }),
      });
      setNotice("공식 이의신청이 접수되었습니다. 담당 부장 교사의 2차 재심사가 진행됩니다.");
      setAppealingId(null);
      setAppealReason("");
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "이의신청 접수 중 오류가 발생했습니다.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function saveResubmit(id: string) {
    if (saving.current) return;
    setError("");
    setNotice("");
    const submission = mine.find((s) => s.id === id);
    if (!submission || !["반려", "재제출요청"].includes(submission.status)) {
      setError("반려 또는 재제출요청 상태에서만 보완할 수 있습니다."); return;
    }
    if (!criteria.some((c) => c.year === submission.year && c.active)) { setError("비활성 학년도에는 재제출할 수 없습니다."); return; }
    const normId = (val: string | number) => String(val).replace(/^item-/, "");
    const item = criteria.find((c) => c.year === submission.year)?.gradeCriteria
      .find((g) => g.grade === user?.grade)?.areas.find((a) => a.area === submission.area)
      ?.items.find((i) => normId(i.id) === normId(submission.itemId) || i.name === submission.itemName);
    if (!item || item.autoCalculated) { setError("평가 기준을 확인할 수 없거나 자동연동 항목입니다. 관리자에게 문의해 주세요."); return; }
    if (replacement && replacement.size > 50 * 1024 * 1024) { setError("파일은 50MB 이하여야 합니다."); return; }
    if (!draft.detail.trim() || !draft.description.trim() || (item.requiresEvidence && !replacement && !draft.fileName.trim() && !draft.link.trim())) {
      setError("설명과 필요한 증빙자료를 입력해 주세요.");
      return;
    }
    if (draft.link.trim()) {
      try {
        if (!["http:", "https:"].includes(new URL(draft.link.trim()).protocol)) throw new Error("Invalid protocol");
      } catch {
        setError("http:// 또는 https://로 시작하는 올바른 링크를 입력해 주세요.");
        return;
      }
    }
    saving.current = true;
    setBusy(true);
    try {
      await updateSubmission(id, {
        detail: draft.detail.trim(),
        description: draft.description.trim(),
        fileName: replacement?.name ?? (draft.fileName || undefined),
        link: draft.link.trim() || undefined,
        status: "제출완료",
        file: replacement || undefined,
      } as any);
      setEditing(null);
      setNotice("보완 자료를 성공적으로 재제출했습니다.");
    } catch { setError("재제출하지 못했습니다. 다시 시도해 주세요."); }
    finally { saving.current = false; setBusy(false); }
  }

  async function remove(id: string) {
    if (saving.current || !user) return;
    setError(""); setNotice("");
    const current = mine.find((s) => s.id === id);
    if (!current || current.status !== "제출완료") { setError("이미 심사 중이거나 삭제할 수 없는 건입니다. 현재 목록을 확인해 주세요."); return; }
    saving.current = true; setBusy(true);
    try {
      await deleteSubmission(id, user.id);
      if (editing === id) setEditing(null);
      setConfirmDeleteId(null);
      setNotice("제출 자료를 삭제했습니다.");
    } catch { setError("삭제하지 못했습니다. 이미 심사가 진행된 건인지 목록을 확인해 주세요."); }
    finally { saving.current = false; setBusy(false); }
  }

  return (
    <div>
      <PageHeader title="제출 내역" description="제출한 증빙자료의 처리 결과를 확인할 수 있습니다." />

      <label className="mb-4 flex items-center gap-3 text-sm text-ink">학년도
        <select value={year} onChange={(e) => { setYear(e.target.value); setEditing(null); }} className="rounded-md border border-line bg-white px-3 py-2">
          <option value="">전체 학년도</option>
          {years.map((value) => <option key={value} value={value}>{value}학년도</option>)}
        </select>
      </label>
      <div role="group" aria-label="심사 상태 필터" className="mb-5 flex flex-wrap gap-2">
        {(["", ...STATUSES] as const).map((value) => <button key={value} aria-pressed={status === value}
          onClick={() => { setStatus(value); setEditing(null); }}
          className={`rounded-md border border-line px-3 py-2 text-sm ${status === value ? "bg-navy text-white" : "bg-paper-raised text-ink"}`}>
          {value || "전체"} ({inYear.filter((s) => !value || s.status === value).length})
        </button>)}
      </div>
      {notice && <p role="status" className="mb-4 text-sm text-ink-soft">{notice}</p>}
      {error && <p role="alert" className="mb-4 text-sm text-alert">{error}</p>}

      <div className="space-y-3">
        {visible.map((s) => (
          <div key={s.id} className="rounded-lg border border-line bg-paper-raised p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-ink-soft">
                  {s.submittedAt} 제출 · {s.area} · 활동일 {s.activityDate}
                </p>
                <p className="mt-1 font-medium text-ink">
                  {s.itemName} <span className="text-ink-soft">· {s.detail}</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                {s.score !== undefined && (
                  <span className="font-display text-lg font-semibold text-brass">{s.score}점</span>
                )}
                <StatusPill label={s.status} />
              </div>
            </div>

            <p className="mt-3 text-sm text-ink-soft">{s.description}</p>

            <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-soft">
              {s.fileName && (
                <button
                  type="button"
                  onClick={async () => {
                    setNotice("다운로드 티켓을 발급받는 중입니다...");
                    const res = await downloadSubmissionFile(s.id, s.fileUrl);
                    if (!res.ok) setNotice(res.message || "파일 다운로드에 실패했습니다.");
                    else setNotice("파일 다운로드가 시작되었습니다.");
                  }}
                  className="inline-flex items-center gap-1 text-left text-brass hover:underline cursor-pointer"
                >
                  <FileText size={13} strokeWidth={1.75} /> {s.fileName} · 증빙자료 다운로드
                </button>
              )}
              {s.link && (
                <span className="inline-flex items-center gap-1">
                  <LinkIcon size={13} strokeWidth={1.75} /> {safeLink(s.link) ? <a href={s.link.trim()} target="_blank" rel="noopener noreferrer" className="break-all underline">{s.link}</a> : <span>유효하지 않은 링크</span>}
                </span>
              )}
            </div>

            {s.teacherComment && (
              <div
                className={`mt-3 rounded-md px-3 py-2 text-sm ${
                  s.status === "반려" || s.status === "재제출요청"
                    ? "bg-alert-soft text-alert"
                    : "bg-navy-soft text-ink"
                }`}
              >
                교사 의견: {decodeHtmlEntities(s.teacherComment)}
              </div>
            )}

            {(s.status === "반려" || s.status === "재제출요청") && editing !== s.id && (
              <button
                onClick={() => startResubmit(s)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-navy-soft"
              >
                <RotateCcw size={13} strokeWidth={1.75} /> 보완하여 재제출
              </button>
            )}

            {s.status === "반려" && editing !== s.id && appealingId !== s.id && (
              <button
                onClick={() => startAppeal(s)}
                className="ml-2 mt-3 inline-flex items-center gap-1.5 rounded-md border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100"
              >
                공식 이의신청
              </button>
            )}

            {appealingId === s.id && (
              <div className="mt-3 space-y-2 rounded-lg border border-purple-200 bg-purple-50/50 p-3">
                <p className="text-xs font-semibold text-purple-900">공식 이의신청 사유 작성 (부장 교사 2차 재심사)</p>
                <textarea
                  className="w-full rounded-md border border-line bg-paper p-2 text-xs"
                  rows={3}
                  placeholder="반려 사유에 대한 반론 및 증빙 상세 근거를 작성하세요 (최대 1000자)"
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  disabled={busy}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setAppealingId(null)}
                    disabled={busy}
                    className="rounded-md border border-line px-3 py-1 text-xs"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => saveAppeal(s.id)}
                    disabled={busy || !appealReason.trim()}
                    className="rounded-md bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    이의신청 접수
                  </button>
                </div>
              </div>
            )}

            {s.status === "제출완료" && (
              confirmDeleteId !== s.id ? (
                <button
                  disabled={busy}
                  onClick={() => setConfirmDeleteId(s.id)}
                  className="ml-2 mt-3 rounded-md border border-line px-3 py-1.5 text-xs text-alert hover:bg-alert-soft"
                >
                  제출 삭제
                </button>
              ) : (
                <span className="ml-2 mt-3 inline-flex items-center gap-1.5">
                  <button
                    disabled={busy}
                    onClick={() => remove(s.id)}
                    className="rounded-md bg-alert px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                  >
                    삭제 확인
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setConfirmDeleteId(null)}
                    className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-soft hover:bg-white"
                  >
                    취소
                  </button>
                </span>
              )
            )}

            {editing === s.id && (
              <div className="mt-4 space-y-3 rounded-md border border-line bg-white p-4">
                <input aria-label="보완 활동상세" value={draft.detail} onChange={(e) => setDraft((d) => ({ ...d, detail: e.target.value }))} className="w-full rounded-md border border-line px-3 py-2 text-sm" />
                <textarea
                  aria-label="보완 설명"
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brass focus:ring-1 focus:ring-brass"
                />
                <p className="text-xs text-ink-soft">기존 파일: {draft.fileName || "없음"}. 교체하지 않으면 기존 파일이 유지됩니다. (최대 50MB)</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    type="file"
                    aria-label="교체 파일 (선택, 최대 50MB)"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (file && file.size > 50 * 1024 * 1024) {
                        e.target.value = ""; setReplacement(null); setError("50MB를 초과한 파일은 첨부할 수 없습니다."); return;
                      }
                      setReplacement(file); setError("");
                    }}
                    className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brass focus:ring-1 focus:ring-brass"
                  />
                  <input
                    aria-label="보완 링크"
                    value={draft.link}
                    onChange={(e) => setDraft((d) => ({ ...d, link: e.target.value }))}
                    placeholder="링크 (선택)"
                    className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brass focus:ring-1 focus:ring-brass"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() => saveResubmit(s.id)}
                    className="rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-ink"
                  >
                    {busy ? "등록 중..." : "재제출하기"}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setEditing(null)}
                    className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {visible.length === 0 && (
          <p className="rounded-lg border border-line bg-paper-raised p-8 text-center text-sm text-ink-soft">
            선택한 조건에 해당하는 증빙자료가 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}
