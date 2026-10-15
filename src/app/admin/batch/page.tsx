"use client";

import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { ApiAvailability, SpecAdminLinks, SpecAdminPanel, TaskStatus, specButton, specInput, useApiAvailability, useApiTask } from "@/components/SpecAdminPanel";
import { ApiError, apiClient, apiErrorMessage, type BatchReport } from "@/lib/api-client";

const modes = {
  student: { label: "학생 명단", path: "/api/admin/students/batch" },
  neis: { label: "NEIS 학생 명단", path: "/api/admin/students/batch/neis" },
  teacher: { label: "교원 명단", path: "/api/admin/teachers/batch" },
};

export default function BatchPage() {
  const availability = useApiAvailability();
  const task = useApiTask<BatchReport>();
  const [mode, setMode] = useState<keyof typeof modes>("student");
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState("");
  const [fileKey, setFileKey] = useState(0);
  const report = task.data;
  return <>
    <PageHeader eyebrow="관리자" title="명단 일괄 등록" description="학생, NEIS 학적 및 교원 명단을 서버에 일괄 등록합니다." />
    <SpecAdminLinks /><ApiAvailability state={availability} />
    <SpecAdminPanel>
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        if (!availability.available || !file || task.loading) return;
        const body = new FormData(); body.append("file", file);
        void task.run(async (signal) => {
          const result = await apiClient.request<BatchReport>(modes[mode].path, { method: "POST", body, signal });
          const total = result?.total_count ?? result?.totalProcessed;
          const success = result?.success_count ?? result?.successCount;
          const hasCount = [total, success, result?.imported_count, result?.total_teachers].some((count) => typeof count === "number");
          if (!result || typeof result !== "object" || !hasCount ||
            (result.errors !== undefined && (!Array.isArray(result.errors) || result.errors.some((error) => !error || typeof error !== "object")))) {
            throw new ApiError("등록 결과 형식이 올바르지 않습니다. 재시도 전에 서버 등록 내역을 확인하세요.", 0, "INVALID_RESPONSE");
          }
          return {
            ...result,
            total_count: total,
            success_count: success,
            failed_count: result.failed_count ?? result.failureCount ?? (result as any).failedCount,
          };
        });
      }}>
        <label className="block space-y-2 text-sm">등록 유형
          <select disabled={task.loading} className={specInput} value={mode} onChange={(event) => {
            setMode(event.target.value as keyof typeof modes); setFile(null); setValidation(""); setFileKey((value) => value + 1); task.reset();
          }}>{Object.entries(modes).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select>
        </label>
        <label className="block space-y-2 text-sm">엑셀 또는 CSV 파일
          <input key={fileKey} type="file" accept=".xlsx,.csv" disabled={task.loading} className={specInput} onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            task.reset(); setValidation(""); setFile(null);
            if (!selected) return;
            if (!/\.(xlsx|csv)$/i.test(selected.name) || selected.size === 0) {
              setValidation("내용이 있는 .xlsx 또는 .csv 파일을 선택해 주세요."); return;
            }
            setFile(selected);
          }} />
        </label>
        <p className="text-sm text-ink-soft">학생 명단의 학번과 이름 등 필수 컬럼을 확인해 주세요. NEIS는 학교에서 제공한 표준 양식을 사용하세요.</p>
        <p className="text-xs text-ink-soft">공식 샘플 서식 URL은 명세에 제공되지 않았습니다. 임의 서식 대신 관리자에게 최신 서식을 요청해 주세요.</p>
        <p className="break-all text-xs text-ink-soft">POST {modes[mode].path} · multipart/form-data · file</p>
        {validation && <p role="alert" className="text-sm text-alert">{validation}</p>}
        <button className={specButton} disabled={!availability.available || !file || task.loading} aria-busy={task.loading}>{task.loading ? "업로드 중..." : "명단 등록"}</button>
      </form>
      <TaskStatus {...task} />
      {task.error && <p className="text-xs text-ink-soft">네트워크 오류가 나도 서버에서 등록됐을 수 있습니다. 재시도 전에 등록 내역을 확인하세요.</p>}
    </SpecAdminPanel>
    {report && <SpecAdminPanel>
      <h2 className="font-display font-semibold">등록 결과 · {modes[mode].label}</h2>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {([["전체", report.total_count ?? report.totalProcessed], ["성공", report.success_count ?? report.successCount], ["실패", report.failed_count ?? (report as any).failedCount], ["등록 학생", report.imported_count ?? (report as any).createdStudentsCount], ["등록 교원", report.total_teachers ?? (report as any).createdTeachersCount]] as const).map(([label, count]) => count !== undefined && <div key={label}><dt className="text-sm text-ink-soft">{label}</dt><dd className="text-xl font-semibold">{count}</dd></div>)}
      </dl>
      {report.class_mappings !== undefined && <div><h3 className="text-sm font-semibold">학급 매핑</h3><pre className="overflow-auto whitespace-pre-wrap break-all text-sm">{JSON.stringify(report.class_mappings, null, 2)}</pre></div>}
      {report.assigned_classes !== undefined && <div><h3 className="text-sm font-semibold">담당 학급 배정</h3><pre className="overflow-auto whitespace-pre-wrap break-all text-sm">{JSON.stringify(report.assigned_classes, null, 2)}</pre></div>}
      {!!report.errors?.length && <div className="overflow-x-auto"><table className="ledger-table text-sm"><caption className="text-left font-semibold">행별 오류 리포트</caption><thead><tr><th scope="col">행 번호</th><th scope="col">실패 사유</th></tr></thead><tbody>{report.errors.map((error, index) => <tr key={index}><td>{error.row}</td><td className="whitespace-pre-wrap break-words text-alert">{apiErrorMessage(error.reason)}</td></tr>)}</tbody></table></div>}
      {!report.errors?.length && <p className="text-sm text-ink-soft">서버가 반환한 행별 오류가 없습니다.</p>}
    </SpecAdminPanel>}
  </>;
}
