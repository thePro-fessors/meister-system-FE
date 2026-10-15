"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { ApiAvailability, SpecAdminLinks, SpecAdminPanel, TaskStatus, specButton, specInput, useApiAvailability, useApiTask } from "@/components/SpecAdminPanel";
import { ApiError, apiClient, type AnomalyReport, type AuditLogs, type RecalculationReport } from "@/lib/api-client";

const emptyFilters = { action: "", user_id: "", start_date: "", end_date: "" };

export default function AuditPage() {
  const availability = useApiAvailability();
  const logs = useApiTask<AuditLogs>();
  const anomalies = useApiTask<AnomalyReport>();
  const recalculate = useApiTask<RecalculationReport>();
  const [draft, setDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [revision, setRevision] = useState(0);
  const [year, setYear] = useState("");
  const [validation, setValidation] = useState("");
  const { run, reset } = logs;
  useEffect(() => {
    if (!availability.available) { reset(); return; }
    void run(async (signal) => {
      const result = await apiClient.request<AuditLogs>("/api/admin/audit-logs", { query: { ...filters, page, limit }, signal });
      if (!result || !Array.isArray(result.logs) || !Number.isInteger(result.total) || result.total < 0) throw new ApiError("감사 로그 응답 형식이 올바르지 않습니다.", 0, "INVALID_RESPONSE");
      return result;
    }, true);
    return reset;
  }, [availability.available, filters, page, limit, revision, run, reset]);

  const yearValid = year === "" || /^\d{4}$/.test(year) && Number(year) >= 1900 && Number(year) <= 9999;
  const body = year ? { year: Number(year) } : {};
  const maintenanceBusy = anomalies.loading || recalculate.loading;
  return <>
    <PageHeader eyebrow="관리자" title="감사로그 및 이상탐지" description="시스템 변경 이력을 조회하고, 의심 제출을 점검하며 인증 데이터를 재계산합니다." />
    <SpecAdminLinks /><ApiAvailability state={availability} />
    <SpecAdminPanel>
      <h2 className="font-display font-semibold">감사 로그</h2>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => {
        event.preventDefault();
        if (draft.start_date && draft.end_date && draft.start_date > draft.end_date) { setValidation("종료일은 시작일 이후여야 합니다."); return; }
        setValidation(""); setFilters({ ...draft, action: draft.action.trim(), user_id: draft.user_id.trim() }); setPage(1); setRevision((value) => value + 1);
      }}>
        <label className="space-y-1 text-sm">행위자 계정 ID<input className={specInput} value={draft.user_id} onChange={(event) => setDraft({ ...draft, user_id: event.target.value })} /></label>
        <label className="space-y-1 text-sm">액션<input className={specInput} value={draft.action} onChange={(event) => setDraft({ ...draft, action: event.target.value })} placeholder="전체 액션" /></label>
        <label className="space-y-1 text-sm">시작일<input className={specInput} type="date" value={draft.start_date} onChange={(event) => setDraft({ ...draft, start_date: event.target.value })} /></label>
        <label className="space-y-1 text-sm">종료일<input className={specInput} type="date" min={draft.start_date || undefined} value={draft.end_date} onChange={(event) => setDraft({ ...draft, end_date: event.target.value })} /></label>
        <label className="space-y-1 text-sm">페이지당 항목<select className={specInput} value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}>{[10, 20, 50].map((size) => <option key={size}>{size}</option>)}</select></label>
        <div className="flex items-end"><button className={specButton} disabled={!availability.available}>조회 / 새로고침</button></div>
      </form>
      {validation && <p role="alert" className="text-sm text-alert">{validation}</p>}
      <TaskStatus {...logs} />
      {logs.data && <>
        <p className="text-sm text-ink-soft">전체 {logs.data.total}건 · {page}페이지</p>
        {logs.data.logs.length === 0 ? <p className="text-sm">조회된 감사 로그가 없습니다.</p> : <ol className="divide-y divide-line">
          {[...logs.data.logs].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).map((log) => <li key={log.log_id} className="space-y-2 py-4">
            <div className="flex flex-wrap justify-between gap-2 text-sm"><strong>{log.action} · {log.user_id}</strong><time dateTime={log.created_at}>{log.created_at}</time></div>
            <p className="text-xs text-ink-soft">로그 #{log.log_id} · IP {log.ip_address || "미기록"}</p>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-paper p-3 text-xs">{typeof log.details === "string" ? log.details : JSON.stringify(log.details, null, 2)}</pre>
          </li>)}
        </ol>}
      </>}
      <div className="flex items-center gap-3">
        <button className={specButton} disabled={!availability.available || logs.loading || page === 1} onClick={() => setPage((value) => value - 1)}>이전</button>
        <span className="text-sm">{page}페이지</span>
        <button className={specButton} disabled={!availability.available || logs.loading || !logs.data || page * limit >= logs.data.total} onClick={() => setPage((value) => value + 1)}>다음</button>
      </div>
    </SpecAdminPanel>
    <SpecAdminPanel>
      <h2 className="font-display font-semibold">데이터 점검</h2>
      <label className="block space-y-1 text-sm">대상 학년도 (미입력 시 서버 기본값)
        <input className={specInput} inputMode="numeric" maxLength={4} placeholder="예: 2026" disabled={maintenanceBusy} value={year} onChange={(event) => { setYear(event.target.value); anomalies.reset(); recalculate.reset(); }} />
      </label>
      {!yearValid && <p role="alert" className="text-sm text-alert">1900~9999 사이의 4자리 학년도를 입력해 주세요.</p>}
      <div className="flex flex-wrap gap-3">
        <button className={specButton} disabled={!availability.available || maintenanceBusy || !yearValid} onClick={() => {
          void anomalies.run(async (signal) => {
            const result = await apiClient.request<AnomalyReport>("/api/ai/admin/audit-anomalies", { method: "POST", body, signal });
            if (!result || !Array.isArray(result.high_risk_submissions) || typeof result.anomaly_count !== "number") throw new ApiError("이상탐지 응답 형식이 올바르지 않습니다.");
            return result;
          });
        }}>부정 의심 제출 AI 탐지</button>
        <button className={specButton} disabled={!availability.available || maintenanceBusy || !yearValid} onClick={() => {
          if (!window.confirm(`${year || "서버 기본 학년도"} 학생들의 점수와 인증 판정을 전체 재계산합니다. 계속하시겠습니까?`)) return;
          void recalculate.run(async (signal) => {
            const result = await apiClient.request<RecalculationReport>("/api/admin/recalculate", { method: "POST", body, signal });
            if (!result || ![result.processed_students, result.recalculated_scores, result.duration_ms].every((value) => typeof value === "number" && Number.isFinite(value))) {
              throw new ApiError("재계산 결과 형식이 올바르지 않습니다. 서버 처리 상태를 확인하세요.", 0, "INVALID_RESPONSE");
            }
            return result;
          });
        }}>전체 데이터 재계산</button>
      </div>
      <p className="text-xs text-ink-soft">AI 결과는 의심 징후이며 부정행위 확정이 아닙니다. 담당자가 증빙을 확인해 주세요. 재계산 중 연결이 끊어지면 재시도 전에 서버 처리 상태를 확인하세요.</p>
      <TaskStatus {...anomalies} /><TaskStatus {...recalculate} />
      {anomalies.data && <div className="space-y-3">
        <h3 className="font-semibold">이상 징후 {anomalies.data.anomaly_count}건</h3>
        {anomalies.data.high_risk_submissions.length === 0 && <p className="text-sm">의심 제출이 없습니다.</p>}
        {anomalies.data.high_risk_submissions.map((item) => <article key={item.submission_id} className={`rounded-md border p-3 text-sm ${item.risk_score >= 80 ? "border-alert bg-alert-soft text-alert" : "border-line"}`}>
          <h4 className="font-semibold">{item.student_name} · 제출 #{item.submission_id} · 위험 점수 {item.risk_score}{item.risk_score >= 80 && " · 고위험"}</h4><p>{item.reason}</p>
        </article>)}
      </div>}
      {recalculate.data && <p role="status" className="rounded-md bg-certified-soft p-3 text-sm text-certified">재계산 완료: 학생 {recalculate.data.processed_students}명, 점수 {recalculate.data.recalculated_scores}건, {recalculate.data.duration_ms}ms</p>}
    </SpecAdminPanel>
  </>;
}
