"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  Users,
  UserX,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { useAuth } from "@/context/AuthContext";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { AdminUserListItem, AdminUsersResponse } from "@/lib/types";

const ROLE_LABELS: Record<string, string> = {
  student: "학생",
  teacher: "교사",
  admin: "관리자",
};

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();

  // 목록 및 필터 상태
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 검색 및 필터 인풋 상태
  const [searchInput, setSearchInput] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [role, setRole] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(15);

  // 진행 중 액션 상태
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 모달 상태
  const [purgeAllModalOpen, setPurgeAllModalOpen] = useState<boolean>(false);
  const [singlePurgeTarget, setSinglePurgeTarget] = useState<AdminUserListItem | null>(null);
  const [softDeleteTarget, setSoftDeleteTarget] = useState<AdminUserListItem | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<AdminUserListItem | null>(null);

  // 유저 목록 조회
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query: Record<string, string | number> = {
        page,
        limit,
      };
      if (search.trim()) query.search = search.trim();
      if (role !== "all") query.role = role;
      if (status !== "all") query.status = status;

      const res = await apiClient.request<AdminUsersResponse>("/api/admin/users", {
        query,
      });
      setData(res);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, role, status]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // 삭제 또는 일괄 정리 후 현재 페이지가 전체 페이지보다 커진 경우 마지막 유효 페이지로 자동 보정
  useEffect(() => {
    if (data && data.total > 0) {
      const maxPage = Math.max(1, Math.ceil(data.total / limit));
      if (page > maxPage) {
        setPage(maxPage);
      }
    }
  }, [data, limit, page]);

  // 검색 제출 핸들러
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  // 성공 메시지 3초 후 자동 해제
  const showToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3500);
  };

  // 1. 유저 소프트 삭제
  const handleSoftDelete = async () => {
    if (!softDeleteTarget) return;
    setActionLoading(`soft-delete-${softDeleteTarget.uuid}`);
    try {
      await apiClient.request(`/api/admin/users/${softDeleteTarget.uuid}/soft-delete`, {
        method: "PATCH",
      });
      showToast(`${softDeleteTarget.name} (${softDeleteTarget.id}) 유저가 삭제 대기 상태로 변경되었습니다.`);
      setSoftDeleteTarget(null);
      await fetchUsers();
    } catch (err) {
      setError(apiErrorMessage(err));
      setSoftDeleteTarget(null);
    } finally {
      setActionLoading(null);
    }
  };

  // 2. 유저 복원
  const handleRestore = async () => {
    if (!restoreTarget) return;
    setActionLoading(`restore-${restoreTarget.uuid}`);
    try {
      await apiClient.request(`/api/admin/users/${restoreTarget.uuid}/restore`, {
        method: "PATCH",
      });
      showToast(`${restoreTarget.name} (${restoreTarget.id}) 유저가 정상 복원되었습니다.`);
      setRestoreTarget(null);
      await fetchUsers();
    } catch (err) {
      setError(apiErrorMessage(err));
      setRestoreTarget(null);
    } finally {
      setActionLoading(null);
    }
  };

  // 3. 단건 영구 삭제
  const handleSinglePurge = async () => {
    if (!singlePurgeTarget) return;
    setActionLoading(`purge-${singlePurgeTarget.uuid}`);
    try {
      await apiClient.request("/api/admin/users/purge-deleted", {
        method: "DELETE",
        query: { user_uuid: singlePurgeTarget.uuid },
      });
      showToast(`${singlePurgeTarget.name} (${singlePurgeTarget.id}) 유저가 영구 삭제되었습니다.`);
      setSinglePurgeTarget(null);
      await fetchUsers();
    } catch (err) {
      setError(apiErrorMessage(err));
      setSinglePurgeTarget(null);
    } finally {
      setActionLoading(null);
    }
  };

  // 4. 전체 일괄 영구 삭제
  const handlePurgeAll = async () => {
    setActionLoading("purge-all");
    try {
      const res = await apiClient.request<{ purgedCount: number; message: string }>(
        "/api/admin/users/purge-deleted",
        { method: "DELETE" }
      );
      showToast(res.message || `${res.purgedCount}명의 유저가 영구 삭제되었습니다.`);
      setPurgeAllModalOpen(false);
      await fetchUsers();
    } catch (err) {
      setError(apiErrorMessage(err));
      setPurgeAllModalOpen(false);
    } finally {
      setActionLoading(null);
    }
  };

  // 학적 / 교무 정보 문자열 서식
  const renderExtraInfo = (u: AdminUserListItem) => {
    const { role: userRole, extra } = u;
    if (!extra) return <span className="text-ink-soft">-</span>;

    if (userRole === "student") {
      if (extra.grade && extra.class) {
        return (
          <span className="font-mono text-xs">
            {extra.grade}학년 {extra.class}반 {extra.number ? `${extra.number}번` : ""}
          </span>
        );
      }
      return <span className="text-ink-soft">학적 미등록</span>;
    }

    if (userRole === "teacher") {
      const parts: string[] = [];
      if (extra.department) parts.push(extra.department);
      if (extra.subject) parts.push(extra.subject);
      if (extra.position) parts.push(extra.position);
      if (extra.grade && extra.class) parts.push(`${extra.grade}-${extra.class} 담임`);
      return parts.length > 0 ? (
        <span className="text-xs text-ink-soft">{parts.join(" · ")}</span>
      ) : (
        <span className="text-ink-soft">교무 정보 없음</span>
      );
    }

    if (userRole === "admin") {
      if (extra.department || extra.subject) {
        return (
          <span className="text-xs text-ink-soft">
            {[extra.department, extra.subject, extra.position].filter(Boolean).join(" · ")}
          </span>
        );
      }
      return <span className="text-xs text-ink-soft">시스템 관리 권한</span>;
    }

    return <span className="text-ink-soft">-</span>;
  };

  // 날짜 포맷
  const formatDate = (isoString?: string) => {
    if (!isoString) return "-";
    return isoString.replace("T", " ").slice(0, 16);
  };

  const deletedCount = data?.deletedCount ?? data?.deleted_count ?? 0;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // 페이지네이션 번호 목록 계산 (최대 7개 노출)
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (page <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }
    if (page >= totalPages - 3) {
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", page - 1, page, page + 1, "...", totalPages];
  };

  return (
    <div className="space-y-6">
      {/* 1. 상단 헤더 영역 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          eyebrow="시스템 관리자"
          title="전체 유저 탐색"
          description="학생, 교사, 관리자 계정을 탐색하고 소프트 삭제 및 영구 삭제(Purge)를 관리합니다."
        />

        {/* 상단 우측 [완전 삭제하기 (영구 삭제)] 붉은색 버튼 */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPurgeAllModalOpen(true)}
            disabled={deletedCount === 0 || actionLoading !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-40 transition-all"
            title={deletedCount === 0 ? "삭제 대기 중인 유저가 없습니다." : "삭제 대기 상태인 유저 전체를 영구 삭제합니다."}
          >
            <Trash2 size={16} />
            <span>완전 삭제하기 (영구 삭제)</span>
            <span className="ml-1 inline-flex items-center justify-center rounded-full bg-white px-2 py-0.5 text-xs font-bold text-rose-700">
              {deletedCount}명
            </span>
          </button>
        </div>
      </div>

      {/* 피드백 알림 메시지 */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-600 hover:text-rose-800"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 2. 필터 바 영역 */}
      <div className="rounded-xl border border-line bg-paper-raised p-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 md:flex-row md:items-center">
          {/* 검색어 인풋 */}
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="아이디, 성명, 이메일로 검색..."
              className="w-full rounded-lg border border-line bg-paper pl-10 pr-4 py-2 text-sm text-ink placeholder:text-ink-soft focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 역할 셀렉트 */}
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none"
            >
              <option value="all">전체 역할</option>
              <option value="student">학생</option>
              <option value="teacher">교사</option>
              <option value="admin">관리자</option>
            </select>

            {/* 상태 셀렉트 */}
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none"
            >
              <option value="all">전체 상태</option>
              <option value="active">정상 계정</option>
              <option value="deleted">삭제 대기</option>
            </select>

            {/* 검색 버튼 */}
            <button
              type="submit"
              className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark transition-colors"
            >
              검색
            </button>

            {/* 새로고침 버튼 */}
            <button
              type="button"
              onClick={() => void fetchUsers()}
              disabled={loading}
              className="rounded-lg border border-line bg-paper p-2 text-ink-soft hover:bg-paper-sunken hover:text-ink transition-colors"
              title="새로고침"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </form>
      </div>

      {/* 3. 유저 테이블 영역 */}
      <div className="overflow-hidden rounded-xl border border-line bg-paper-raised shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-paper-sunken text-xs font-semibold text-ink-soft uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">역할</th>
                <th className="px-4 py-3">아이디</th>
                <th className="px-4 py-3">성명</th>
                <th className="px-4 py-3">이메일</th>
                <th className="px-4 py-3">학적 / 교무 정보</th>
                <th className="px-4 py-3 text-center">상태</th>
                <th className="px-4 py-3">가입일시</th>
                <th className="px-4 py-3 text-right">계정 관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading && !data ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-ink-soft">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={24} className="animate-spin text-navy" />
                      <span>유저 목록을 불러오는 중입니다...</span>
                    </div>
                  </td>
                </tr>
              ) : !data?.users || data.users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-ink-soft">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users size={28} className="text-ink-soft/60" />
                      <span>조건에 일치하는 사용자가 없습니다.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                data.users.map((u) => {
                  const isDeleted = Boolean(u.is_deleted ?? u.isDeleted);
                  const isSelf =
                    currentUser?.id === u.id ||
                    (currentUser?.uuid && u.uuid && currentUser.uuid === u.uuid);
                  const roleLabel = ROLE_LABELS[u.role] || u.role;

                  return (
                    <tr
                      key={u.uuid}
                      className={`hover:bg-paper-sunken/50 transition-colors ${
                        isDeleted ? "bg-rose-50/20" : ""
                      }`}
                    >
                      {/* 역할 */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <StatusPill label={roleLabel} />
                      </td>

                      {/* 아이디 */}
                      <td className="px-4 py-3.5 font-mono text-xs font-semibold text-ink whitespace-nowrap">
                        {u.id}
                        {isSelf && (
                          <span className="ml-1.5 rounded bg-navy-soft px-1.5 py-0.5 text-[10px] font-semibold text-navy">
                            본인
                          </span>
                        )}
                      </td>

                      {/* 성명 */}
                      <td className="px-4 py-3.5 font-medium text-ink whitespace-nowrap">
                        {u.name}
                      </td>

                      {/* 이메일 */}
                      <td className="px-4 py-3.5 text-xs text-ink-soft whitespace-nowrap">
                        {u.email || "-"}
                      </td>

                      {/* 학적 / 교무 정보 */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {renderExtraInfo(u)}
                      </td>

                      {/* 상태 뱃지 */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <StatusPill label={isDeleted ? "삭제 대기" : "정상"} />
                      </td>

                      {/* 가입일시 */}
                      <td className="px-4 py-3.5 text-xs text-ink-soft whitespace-nowrap font-mono">
                        {formatDate(u.created_at || u.createdAt)}
                      </td>

                      {/* 행 액션 버튼 */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isDeleted ? (
                            /* 정상 유저: 삭제 버튼 */
                            <button
                              type="button"
                              onClick={() => setSoftDeleteTarget(u)}
                              disabled={isSelf || actionLoading !== null}
                              className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                              title={isSelf ? "본인 계정은 삭제할 수 없습니다." : "삭제 대기 상태로 변경"}
                            >
                              <UserX size={13} />
                              <span>삭제</span>
                            </button>
                          ) : (
                            /* 삭제 대기 유저: 복원 및 영구 삭제 버튼 */
                            <>
                              <button
                                type="button"
                                onClick={() => setRestoreTarget(u)}
                                disabled={actionLoading !== null}
                                className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                                title="정상 계정으로 복원"
                              >
                                <RotateCcw size={13} />
                                <span>복원</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSinglePurgeTarget(u)}
                                disabled={isSelf || actionLoading !== null}
                                className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                                title="외래키 정리 및 영구 삭제"
                              >
                                <Trash2 size={13} />
                                <span>영구 삭제</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. 페이지네이션 바 */}
        <div className="flex flex-col gap-3 border-t border-line bg-paper px-4 py-3 sm:flex-row sm:items-center sm:justify-between text-xs text-ink-soft">
          <div>
            전체 <strong className="font-semibold text-ink">{total}</strong>명 (삭제 대기{" "}
            <strong className="font-semibold text-rose-600">{deletedCount}</strong>명)
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* 페이지네이션 컨트롤 (이전, N페이지, 다음) */}
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="rounded border border-line bg-paper px-2.5 py-1 font-medium hover:bg-paper-sunken disabled:cursor-not-allowed disabled:opacity-40"
            >
              이전
            </button>

            {getPageNumbers().map((item, idx) =>
              item === "..." ? (
                <span key={`ellipsis-${idx}`} className="px-1.5 py-1 text-ink-soft select-none">
                  ...
                </span>
              ) : (
                <button
                  key={`page-${item}`}
                  type="button"
                  onClick={() => setPage(Number(item))}
                  disabled={loading}
                  className={`min-w-[28px] rounded border px-2 py-1 font-medium transition-colors ${
                    page === item
                      ? "border-navy bg-navy text-white"
                      : "border-line bg-paper text-ink hover:bg-paper-sunken"
                  }`}
                >
                  {item}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="rounded border border-line bg-paper px-2.5 py-1 font-medium hover:bg-paper-sunken disabled:cursor-not-allowed disabled:opacity-40"
            >
              다음
            </button>

            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="ml-2 rounded border border-line bg-paper px-2 py-1 text-xs text-ink"
            >
              <option value={10}>10개씩</option>
              <option value={15}>15개씩</option>
              <option value={20}>20개씩</option>
              <option value={50}>50개씩</option>
            </select>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 5. 확인 다이얼로그 모달 모음                                         */}
      {/* ==================================================================== */}

      {/* 모달 1: 전체 일괄 영구 삭제 확인 다이얼로그 */}
      {purgeAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-line bg-paper-raised p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-rose-100 p-2 text-rose-600 shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-ink">삭제 대기 유저 전체 영구 삭제</h3>
                <p className="text-xs text-ink-soft">
                  현재 삭제 대기 상태인 총{" "}
                  <strong className="text-rose-600 font-semibold">{deletedCount}명</strong>의
                  사용자를 영구 삭제합니다.
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-900 space-y-1.5 leading-relaxed">
              <p className="font-semibold">⚠️ 주의: 이 작업은 되돌릴 수 없습니다.</p>
              <ul className="list-disc pl-4 space-y-1 text-rose-800">
                <li>유저 계정(`users`)이 데이터베이스에서 완전히 삭제됩니다.</li>
                <li>챗봇 대화 이력 및 연동 메시지가 영구 삭제됩니다.</li>
                <li>학생/교사 프로필 연동이 해제되며, 심사/상벌점 이력의 수정자 정보가 안전하게 null 처리됩니다.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPurgeAllModalOpen(false)}
                disabled={actionLoading !== null}
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-paper-sunken transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handlePurgeAll()}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 transition-colors"
              >
                {actionLoading === "purge-all" ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>영구 삭제 중...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>전체 영구 삭제 확인</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모달 2: 단건 영구 삭제 확인 다이얼로그 */}
      {singlePurgeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-line bg-paper-raised p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-rose-100 p-2 text-rose-600 shrink-0">
                <Trash2 size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-ink">단건 영구 삭제 확인</h3>
                <p className="text-xs text-ink-soft">
                  선택한 삭제 대기 유저를 데이터베이스에서 완전히 영구 삭제합니다.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-paper p-3 text-xs space-y-1">
              <div>
                <span className="text-ink-soft">대상 유저:</span>{" "}
                <strong className="text-ink">{singlePurgeTarget.name}</strong> ({singlePurgeTarget.id})
              </div>
              <div>
                <span className="text-ink-soft">역할:</span> {ROLE_LABELS[singlePurgeTarget.role] || singlePurgeTarget.role}
              </div>
              <div>
                <span className="text-ink-soft">이메일:</span> {singlePurgeTarget.email || "-"}
              </div>
            </div>

            <p className="text-xs text-rose-600 font-medium">
              * 해당 유저의 챗봇 대화 및 계정 정보가 완전 삭제되며 절대 복구할 수 없습니다.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSinglePurgeTarget(null)}
                disabled={actionLoading !== null}
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-paper-sunken transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleSinglePurge()}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 transition-colors"
              >
                {actionLoading === `purge-${singlePurgeTarget.uuid}` ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>영구 삭제 중...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>영구 삭제 실행</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모달 3: 소프트 삭제 확인 다이얼로그 */}
      {softDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-line bg-paper-raised p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-100 p-2 text-amber-600 shrink-0">
                <UserX size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-ink">유저 삭제 (삭제 대기 상태 전환)</h3>
                <p className="text-xs text-ink-soft">
                  유저를 소프트 삭제 처리하여 삭제 대기 상태로 전환합니다.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-paper p-3 text-xs space-y-1">
              <div>
                <span className="text-ink-soft">대상 유저:</span>{" "}
                <strong className="text-ink">{softDeleteTarget.name}</strong> ({softDeleteTarget.id})
              </div>
              <div>
                <span className="text-ink-soft">역할:</span> {ROLE_LABELS[softDeleteTarget.role] || softDeleteTarget.role}
              </div>
            </div>

            <p className="text-xs text-ink-soft">
              * 소프트 삭제된 유저는 즉시 로그아웃되며 서비스 접근이 차단됩니다. 추후 언제든지 복원하거나 완전 영구 삭제할 수 있습니다.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSoftDeleteTarget(null)}
                disabled={actionLoading !== null}
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-paper-sunken transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleSoftDelete()}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 transition-colors"
              >
                {actionLoading === `soft-delete-${softDeleteTarget.uuid}` ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>삭제 처리 중...</span>
                  </>
                ) : (
                  <span>삭제 대기로 변경</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모달 4: 복원 확인 다이얼로그 */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-line bg-paper-raised p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-emerald-100 p-2 text-emerald-600 shrink-0">
                <UserCheck size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-ink">유저 계정 복원</h3>
                <p className="text-xs text-ink-soft">
                  삭제 대기 상태인 유저를 정상 계정 상태로 즉시 복원합니다.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-paper p-3 text-xs space-y-1">
              <div>
                <span className="text-ink-soft">복원 대상:</span>{" "}
                <strong className="text-ink">{restoreTarget.name}</strong> ({restoreTarget.id})
              </div>
              <div>
                <span className="text-ink-soft">역할:</span> {ROLE_LABELS[restoreTarget.role] || restoreTarget.role}
              </div>
            </div>

            <p className="text-xs text-emerald-700 font-medium">
              * 복원 즉시 유저가 다시 시스템에 정상 로그인하고 모든 서비스를 이용할 수 있습니다.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                disabled={actionLoading !== null}
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-paper-sunken transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleRestore()}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 transition-colors"
              >
                {actionLoading === `restore-${restoreTarget.uuid}` ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>복원 중...</span>
                  </>
                ) : (
                  <span>계정 복원 실행</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
