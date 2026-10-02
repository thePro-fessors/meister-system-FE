"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { isInTeacherScope } from "@/lib/teacherScope";
import { computeAreaResults, computeCertStatus } from "@/lib/grading";
import { AREA_NAMES, AreaName, SubmissionStatus } from "@/lib/types";

const STATUS_OPTIONS: SubmissionStatus[] = ["제출완료", "검토중", "인정완료", "반려", "재제출요청"];

export default function TeacherStudentsPage() {
  const { user } = useAuth();
  const { users, submissions, points, criteria } = useData();

  const [name, setName] = useState("");
  const [area, setArea] = useState<AreaName | "">("");
  const [status, setStatus] = useState<SubmissionStatus | "">("");
  const [pointsOnly, setPointsOnly] = useState(false);

  const year = criteria.find((c) => c.active) ?? criteria[0];

  const scopedStudents = useMemo(
    () => (user ? users.filter((u) => u.role === "student" && isInTeacherScope(user, u)) : []),
    [users, user]
  );

  const rows = useMemo(() => {
    return scopedStudents
      .filter((s) => (name ? s.name.includes(name) : true))
      .map((s) => {
        const studentSubs = submissions.filter((sub) => sub.studentId === s.id && sub.year === year?.year);
        const studentPoints = points.filter((p) => p.studentId === s.id);
        const results =
          s.grade && year ? computeAreaResults(s.id, year.year, s.grade, year, submissions, points) : [];
        const totalScore = results.reduce((sum, r) => sum + r.score, 0);
        const hasUnderReview = studentSubs.some((sub) => ["제출완료", "검토중", "재제출요청"].includes(sub.status));
        const certStatus = computeCertStatus(results, hasUnderReview);
        const pending = studentSubs.filter((sub) => sub.status === "제출완료" || sub.status === "검토중").length;
        const pointTotal = studentPoints.reduce((sum, p) => sum + p.score, 0);

        return { student: s, studentSubs, totalScore, certStatus, pending, pointTotal, studentPoints };
      })
      .filter((r) => (area ? r.studentSubs.some((sub) => sub.area === area) : true))
      .filter((r) => (status ? r.studentSubs.some((sub) => sub.status === status) : true))
      .filter((r) => (pointsOnly ? r.studentPoints.length > 0 : true));
  }, [scopedStudents, submissions, points, year, name, area, status, pointsOnly]);

  return (
    <div>
      <PageHeader title="학생 자료 조회" description="권한 범위 내 학생의 인증 현황과 제출 자료를 조회합니다." />

      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-paper-raised p-4">
        <Field label="이름">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="학생 이름 검색"
            className="w-40 rounded-md border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brass"
          />
        </Field>
        <Field label="인증 영역">
          <select
            value={area}
            onChange={(e) => setArea(e.target.value as AreaName | "")}
            className="rounded-md border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brass"
          >
            <option value="">전체</option>
            {AREA_NAMES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>
        <Field label="제출 상태">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SubmissionStatus | "")}
            className="rounded-md border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brass"
          >
            <option value="">전체</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-1.5 pb-1.5 text-sm text-ink-soft">
          <input type="checkbox" checked={pointsOnly} onChange={(e) => setPointsOnly(e.target.checked)} />
          상벌점 있는 학생만
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-paper-raised">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>학생</th>
              <th>학년/반/번호</th>
              <th>총점</th>
              <th>인증 상태</th>
              <th>검토 대기 자료</th>
              <th>상벌점 합계</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ student, totalScore, certStatus, pending, pointTotal }) => (
              <tr key={student.id}>
                <td className="font-medium text-ink">{student.name}</td>
                <td className="text-ink-soft">
                  {student.grade}학년 {student.classNo}반 {student.number}번
                </td>
                <td className="tabular-nums text-ink-soft">{totalScore.toFixed(1)}점</td>
                <td>
                  <StatusPill label={certStatus} />
                </td>
                <td className="text-ink-soft">{pending}건</td>
                <td className={pointTotal < 0 ? "text-alert" : "text-certified"}>
                  {pointTotal > 0 ? `+${pointTotal}` : pointTotal}
                </td>
                <td>
                  <Link
                    href={`/teacher/students/${student.id}`}
                    className="text-sm text-brass hover:underline"
                  >
                    상세보기
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-ink-soft">
                  조건에 맞는 학생이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-ink-soft">{label}</span>
      {children}
    </div>
  );
}
