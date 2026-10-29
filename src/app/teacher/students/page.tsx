"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { canViewStudent, isSubmissionOfStudent } from "@/lib/teacherScope";
import { computeAreaResults, computeCertStatus, matchesStudentId } from "@/lib/grading";
import { AREA_NAMES, AreaName, SubmissionStatus } from "@/lib/types";
import { apiClient } from "@/lib/api-client";

const STATUS_OPTIONS: SubmissionStatus[] = ["제출완료", "검토중", "인정완료", "반려", "재제출요청"];

export default function TeacherStudentsPage() {
  const { user } = useAuth();
  const { users, submissions, points, criteria } = useData();

  const activeYear = criteria.find((c) => c.active) ?? criteria[0];
  const years = useMemo(() => {
    const set = new Set(criteria.map((c) => c.year));
    if (activeYear?.year) set.add(activeYear.year);
    if (set.size === 0) set.add(2026);
    return Array.from(set).sort((a, b) => b - a);
  }, [criteria, activeYear]);

  const [selectedYear, setSelectedYear] = useState<number | "">(activeYear?.year ?? 2026);
  const [grade, setGrade] = useState<string>("");
  const [classNo, setClassNo] = useState<string>("");
  const [studentNo, setStudentNo] = useState<string>("");
  const [name, setName] = useState("");
  const [area, setArea] = useState<AreaName | "">("");
  const [status, setStatus] = useState<SubmissionStatus | "">("");
  const [pointsOnly, setPointsOnly] = useState(false);
  const [serverStudents, setServerStudents] = useState<any[] | null>(null);

  const year = criteria.find((c) => c.year === Number(selectedYear)) ?? activeYear;

  useEffect(() => {
    let ignore = false;
    const query: Record<string, string | number | boolean | undefined> = {};
    if (selectedYear) query.year = Number(selectedYear);
    if (grade) query.grade = Number(grade);
    if (classNo) query.classNo = Number(classNo);
    if (studentNo.trim()) {
      const num = Number(studentNo.trim());
      if (Number.isInteger(num) && num > 0) {
        query.studentNo = num;
      } else {
        query.studentId = studentNo.trim();
      }
    }
    if (name.trim()) query.name = name.trim();
    if (area) query.area = area;
    if (status) query.status = status;
    if (pointsOnly) query.hasPoints = "true";

    apiClient
      .request<any[]>("/api/teacher/students", { query })
      .then((res) => {
        if (!ignore && Array.isArray(res)) {
          setServerStudents(res);
        }
      })
      .catch(() => {
        if (!ignore) {
          // 백엔드 연동 불가 또는 오류 시 로컬 데이터 계산 유지
          setServerStudents(null);
        }
      });

    return () => {
      ignore = true;
    };
  }, [selectedYear, grade, classNo, studentNo, name, area, status, pointsOnly]);

  const scopedStudents = useMemo(
    () => (user ? users.filter((u) => u.role === "student" && canViewStudent(user, u)) : []),
    [users, user]
  );

  const rows = useMemo(() => {
    if (serverStudents) {
      return serverStudents.map((st: any) => {
        const student = {
          id: String(st.userId ?? st.studentId ?? st.id),
          name: st.name,
          grade: st.grade,
          classNo: st.classNo ?? st.class_no,
          number: st.number ?? st.studentNo,
        };
        return {
          student,
          totalScore: Number(st.totalScore ?? 0),
          certStatus: st.certStatus ?? "미달성",
          pending: Number(st.pendingCount ?? 0),
          pointTotal: Number(st.pointTotal ?? 0),
        };
      });
    }

    return scopedStudents
      .filter((s) => (grade ? String(s.grade) === grade : true))
      .filter((s) => (classNo ? String(s.classNo) === classNo : true))
      .filter((s) => (studentNo ? String(s.number) === studentNo || String(s.id).includes(studentNo) : true))
      .filter((s) => (name ? s.name.includes(name) : true))
      .map((s) => {
        const studentSubs = submissions.filter((sub) => isSubmissionOfStudent(sub, s) && sub.year === year?.year);
        const studentPoints = points.filter(
          (p) => matchesStudentId(p.studentId, p.rawStudentId, s.id) || (s.studentId !== undefined && matchesStudentId(p.studentId, p.rawStudentId, s.studentId))
        );
        const results =
          s.grade && year ? computeAreaResults(s.id, year.year, s.grade, year, submissions, points) : [];
        const localTotalScore = results.reduce((sum, r) => sum + r.score, 0);
        const totalScore = studentSubs.length > 0 ? localTotalScore : (s.totalScore ?? localTotalScore);
        const hasUnderReview = studentSubs.some((sub) => ["제출완료", "검토중", "재제출요청"].includes(sub.status));
        const certStatus = studentSubs.length > 0 ? computeCertStatus(results, hasUnderReview) : (s.certStatus ?? computeCertStatus(results, hasUnderReview));
        const localPending = studentSubs.filter((sub) => sub.status === "제출완료" || sub.status === "검토중").length;
        const pending = studentSubs.length > 0 ? localPending : (s.pendingCount ?? localPending);
        const localPointTotal = studentPoints.reduce((sum, p) => sum + p.score, 0);
        const pointTotal = studentPoints.length > 0 ? localPointTotal : (s.pointTotal ?? localPointTotal);

        return { student: s, studentSubs, totalScore, certStatus, pending, pointTotal, studentPoints };
      })
      .filter((r) => (area ? r.studentSubs.some((sub) => sub.area === area) : true))
      .filter((r) => (status ? r.studentSubs.some((sub) => sub.status === status) : true))
      .filter((r) => (pointsOnly ? (r.studentPoints.length > 0 || r.pointTotal !== 0) : true));
  }, [serverStudents, scopedStudents, submissions, points, year, grade, classNo, studentNo, name, area, status, pointsOnly]);

  return (
    <div>
      <PageHeader title="학생 자료 조회" description="권한 범위 내 학생의 인증 현황과 제출 자료를 조회합니다." />

      <div className="mobile-filters mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-paper-raised p-4">
        <Field label="학년도">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : "")}
            className="rounded-md border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brass"
          >
            <option value="">전체 학년도</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}학년도
              </option>
            ))}
          </select>
        </Field>
        <Field label="학년">
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="rounded-md border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brass"
          >
            <option value="">전체 학년</option>
            <option value="1">1학년</option>
            <option value="2">2학년</option>
            <option value="3">3학년</option>
          </select>
        </Field>
        <Field label="반">
          <select
            value={classNo}
            onChange={(e) => setClassNo(e.target.value)}
            className="rounded-md border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brass"
          >
            <option value="">전체 반</option>
            {[1, 2, 3, 4].map((c) => (
              <option key={c} value={c}>
                {c}반
              </option>
            ))}
          </select>
        </Field>
        <Field label="학번/번호">
          <input
            value={studentNo}
            onChange={(e) => setStudentNo(e.target.value)}
            placeholder="번호 또는 학번"
            className="w-28 rounded-md border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brass"
          />
        </Field>
        <Field label="이름">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="학생 이름 검색"
            className="w-36 rounded-md border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brass"
          />
        </Field>
        <Field label="인증 영역">
          <select
            value={area}
            onChange={(e) => setArea(e.target.value as AreaName | "")}
            className="rounded-md border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brass"
          >
            <option value="">전체 영역</option>
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
            <option value="">전체 상태</option>
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

      <div className="space-y-3 md:hidden">
        {rows.map(({ student, totalScore, certStatus, pending, pointTotal }) => (
          <article key={student.id} className="rounded-xl border border-line bg-paper-raised p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-semibold">{student.name}</h2><p className="text-xs text-ink-soft">{student.grade}학년 {student.classNo}반 {student.number}번</p></div><StatusPill label={certStatus} /></div>
            <dl className="my-4 grid grid-cols-3 gap-2 rounded-lg bg-paper p-3 text-sm"><div><dt className="text-xs text-ink-soft">총점</dt><dd className="mt-1 font-semibold">{totalScore.toFixed(1)}점</dd></div><div><dt className="text-xs text-ink-soft">검토 대기</dt><dd className="mt-1 font-semibold">{pending}건</dd></div><div><dt className="text-xs text-ink-soft">상벌점</dt><dd className={`mt-1 font-semibold ${pointTotal < 0 ? "text-alert" : "text-certified"}`}>{pointTotal > 0 ? "+" : ""}{pointTotal}</dd></div></dl>
            <Link href={`/teacher/students/${student.id}`} className="flex min-h-11 items-center justify-center rounded-lg bg-brass-soft text-sm font-medium text-brass" aria-label={`${student.name} 학생 자료 상세보기`}>학생 자료 상세보기</Link>
          </article>
        ))}
        {rows.length === 0 && <p className="rounded-xl border border-line bg-white p-6 text-center text-sm text-ink-soft">조건에 맞는 학생이 없습니다.</p>}
      </div>
      <div className="hidden overflow-hidden rounded-lg border border-line bg-paper-raised md:block">
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
