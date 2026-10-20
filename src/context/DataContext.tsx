"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AreaCriteria, AreaName, EvalItem, PointRecord, ScoringType, Submission, User, YearCriteria } from "@/lib/types";
import { AuthService, createBackendAuthService } from "@/lib/auth-service";
import { apiClient } from "@/lib/api-client";
import { academicYear } from "@/lib/grading";

type ItemRow = [number, string, number, ScoringType, boolean, string];
function makeItems(rows: ItemRow[]): EvalItem[] {
  return rows.map(([id, name, maxScore, scoringType, requiresEvidence, description]) => ({
    id: `item-${id}`, name, maxScore, scoringType, requiresEvidence, description,
    active: true, ...(id === 405 ? { autoCalculated: true } : {}),
  }));
}

const DEFAULT_AREAS: AreaCriteria[] = [
  { area: "전공역량", maxScore: 25, items: makeItems([
    [101, "전공 교과 성적 우수", 10, "누적합산형", false, "전공 교과 성취도 A 또는 학기말 성적 우수자 (NEIS연동)"],
    [102, "전공 프로젝트 포트폴리오", 10, "누적합산형", true, "깃허브 레포지토리 링크 또는 소프트웨어 산출물 PDF"],
    [103, "교내 전공 경진대회 수상", 8, "최고점수반영형", true, "해커톤, 알고리즘 대회, 임베디드 경진대회 입상 (상장 사본)"],
    [104, "대외 전공 경진대회 입상", 10, "최고점수반영형", true, "전국 기능경기대회, 정부/공공기관 주최 IT 공모전 수상 (상장 사본)"],
    [105, "전공 동아리 우수 활동", 5, "고정점수형", true, "전공심화동아리 80% 이상 출석 및 결과물 발표 (활동일지)"],
    [106, "산학협력 프로젝트 참여", 8, "누적합산형", true, "기업 연계 산학맞춤 멘토링 및 실무 프로젝트 완수 (수행확인서)"],
    [107, "오픈소스 기여 (Pull Request)", 5, "누적합산형", true, "공개 오픈소스 저장소 PR 머지 또는 기술 아티클 기고 (PR 링크)"],
  ]) },
  { area: "외국어역량", maxScore: 20, items: makeItems([
    [201, "TOEIC 성적 우수 (700점 이상)", 15, "최고점수반영형", true, "공인 토익 700점 이상(15점), 600점 이상(10점) (성적표 사본)"],
    [202, "TOEIC Bridge 우수 (140점 이상)", 10, "최고점수반영형", true, "토익 브릿지 140점 이상 달성 시 취득 (성적표 사본)"],
    [203, "교내 영어 말하기/어휘 대회", 8, "최고점수반영형", true, "교내 실무 영어 프레젠테이션 및 보카 경시대회 입상 (상장 사본)"],
    [204, "방과후 실무영어 성실 이수", 5, "고정점수형", true, "영어 방과후 학교 프로그램 80% 이상 출석 및 수료 (이수증)"],
    [205, "원어 기술 문서 번역/작성", 5, "누적합산형", true, "영문 오픈소스 공식 문서 번역 및 기술 블로그 포스팅 (번역문/원본)"],
    [206, "제2외국어 기초 회화 이수", 5, "고정점수형", false, "일본어/중국어 등 기초 외국어 과정 수료 (확인서 선택)"],
  ]) },
  { area: "자격취득", maxScore: 20, items: makeItems([
    [301, "정보처리기능사 취득", 10, "고정점수형", true, "한국산업인력공단 국가기술자격증 정보처리기능사 (자격증 사본)"],
    [302, "정보보안기능사 / 네트워크관리사", 10, "고정점수형", true, "네트워크관리사 2급 또는 정보보안 분야 공인 자격증 (자격증 사본)"],
    [303, "SQLD / 리눅스마스터", 8, "고정점수형", true, "SQL 개발자(SQLD) 또는 리눅스마스터 2급 이상 (자격증 사본)"],
    [304, "AWS / 클라우드 국제공인자격", 10, "최고점수반영형", true, "AWS Certified Cloud Practitioner, SAA, GCP, Azure 등 (디지털 배지/자격증)"],
    [305, "컴퓨터활용능력 / 사무자격", 5, "최고점수반영형", true, "컴퓨터활용능력 1급/2급, MOS Master 등 (자격증 사본)"],
    [306, "기타 공인 기술 자격증", 5, "누적합산형", true, "교과협의회에서 인정한 전공 유관 IT 공인 자격증 (자격증 사본)"],
  ]) },
  { area: "인성/봉사", maxScore: 20, items: makeItems([
    [401, "교내외 봉사활동 시간 (40시간 이상)", 10, "누적합산형", true, "1365 또는 VMS 공인 봉사활동 시간 누적 증빙"],
    [402, "학급 임원 및 학생회 간부 활동", 8, "고정점수형", false, "반장, 부반장, 학생회 부서장 활동 성실 수행 (생활기록부 선택)"],
    [403, "교내 선행 / 효행 / 모범 표창", 8, "누적합산형", true, "교내외 모범 학생 표창 및 선행상 수상 (표창장)"],
    [404, "학교폭력 예방 및 또래상담 활동", 5, "고정점수형", true, "또래상담부 수료 및 캠페인 참여 (활동확인서)"],
    [405, "상벌점 순상점 우수 (상점-벌점 >= 10)", 5, "고정점수형", false, "시스템 내 누적 순상점이 10점 이상인 경우 자동 가산"],
    [406, "환경 정화 및 멘토링 봉사", 5, "누적합산형", true, "후배 전공 지도 멘토링 또는 지역사회 환경정화 (활동보고서)"],
    [407, "교내 행사 질서/안전 도우미", 5, "누적합산형", false, "입학설명회, 축제, 체육대회 운영요원 성실 참여 (교사확인서 선택)"],
  ]) },
  { area: "창체/독서", maxScore: 15, items: makeItems([
    [501, "전공/인문 독서 활동 (10권 이상)", 8, "누적합산형", true, "독서교육종합지원시스템 등록 또는 서평 보고서 (독후감/서평)"],
    [502, "인문학 고전 읽기 프로그램", 5, "고정점수형", true, "학교 권장 인문 고전 도서 완독 및 토론 참여 (활동기록)"],
    [503, "전공 기술 세미나 발표", 5, "누적합산형", true, "교내 테크톡 또는 전공 세미나 발표자 참여 (발표자료 PDF)"],
    [504, "교내 1인 1기 문화예술 이수", 4, "고정점수형", false, "악기, 체육, 미술 등 1인 1기 프로그램 80% 이상 참여 (출석부)"],
    [505, "자율 동아리 주도 활동", 5, "누적합산형", true, "SW 개발/알고리즘 연구 자율동아리 개설 및 산출물 보고서"],
    [506, "교내 동아리 축제 부스 운영", 4, "고정점수형", false, "동아리 발표회 체험 부스 기획 및 운영 요원 (지도교사 확인)"],
    [507, "진로/취업 포트폴리오 경진", 5, "최고점수반영형", true, "교내 취업역량강화 이력서/포트폴리오 경진대회 입상 (상장)"],
  ]) },
];

