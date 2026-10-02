"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { isInTeacherScope } from "@/lib/teacherScope";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { users, submissions } = useData();

  const scopedStudentIds = useMemo(() => {
    if (!user) return new Set<string>();
    return new Set(
      users.filter((u) => u.role === "student" && isInTeacherScope(user, u)).map((u) => u.id)
    );
  }, [users, user]);

  const scoped = useMemo(
    () => submissions.filter((s) => scopedStudentIds.has(s.studentId)),
    [submissions, scopedStudentIds]
  );

  const pending = scoped.filter((s) => s.status === "제출완료" || s.status === "검토중");
  const resubmitted = scoped.filter((s) => s.status === "재제출요청");
  const recent = [...scoped].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)).slice(0, 6);
  const unscored = scoped.filter((s) => s.status !== "인정완료" && s.status !== "반려");

  const studentName = (id: string) => users.find((u) => u.id === id)?.name ?? id;

  return (
    <div>
      <PageHeader
        title="교사 대시보드"
        description={user?.homeroom ? `권한 범위: ${user.homeroom}` : "담당 학생 자료를 확인하세요."}
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="검토 대기 자료 수" value={pending.length} tone="amber" />
        <StatCard label="재제출 자료" value={resubmitted.length} tone="alert" />
        <StatCard label="점수 미부여 자료" value={unscored.length} tone="navy" />
        <StatCard label="권한 범위 학생 수" value={scopedStudentIds.size} tone="brass" />
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-paper-raised">
        <div className="border-b border-line px-5 py-3">
          <p className="font-display text-sm font-semibold text-ink">최근 제출 자료</p>
        </div>
        <table className="ledger-table">
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
            {recent.map((s) => (
              <tr key={s.id}>
                <td className="text-ink-soft">{s.submittedAt}</td>
                <td className="font-medium text-ink">{studentName(s.studentId)}</td>
                <td className="text-ink-soft">
                  {s.area} · {s.itemName}
                </td>
                <td>
                  <StatusPill label={s.status} />
                </td>
                <td>
                  <Link href={`/teacher/review/${s.id}`} className="text-sm text-brass hover:underline">
                    검토하기
                  </Link>
                </td>
              </tr>
            ))}
            {recent.length === 0 && (
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
