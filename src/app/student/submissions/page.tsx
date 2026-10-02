"use client";

import { useMemo, useState } from "react";
import { FileText, Link as LinkIcon, RotateCcw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { Submission } from "@/lib/types";

export default function StudentSubmissionsPage() {
  const { user } = useAuth();
  const { submissions, criteria, updateSubmission } = useData();
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ description: "", fileName: "", link: "" });

  const mine = useMemo(
    () =>
      submissions
        .filter((s) => s.studentId === user?.id)
        .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)),
    [submissions, user]
  );

  function startResubmit(s: Submission) {
    setError("");
    setEditing(s.id);
    setDraft({ description: s.description, fileName: s.fileName ?? "", link: s.link ?? "" });
  }

  function saveResubmit(id: string) {
    const submission = mine.find((s) => s.id === id);
    if (!submission || !["반려", "재제출요청"].includes(submission.status)) return;
    const item = criteria.find((c) => c.year === submission.year)?.gradeCriteria
      .find((g) => g.grade === user?.grade)?.areas.find((a) => a.area === submission.area)
      ?.items.find((i) => i.id === submission.itemId);
    if (!draft.description.trim() || ((item?.requiresEvidence ?? true) && !draft.fileName.trim() && !draft.link.trim())) {
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
    updateSubmission(id, {
      description: draft.description,
      fileName: draft.fileName || undefined,
      link: draft.link || undefined,
      status: "검토중",
      teacherComment: undefined,
      score: undefined,
      reviewerId: undefined,
      reviewedAt: undefined,
      submittedAt: new Date().toISOString().slice(0, 10),
    });
    setEditing(null);
  }

  return (
    <div>
      <PageHeader title="제출 내역" description="제출한 증빙자료의 처리 결과를 확인할 수 있습니다." />

      <div className="space-y-3">
        {mine.map((s) => (
          <div key={s.id} className="rounded-lg border border-line bg-paper-raised p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-ink-soft">
                  {s.submittedAt} 제출 · {s.area}
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
                <span className="inline-flex items-center gap-1">
                  <FileText size={13} strokeWidth={1.75} /> {s.fileName}
                </span>
              )}
              {s.link && (
                <span className="inline-flex items-center gap-1">
                  <LinkIcon size={13} strokeWidth={1.75} /> {s.link}
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
                교사 의견: {s.teacherComment}
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

            {editing === s.id && (
              <div className="mt-4 space-y-3 rounded-md border border-line bg-white p-4">
                {error && <p role="alert" className="text-sm text-alert">{error}</p>}
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brass focus:ring-1 focus:ring-brass"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={draft.fileName}
                    onChange={(e) => setDraft((d) => ({ ...d, fileName: e.target.value }))}
                    placeholder="파일명 (선택)"
                    className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brass focus:ring-1 focus:ring-brass"
                  />
                  <input
                    value={draft.link}
                    onChange={(e) => setDraft((d) => ({ ...d, link: e.target.value }))}
                    placeholder="링크 (선택)"
                    className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brass focus:ring-1 focus:ring-brass"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveResubmit(s.id)}
                    className="rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-ink"
                  >
                    재제출하기
                  </button>
                  <button
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

        {mine.length === 0 && (
          <p className="rounded-lg border border-line bg-paper-raised p-8 text-center text-sm text-ink-soft">
            아직 제출한 증빙자료가 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}
