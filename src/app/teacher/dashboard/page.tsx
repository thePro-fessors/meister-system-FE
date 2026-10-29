"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { canReviewSubmission, isInTeacherScope } from "@/lib/teacherScope";
import { apiClient } from "@/lib/api-client";
import { SubmissionStatus } from "@/lib/types";

interface ServerSubmissionRow {
  id: string | number;
  submissionId?: string | number;
  studentName: string;
  area: string;
  itemName: string;
  status: SubmissionStatus;
  submittedAt: string;
}

interface ServerDashboardData {
  pendingCount?: number;
  resubmittedCount?: number;
  unscoredCount?: number;
  studentCount?: number;
  scopeLabel?: string;
  recentSubmissions?: ServerSubmissionRow[];
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { users, submissions } = useData();
  const [serverDashboard, setServerDashboard] = useState<ServerDashboardData | null>(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await apiClient.request<ServerDashboardData>("/api/teacher/dashboard");
        if (!ignore && res) {
          setServerDashboard(res);
        }
      } catch {
        // Fall back to context calculation
      }
    }
    void load();
    return () => { ignore = true; };
  }, []);

  const scopedStudentIds = useMemo(() => {
    if (!user) return new Set<string>();
    return new Set(
      users.filter((u) => u.role === "student" && isInTeacherScope(user, u)).map((u) => u.id)
    );
  }, [users, user]);

  const scoped = useMemo(
    () => submissions.filter((s) => scopedStudentIds.has(s.studentId) && !!user && users.some((student) => student.id === s.studentId && canReviewSubmission(user, student, s))),
    [submissions, scopedStudentIds, user, users]
  );

  const pending = scoped.filter((s) => s.status === "제출완료" || s.status === "검토중");
  const resubmitted = scoped.filter((s) => s.status === "재제출요청");
  const recent = [...scoped].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)).slice(0, 6);
  const unscored = scoped.filter((s) => s.status !== "인정완료" && s.status !== "반려");

  const studentName = (id: string) => users.find((u) => u.id === id)?.name ?? id;

  const displayPending = pending.length > 0 ? pending.length : (serverDashboard?.pendingCount ?? 0);
  const displayResubmitted = serverDashboard?.resubmittedCount ?? resubmitted.length;
  const displayUnscored = serverDashboard?.unscoredCount ?? unscored.length;
  const displayStudentCount = serverDashboard?.studentCount ?? scopedStudentIds.size;
  const displayScope = serverDashboard?.scopeLabel ?? (user?.homeroom ? `권한 범위: ${user.homeroom}` : "담당 학생 자료를 확인하세요.");

  const displayRecent = serverDashboard?.recentSubmissions && serverDashboard.recentSubmissions.length > 0
    ? serverDashboard.recentSubmissions.map((s) => ({
        id: String(s.id ?? s.submissionId),
        submittedAt: s.submittedAt ? String(s.submittedAt).slice(0, 10) : "",
        studentName: s.studentName,
        area: s.area,
        itemName: s.itemName,
        status: s.status,
        canDirectlyReview: user?.role === "admin" || scoped.some((item) => String(item.id).replace(/^sub-/, "") === String(s.id ?? s.submissionId).replace(/^sub-/, "")),
      }))
    : recent.map((s) => ({
        id: s.id,
        submittedAt: s.submittedAt,
        studentName: studentName(s.studentId),
        area: s.area,
        itemName: s.itemName,
        status: s.status,
        canDirectlyReview: true,
      }));

  return (
    <div>
      <PageHeader
        title="교사 대시보드"
        description={displayScope}
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="검토 대기 자료 수" value={displayPending} tone="amber" />
        <StatCard label="재제출 자료" value={displayResubmitted} tone="alert" />
        <StatCard label="점수 미부여 자료" value={displayUnscored} tone="navy" />
        <StatCard label="권한 범위 학생 수" value={displayStudentCount} tone="brass" />
      </div>

      <div className="space-y-3 md:hidden">
        <div className="px-1 py-1">
          <p className="font-display text-sm font-semibold text-ink">최근 제출 자료</p>
        </div>
        {displayRecent.map((s) => (
          <article key={s.id} className="rounded-xl border border-line bg-paper-raised p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-ink">{s.studentName}</p>
                <p className="text-xs text-ink-soft flex items-center gap-1.5">
                  <span>{s.area} · {s.itemName}</span>
                  {!s.canDirectlyReview && (
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
                      교과전담 심사
                    </span>
                  )}
                </p>
              </div>
              <StatusPill label={s.status} />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-ink-soft">
              <span>제출일: {s.submittedAt || "—"}</span>
              <Link
                href={`/teacher/review/${s.id}`}
                className="inline-flex min-h-11 items-center rounded-lg bg-brass-soft px-3.5 text-xs font-semibold text-brass"
              >
                {s.canDirectlyReview ? "검토하기" : "열람하기"}
              </Link>
            </div>
          </article>
        ))}
        {displayRecent.length === 0 && (
          <p className="rounded-xl border border-line bg-paper-raised p-6 text-center text-sm text-ink-soft">
            제출된 자료가 없습니다.
          </p>
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-line bg-paper-raised md:block">
        <div className="border-b border-line px-5 py-3">
          <p className="font-display text-sm font-semibold text-ink">최근 제출 자료</p>
        </div>
        <table className="ledger-table min-w-[560px]">
          <thead>
            <tr>
              <th>제출일</th>
              <th>학생</th>
              <th>영역 · 항목</th>
              <th>상태</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {displayRecent.map((s) => (
              <tr key={s.id}>
                <td className="text-ink-soft">{s.submittedAt}</td>
                <td className="font-medium text-ink">{s.studentName}</td>
                <td className="text-ink-soft">
                  <div className="flex items-center gap-1.5">
                    <span>{s.area} · {s.itemName}</span>
                    {!s.canDirectlyReview && (
                      <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-600">
                        교과전담 심사
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <StatusPill label={s.status} />
                </td>
                <td>
                  <Link href={`/teacher/review/${s.id}`} className="text-sm text-brass hover:underline">
                    {s.canDirectlyReview ? "검토하기" : "열람하기"}
                  </Link>
                </td>
              </tr>
            ))}
            {displayRecent.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-ink-soft">
                  제출된 자료가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "alert" | "navy" | "brass";
}) {
  const toneMap = {
    amber: "text-amber",
    alert: "text-alert",
    navy: "text-navy",
    brass: "text-brass",
  };
  return (
    <div className="rounded-lg border border-line bg-paper-raised p-5">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className={`mt-1.5 font-display text-3xl font-semibold ${toneMap[tone]}`}>{value}</p>
    </div>
  );
}
