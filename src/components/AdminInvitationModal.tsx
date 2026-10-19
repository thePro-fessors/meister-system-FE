"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, Copy, KeyRound, RefreshCw, Trash2, X } from "lucide-react";
import { apiClient, apiErrorMessage } from "@/lib/api-client";

export interface InvitationItem {
  code: string;
  role: "student" | "teacher" | "admin";
  role_prefix?: string;
  target_role?: number;
  year: number;
  max_uses: number;
  remaining_uses: number;
  created_at: string;
  expires_at: string;
  created_by?: string;
}

interface AdminInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultYear?: number;
}

const ROLE_OPTIONS = [
  { value: "teacher", label: "교사 (TCH)" },
  { value: "admin", label: "관리자 (ADM)" },
  { value: "student", label: "학생 (STU)" },
] as const;

export function AdminInvitationModal({ isOpen, onClose, defaultYear = 2026 }: AdminInvitationModalProps) {
  const [role, setRole] = useState<"teacher" | "admin" | "student">("teacher");
  const [validDays, setValidDays] = useState<number>(1);
  const [maxUses, setMaxUses] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [createdItem, setCreatedItem] = useState<InvitationItem | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeList, setActiveList] = useState<InvitationItem[]>([]);
  const [listLoading, setListLoading] = useState<boolean>(false);

  const fetchInvitations = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await apiClient.request<{ invitations: InvitationItem[]; total: number }>("/api/admin/invitations");
      if (res?.invitations) {
        setActiveList(res.invitations);
      }
    } catch {
      // 목록 조회 실패 시 무시
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setCreatedItem(null);
      setCopiedCode(null);
      void fetchInvitations();
    }
  }, [isOpen, fetchInvitations]);

  if (!isOpen) return null;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCreatedItem(null);
    try {
      const res = await apiClient.request<InvitationItem>("/api/admin/invitations", {
        method: "POST",
        body: {
          role,
          validDays: Number(validDays) || 1,
          maxUses: Number(maxUses) || 1,
          year: defaultYear,
        },
      });
      setCreatedItem(res);
      await fetchInvitations();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // 복사 실패 처리
    }
  }

  async function handleRevoke(code: string) {
    if (!window.confirm(`초대코드 [${code}]를 즉시 파기하시겠습니까?`)) return;
    try {
      await apiClient.request(`/api/admin/invitations/${encodeURIComponent(code)}`, {
        method: "DELETE",
      });
      if (createdItem?.code === code) {
        setCreatedItem(null);
      }
      await fetchInvitations();
    } catch (err) {
      alert("코드 취소 실패: " + apiErrorMessage(err));
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-line bg-paper-raised p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-white">
              <KeyRound size={16} />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold text-ink">관리자 초대코드 발급</h2>
              <p className="text-xs text-ink-soft">신규 가입용 난수 초대코드를 발급하고 관리합니다.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-soft hover:bg-paper hover:text-ink"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto py-4 space-y-5 flex-1 pr-1">
          {error && (
            <p role="alert" className="rounded-md bg-alert-soft p-3 text-xs text-alert font-medium">
              {error}
            </p>
          )}

          {createdItem && (
            <div className="rounded-lg border border-certified bg-certified-soft p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-certified">초대코드가 정상 발급되었습니다</p>
                  <p className="mt-1 font-mono text-lg font-bold tracking-wider text-ink">{createdItem.code}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(createdItem.code)}
                  className="inline-flex items-center gap-1 rounded-md bg-white border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper"
                >
                  {copiedCode === createdItem.code ? (
                    <>
                      <Check size={14} className="text-certified" /> 복사됨
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> 복사
                    </>
                  )}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-ink-soft">
                역할: <span className="font-medium text-ink">{createdItem.role}</span> · 유효기간:{" "}
                <span className="font-medium text-ink">{new Date(createdItem.expires_at).toLocaleString("ko-KR")}</span>{" "}
                · 사용 가능 횟수: <span className="font-medium text-ink">{createdItem.remaining_uses}회</span>
              </p>
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-4 rounded-lg border border-line bg-paper/50 p-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink">가입 대상 역할</label>
              <div className="grid grid-cols-3 gap-2">
                {ROLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    className={`rounded-md border py-2 text-xs font-medium transition-colors ${
                      role === opt.value
                        ? "border-navy bg-navy text-white shadow-xs"
                        : "border-line bg-paper-raised text-ink hover:bg-paper"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink">유효기간 (일)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={validDays}
                  onChange={(e) => setValidDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full rounded-md border border-line bg-paper-raised px-3 py-2 text-xs text-ink focus:border-navy focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink">사용 가능 횟수 (회)</label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={maxUses}
                  onChange={(e) => setMaxUses(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full rounded-md border border-line bg-paper-raised px-3 py-2 text-xs text-ink focus:border-navy focus:outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-navy py-2 text-xs font-semibold text-white hover:bg-navy/90 disabled:opacity-50"
            >
              {loading ? "코드 생성 중..." : "새 초대코드 생성"}
            </button>
          </form>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-ink">현재 활성 초대코드 ({activeList.length}건)</span>
              <button
                type="button"
                onClick={fetchInvitations}
                disabled={listLoading}
                className="inline-flex items-center gap-1 text-[11px] text-ink-soft hover:text-ink disabled:opacity-50"
              >
                <RefreshCw size={11} className={listLoading ? "animate-spin" : ""} /> 새로고침
              </button>
            </div>

            {activeList.length === 0 ? (
              <p className="py-4 text-center text-xs text-ink-soft border border-dashed border-line rounded-lg">
                현재 활성화된 초대코드가 없습니다.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
                {activeList.map((item) => (
                  <div
                    key={item.code}
                    className="flex items-center justify-between rounded-lg border border-line bg-paper-raised p-2.5 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-ink">{item.code}</span>
                        <span className="rounded bg-brass-soft px-1.5 py-0.5 text-[10px] font-semibold text-brass">
                          {item.role === "teacher" ? "교사" : item.role === "admin" ? "관리자" : "학생"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-ink-soft">
                        잔여: {item.remaining_uses}/{item.max_uses}회 · 만료:{" "}
                        {new Date(item.expires_at).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopy(item.code)}
                        className="rounded p-1 text-ink-soft hover:bg-paper hover:text-ink"
                        title="코드 복사"
                      >
                        {copiedCode === item.code ? (
                          <Check size={14} className="text-certified" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevoke(item.code)}
                        className="rounded p-1 text-ink-soft hover:bg-alert-soft hover:text-alert"
                        title="코드 즉시 파기"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-line pt-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line bg-paper px-4 py-1.5 text-xs font-medium text-ink hover:bg-paper-raised"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
