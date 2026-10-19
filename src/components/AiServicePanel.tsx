"use client";

import { useState } from "react";
import { Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";

export function AiServicePanel({
  title,
  endpoint,
  description,
  action,
  presets,
  emptyMessage,
}: {
  title: string;
  endpoint: string;
  description: string;
  action: string;
  presets?: string[];
  emptyMessage?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [promptInput, setPromptInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);

  async function execute(overridePrompt?: string) {
    setLoading(true);
    setError(null);
    const activePrompt = overridePrompt !== undefined ? overridePrompt : promptInput;
    if (overridePrompt !== undefined) setPromptInput(overridePrompt);
    try {
      let body: any = {};
      if (endpoint.includes("summary-report")) {
        body = { year: 2026, grade: 1 };
      } else if (endpoint.includes("teacher/chat")) {
        body = {
          message: activePrompt.trim() || "우리 반 역량인증 취약 영역 분석 및 지도방안 제안",
          conversationId,
        };
      } else if (endpoint.includes("audit-anomalies")) {
        body = { year: 2026, threshold: 0.7, limit: 50 };
      }

      const res = await apiClient.request<any>(endpoint, {
        method: "POST",
        body,
      });

      if (res?.conversationId) setConversationId(res.conversationId);
      setResult(res);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="my-5 space-y-4 rounded-lg border border-line bg-paper-raised p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-brass" />
          <h2 className="font-display font-semibold text-ink">{title}</h2>
        </div>
        <span className="flex items-center gap-1 rounded bg-certified-soft px-2 py-0.5 text-xs font-medium text-certified">
          <CheckCircle2 size={12} /> AI 실시간 연동
        </span>
      </div>

      <p className="text-sm text-ink-soft">{description}</p>

      {endpoint.includes("teacher/chat") && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-ink">상담 질문 입력</label>
          <input
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder="예: 외국어 역량 미달성 학생 명단과 추천 지도방안 알려줘"
            className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brass focus:ring-1 focus:ring-brass"
          />
          {presets && presets.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1" aria-label="추천 질문">
              {presets.map((text) => (
                <button
                  key={text}
                  type="button"
                  disabled={loading}
                  onClick={() => void execute(text)}
                  className="rounded-full border border-brass/40 bg-brass-soft/40 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-brass-soft disabled:opacity-50"
                >
                  {text}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => void execute()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-ink disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              AI 분석 실행 중...
            </>
          ) : (
            action
          )}
        </button>
      </div>

      {!result && !loading && !error && emptyMessage && (
        <p className="text-xs text-ink-soft">{emptyMessage}</p>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-alert-soft p-3 text-sm text-alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-lg border border-brass/30 bg-brass-soft/20 p-4 text-sm text-ink">
          <p className="font-semibold text-brass">AI 분석 결과</p>
          
          {/* Summary Report View */}
          {result.summaryReport && (
            <div className="mt-2 whitespace-pre-wrap rounded-md bg-paper-raised p-3 text-xs leading-relaxed text-ink">
              {result.summaryReport}
            </div>
          )}

          {/* Key insights */}
          {result.keyInsights && Array.isArray(result.keyInsights) && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-ink">주요 인사이트</p>
              <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-ink-soft">
                {result.keyInsights.map((insight: string, idx: number) => (
                  <li key={idx}>{insight}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Teacher chat reply */}
          {result.reply && (
            <div className="mt-2 rounded-md bg-paper-raised p-3 text-xs leading-relaxed text-ink">
              {result.reply}
            </div>
          )}

          {/* Suggestions */}
          {result.suggestions && Array.isArray(result.suggestions) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {result.suggestions.map((sug: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => {
                    setPromptInput(sug);
                  }}
                  className="rounded-full border border-line bg-paper-raised px-2.5 py-1 text-xs text-ink-soft hover:text-ink"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          {/* Audit anomalies view */}
          {result.anomalies && (
            <div className="mt-2 space-y-2">
              <p className="text-xs font-medium">검출된 이상치: {result.totalAnomalies ?? result.anomalies.length}건 (위험도: {result.riskLevel || "보통"})</p>
              {result.auditAnalysis && (
                <p className="text-xs text-ink-soft">{result.auditAnalysis}</p>
              )}
              {Array.isArray(result.anomalies) && result.anomalies.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="ledger-table text-xs">
                    <thead>
                      <tr>
                        <th>유형</th>
                        <th>제출물 ID</th>
                        <th>위험도</th>
                        <th>의심 사유</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.anomalies.map((anom: any, idx: number) => (
                        <tr key={idx}>
                          <td>{anom.type || "중복의심"}</td>
                          <td>{anom.submissionId || "-"}</td>
                          <td className="text-alert">{Math.round((anom.riskScore || 0) * 100)}%</td>
                          <td className="text-ink-soft">{anom.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
