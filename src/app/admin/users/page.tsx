"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  GraduationCap,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  School,
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
import {
  AdminStudentItem,
  AdminStudentsResponse,
  AdminTeacherItem,
  AdminTeachersResponse,
  AdminUserListItem,
  AdminUsersResponse,
} from "@/lib/types";

type TabKey = "users" | "students" | "teachers";

const ROLE_LABELS: Record<string, string> = {
  student: "학생",
  teacher: "교사",
  admin: "관리자",
};

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const searchParams = useSearchParams();

  // 탭 상태 (URL query string ?tab=students 등 지원)
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const qTab = searchParams.get("tab");
    if (qTab === "students" || qTab === "teachers") return qTab;
    return "users";
  });

  // 공통 피드백 상태
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3500);
  };

  // ============================================================================
  // TAB 1: 전체 유저 (계정) 상태 및 로직
  // ============================================================================
  const [usersData, setUsersData] = useState<AdminUsersResponse | null>(null);
  const [usersLoading, setUsersLoading] = useState<boolean>(true);
  const [usersSearchInput, setUsersSearchInput] = useState<string>("");
  const [usersSearch, setUsersSearch] = useState<string>("");
  const [usersRole, setUsersRole] = useState<string>("all");
  const [usersStatus, setUsersStatus] = useState<string>("all");
  const [usersPage, setUsersPage] = useState<number>(1);
  const [usersLimit] = useState<number>(15);

  const [purgeAllUsersModal, setPurgeAllUsersModal] = useState<boolean>(false);
  const [singlePurgeUser, setSinglePurgeUser] = useState<AdminUserListItem | null>(null);
  const [softDeleteUser, setSoftDeleteUser] = useState<AdminUserListItem | null>(null);
  const [restoreUser, setRestoreUser] = useState<AdminUserListItem | null>(null);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    setError(null);
    try {
      const query: Record<string, string | number> = {
        page: usersPage,
        limit: usersLimit,
      };
      if (usersSearch.trim()) query.search = usersSearch.trim();
      if (usersRole !== "all") query.role = usersRole;
      if (usersStatus !== "all") query.status = usersStatus;

      const res = await apiClient.request<AdminUsersResponse>("/api/admin/users", { query });
      setUsersData(res);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUsersLoading(false);
    }
  }, [usersPage, usersLimit, usersSearch, usersRole, usersStatus]);

  useEffect(() => {
    if (activeTab === "users") void fetchUsers();
  }, [activeTab, fetchUsers]);

  const handleSoftDeleteUser = async (target: AdminUserListItem) => {
    setActionLoading(`soft-delete-${target.uuid}`);
    setError(null);
    try {
      await apiClient.request(`/api/admin/users/${encodeURIComponent(target.uuid)}/soft-delete`, {
        method: "PATCH",
      });
      showToast(`유저 '${target.name || target.id}'이(가) 삭제 대기 상태로 전환되었습니다.`);
      setSoftDeleteUser(null);
      await fetchUsers();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestoreUser = async (target: AdminUserListItem) => {
    setActionLoading(`restore-${target.uuid}`);
    setError(null);
    try {
      await apiClient.request(`/api/admin/users/${encodeURIComponent(target.uuid)}/restore`, {
        method: "PATCH",
      });
      showToast(`유저 '${target.name || target.id}'이(가) 정상 복구되었습니다.`);
      setRestoreUser(null);
      await fetchUsers();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handlePurgeUsers = async (targetUuid?: string) => {
    const actionKey = targetUuid ? `purge-${targetUuid}` : "purge-all-users";
    setActionLoading(actionKey);
    setError(null);
    try {
      const query: Record<string, string> = {};
      if (targetUuid) query.user_uuid = targetUuid;

      const res = await apiClient.request<{ purgedCount?: number; purged_count?: number }>(
        "/api/admin/users/purge-deleted",
        {
          method: "DELETE",
          query,
        }
      );
      const count = res?.purgedCount ?? res?.purged_count ?? 1;
      showToast(`${count}명의 삭제 대기 유저가 영구 삭제되었습니다.`);
      setPurgeAllUsersModal(false);
      setSinglePurgeUser(null);
      await fetchUsers();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================================================
  // TAB 2: 학생 명단 관리 상태 및 로직
  // ============================================================================
  const [studentsData, setStudentsData] = useState<AdminStudentsResponse | null>(null);
  const [studentsLoading, setStudentsLoading] = useState<boolean>(true);
  const [studentsSearchInput, setStudentsSearchInput] = useState<string>("");
  const [studentsSearch, setStudentsSearch] = useState<string>("");
  const [studentsGrade, setStudentsGrade] = useState<string>("all");
  const [studentsClass, setStudentsClass] = useState<string>("all");
  const [studentsStatus, setStudentsStatus] = useState<string>("all");
  const [studentsPage, setStudentsPage] = useState<number>(1);
  const [studentsLimit] = useState<number>(15);

  // 모달 상태
  const [createStudentModal, setCreateStudentModal] = useState<boolean>(false);
  const [editStudentTarget, setEditStudentTarget] = useState<AdminStudentItem | null>(null);
  const [softDeleteStudentTarget, setSoftDeleteStudentTarget] = useState<AdminStudentItem | null>(null);
  const [restoreStudentTarget, setRestoreStudentTarget] = useState<AdminStudentItem | null>(null);
  const [purgeStudentTarget, setPurgeStudentTarget] = useState<AdminStudentItem | null>(null);
  const [purgeAllStudentsModal, setPurgeAllStudentsModal] = useState<boolean>(false);

  // 학생 입력 폼 상태
  const [studentForm, setStudentForm] = useState({
    name: "",
    email: "",
    grade: "1",
    classNo: "1",
    studentNo: "1",
  });

  const fetchStudents = useCallback(async () => {
    setStudentsLoading(true);
    setError(null);
    try {
      const query: Record<string, string | number> = {
        page: studentsPage,
        limit: studentsLimit,
      };
      if (studentsSearch.trim()) query.search = studentsSearch.trim();
      if (studentsGrade !== "all") query.grade = Number(studentsGrade);
      if (studentsClass !== "all") query.class_no = Number(studentsClass);
      if (studentsStatus !== "all") query.status = studentsStatus;

      const res = await apiClient.request<AdminStudentsResponse>("/api/admin/roster/students", { query });
      setStudentsData(res);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setStudentsLoading(false);
    }
  }, [studentsPage, studentsLimit, studentsSearch, studentsGrade, studentsClass, studentsStatus]);

  useEffect(() => {
    if (activeTab === "students") void fetchStudents();
  }, [activeTab, fetchStudents]);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading("create-student");
    setError(null);
    try {
      await apiClient.request("/api/admin/roster/students", {
        method: "POST",
        body: {
          name: studentForm.name.trim(),
          email: studentForm.email.trim(),
          grade: Number(studentForm.grade),
          class: Number(studentForm.classNo),
          number: Number(studentForm.studentNo),
        },
      });
      showToast(`학생 '${studentForm.name}'이(가) 개별 등록되었습니다.`);
      setCreateStudentModal(false);
      setStudentForm({ name: "", email: "", grade: "1", classNo: "1", studentNo: "1" });
      await fetchStudents();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudentTarget) return;
    setActionLoading(`edit-student-${editStudentTarget.student_id}`);
    setError(null);
    try {
      await apiClient.request(`/api/admin/roster/students/${editStudentTarget.student_id}`, {
        method: "PATCH",
        body: {
          name: studentForm.name.trim(),
          email: studentForm.email.trim(),
          grade: Number(studentForm.grade),
          class: Number(studentForm.classNo),
          number: Number(studentForm.studentNo),
        },
      });
      showToast(`학생 '${studentForm.name}' 정보가 수정되었습니다.`);
      setEditStudentTarget(null);
      await fetchStudents();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSoftDeleteStudent = async (target: AdminStudentItem) => {
    setActionLoading(`soft-delete-student-${target.student_id}`);
    setError(null);
    try {
      await apiClient.request(`/api/admin/roster/students/${target.student_id}/soft-delete`, {
        method: "PATCH",
      });
      showToast(`학생 '${target.name}'이(가) 삭제 대기 상태로 전환되었습니다.`);
      setSoftDeleteStudentTarget(null);
      await fetchStudents();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestoreStudent = async (target: AdminStudentItem) => {
    setActionLoading(`restore-student-${target.student_id}`);
    setError(null);
    try {
      await apiClient.request(`/api/admin/roster/students/${target.student_id}/restore`, {
        method: "PATCH",
      });
      showToast(`학생 '${target.name}'이(가) 정상 복원되었습니다.`);
      setRestoreStudentTarget(null);
      await fetchStudents();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handlePurgeStudents = async (studentId?: number) => {
    const actionKey = studentId ? `purge-student-${studentId}` : "purge-all-students";
    setActionLoading(actionKey);
    setError(null);
    try {
      const query: Record<string, number> = {};
      if (studentId) query.student_id = studentId;

      const res = await apiClient.request<{ purgedCount?: number }>("/api/admin/roster/students/purge", {
        method: "DELETE",
        query,
      });
      const count = res?.purgedCount ?? 1;
      showToast(`${count}명의 삭제 대기 학생이 영구 삭제되었습니다.`);
      setPurgeAllStudentsModal(false);
      setPurgeStudentTarget(null);
      await fetchStudents();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================================================
  // TAB 3: 교원 명단 관리 상태 및 로직
  // ============================================================================
  const [teachersData, setTeachersData] = useState<AdminTeachersResponse | null>(null);
  const [teachersLoading, setTeachersLoading] = useState<boolean>(true);
  const [teachersSearchInput, setTeachersSearchInput] = useState<string>("");
  const [teachersSearch, setTeachersSearch] = useState<string>("");
  const [teachersDepartment, setTeachersDepartment] = useState<string>("");
  const [teachersPosition, setTeachersPosition] = useState<string>("");
  const [teachersStatus, setTeachersStatus] = useState<string>("all");
  const [teachersPage, setTeachersPage] = useState<number>(1);
  const [teachersLimit] = useState<number>(15);

  // 모달 상태
  const [createTeacherModal, setCreateTeacherModal] = useState<boolean>(false);
  const [editTeacherTarget, setEditTeacherTarget] = useState<AdminTeacherItem | null>(null);
  const [softDeleteTeacherTarget, setSoftDeleteTeacherTarget] = useState<AdminTeacherItem | null>(null);
  const [restoreTeacherTarget, setRestoreTeacherTarget] = useState<AdminTeacherItem | null>(null);
  const [purgeTeacherTarget, setPurgeTeacherTarget] = useState<AdminTeacherItem | null>(null);
  const [purgeAllTeachersModal, setPurgeAllTeachersModal] = useState<boolean>(false);

  // 교원 입력 폼 상태
  const [teacherForm, setTeacherForm] = useState({
    name: "",
    email: "",
    subject: "",
    department: "",
    position: "교과전담",
    grade: "",
    classNo: "",
  });

  const fetchTeachers = useCallback(async () => {
    setTeachersLoading(true);
    setError(null);
    try {
      const query: Record<string, string | number> = {
        page: teachersPage,
        limit: teachersLimit,
      };
      if (teachersSearch.trim()) query.search = teachersSearch.trim();
      if (teachersDepartment.trim()) query.department = teachersDepartment.trim();
      if (teachersPosition.trim()) query.position = teachersPosition.trim();
      if (teachersStatus !== "all") query.status = teachersStatus;

      const res = await apiClient.request<AdminTeachersResponse>("/api/admin/roster/teachers", { query });
      setTeachersData(res);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setTeachersLoading(false);
    }
  }, [teachersPage, teachersLimit, teachersSearch, teachersDepartment, teachersPosition, teachersStatus]);

  useEffect(() => {
    if (activeTab === "teachers") void fetchTeachers();
  }, [activeTab, fetchTeachers]);

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading("create-teacher");
    setError(null);
    try {
      const g = teacherForm.grade ? Number(teacherForm.grade) : undefined;
      const c = teacherForm.classNo ? Number(teacherForm.classNo) : undefined;
      await apiClient.request("/api/admin/roster/teachers", {
        method: "POST",
        body: {
          name: teacherForm.name.trim(),
          email: teacherForm.email.trim(),
          subject: teacherForm.subject.trim() || undefined,
          department: teacherForm.department.trim() || undefined,
          position: teacherForm.position.trim() || "교과전담",
          grade: g,
          class: c,
        },
      });
      showToast(`교원 '${teacherForm.name}'이(가) 개별 등록되었습니다.`);
      setCreateTeacherModal(false);
      setTeacherForm({ name: "", email: "", subject: "", department: "", position: "교과전담", grade: "", classNo: "" });
      await fetchTeachers();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTeacherTarget) return;
    setActionLoading(`edit-teacher-${editTeacherTarget.teachers_id}`);
    setError(null);
    try {
      const g = teacherForm.grade ? Number(teacherForm.grade) : undefined;
      const c = teacherForm.classNo ? Number(teacherForm.classNo) : undefined;
      await apiClient.request(`/api/admin/roster/teachers/${editTeacherTarget.teachers_id}`, {
        method: "PATCH",
        body: {
          name: teacherForm.name.trim(),
          email: teacherForm.email.trim(),
          subject: teacherForm.subject.trim() || undefined,
          department: teacherForm.department.trim() || undefined,
          position: teacherForm.position.trim() || "교과전담",
          grade: g,
          class: c,
        },
      });
      showToast(`교원 '${teacherForm.name}' 정보가 수정되었습니다.`);
      setEditTeacherTarget(null);
      await fetchTeachers();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSoftDeleteTeacher = async (target: AdminTeacherItem) => {
    setActionLoading(`soft-delete-teacher-${target.teachers_id}`);
    setError(null);
    try {
      await apiClient.request(`/api/admin/roster/teachers/${target.teachers_id}/soft-delete`, {
        method: "PATCH",
      });
      showToast(`교원 '${target.name}'이(가) 삭제 대기 상태로 전환되었습니다.`);
      setSoftDeleteTeacherTarget(null);
      await fetchTeachers();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestoreTeacher = async (target: AdminTeacherItem) => {
    setActionLoading(`restore-teacher-${target.teachers_id}`);
    setError(null);
    try {
      await apiClient.request(`/api/admin/roster/teachers/${target.teachers_id}/restore`, {
        method: "PATCH",
      });
      showToast(`교원 '${target.name}'이(가) 정상 복원되었습니다.`);
      setRestoreTeacherTarget(null);
      await fetchTeachers();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handlePurgeTeachers = async (teacherId?: number) => {
    const actionKey = teacherId ? `purge-teacher-${teacherId}` : "purge-all-teachers";
    setActionLoading(actionKey);
    setError(null);
    try {
      const query: Record<string, number> = {};
      if (teacherId) query.teacher_id = teacherId;

      const res = await apiClient.request<{ purgedCount?: number }>("/api/admin/roster/teachers/purge", {
        method: "DELETE",
        query,
      });
      const count = res?.purgedCount ?? 1;
      showToast(`${count}명의 삭제 대기 교원이 영구 삭제되었습니다.`);
      setPurgeAllTeachersModal(false);
      setPurgeTeacherTarget(null);
      await fetchTeachers();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  // 날짜 포맷
  const formatDate = (isoString?: string) => {
    if (!isoString) return "-";
    return isoString.replace("T", " ").slice(0, 16);
  };

  return (
    <div className="space-y-6">
      {/* 1. 상단 헤더 영역 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          eyebrow="시스템 관리자"
          title="전체 유저 및 명단 관리"
          description="계정, 학생 명단 및 교원 명단을 개별 등록, 수정, 제외(소프트 삭제) 및 영구 삭제(Purge)합니다."
        />
      </div>

      {/* 2. 탭 네비게이션 */}
      <div className="flex border-b border-line gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "users"
              ? "border-navy text-navy font-bold bg-paper-raised/40 rounded-t-lg"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          <Users size={16} />
          <span>전체 유저 (계정)</span>
          {usersData && usersData.total > 0 && (
            <span className="rounded-full bg-paper px-2 py-0.5 text-xs text-ink-soft">
              {usersData.total}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("students")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "students"
              ? "border-navy text-navy font-bold bg-paper-raised/40 rounded-t-lg"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          <GraduationCap size={16} />
          <span>학생 명단</span>
          {studentsData && studentsData.total > 0 && (
            <span className="rounded-full bg-paper px-2 py-0.5 text-xs text-ink-soft">
              {studentsData.total}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("teachers")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "teachers"
              ? "border-navy text-navy font-bold bg-paper-raised/40 rounded-t-lg"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          <School size={16} />
          <span>교원 명단</span>
          {teachersData && teachersData.total > 0 && (
            <span className="rounded-full bg-paper px-2 py-0.5 text-xs text-ink-soft">
              {teachersData.total}
            </span>
          )}
        </button>
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
          <button type="button" onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 탭 1 컨텐츠: 전체 유저 (계정) */}
      {/* ==================================================================== */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setUsersSearch(usersSearchInput);
                setUsersPage(1);
              }}
              className="flex flex-1 items-center gap-2 max-w-xl"
            >
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input
                  type="text"
                  value={usersSearchInput}
                  onChange={(e) => setUsersSearchInput(e.target.value)}
                  placeholder="아이디, 이름, 이메일 검색..."
                  className="w-full rounded-lg border border-line bg-paper-raised pl-9 pr-3 py-2 text-sm text-ink outline-none focus:border-navy"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90"
              >
                검색
              </button>
            </form>

            <div className="flex items-center gap-3">
              <select
                value={usersRole}
                onChange={(e) => {
                  setUsersRole(e.target.value);
                  setUsersPage(1);
                }}
                className="rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm text-ink outline-none"
              >
                <option value="all">전체 역할</option>
                <option value="student">학생</option>
                <option value="teacher">교사</option>
                <option value="admin">관리자</option>
              </select>

              <select
                value={usersStatus}
                onChange={(e) => {
                  setUsersStatus(e.target.value);
                  setUsersPage(1);
                }}
                className="rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm text-ink outline-none"
              >
                <option value="all">전체 상태</option>
                <option value="active">정상</option>
                <option value="deleted">삭제 대기</option>
              </select>

              <button
                type="button"
                onClick={() => setPurgeAllUsersModal(true)}
                disabled={(usersData?.deletedCount ?? 0) === 0 || actionLoading !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-40 cursor-pointer"
              >
                <Trash2 size={14} />
                <span>완전 삭제</span>
                <span className="rounded-full bg-white px-1.5 py-0.2 text-[10px] font-bold text-rose-700">
                  {usersData?.deletedCount ?? 0}
                </span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-line bg-paper-raised">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-paper text-xs font-semibold text-ink-soft">
                <tr>
                  <th className="px-4 py-3">계정 ID</th>
                  <th className="px-4 py-3">성명</th>
                  <th className="px-4 py-3">이메일</th>
                  <th className="px-4 py-3">역할</th>
                  <th className="px-4 py-3">학적 / 직책 정보</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">가입일시</th>
                  <th className="px-4 py-3 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {usersLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-ink-soft">
                      <RefreshCw className="mx-auto mb-2 animate-spin text-ink-soft" size={20} />
                      유저 목록을 불러오는 중입니다...
                    </td>
                  </tr>
                ) : !usersData?.users || usersData.users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-ink-soft">
                      조건에 일치하는 유저가 없습니다.
                    </td>
                  </tr>
                ) : (
                  usersData.users.map((u) => {
                    const isDeleted = u.is_deleted || u.isDeleted;
                    const isSelf = currentUser?.id === u.id || currentUser?.uuid === u.uuid;
                    return (
                      <tr key={u.uuid} className={`hover:bg-paper/40 ${isDeleted ? "bg-rose-50/20" : ""}`}>
                        <td className="px-4 py-3 font-mono font-medium text-ink">{u.id}</td>
                        <td className="px-4 py-3 font-semibold text-ink">{u.name}</td>
                        <td className="px-4 py-3 text-ink-soft">{u.email || "-"}</td>
                        <td className="px-4 py-3">
                          <StatusPill label={ROLE_LABELS[u.role] || u.role} />
                        </td>
                        <td className="px-4 py-3 text-xs text-ink-soft">
                          {u.extra?.grade && u.extra?.class
                            ? `${u.extra.grade}학년 ${u.extra.class}반 ${u.extra.number ? `${u.extra.number}번` : ""}`
                            : u.extra?.department || u.extra?.position || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill label={isDeleted ? "삭제 대기" : "정상"} />
                        </td>
                        <td className="px-4 py-3 text-xs text-ink-soft font-mono">
                          {formatDate(u.created_at || u.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isDeleted ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setRestoreUser(u)}
                                  disabled={actionLoading !== null}
                                  className="inline-flex items-center gap-1 rounded border border-line bg-paper px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                                >
                                  <RotateCcw size={13} />
                                  <span>복원</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSinglePurgeUser(u)}
                                  disabled={actionLoading !== null}
                                  className="inline-flex items-center gap-1 rounded bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700 cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                  <span>완전 삭제</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSoftDeleteUser(u)}
                                disabled={isSelf || actionLoading !== null}
                                className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-40 cursor-pointer"
                                title={isSelf ? "관리자 본인 계정은 삭제할 수 없습니다." : "삭제 대기 상태로 전환"}
                              >
                                <UserX size={13} />
                                <span>삭제</span>
                              </button>
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
        </div>
      )}

      {/* ==================================================================== */}
      {/* 탭 2 컨텐츠: 학생 명단 관리 */}
      {/* ==================================================================== */}
      {activeTab === "students" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStudentsSearch(studentsSearchInput);
                setStudentsPage(1);
              }}
              className="flex flex-1 items-center gap-2 max-w-xl"
            >
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input
                  type="text"
                  value={studentsSearchInput}
                  onChange={(e) => setStudentsSearchInput(e.target.value)}
                  placeholder="학생 이름, 이메일, 계정ID 검색..."
                  className="w-full rounded-lg border border-line bg-paper-raised pl-9 pr-3 py-2 text-sm text-ink outline-none focus:border-navy"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90"
              >
                검색
              </button>
            </form>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={studentsGrade}
                onChange={(e) => {
                  setStudentsGrade(e.target.value);
                  setStudentsPage(1);
                }}
                className="rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm text-ink outline-none"
              >
                <option value="all">전체 학년</option>
                <option value="1">1학년</option>
                <option value="2">2학년</option>
                <option value="3">3학년</option>
              </select>

              <select
                value={studentsClass}
                onChange={(e) => {
                  setStudentsClass(e.target.value);
                  setStudentsPage(1);
                }}
                className="rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm text-ink outline-none"
              >
                <option value="all">전체 반</option>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((c) => (
                  <option key={c} value={c}>
                    {c}반
                  </option>
                ))}
              </select>

              <select
                value={studentsStatus}
                onChange={(e) => {
                  setStudentsStatus(e.target.value);
                  setStudentsPage(1);
                }}
                className="rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm text-ink outline-none"
              >
                <option value="all">전체 상태</option>
                <option value="active">정상</option>
                <option value="deleted">삭제 대기</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  setStudentForm({ name: "", email: "", grade: "1", classNo: "1", studentNo: "1" });
                  setCreateStudentModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white hover:bg-navy/90 cursor-pointer shadow-sm"
              >
                <Plus size={14} />
                <span>학생 개별 등록</span>
              </button>

              <button
                type="button"
                onClick={() => setPurgeAllStudentsModal(true)}
                disabled={(studentsData?.deletedCount ?? 0) === 0 || actionLoading !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-40 cursor-pointer"
              >
                <Trash2 size={14} />
                <span>삭제 대기 완전 삭제</span>
                <span className="rounded-full bg-white px-1.5 py-0.2 text-[10px] font-bold text-rose-700">
                  {studentsData?.deletedCount ?? 0}
                </span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-line bg-paper-raised">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-paper text-xs font-semibold text-ink-soft">
                <tr>
                  <th className="px-4 py-3">학생 ID</th>
                  <th className="px-4 py-3">성명</th>
                  <th className="px-4 py-3">학년 - 반 - 번호</th>
                  <th className="px-4 py-3">이메일</th>
                  <th className="px-4 py-3">계정 연동</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {studentsLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-ink-soft">
                      <RefreshCw className="mx-auto mb-2 animate-spin text-ink-soft" size={20} />
                      학생 명단을 불러오는 중입니다...
                    </td>
                  </tr>
                ) : !studentsData?.students || studentsData.students.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-ink-soft">
                      등록된 학생이 없거나 조건에 일치하는 결과가 없습니다.
                    </td>
                  </tr>
                ) : (
                  studentsData.students.map((st) => {
                    const isDel = st.is_deleted || st.isDeleted;
                    const hasAcc = st.has_account || st.hasAccount;
                    return (
                      <tr key={st.student_id} className={`hover:bg-paper/40 ${isDel ? "bg-rose-50/20" : ""}`}>
                        <td className="px-4 py-3 font-mono text-xs text-ink-soft">#{st.student_id}</td>
                        <td className="px-4 py-3 font-semibold text-ink">{st.name}</td>
                        <td className="px-4 py-3 font-medium text-ink">
                          {st.grade && st.class_no
                            ? `${st.grade}학년 ${st.class_no}반 ${st.student_no ? `${st.student_no}번` : ""}`
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-ink-soft font-mono text-xs">{st.email}</td>
                        <td className="px-4 py-3">
                          {hasAcc ? (
                            <span className="inline-flex items-center gap-1 rounded bg-sky-50 border border-sky-200 px-2 py-0.5 text-xs font-medium text-sky-700">
                              <UserCheck size={12} />
                              <span>가입됨 ({st.user_account_id})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
                              <span>사전등록 (미가입)</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill label={isDel ? "삭제 대기" : "정상"} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setStudentForm({
                                  name: st.name,
                                  email: st.email,
                                  grade: String(st.grade || 1),
                                  classNo: String(st.class_no || 1),
                                  studentNo: String(st.student_no || 1),
                                });
                                setEditStudentTarget(st);
                              }}
                              className="inline-flex items-center gap-1 rounded border border-line bg-paper px-2 py-1 text-xs font-medium text-ink hover:bg-paper-raised cursor-pointer"
                            >
                              <Pencil size={13} />
                              <span>수정</span>
                            </button>
                            {isDel ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setRestoreStudentTarget(st)}
                                  className="inline-flex items-center gap-1 rounded border border-line bg-paper px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                                >
                                  <RotateCcw size={13} />
                                  <span>복구</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPurgeStudentTarget(st)}
                                  className="inline-flex items-center gap-1 rounded bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700 cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                  <span>완전 삭제</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSoftDeleteStudentTarget(st)}
                                className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 cursor-pointer"
                              >
                                <UserX size={13} />
                                <span>제외(삭제)</span>
                              </button>
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
        </div>
      )}

      {/* ==================================================================== */}
      {/* 탭 3 컨텐츠: 교원 명단 관리 */}
      {/* ==================================================================== */}
      {activeTab === "teachers" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setTeachersSearch(teachersSearchInput);
                setTeachersPage(1);
              }}
              className="flex flex-1 items-center gap-2 max-w-xl"
            >
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input
                  type="text"
                  value={teachersSearchInput}
                  onChange={(e) => setTeachersSearchInput(e.target.value)}
                  placeholder="교사 이름, 이메일, 담당과목 검색..."
                  className="w-full rounded-lg border border-line bg-paper-raised pl-9 pr-3 py-2 text-sm text-ink outline-none focus:border-navy"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90"
              >
                검색
              </button>
            </form>

            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={teachersDepartment}
                onChange={(e) => {
                  setTeachersDepartment(e.target.value);
                  setTeachersPage(1);
                }}
                placeholder="부서 필터..."
                className="w-28 rounded-lg border border-line bg-paper-raised px-2.5 py-2 text-xs text-ink outline-none"
              />
              <input
                type="text"
                value={teachersPosition}
                onChange={(e) => {
                  setTeachersPosition(e.target.value);
                  setTeachersPage(1);
                }}
                placeholder="직책 필터..."
                className="w-24 rounded-lg border border-line bg-paper-raised px-2.5 py-2 text-xs text-ink outline-none"
              />
              <select
                value={teachersStatus}
                onChange={(e) => {
                  setTeachersStatus(e.target.value);
                  setTeachersPage(1);
                }}
                className="rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm text-ink outline-none"
              >
                <option value="all">전체 상태</option>
                <option value="active">정상</option>
                <option value="deleted">삭제 대기</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  setTeacherForm({ name: "", email: "", subject: "", department: "", position: "교과전담", grade: "", classNo: "" });
                  setCreateTeacherModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white hover:bg-navy/90 cursor-pointer shadow-sm"
              >
                <Plus size={14} />
                <span>교원 개별 등록</span>
              </button>

              <button
                type="button"
                onClick={() => setPurgeAllTeachersModal(true)}
                disabled={(teachersData?.deletedCount ?? 0) === 0 || actionLoading !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-40 cursor-pointer"
              >
                <Trash2 size={14} />
                <span>삭제 대기 완전 삭제</span>
                <span className="rounded-full bg-white px-1.5 py-0.2 text-[10px] font-bold text-rose-700">
                  {teachersData?.deletedCount ?? 0}
                </span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-line bg-paper-raised">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-paper text-xs font-semibold text-ink-soft">
                <tr>
                  <th className="px-4 py-3">교원 ID</th>
                  <th className="px-4 py-3">성명</th>
                  <th className="px-4 py-3">담당교과</th>
                  <th className="px-4 py-3">소속부서</th>
                  <th className="px-4 py-3">직책</th>
                  <th className="px-4 py-3">담당학급</th>
                  <th className="px-4 py-3">이메일</th>
                  <th className="px-4 py-3">계정 연동</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {teachersLoading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-ink-soft">
                      <RefreshCw className="mx-auto mb-2 animate-spin text-ink-soft" size={20} />
                      교원 명단을 불러오는 중입니다...
                    </td>
                  </tr>
                ) : !teachersData?.teachers || teachersData.teachers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-ink-soft">
                      등록된 교원이 없거나 조건에 일치하는 결과가 없습니다.
                    </td>
                  </tr>
                ) : (
                  teachersData.teachers.map((t) => {
                    const isDel = t.is_deleted || t.isDeleted;
                    const hasAcc = t.has_account || t.hasAccount;
                    return (
                      <tr key={t.teachers_id} className={`hover:bg-paper/40 ${isDel ? "bg-rose-50/20" : ""}`}>
                        <td className="px-4 py-3 font-mono text-xs text-ink-soft">#{t.teachers_id}</td>
                        <td className="px-4 py-3 font-semibold text-ink">{t.name}</td>
                        <td className="px-4 py-3 text-ink-soft">{t.subject || "-"}</td>
                        <td className="px-4 py-3 text-ink-soft">{t.department || "-"}</td>
                        <td className="px-4 py-3 font-medium text-ink">{t.position || "교과전담"}</td>
                        <td className="px-4 py-3 text-ink-soft">
                          {t.grade && t.class_no ? `${t.grade}학년 ${t.class_no}반` : "-"}
                        </td>
                        <td className="px-4 py-3 text-ink-soft font-mono text-xs">{t.email}</td>
                        <td className="px-4 py-3">
                          {hasAcc ? (
                            <span className="inline-flex items-center gap-1 rounded bg-sky-50 border border-sky-200 px-2 py-0.5 text-xs font-medium text-sky-700">
                              <UserCheck size={12} />
                              <span>가입됨 ({t.user_account_id})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
                              <span>사전등록 (미가입)</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill label={isDel ? "삭제 대기" : "정상"} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setTeacherForm({
                                  name: t.name,
                                  email: t.email,
                                  subject: t.subject || "",
                                  department: t.department || "",
                                  position: t.position || "교과전담",
                                  grade: t.grade ? String(t.grade) : "",
                                  classNo: t.class_no ? String(t.class_no) : "",
                                });
                                setEditTeacherTarget(t);
                              }}
                              className="inline-flex items-center gap-1 rounded border border-line bg-paper px-2 py-1 text-xs font-medium text-ink hover:bg-paper-raised cursor-pointer"
                            >
                              <Pencil size={13} />
                              <span>수정</span>
                            </button>
                            {isDel ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setRestoreTeacherTarget(t)}
                                  className="inline-flex items-center gap-1 rounded border border-line bg-paper px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                                >
                                  <RotateCcw size={13} />
                                  <span>복구</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPurgeTeacherTarget(t)}
                                  className="inline-flex items-center gap-1 rounded bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700 cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                  <span>완전 삭제</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSoftDeleteTeacherTarget(t)}
                                className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 cursor-pointer"
                              >
                                <UserX size={13} />
                                <span>제외(삭제)</span>
                              </button>
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
        </div>
      )}

      {/* ==================================================================== */}
      {/* 학생 등록/수정 모달 */}
      {/* ==================================================================== */}
      {(createStudentModal || editStudentTarget) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-line bg-paper-raised p-6 shadow-xl">
            <h3 className="text-lg font-bold text-ink">
              {editStudentTarget ? "학생 정보 수정" : "학생 개별 등록"}
            </h3>
            <p className="mt-1 text-xs text-ink-soft">
              {editStudentTarget ? "학생의 인적 사항 및 학년/반/번호를 수정합니다." : "새로운 학생을 명단에 개별 추가합니다."}
            </p>

            <form
              onSubmit={editStudentTarget ? handleEditStudent : handleCreateStudent}
              className="mt-4 space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-ink">성명 *</label>
                <input
                  type="text"
                  required
                  value={studentForm.name}
                  onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-navy"
                  placeholder="예: 홍길동"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink">이메일 *</label>
                <input
                  type="email"
                  required
                  value={studentForm.email}
                  onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-navy"
                  placeholder="예: student@bssm.hs.kr"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-ink">학년 *</label>
                  <select
                    value={studentForm.grade}
                    onChange={(e) => setStudentForm({ ...studentForm, grade: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none"
                  >
                    <option value="1">1학년</option>
                    <option value="2">2학년</option>
                    <option value="3">3학년</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink">반 *</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={studentForm.classNo}
                    onChange={(e) => setStudentForm({ ...studentForm, classNo: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink">번호 *</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={studentForm.studentNo}
                    onChange={(e) => setStudentForm({ ...studentForm, studentNo: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateStudentModal(false);
                    setEditStudentTarget(null);
                  }}
                  className="rounded-lg border border-line bg-paper px-4 py-2 text-xs font-medium text-ink hover:bg-paper-raised"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={actionLoading !== null}
                  className="rounded-lg bg-navy px-4 py-2 text-xs font-semibold text-white hover:bg-navy/90 disabled:opacity-50"
                >
                  {actionLoading ? "저장 중..." : editStudentTarget ? "수정 완료" : "등록하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 교원 등록/수정 모달 */}
      {/* ==================================================================== */}
      {(createTeacherModal || editTeacherTarget) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-line bg-paper-raised p-6 shadow-xl">
            <h3 className="text-lg font-bold text-ink">
              {editTeacherTarget ? "교원 정보 수정" : "교원 개별 등록"}
            </h3>
            <p className="mt-1 text-xs text-ink-soft">
              {editTeacherTarget ? "교원의 직책, 과목 및 담당 학급을 수정합니다." : "새로운 교원을 명단에 개별 추가합니다."}
            </p>

            <form
              onSubmit={editTeacherTarget ? handleEditTeacher : handleCreateTeacher}
              className="mt-4 space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-ink">성명 *</label>
                <input
                  type="text"
                  required
                  value={teacherForm.name}
                  onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-navy"
                  placeholder="예: 김교사"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink">이메일 *</label>
                <input
                  type="email"
                  required
                  value={teacherForm.email}
                  onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-navy"
                  placeholder="예: teacher@bssm.hs.kr"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-ink">담당교과</label>
                  <input
                    type="text"
                    value={teacherForm.subject}
                    onChange={(e) => setTeacherForm({ ...teacherForm, subject: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none"
                    placeholder="예: 정보, 인공지능"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink">소속부서</label>
                  <input
                    type="text"
                    value={teacherForm.department}
                    onChange={(e) => setTeacherForm({ ...teacherForm, department: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none"
                    placeholder="예: 마이스터부"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink">직책</label>
                <select
                  value={teacherForm.position}
                  onChange={(e) => setTeacherForm({ ...teacherForm, position: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none"
                >
                  <option value="교과전담">교과전담</option>
                  <option value="정담임">정담임</option>
                  <option value="부담임">부담임</option>
                  <option value="학년부장">학년부장</option>
                  <option value="부서부장">부서부장</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-ink">담당학년 (담임인 경우)</label>
                  <input
                    type="number"
                    min={1}
                    max={3}
                    value={teacherForm.grade}
                    onChange={(e) => setTeacherForm({ ...teacherForm, grade: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none"
                    placeholder="비담임 시 공란"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink">담당반 (담임인 경우)</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={teacherForm.classNo}
                    onChange={(e) => setTeacherForm({ ...teacherForm, classNo: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none"
                    placeholder="비담임 시 공란"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateTeacherModal(false);
                    setEditTeacherTarget(null);
                  }}
                  className="rounded-lg border border-line bg-paper px-4 py-2 text-xs font-medium text-ink hover:bg-paper-raised"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={actionLoading !== null}
                  className="rounded-lg bg-navy px-4 py-2 text-xs font-semibold text-white hover:bg-navy/90 disabled:opacity-50"
                >
                  {actionLoading ? "저장 중..." : editTeacherTarget ? "수정 완료" : "등록하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 학생 소프트 삭제 확인 모달 */}
      {/* ==================================================================== */}
      {softDeleteStudentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-line bg-paper-raised p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <UserX size={20} />
              </div>
              <div>
                <h4 className="font-bold text-ink">학생 명단 제외(삭제)</h4>
                <p className="text-xs text-ink-soft">삭제 대기 상태로 전환</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-ink">
              학생 <strong className="text-navy">{softDeleteStudentTarget.name}</strong> ({softDeleteStudentTarget.email})을(를) 명단에서 제외하시겠습니까?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSoftDeleteStudentTarget(null)}
                className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper-raised"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => handleSoftDeleteStudent(softDeleteStudentTarget)}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
              >
                삭제(제외) 확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 학생 복구 확인 모달 */}
      {restoreStudentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-line bg-paper-raised p-6 shadow-xl">
            <h4 className="font-bold text-ink">학생 명단 복구</h4>
            <p className="mt-2 text-sm text-ink">
              학생 <strong className="text-navy">{restoreStudentTarget.name}</strong>을(를) 정상 상태로 복원하시겠습니까?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreStudentTarget(null)}
                className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper-raised"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => handleRestoreStudent(restoreStudentTarget)}
                className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/90"
              >
                복구 확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 학생 완전 삭제 모달 */}
      {(purgeStudentTarget || purgeAllStudentsModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-rose-200 bg-paper-raised p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <Trash2 size={20} />
              </div>
              <div>
                <h4 className="font-bold text-rose-700">학생 영구 삭제</h4>
                <p className="text-xs text-rose-500">되돌릴 수 없는 영구 파기</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-ink">
              {purgeStudentTarget
                ? `학생 '${purgeStudentTarget.name}'의 모든 학적 및 연동 데이터를 영구 삭제하시겠습니까?`
                : `삭제 대기 상태인 학생 ${studentsData?.deletedCount ?? 0}명을 데이터베이스에서 완전히 삭제하시겠습니까?`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPurgeStudentTarget(null);
                  setPurgeAllStudentsModal(false);
                }}
                className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper-raised"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => handlePurgeStudents(purgeStudentTarget?.student_id)}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
              >
                완전 삭제 실행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 교원 소프트 삭제 확인 모달 */}
      {/* ==================================================================== */}
      {softDeleteTeacherTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-line bg-paper-raised p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <UserX size={20} />
              </div>
              <div>
                <h4 className="font-bold text-ink">교원 명단 제외(삭제)</h4>
                <p className="text-xs text-ink-soft">삭제 대기 상태로 전환</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-ink">
              교원 <strong className="text-navy">{softDeleteTeacherTarget.name}</strong> ({softDeleteTeacherTarget.email})을(를) 명단에서 제외하시겠습니까?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSoftDeleteTeacherTarget(null)}
                className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper-raised"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => handleSoftDeleteTeacher(softDeleteTeacherTarget)}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
              >
                삭제(제외) 확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 교원 복구 확인 모달 */}
      {restoreTeacherTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-line bg-paper-raised p-6 shadow-xl">
            <h4 className="font-bold text-ink">교원 명단 복구</h4>
            <p className="mt-2 text-sm text-ink">
              교원 <strong className="text-navy">{restoreTeacherTarget.name}</strong>을(를) 정상 상태로 복원하시겠습니까?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreTeacherTarget(null)}
                className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper-raised"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => handleRestoreTeacher(restoreTeacherTarget)}
                className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/90"
              >
                복구 확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 교원 완전 삭제 모달 */}
      {(purgeTeacherTarget || purgeAllTeachersModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-rose-200 bg-paper-raised p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <Trash2 size={20} />
              </div>
              <div>
                <h4 className="font-bold text-rose-700">교원 영구 삭제</h4>
                <p className="text-xs text-rose-500">되돌릴 수 없는 영구 파기</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-ink">
              {purgeTeacherTarget
                ? `교원 '${purgeTeacherTarget.name}'의 모든 권한 및 연동 데이터를 영구 삭제하시겠습니까?`
                : `삭제 대기 상태인 교원 ${teachersData?.deletedCount ?? 0}명을 데이터베이스에서 완전히 삭제하시겠습니까?`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPurgeTeacherTarget(null);
                  setPurgeAllTeachersModal(false);
                }}
                className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper-raised"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => handlePurgeTeachers(purgeTeacherTarget?.teachers_id)}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
              >
                완전 삭제 실행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 유저 계정 소프트 삭제/복원/완전삭제 모달 */}
      {/* ==================================================================== */}
      {softDeleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-line bg-paper-raised p-6 shadow-xl">
            <h4 className="font-bold text-ink">유저 계정 삭제</h4>
            <p className="mt-2 text-sm text-ink">
              유저 <strong className="text-navy">{softDeleteUser.name || softDeleteUser.id}</strong>을(를) 삭제 대기 상태로 전환하시겠습니까?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSoftDeleteUser(null)}
                className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper-raised"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => handleSoftDeleteUser(softDeleteUser)}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
              >
                삭제 확인
              </button>
            </div>
          </div>
        </div>
      )}

      {restoreUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-line bg-paper-raised p-6 shadow-xl">
            <h4 className="font-bold text-ink">유저 계정 복원</h4>
            <p className="mt-2 text-sm text-ink">
              유저 <strong className="text-navy">{restoreUser.name || restoreUser.id}</strong>을(를) 정상 상태로 복원하시겠습니까?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreUser(null)}
                className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper-raised"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => handleRestoreUser(restoreUser)}
                className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/90"
              >
                복원 확인
              </button>
            </div>
          </div>
        </div>
      )}

      {(singlePurgeUser || purgeAllUsersModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-rose-200 bg-paper-raised p-6 shadow-xl">
            <h4 className="font-bold text-rose-700">유저 영구 삭제</h4>
            <p className="mt-2 text-sm text-ink">
              {singlePurgeUser
                ? `유저 '${singlePurgeUser.name || singlePurgeUser.id}'을(를) 영구 삭제하시겠습니까?`
                : `삭제 대기 상태인 유저 ${usersData?.deletedCount ?? 0}명을 데이터베이스에서 완전히 삭제하시겠습니까?`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSinglePurgeUser(null);
                  setPurgeAllUsersModal(false);
                }}
                className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper-raised"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => handlePurgeUsers(singlePurgeUser?.uuid)}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
              >
                영구 삭제 실행
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
