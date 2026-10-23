"use client";

import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { SpecAdminPanel, TaskStatus, specButton, specInput, useApiTask } from "@/components/SpecAdminPanel";
import { ApiError, apiClient, apiErrorMessage, getApiToken, type BatchReport } from "@/lib/api-client";

const modes = {
  student: {
    label: "학생 명단",
    path: "/api/admin/students/batch",
    sampleName: "sample_students.csv",
    sampleContent: "학년,반,번호,이름,이메일\n1,1,1,홍길동,student1@bssm.hs.kr\n",
  },
  neis: {
    label: "NEIS 학생 명단",
    path: "/api/admin/students/batch/neis",
    sampleName: "sample_neis_students.csv",
    sampleContent: "학년,반,번호,성명,학교이메일\n1,1,1,홍길동,student1@bssm.hs.kr\n",
  },
  teacher: {
    label: "교원 명단",
    path: "/api/admin/teachers/batch",
    sampleName: "sample_teachers.csv",
    sampleContent: "이름,이메일,담당학년,담당반,담당영역\n김교사,teacher1@bssm.hs.kr,1,1,전공\n",
  },
};

export default function BatchPage() {
  const task = useApiTask<BatchReport>();
  const [mode, setMode] = useState<keyof typeof modes>("student");
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState("");
  const [fileKey, setFileKey] = useState(0);
  const [useAsync, setUseAsync] = useState(true);
  const [sseProgress, setSseProgress] = useState<{
    taskId: string;
    progress: number;
    processedCount: number;
    totalCount: number;
    status: string;
    errorCount: number;
  } | null>(null);
  const report = task.data;

  function downloadSample() {
    const item = modes[mode];
    const blob = new Blob(["\uFEFF" + item.sampleContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.sampleName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleAsyncUpload(uploadFile: File) {
    const body = new FormData();
    body.append("file", uploadFile);
    void task.run(async (signal) => {
      setSseProgress({
        taskId: "",
        progress: 0,
        processedCount: 0,
        totalCount: 0,
        status: "PROCESSING",
        errorCount: 0,
      });

      const res = await apiClient.request<{
        taskId: string;
        status: string;
        totalCount: number;
        progressUrl: string;
      }>("/api/admin/students/batch/async", { method: "POST", body, signal });

      const taskId = res?.taskId;
      if (!taskId) throw new ApiError("작업 ID를 수신하지 못했습니다.", 0, "INVALID_RESPONSE");

      const token = await getApiToken();
      const progressPath = res?.progressUrl || `/api/admin/batch/tasks/${encodeURIComponent(taskId)}/progress`;
      const sseUrl = token
        ? `${progressPath}${progressPath.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`
        : progressPath;

      return new Promise<BatchReport>((resolve, reject) => {
        let isClosed = false;
        let pollTimer: ReturnType<typeof setTimeout> | null = null;
        let pollCount = 0;
        const maxPolls = 180; // 최대 3분간 폴링 유지

        let es: EventSource | null = null;

        const closeStream = () => {
          if (!isClosed) {
            isClosed = true;
            if (pollTimer) {
              clearTimeout(pollTimer);
              pollTimer = null;
            }
            if (es) {
              es.close();
              es = null;
            }
          }
        };

        if (signal.aborted) {
          closeStream();
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        signal.addEventListener("abort", () => {
          closeStream();
          reject(new DOMException("Aborted", "AbortError"));
        });

        const pollProgress = async () => {
          if (isClosed) return;
          try {
            const fallbackTask = await apiClient.request<any>(
              `/api/admin/batch/tasks/${encodeURIComponent(taskId)}`,
              { signal }
            );
            if (fallbackTask && !isClosed) {
              setSseProgress({
                taskId: fallbackTask.taskId,
                progress: fallbackTask.progress ?? 0,
                processedCount: fallbackTask.processedCount ?? 0,
                totalCount: fallbackTask.totalCount ?? 0,
                status: fallbackTask.status,
                errorCount: fallbackTask.errorCount ?? 0,
              });

              if (fallbackTask.status === "COMPLETED") {
                closeStream();
                resolve({
                  total_count: fallbackTask.totalCount,
                  success_count: (fallbackTask.createdCount ?? 0) + (fallbackTask.updatedCount ?? 0),
                  failed_count: fallbackTask.errorCount ?? 0,
                  imported_count: fallbackTask.createdCount ?? 0,
                  taskId: fallbackTask.taskId,
                } as BatchReport & { taskId?: string });
                return;
              }
              if (fallbackTask.status === "FAILED") {
                closeStream();
                reject(new ApiError(fallbackTask.error || "배치 처리 중 오류가 발생했습니다.", 500, "BATCH_FAILED"));
                return;
              }
            }
          } catch {
            if (signal.aborted) return;
          }

          pollCount++;
          if (pollCount >= maxPolls) {
            closeStream();
            reject(new ApiError("배치 작업 완료 대기 시간이 초과되었습니다.", 0, "TIMEOUT"));
            return;
          }

          if (!isClosed) {
            pollTimer = setTimeout(pollProgress, 1000);
          }
        };

        try {
          es = new EventSource(sseUrl);
        } catch {
          void pollProgress();
          return;
        }

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.status === "NOT_FOUND") {
              closeStream();
              reject(new ApiError("배치 작업을 찾을 수 없습니다.", 404, "NOT_FOUND"));
              return;
            }
            setSseProgress({
              taskId: data.taskId,
              progress: data.progress ?? 0,
              processedCount: data.processedCount ?? 0,
              totalCount: data.totalCount ?? 0,
              status: data.status,
              errorCount: data.errorCount ?? 0,
            });

            if (data.status === "COMPLETED") {
              closeStream();
              resolve({
                total_count: data.totalCount,
                success_count: (data.createdCount ?? 0) + (data.updatedCount ?? 0),
                failed_count: data.errorCount ?? 0,
                imported_count: data.createdCount ?? 0,
                taskId: data.taskId,
              } as BatchReport & { taskId?: string });
            } else if (data.status === "FAILED") {
              closeStream();
              reject(new ApiError(data.error || "배치 처리 중 오류가 발생했습니다.", 500, "BATCH_FAILED"));
            }
          } catch {
            // Keep-alive or ignore
          }
        };

        es.onerror = () => {
          if (isClosed) return;
          if (es) {
            es.close();
            es = null;
          }
          void pollProgress();
        };
      });
    });
  }

  return <>
    <PageHeader eyebrow="관리자" title="명단 일괄 등록" description="학생, NEIS 학적 및 교원 명단을 서버에 일괄 등록합니다." />
    <SpecAdminPanel>
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        if (!file || task.loading) return;
        if (mode === "student" && useAsync) {
          handleAsyncUpload(file);
          return;
        }
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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="block space-y-2 text-sm flex-1 min-w-[200px]">등록 유형
            <select disabled={task.loading} className={specInput} value={mode} onChange={(event) => {
              setMode(event.target.value as keyof typeof modes); setFile(null); setValidation(""); setFileKey((value) => value + 1); task.reset(); setSseProgress(null);
            }}>{Object.entries(modes).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select>
          </label>
          {mode === "student" && (
            <label className="inline-flex items-center gap-2 text-sm text-ink-soft cursor-pointer pt-6">
              <input type="checkbox" checked={useAsync} onChange={(e) => setUseAsync(e.target.checked)} disabled={task.loading} className="rounded border-line" />
              <span>실시간 비동기 백그라운드 등록 (SSE 타임아웃 방어)</span>
            </label>
          )}
        </div>
        <label className="block space-y-2 text-sm">엑셀 또는 CSV 파일
          <input key={fileKey} type="file" accept=".xlsx,.csv" disabled={task.loading} className={specInput} onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            task.reset(); setValidation(""); setFile(null); setSseProgress(null);
            if (!selected) return;
            if (!/\.(xlsx|csv)$/i.test(selected.name) || selected.size === 0) {
              setValidation("내용이 있는 .xlsx 또는 .csv 파일을 선택해 주세요."); return;
            }
            setFile(selected);
          }} />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-soft">학생 명단의 학번과 이름 등 필수 컬럼을 확인해 주세요. NEIS는 학교에서 제공한 표준 양식을 사용하세요.</p>
          <button
            type="button"
            onClick={downloadSample}
            className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-brass hover:bg-brass-soft/40"
          >
            {modes[mode].label} 샘플 양식(CSV) 다운로드
          </button>
        </div>
        {validation && <p role="alert" className="text-sm text-alert">{validation}</p>}

        {/* 비동기 실시간 SSE Progress Bar */}
        {task.loading && sseProgress && (
          <div className="space-y-2 rounded-lg border border-line bg-paper/60 p-4">
            <div className="flex items-center justify-between text-xs font-medium text-ink-soft">
              <span>대량 등록 진행률: {sseProgress.progress}%</span>
              <span>{sseProgress.processedCount} / {sseProgress.totalCount}건 처리 중</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-paper border border-line">
              <div
                className="h-full bg-brass transition-all duration-300 ease-out"
                style={{ width: `${sseProgress.progress}%` }}
              />
            </div>
            <p className="text-xs text-ink-soft">대량 명단을 원자적 트랜잭션으로 분할 검증 및 적재하고 있습니다. 페이지를 벗어나지 마세요.</p>
          </div>
        )}

        <button className={specButton} disabled={!file || task.loading} aria-busy={task.loading}>
          {task.loading ? (sseProgress ? `등록 중 (${sseProgress.progress}%)` : "업로드 중...") : "명단 등록"}
        </button>
      </form>
      <TaskStatus {...task} />
      {task.error && <p className="text-xs text-ink-soft">네트워크 오류가 나도 서버에서 등록됐을 수 있습니다. 재시도 전에 등록 내역을 확인하세요.</p>}
    </SpecAdminPanel>
    {report && <SpecAdminPanel>
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold">등록 결과 · {modes[mode].label}</h2>
        {(report as any).taskId && (
          <button
            type="button"
            onClick={async () => {
              const taskId = (report as any).taskId;
              try {
                const blob = await apiClient.blob(`/api/admin/batch/tasks/${encodeURIComponent(taskId)}/report/download`);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `batch_error_report_${taskId}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch {
                const token = await getApiToken();
                const path = `/api/admin/batch/tasks/${encodeURIComponent(taskId)}/report/download`;
                window.open(token ? `${path}?token=${encodeURIComponent(token)}` : path, "_blank");
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-alert/30 bg-alert-soft/20 px-3 py-1.5 text-xs font-medium text-alert hover:bg-alert-soft/40 cursor-pointer"
          >
            실패 행 상세 리포트 (CSV) 다운로드
          </button>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {([["전체", report.total_count ?? report.totalProcessed], ["성공", report.success_count ?? report.successCount], ["실패", report.failed_count ?? (report as any).failedCount], ["등록 학생", report.imported_count ?? (report as any).createdStudentsCount], ["등록 교원", report.total_teachers ?? (report as any).createdTeachersCount]] as const).map(([label, count]) => count !== undefined && <div key={label}><dt className="text-sm text-ink-soft">{label}</dt><dd className="text-xl font-semibold">{count}</dd></div>)}
      </dl>
      {report.class_mappings !== undefined && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold">학급 매핑</h3>
          <div className="rounded-md border border-line bg-paper p-3 text-xs text-ink-soft">
            {typeof report.class_mappings === "object" && report.class_mappings !== null
              ? Object.entries(report.class_mappings as Record<string, any>).map(([k, v]) => (
                  <p key={k}>{k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}</p>
                ))
              : String(report.class_mappings)}
          </div>
        </div>
      )}
      {report.assigned_classes !== undefined && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold">담당 학급 배정</h3>
          <div className="rounded-md border border-line bg-paper p-3 text-xs text-ink-soft">
            {Array.isArray(report.assigned_classes)
              ? report.assigned_classes.join(", ")
              : typeof report.assigned_classes === "object" && report.assigned_classes !== null
                ? Object.entries(report.assigned_classes as Record<string, any>).map(([k, v]) => (
                    <p key={k}>{k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}</p>
                  ))
                : String(report.assigned_classes)}
          </div>
        </div>
      )}
      {!!report.errors?.length && <div className="overflow-x-auto"><table className="ledger-table text-sm"><caption className="text-left font-semibold">행별 오류 리포트</caption><thead><tr><th scope="col">행 번호</th><th scope="col">실패 사유</th></tr></thead><tbody>{report.errors.map((error, index) => <tr key={index}><td>{error.row}</td><td className="whitespace-pre-wrap break-words text-alert">{apiErrorMessage(error.reason)}</td></tr>)}</tbody></table></div>}
      {!report.errors?.length && <p className="text-sm text-ink-soft">서버가 반환한 행별 오류가 없습니다.</p>}
    </SpecAdminPanel>}
  </>;
}
