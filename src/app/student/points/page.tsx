"use client";

import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";

export default function StudentPointsPage() {
  const { user } = useAuth();
  const { points, users } = useData();

  const mine = useMemo(
    () =>
      points
        .filter((p) => p.studentId === user?.id || (user?.studentId && String(p.rawStudentId ?? p.studentId) === String(user.studentId)))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [points, user]
  );

  const teacherName = (id: string) => users.find((u) => u.id === id || (u.teacherId && String(u.teacherId) === id))?.name ?? id;
  const total = mine.reduce((sum, p) => sum + p.score, 0);

  return (
    <div>
      <PageHeader title="상벌점 내역" description="상점 및 벌점 부여 내역과 인증 점수 반영 여부를 확인할 수 있습니다." />

      <div className="mb-6 inline-flex items-center gap-3 rounded-lg border border-line bg-paper-raised px-5 py-4">
        <span className="text-sm text-ink-soft">누적 상벌점</span>
        <span className={`font-display text-2xl font-semibold ${total < 0 ? "text-alert" : "text-certified"}`}>
          {total > 0 ? `+${total}` : total}점
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-paper-raised">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>발생일</th>
              <th>구분</th>
              <th>점수</th>
              <th>사유</th>
              <th>등록 교사</th>
              <th>인증 반영</th>
            </tr>
          </thead>
          <tbody>
            {mine.map((p) => (
              <tr key={p.id}>
                <td className="text-ink-soft">{p.date}</td>
                <td>
                  <StatusPill label={p.type} />
                </td>
                <td className={`tabular-nums font-medium ${p.score < 0 ? "text-alert" : "text-certified"}`}>
                  {p.score > 0 ? `+${p.score}` : p.score}
                </td>
                <td className="text-ink">{p.reason}</td>
                <td className="text-ink-soft">{p.teacherName ?? teacherName(p.teacherId)}</td>
                <td className="text-ink-soft">
                  {p.reflected ? `반영됨 (${p.reflectedArea})` : "미반영"}
                </td>
              </tr>
            ))}
            {mine.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-ink-soft">
                  상벌점 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
