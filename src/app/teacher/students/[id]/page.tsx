"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { GradeBadge } from "@/components/GradeBadge";
import { StatusPill } from "@/components/StatusPill";
import { academicYear, computeAreaResults, matchesStudentId } from "@/lib/grading";
import { useAuth } from "@/context/AuthContext";
import { canManageStudent, isSubmissionOfStudent } from "@/lib/teacherScope";
import { DeletePointButton } from "@/components/DeletePointButton";
import { apiClient } from "@/lib/api-client";
import { AreaName, GradeLevel } from "@/lib/types";

interface ServerStudentDetail {
  studentId?: number;
  name?: string;
  grade?: number;
  classNo?: number;
  number?: number;
  pointTotal?: number;
  pendingCount?: number;
  areas?: Array<{
    area: AreaName;
    score: number;
    maxScore: number;
    grade: GradeLevel;
    status: string;
  }>;
  submissions?: Array<any>;
}

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { users, submissions, points, criteria } = useData();
  const [serverDetail, setServerDetail] = useState<ServerStudentDetail | null>(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await apiClient.request<ServerStudentDetail>(`/api/teacher/students/${id}`);
        if (!ignore && res) setServerDetail(res);
      } catch {
        // Fall back to context calculation
      }
    }
    void load();
    return () => { ignore = true; };
  }, [id]);

  const student = users.find((u) => u.id === id || String(u.studentId) === id);
  const year = criteria.find((c) => c.active) ?? criteria[0];

  const localResults = useMemo(
    () => (student?.grade && year ? computeAreaResults(student.id, year.year, student.grade, year, submissions, points) : []),
    [student, year, submissions, points]
  );

  const results = serverDetail?.areas && serverDetail.areas.length > 0 ? serverDetail.areas : localResults;

  const studentPoints = useMemo(
    () =>
      points.filter(
        (p) =>
          matchesStudentId(p.studentId, p.rawStudentId, id) ||
          (student && matchesStudentId(p.studentId, p.rawStudentId, student.id)) ||
          (student?.studentId !== undefined && matchesStudentId(p.studentId, p.rawStudentId, student.studentId))
      ),
    [points, id, student]
  );

  const pointTotal = useMemo(() => {
    const yearPts = studentPoints.filter((p) => (p.year ?? academicYear(p.date)) === year?.year);
    if (yearPts.length > 0) return yearPts.reduce((sum, p) => sum + p.score, 0);
    return serverDetail?.pointTotal ?? student?.pointTotal ?? 0;
  }, [studentPoints, year, serverDetail, student]);

  const studentSubs = useMemo(() => {
    if (serverDetail?.submissions && serverDetail.submissions.length > 0) {
      return serverDetail.submissions.map((s) => ({
        id: String(s.id ?? s.submission_id),
        area: s.area || s.area_name,
        itemName: s.itemName || s.item_name,
        status: s.status,
        score: s.grantedScore ?? s.granted_score ?? s.score,
        submittedAt: s.submittedAt ? String(s.submittedAt).slice(0, 10) : (s.created_at ? String(s.created_at).slice(0, 10) : ""),
      }));
    }
    return submissions
      .filter((s) => s.studentId === id || (student && isSubmissionOfStudent(s, student)))
      .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  }, [submissions, id, student, serverDetail]);

  if (!student || !user || !canManageStudent(user, student)) {
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
        <p aria-live="polite" className="p-5 text-sm text-ink">취득 총점 {results.reduce((sum, r) => sum + r.score, 0)}점 · 상벌점 합계 {pointTotal}점</p>
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

      <section className="mb-6 rounded-lg border border-line bg-paper-raised p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold">상벌점 이력</h2>
          <Link href="/teacher/points" className="text-sm text-brass hover:underline">상벌점 신규 부여</Link>
        </div>
        {studentPoints.map((p) => <div key={p.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
          <span>{p.date} · {p.reason} · {p.score > 0 ? "+" : ""}{p.score}점</span><DeletePointButton id={p.id} />
        </div>)}
        {studentPoints.length === 0 && <p className="mt-3 text-sm text-ink-soft">상벌점 기록이 없습니다.</p>}
      </section>

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
