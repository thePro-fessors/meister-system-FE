"use client";

import { useMemo } from "react";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { computeAreaResults, computeCertStatus } from "@/lib/grading";
import { CertStatus } from "@/lib/types";

export default function AdminDashboard() {
  const { users, submissions, points, criteria } = useData();
  const year = criteria.find((c) => c.active) ?? criteria[0];
  const students = users.filter((u) => u.role === "student");

  const rows = useMemo(
    () =>
      students.map((s) => {
        const results = s.grade && year ? computeAreaResults(s.id, year.year, s.grade, year, submissions, points) : [];
        const hasUnderReview = submissions.some(
          (sub) => sub.studentId === s.id && sub.year === year?.year && ["제출완료", "검토중", "재제출요청"].includes(sub.status)
        );
        const status = computeCertStatus(results, hasUnderReview);
        const total = results.reduce((sum, r) => sum + r.score, 0);
        return { student: s, status, total };
      }),
    [students, year, submissions, points]
  );

  const statusCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  const pendingCount = submissions.filter((s) => s.status === "제출완료" || s.status === "검토중").length;

  const STATUS_ORDER: CertStatus[] = ["인증 가능", "보완 필요", "검토중", "미달성"];

  return (
    <div>
      <PageHeader
        eyebrow={year ? `${year.year}학년도` : undefined}
        title="전체 현황"
        description="전체 학생의 인증 현황과 검토 대기 자료를 한눈에 확인합니다."
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border border-line bg-paper-raised p-5">
          <p className="text-xs text-ink-soft">전체 학생 수</p>
          <p className="mt-1.5 font-display text-3xl font-semibold text-ink">{students.length}</p>
        </div>
        {STATUS_ORDER.map((st) => (
          <div key={st} className="rounded-lg border border-line bg-paper-raised p-5">
            <p className="text-xs text-ink-soft">{st}</p>
            <p className="mt-1.5 font-display text-3xl font-semibold text-navy">{statusCounts[st] ?? 0}</p>
          </div>
        ))}
      </div>

      <p className="mb-3 text-sm text-ink-soft">현재 검토 대기 중인 증빙자료: {pendingCount}건</p>

      <div className="overflow-hidden rounded-lg border border-line bg-paper-raised">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>학생</th>
              <th>학년/반/번호</th>
              <th>총점</th>
              <th>인증 상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ student, status, total }) => (
              <tr key={student.id}>
                <td className="font-medium text-ink">{student.name}</td>
                <td className="text-ink-soft">
                  {student.grade}학년 {student.classNo}반 {student.number}번
                </td>
                <td className="tabular-nums text-ink-soft">{total.toFixed(1)}점</td>
                <td>
                  <StatusPill label={status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
