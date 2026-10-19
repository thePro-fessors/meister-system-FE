"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, KeyRound } from "lucide-react";
import { AdminInvitationModal } from "@/components/AdminInvitationModal";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { computeAreaResults, computeCertStatus } from "@/lib/grading";
import { isSubmissionOfStudent } from "@/lib/teacherScope";
import { CertStatus } from "@/lib/types";
import { apiClient, apiErrorMessage } from "@/lib/api-client";

interface AdminOverviewData {
  year?: number;
  totalStudents?: number;
  statusCounts?: {
    certified?: number;
    reviewing?: number;
    supplement?: number;
    uncertified?: number;
  };
  submissionCounts?: {
    total?: number;
    pending?: number;
    approved?: number;
    rejected?: number;
    resubmitRequested?: number;
  };
}

export default function AdminDashboard() {
  const { users, submissions, points, criteria } = useData();
  const year = criteria.find((c) => c.active) ?? criteria[0];
  const students = users.filter((u) => u.role === "student");
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await apiClient.request<AdminOverviewData>("/api/admin/overview", {
          query: { year: year?.year },
        });
        if (!ignore && res) setOverview(res);
      } catch {
        // Fall back to local calculation
      }
    }
    void load();
    return () => { ignore = true; };
  }, [year?.year]);

  async function handleExport(format: "csv" | "xlsx" | "pdf") {
    setExporting(true);
    setExportError(null);
    try {
      const blob = await apiClient.exportStats(format, year?.year);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meister_stats_${year?.year || 2026}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError("내보내기 실패: " + apiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  }

  const rows = useMemo(
    () =>
      students.map((s) => {
        const studentSubs = submissions.filter((sub) => isSubmissionOfStudent(sub, s) && sub.year === year?.year);
        const results = s.grade && year ? computeAreaResults(s.id, year.year, s.grade, year, submissions, points) : [];
        const hasUnderReview = studentSubs.some((sub) => ["제출완료", "검토중", "재제출요청"].includes(sub.status));
        const localStatus = computeCertStatus(results, hasUnderReview);
        const localTotal = results.reduce((sum, r) => sum + r.score, 0);
        const status = studentSubs.length > 0 ? localStatus : (s.certStatus ?? localStatus);
        const total = studentSubs.length > 0 ? localTotal : (s.totalScore ?? localTotal);
        return { student: s, status, total };
      }),
    [students, year, submissions, points]
  );

  const localStatusCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  const totalStudentCount = overview?.totalStudents ?? students.length;
  const pendingCount = overview?.submissionCounts?.pending ?? submissions.filter((s) => s.status === "제출완료" || s.status === "검토중").length;

  const STATUS_ORDER: CertStatus[] = ["인증 가능", "보완 필요", "검토중", "미달성"];

  function getStatusValue(st: CertStatus): number {
    if (overview?.statusCounts) {
      if (st === "인증 가능") return overview.statusCounts.certified ?? 0;
      if (st === "보완 필요") return overview.statusCounts.supplement ?? 0;
      if (st === "검토중") return overview.statusCounts.reviewing ?? 0;
      if (st === "미달성") return overview.statusCounts.uncertified ?? 0;
    }
    return localStatusCounts[st] ?? 0;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          eyebrow={year ? `${year.year}학년도` : undefined}
          title="전체 현황"
          description="전체 학생의 인증 현황과 검토 대기 자료를 한눈에 확인합니다."
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-navy/90 transition-colors"
          >
            <KeyRound size={13} /> 초대코드 발급
          </button>
          <button
            onClick={() => handleExport("csv")}
            disabled={exporting}
            className="inline-flex items-center gap-1 rounded-md border border-line bg-paper-raised px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper disabled:opacity-50"
          >
            <Download size={13} /> CSV
          </button>
          <button
            onClick={() => handleExport("xlsx")}
            disabled={exporting}
            className="inline-flex items-center gap-1 rounded-md border border-line bg-paper-raised px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper disabled:opacity-50"
          >
            <Download size={13} /> Excel
          </button>
          <button
            onClick={() => handleExport("pdf")}
            disabled={exporting}
            className="inline-flex items-center gap-1 rounded-md border border-line bg-paper-raised px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper disabled:opacity-50"
          >
            <Download size={13} /> PDF
          </button>
        </div>
      </div>

      {exportError && (
        <p role="alert" className="mb-4 rounded-md bg-alert-soft px-3 py-2 text-sm text-alert">
          {exportError}
        </p>
      )}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border border-line bg-paper-raised p-5">
          <p className="text-xs text-ink-soft">전체 학생 수</p>
          <p className="mt-1.5 font-display text-3xl font-semibold text-ink">{totalStudentCount}</p>
        </div>
        {STATUS_ORDER.map((st) => (
          <div key={st} className="rounded-lg border border-line bg-paper-raised p-5">
            <p className="text-xs text-ink-soft">{st}</p>
            <p className="mt-1.5 font-display text-3xl font-semibold text-navy">{getStatusValue(st)}</p>
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

      <AdminInvitationModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        defaultYear={year?.year}
      />
    </div>
  );
}