const CURRENT_ACADEMIC_YEAR = academicYear(new Date().toISOString().slice(0, 10));

const DEFAULT_CRITERIA: YearCriteria[] = [
  {
    year: CURRENT_ACADEMIC_YEAR,
    active: true,
    gradeCriteria: [1, 2, 3].map((grade) => ({ grade, areas: DEFAULT_AREAS })),
  },
];

interface DataContextValue {
  users: User[];
  criteria: YearCriteria[];
  submissions: Submission[];
  points: PointRecord[];
  authService: AuthService;
  loading: boolean;
  refresh: () => Promise<void>;
  registerStudent: (input: { id: string; password: string; name?: string; grade?: number; classNo?: number; number?: number }) => void;
  registerTeacher: (input: { id: string; password: string; name?: string; invitationCode?: string }) => Promise<void>;
  addSubmission: (s: any) => Promise<any>;
  updateSubmission: (id: string, patch: Partial<Submission>) => Promise<any>;
  deleteSubmission: (id: string, studentId: string) => Promise<any>;
  deletePoint: (id: string, actorId: string) => Promise<any>;
  addPoint: (p: any) => Promise<any>;
  updatePoint: (id: string, patch: Partial<PointRecord>, editorId: string, reason: string) => Promise<any>;
  updateCriteria: (criteria: YearCriteria[]) => void;
  resetToSeed: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

function mapSubmissionFromBackend(item: any, userIdByStudentId?: Map<number, string>): Submission {
  const rawSid = Number(item.studentId ?? item.student_id);
  const mappedUserId =
    item.userId ??
    item.user_id ??
    (Number.isFinite(rawSid) && rawSid > 0 ? userIdByStudentId?.get(rawSid) : undefined);
  return {
    id: String(item.id ?? item.submissionId ?? item.submission_id),
    studentId: String(mappedUserId ?? item.studentId ?? item.student_id ?? ""),
    rawStudentId: Number.isFinite(rawSid) && rawSid > 0 ? rawSid : undefined,
    studentName: item.studentName ?? item.student_name,
    year: Number(item.year ?? CURRENT_ACADEMIC_YEAR),
    area: (item.area ?? item.areaName ?? item.area_name ?? "전공역량") as AreaName,
    itemId: String(item.itemId ?? item.item_id),
    itemName: item.itemName ?? item.item_name ?? "",
    maxScore: item.maxScore != null ? Number(item.maxScore) : undefined,
    detail: item.detail || "",
    activityDate: item.activityDate ? String(item.activityDate).slice(0, 10) : (item.activity_date ? String(item.activity_date).slice(0, 10) : ""),
    fileName: item.originalFilename ?? item.fileName ?? (item.filePath ? item.filePath.split("/").pop() : undefined),
    filePath: item.filePath ?? item.fileUrl,
    fileUrl: item.fileUrl ?? item.filePath,
    link: item.linkUrl ?? item.link,
    description: item.description || "",
    status: item.status || "제출완료",
    score: (item.score ?? item.grantedScore ?? item.granted_score) != null ? Number(item.score ?? item.grantedScore ?? item.granted_score) : undefined,
    teacherComment: item.teacherComment ?? item.teacher_comment,
    submittedAt: (item.submittedAt ?? item.createdAt ?? item.created_at) ? String(item.submittedAt ?? item.createdAt ?? item.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
    reviewedAt: item.reviewedAt ? String(item.reviewedAt).slice(0, 10) : undefined,
    reviewerId: item.reviewerId ? String(item.reviewerId) : undefined,
  };
}

function mapPointFromBackend(p: any, userIdByStudentId?: Map<number, string>): PointRecord {
  const rawSid = Number(p.studentId ?? p.student_id);
  const mappedUserId =
    p.userId ??
    p.user_id ??
    (Number.isFinite(rawSid) && rawSid > 0 ? userIdByStudentId?.get(rawSid) : undefined);
  return {
    id: String(p.id ?? p.pointId ?? p.merits_point_id),
    studentId: String(mappedUserId ?? p.studentId ?? p.student_id ?? ""),
    rawStudentId: Number.isFinite(rawSid) && rawSid > 0 ? rawSid : undefined,
    studentName: p.studentName ?? p.name,
    type: p.type === "MERIT" || p.type === "+" ? "상점" : p.type === "DEMERIT" || p.type === "-" ? "벌점" : (p.type || (Number(p.score ?? p.points) < 0 ? "벌점" : "상점")),
    score: Number(p.score ?? p.points ?? 0),
    reason: p.reason || "",
    date: (p.occurredAt ?? p.occurred_at ?? p.date) ? String(p.occurredAt ?? p.occurred_at ?? p.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
    teacherId: String(p.teacherId ?? p.teachers_id ?? ""),
    teacherName: p.teacherName ?? p.teacher_name,
    reflected: Boolean(p.reflected ?? p.is_reflected),
    reflectedArea: p.reflectedArea ?? p.related_area ?? p.relatedArea,
    deletedAt: p.deletedAt ?? p.deleted_at,
  };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const authService = useMemo(() => createBackendAuthService(), []);
  const [criteria, setCriteria] = useState<YearCriteria[]>(DEFAULT_CRITERIA);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [points, setPoints] = useState<PointRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("meister_access_token") : null;
      if (!token) return;

      const me = await authService.restore().catch(() => null);
      const userIdByStudentId = new Map<number, string>();
      if (me?.studentId) {
        userIdByStudentId.set(me.studentId, me.id);
      }

      // 1. 학년도 및 기준 조회
      try {
        const critRes = await apiClient.request<{ year?: number; areas?: any[] }>("/api/criteria", { method: "GET" });
        if (critRes?.areas && Array.isArray(critRes.areas)) {
          const yr = critRes.year || 2026;
          const areasByGrade: Record<number, AreaCriteria[]> = { 1: [], 2: [], 3: [] };
          critRes.areas.forEach((a: any) => {
            const gr = a.grade || 1;
            const areaItem: AreaCriteria = {
              areaId: a.areaId ?? a.area_id,
              area: a.name as AreaName,
              maxScore: a.maxScore || 20,
              items: (a.items || []).map((it: any) => ({
                id: String(it.itemId ?? it.item_id),
                name: it.name,
                maxScore: it.maxScore || 10,
                scoringType: (it.scoringTypeName || it.scoringType || "고정점수형") as ScoringType,
                active: it.isActive !== false,
                requiresEvidence: Boolean(it.requiresEvidence),
                description: it.subject || it.department || "",
              })),
            };
            if (areasByGrade[gr]) areasByGrade[gr].push(areaItem);
          });
          const mappedCriteria: YearCriteria = {
            year: yr,
            active: true,
            gradeCriteria: [1, 2, 3].map((g) => ({
              grade: g,
              areas: areasByGrade[g].length > 0 ? areasByGrade[g] : DEFAULT_AREAS,
            })),
          };
          setCriteria([mappedCriteria]);
        }
      } catch {
        // Fallback to default criteria
      }

      if (!me || me.role === "student") {
        // 학생 권한: 본인 제출 내역 및 상벌점 내역만 조회 (교사 API 호출 차단하여 403 방지)
        try {
          const subsRes = await apiClient.request<any[]>("/api/submissions", { method: "GET" });
          if (Array.isArray(subsRes)) {
            setSubmissions(subsRes.map((item) => mapSubmissionFromBackend(item, userIdByStudentId)));
          }
        } catch {
          // Keep existing
        }

        try {
          const ptsRes = await apiClient.request<any[]>("/api/points", { method: "GET" });
          if (Array.isArray(ptsRes)) {
            setPoints(ptsRes.map((p) => mapPointFromBackend(p, userIdByStudentId)));
          }
        } catch {
          // Keep existing
        }
      } else {
        // 교사/관리자 권한: 담당 학생 목록 조회 후 필요한 제출물 및 상벌점 조회 (파라미터 없는 400 호출 방지)
        try {
          const studentsRes = await apiClient.request<any[]>("/api/teacher/students", { method: "GET" });
          if (Array.isArray(studentsRes)) {
            const mappedUsers: User[] = studentsRes.map((st: any) => {
              const sid = Number(st.studentId ?? st.id);
              const uid = String(st.userId ?? st.user_id ?? st.studentId ?? st.id);
              if (Number.isFinite(sid) && sid > 0) {
                userIdByStudentId.set(sid, uid);
              }
              return {
                id: uid,
                studentId: Number.isFinite(sid) ? sid : undefined,
                name: st.name,
                role: "student",
                grade: st.grade,
                classNo: st.classNo ?? st.class_no,
                number: st.number ?? st.studentNo ?? st.student_number,
                homeroom: st.homeroom,
                totalScore: st.totalScore != null ? Number(st.totalScore) : undefined,
                certStatus: st.certStatus as any,
                pendingCount: st.pendingCount != null ? Number(st.pendingCount) : undefined,
                pointTotal: st.pointTotal != null ? Number(st.pointTotal) : undefined,
              };
            });
            setUsers(mappedUsers);

            // 제출물이 있거나 대기 건수가 있는 학생들의 제출 내역 병렬 로드
            const activeSubStudents = mappedUsers.filter(
              (u) => u.studentId && ((u.totalScore ?? 0) > 0 || (u.pendingCount ?? 0) > 0 || u.studentId === 1)
            );
            const subLists = await Promise.all(
              activeSubStudents.map((u) =>
                apiClient
                  .request<any[]>("/api/submissions", { method: "GET", query: { studentId: u.studentId } })
                  .catch(() => [])
              )
            );
            setSubmissions(subLists.flat().map((item) => mapSubmissionFromBackend(item, userIdByStudentId)));

            // 상벌점이 있는 학생 목록 조회 후 상벌점 내역 병렬 로드
            const pointStudentsRes = await apiClient
              .request<any[]>("/api/teacher/students", { method: "GET", query: { hasPoints: "true" } })
              .catch(() => []);
            const pointStudentIds = new Set<number>(
              [
                ...(Array.isArray(pointStudentsRes) ? pointStudentsRes.map((s: any) => Number(s.studentId ?? s.id)) : []),
                ...mappedUsers.filter((u) => (u.pointTotal ?? 0) !== 0).map((u) => Number(u.studentId)),
              ].filter((n) => Number.isFinite(n) && n > 0)
            );
            const ptLists = await Promise.all(
              [...pointStudentIds].map((sid) =>
                apiClient
                  .request<any[]>("/api/points", { method: "GET", query: { studentId: sid } })
                  .catch(() => [])
              )
            );
            setPoints(ptLists.flat().map((p) => mapPointFromBackend(p, userIdByStudentId)));
          }
        } catch {
          // Not a teacher or error
        }
      }
    } catch {
      // General refresh catch
    } finally {
      setLoading(false);
    }
  }, [authService]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addSubmission = useCallback(async (s: any) => {
    let body: FormData | any;
    if (typeof FormData !== "undefined" && s instanceof FormData) {
      body = s;
    } else {
      const formData = new FormData();
      const rawItemId = String(s.itemId || s.item_id || "").replace(/^item-/, "");
      formData.append("item_id", rawItemId);
      formData.append("detail", (s.detail || "").trim());
      formData.append("activity_date", s.activityDate || s.activity_date || new Date().toISOString().slice(0, 10));
      formData.append("description", (s.description || "").trim());
      if (s.link || s.linkUrl) formData.append("link_url", (s.link || s.linkUrl).trim());
      if (s.file) formData.append("file", s.file);
      body = formData;
    }
    const result = await apiClient.request("/api/submissions", {
      method: "POST",
      body,
    });
    await refresh();
    return result;
  }, [refresh]);

  const updateSubmission = useCallback(async (id: string, patch: Partial<Submission> & { file?: File }) => {
    const numericId = Number(id.replace(/^sub-/, ""));
    const targetId = Number.isFinite(numericId) && numericId > 0 ? numericId : id;
    const currentSub = submissions.find((s) => String(s.id) === String(id));
    const isAlreadyApproved = currentSub?.status === "인정완료";

    if (isAlreadyApproved && patch.score !== undefined) {
      await apiClient.request(`/api/submissions/${targetId}/score`, {
        method: "PATCH",
        body: {
          score: patch.score,
          reason: patch.teacherComment || "인정 점수 수정",
        },
      });
    } else if (patch.status === "인정완료") {
      await apiClient.request(`/api/submissions/${targetId}/approve`, {
        method: "PATCH",
        body: {
          score: patch.score,
          comment: patch.teacherComment || "승인",
        },
      });
    } else if (patch.status === "반려" || patch.status === "재제출요청") {
      await apiClient.request(`/api/submissions/${targetId}/reject`, {
        method: "PATCH",
        body: {
          comment: patch.teacherComment || (patch.status === "반려" ? "반려" : "재제출 요청"),
          statusCode: patch.status === "반려" ? 4 : 5,
        },
      });
    } else if (patch.score !== undefined) {
      await apiClient.request(`/api/submissions/${targetId}/score`, {
        method: "PATCH",
        body: {
          score: patch.score,
          reason: patch.teacherComment || "점수 수정",
        },
      });
    } else {
      // Student resubmit
      let body: FormData | any;
      if (patch.file) {
        const formData = new FormData();
        if (patch.detail) formData.append("detail", patch.detail);
        if (patch.activityDate) formData.append("activity_date", patch.activityDate);
        if (patch.description) formData.append("description", patch.description);
        if (patch.link) formData.append("link_url", patch.link);
        formData.append("file", patch.file);
        body = formData;
      } else {
        body = {
          detail: patch.detail,
          activity_date: patch.activityDate,
          description: patch.description,
          link_url: patch.link,
        };
      }
      await apiClient.request(`/api/submissions/${targetId}/resubmit`, {
        method: "PATCH",
        body,
      });
    }
    await refresh();
  }, [refresh, submissions]);

  const deleteSubmission = useCallback(async (id: string) => {
    const numericId = Number(id.replace(/^sub-/, ""));
    const targetId = Number.isFinite(numericId) && numericId > 0 ? numericId : id;
    await apiClient.request(`/api/submissions/${targetId}`, {
      method: "DELETE",
    });
    await refresh();
  }, [refresh]);

  const addPoint = useCallback(async (p: any) => {
    const matchedUser = users.find((u) => u.id === p.studentId || String(u.studentId) === String(p.studentId));
    const targetStudentId = matchedUser?.studentId ?? (Number.isFinite(Number(p.studentId)) ? Number(p.studentId) : p.studentId);
    const scoreVal = Number(p.score);
    const isDemerit = p.type === "벌점" || scoreVal < 0;
    await apiClient.request("/api/points", {
      method: "POST",
      body: {
        studentId: targetStudentId,
        type: isDemerit ? "벌점" : "상점",
        score: isDemerit ? -Math.abs(scoreVal) : Math.abs(scoreVal),
        reason: p.reason,
        occurredAt: p.date || p.occurredAt || new Date().toISOString().slice(0, 10),
        relatedArea: p.reflectedArea || p.relatedArea,
      },
    });
    await refresh();
  }, [refresh, users]);

  const updatePoint = useCallback(async (id: string, patch: Partial<PointRecord>, editorId: string, reason: string) => {
    const numericId = Number(id.replace(/^pt-/, ""));
    const targetId = Number.isFinite(numericId) && numericId > 0 ? numericId : id;
    await apiClient.request(`/api/points/${targetId}`, {
      method: "PATCH",
      body: {
        score: patch.score,
        reason,
      },
    });
    await refresh();
  }, [refresh]);

  const deletePoint = useCallback(async (id: string) => {
    const numericId = Number(id.replace(/^pt-/, ""));
    const targetId = Number.isFinite(numericId) && numericId > 0 ? numericId : id;
    await apiClient.request(`/api/points/${targetId}`, {
      method: "DELETE",
    });
    await refresh();
  }, [refresh]);

  const updateCriteria = useCallback((newCrit: YearCriteria[]) => {
    setCriteria(newCrit);
  }, []);

  const value = useMemo<DataContextValue>(() => ({
    users,
    criteria,
    submissions,
    points: points.filter((p) => !p.deletedAt),
    authService,
    loading,
    refresh,
    registerStudent: async () => {},
    registerTeacher: async () => {},
    addSubmission,
    updateSubmission,
    deleteSubmission,
    addPoint,
    updatePoint,
    deletePoint,
    updateCriteria,
    resetToSeed: () => {},
  }), [users, criteria, submissions, points, authService, loading, refresh, addSubmission, updateSubmission, deleteSubmission, addPoint, updatePoint, deletePoint, updateCriteria]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
