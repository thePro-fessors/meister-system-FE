"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { ApiAvailability, SpecAdminLinks, SpecAdminPanel, TaskStatus, specButton, specInput, useApiAvailability, useApiTask } from "@/components/SpecAdminPanel";
import { ApiError, apiClient, type AnomalyReport, type AuditLogs, type RecalculationReport } from "@/lib/api-client";

const emptyFilters = { action: "", user_id: "", start_date: "", end_date: "" };

const ACTION_LABELS: Record<string, string> = {
  SUBMIT: "증빙 제출",
  APPROVE: "심사 승인",
  REJECT: "심사 반려",
  REQUEST_RESUBMIT: "재제출 요청",
  SCORE_MODIFY: "점수 수정",
  RESUBMIT: "증빙 재제출",
  DELETE: "삭제",
  POINT_ADD: "상벌점 등록",
  POINT_MODIFY: "상벌점 수정",
  POINT_DELETE: "상벌점 삭제",
  RECALCULATE: "전체 점수 재계산",
};

function formatActor(log: any): string {
  const mod = log.modifier;
  if (mod?.name && mod?.id) return `${mod.name} (${mod.id})`;
  if (mod?.name) return mod.name;
  const uid = String(log.user_id || mod?.uuid || "시스템");
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(uid)) {
    return `계정 (${uid.slice(0, 8)}…)`;
  }
  return uid;
}

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
  const [confirmRecalculate, setConfirmRecalculate] = useState(false);
  const { run, reset } = logs;
  useEffect(() => {
    if (!availability.available) { reset(); return; }
    void run(async (signal) => {
      const result = await apiClient.request<AuditLogs>("/api/admin/audit-logs", { query: { ...filters, page, limit }, signal });
      const total = result?.pagination?.totalCount ?? result?.total;
      if (!result || !Array.isArray(result.logs) || typeof total !== "number" || total < 0) throw new ApiError("감사 로그 응답 형식이 올바르지 않습니다.", 0, "INVALID_RESPONSE");
      return { ...result, total, logs: result.logs };
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
        <label className="space-y-1 text-sm">행위자 계정 ID<input className={specInput} value={draft.user_id} onChange={(event) => setDraft({ ...draft, user_id: event.target.value })} placeholder="아이디 또는 이름" /></label>
        <label className="space-y-1 text-sm">액션
          <select className={specInput} value={draft.action} onChange={(event) => setDraft({ ...draft, action: event.target.value })}>
            <option value="">전체 액션</option>
            {Object.entries(ACTION_LABELS).map(([code, label]) => (
              <option key={code} value={code}>{label} ({code})</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">시작일<input className={specInput} type="date" value={draft.start_date} onChange={(event) => setDraft({ ...draft, start_date: event.target.value })} /></label>
        <label className="space-y-1 text-sm">종료일<input className={specInput} type="date" min={draft.start_date || undefined} value={draft.end_date} onChange={(event) => setDraft({ ...draft, end_date: event.target.value })} /></label>
        <label className="space-y-1 text-sm">페이지당 항목<select className={specInput} value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}>{[10, 20, 50].map((size) => <option key={size}>{size}</option>)}</select></label>
        <div className="flex items-end"><button className={specButton} disabled={!availability.available}>조회 / 새로고침</button></div>
      </form>
      {validation && <p role="alert" className="text-sm text-alert">{validation}</p>}
      <TaskStatus {...logs} />
      {logs.data && <>
        <p className="text-sm text-ink-soft">전체 {logs.data.total ?? logs.data.pagination?.totalCount}건 · {page}페이지</p>
        {logs.data.logs.length === 0 ? <p className="text-sm">조회된 감사 로그가 없습니다.</p> : <ol className="divide-y divide-line">
          {[...logs.data.logs].sort((a, b) => Date.parse((b.created_at || b.createdAt) || "") - Date.parse((a.created_at || a.createdAt) || "")).map((log) => {
            const rawAction = String(log.action || log.actionType || "");
            const actionLabel = ACTION_LABELS[rawAction] ? `${ACTION_LABELS[rawAction]} (${rawAction})` : rawAction;
            const detailVal = log.details ?? (log as any).changes ?? (log as any).reason;
            return (
              <li key={log.log_id || log.logId || log.id} className="space-y-2 py-4">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <strong>{actionLabel} · {formatActor(log)}</strong>
                  <time dateTime={log.created_at || log.createdAt} className="text-ink-soft">{String(log.created_at || log.createdAt || "").replace("T", " ").slice(0, 19)}</time>
                </div>
                <p className="text-xs text-ink-soft">로그 #{log.log_id || log.logId || log.id} · IP {log.ip_address || log.ipAddress || "미기록"}</p>
                {detailVal !== undefined && detailVal !== null && (
                  <div className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-paper p-3 text-xs text-ink">
                    {typeof detailVal === "string" ? detailVal : JSON.stringify(detailVal, null, 2)}
                  </div>
                )}
              </li>
            );
          })}
        </ol>}
      </>}
      <div className="flex items-center gap-3">
        <button className={specButton} disabled={!availability.available || logs.loading || page === 1} onClick={() => setPage((value) => value - 1)}>이전</button>
        <span className="text-sm">{page}페이지</span>
        <button className={specButton} disabled={!availability.available || logs.loading || !logs.data || page * limit >= (logs.data.total ?? logs.data.pagination?.totalCount ?? 0)} onClick={() => setPage((value) => value + 1)}>다음</button>
      </div>
    </SpecAdminPanel>
    <SpecAdminPanel>
      <h2 className="font-display font-semibold">데이터 점검</h2>
      <label className="block space-y-1 text-sm">대상 학년도 (미입력 시 서버 기본값)
        <input className={specInput} inputMode="numeric" maxLength={4} placeholder="예: 2026" disabled={maintenanceBusy} value={year} onChange={(event) => { setYear(event.target.value); anomalies.reset(); recalculate.reset(); setConfirmRecalculate(false); }} />
      </label>
      {!yearValid && <p role="alert" className="text-sm text-alert">1900~9999 사이의 4자리 학년도를 입력해 주세요.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button className={specButton} disabled={!availability.available || maintenanceBusy || !yearValid} onClick={() => {
          void anomalies.run(async (signal) => {
            const result = await apiClient.request<AnomalyReport>("/api/ai/admin/audit-anomalies", { method: "POST", body, signal });
            if (!result || !Array.isArray(result.high_risk_submissions) || typeof result.anomaly_count !== "number") throw new ApiError("이상탐지 응답 형식이 올바르지 않습니다.");
            return result;
          });
        }}>부정 의심 제출 AI 탐지</button>
        {!confirmRecalculate ? (
          <button
            className={specButton}
            disabled={!availability.available || maintenanceBusy || !yearValid}
            onClick={() => setConfirmRecalculate(true)}
          >
            전체 데이터 재계산
          </button>
        ) : (
          <div className="inline-flex items-center gap-2">
            <button
              className="rounded-md bg-alert px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              disabled={!availability.available || maintenanceBusy || !yearValid}
              onClick={() => {
                setConfirmRecalculate(false);
                void recalculate.run(async (signal) => {
                  const result = await apiClient.request<RecalculationReport>("/api/admin/recalculate", { method: "POST", body, signal });
                  const processed = result?.totalProcessedStudents ?? result?.processed_students;
                  if (!result || typeof processed !== "number" || !Number.isFinite(processed)) {
                    throw new ApiError("재계산 결과 형식이 올바르지 않습니다. 서버 처리 상태를 확인하세요.", 0, "INVALID_RESPONSE");
                  }
                  return {
                    ...result,
                    processed_students: processed,
                    recalculated_scores: result.recalculated_scores ?? (result as any).anomaliesFixedCount ?? processed,
                    duration_ms: result.duration_ms ?? 0,
                  };
                });
              }}
            >
              재계산 실행 확인
            </button>
            <button
              type="button"
              onClick={() => setConfirmRecalculate(false)}
              className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink-soft hover:bg-paper"
            >
              취소
            </button>
          </div>
        )}
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
      {recalculate.data && <p role="status" className="rounded-md bg-certified-soft p-3 text-sm text-certified">재계산 완료: 학생 {recalculate.data.processed_students ?? recalculate.data.totalProcessedStudents}명{recalculate.data.recalculated_scores !== undefined ? `, 점수 ${recalculate.data.recalculated_scores}건` : ""}{recalculate.data.duration_ms ? `, ${recalculate.data.duration_ms}ms` : ""}</p>}
    </SpecAdminPanel>
  </>;
}
