"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { GradeBadge } from "@/components/GradeBadge";
import { StatusPill } from "@/components/StatusPill";
import { computeAreaResults } from "@/lib/grading";
import { useAuth } from "@/context/AuthContext";
import { isInTeacherScope } from "@/lib/teacherScope";

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { users, submissions, points, criteria } = useData();

  const student = users.find((u) => u.id === id);
  const year = criteria.find((c) => c.active) ?? criteria[0];

  const results = useMemo(
    () => (student?.grade && year ? computeAreaResults(student.id, year.year, student.grade, year, submissions, points) : []),
    [student, year, submissions, points]
  );

  const studentSubs = useMemo(
    () =>
      submissions
        .filter((s) => s.studentId === id)
        .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)),
    [submissions, id]
  );

  if (!student || !user || !isInTeacherScope(user, student)) {
    return <p role="alert">해당 학생을 조회할 권한이 없거나 학생을 찾을 수 없습니다.</p>;
  }

  return (
    <div>
      <Link href="/teacher/students" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft size={15} strokeWidth={1.75} /> 학생 목록으로
      </Link>

      <PageHeader
        title={`${student.name} 학생`}
        description={`${student.grade}학년 ${student.classNo}반 ${student.number}번 · ${year?.year}학년도`}
      />

      <div className="mb-6 overflow-hidden rounded-lg border border-line bg-paper-raised">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>영역</th>
              <th>점수</th>
              <th>등급</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.area}>
                <td className="font-medium text-ink">{r.area}</td>
                <td className="tabular-nums text-ink-soft">
                  {r.score} / {r.maxScore}
                </td>
                <td>
                  <GradeBadge grade={r.grade} />
                </td>
                <td>
                  <StatusPill label={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-paper-raised">
        <div className="border-b border-line px-5 py-3">
          <p className="font-display text-sm font-semibold text-ink">제출 자료</p>
        </div>
        <table className="ledger-table">
          <thead>
            <tr>
              <th>제출일</th>
              <th>영역 · 항목</th>
              <th>상태</th>
              <th>점수</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {studentSubs.map((s) => (
              <tr key={s.id}>
                <td className="text-ink-soft">{s.submittedAt}</td>
                <td className="text-ink">
                  {s.area} · {s.itemName}
                </td>
                <td>
                  <StatusPill label={s.status} />
                </td>
                <td className="tabular-nums text-ink-soft">{s.score ?? "-"}</td>
                <td>
                  <Link href={`/teacher/review/${s.id}`} className="text-sm text-brass hover:underline">
                    검토하기
                  </Link>
                </td>
              </tr>
            ))}
            {studentSubs.length === 0 && (
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
