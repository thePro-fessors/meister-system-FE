export type Role = "student" | "teacher" | "admin";

export type TeacherDuty = "homeroom" | "assistant_homeroom" | "grade_head" | "subject_teacher" | "dedicated_evaluator" | "vice_principal";
export interface TeacherScope {
  grade?: number;
  classrooms?: string[];
  areas?: AreaName[];
  itemIds?: string[];
  studentIds?: number[];
  schoolWide?: boolean;
}

export interface User {
  id: string; // 로그인 아이디. 학생/교사 DB ID와 구분한다.
  uuid?: string;
  studentId?: number;
  teacherId?: number;
  name: string;
  email?: string;
  schoolEmail?: string;
  role: Role;
  grade?: number; // 학생
  classNo?: number; // 학생
  number?: number; // 학생
  homeroom?: string; // 교사 담당 학급, 예: "1-2"
  teacherDuty?: TeacherDuty;
  teacherScope?: TeacherScope;
}

// Only the local demo data source may contain a plaintext password.
export interface DemoUser extends User {
  password: string;
}

export type LegacyAreaName =
  | "직업기초능력"
  | "전문기술역량"
  | "인성/직업의식"
  | "인문학적 소양"
  | "외국어 능력";

export type CurrentAreaName = "전공역량" | "외국어역량" | "자격취득" | "인성/봉사" | "창체/독서";
export type AreaName = CurrentAreaName | LegacyAreaName;
export const AREA_NAMES: CurrentAreaName[] = ["전공역량", "외국어역량", "자격취득", "인성/봉사", "창체/독서"];

export type ScoringType =
  | "누적합산형"
  | "최고점수반영형"
  | "고정점수형"
  | "등급환산형"
  | "구간점수형"
  | "시간계산형"
  | "감점형"
  | "가산점형"
  | "최대점제한형"
  | "최상위인정형";

export interface EvalItem {
  id: string;
  name: string; // 평가 항목, 예: 자격증
  maxScore: number;
  scoringType: ScoringType;
  active: boolean;
  requiresEvidence: boolean;
  description?: string; // 산정 방식 설명
  autoCalculated?: boolean;
}

export interface AreaCriteria {
  areaId?: number;
  area: AreaName;
  maxScore: number;
  items: EvalItem[];
}

export interface YearCriteria {
  year: number; // 학년도, 예: 2026
  active: boolean;
  gradeCriteria: {
    grade: number; // 1,2,3
    areas: AreaCriteria[];
  }[];
}

export type SubmissionStatus =
  | "제출완료"
  | "검토중"
  | "인정완료"
  | "반려"
  | "재제출요청";

export interface Submission {
  id: string;
  studentId: string;
  year: number;
  area: AreaName;
  itemId: string;
  itemName: string;
  detail: string; // 세부 항목 정보
  activityDate: string;
  fileName?: string;
  filePath?: string;
  fileUrl?: string;
  link?: string;
  description: string;
  status: SubmissionStatus;
  score?: number;
  teacherComment?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewerId?: string;
  scoreHistory?: { before?: number; after: number; reason: string; at: string }[];
  aiSuggestion?: { area: AreaName; itemName: string; confidence: number };
}

export type PointType = "상점" | "벌점";

export interface PointRecord {
  deletedAt?: string;
  deletedBy?: string;
  id: string;
  year?: number; // 학년도; 기존 기록은 발생일 기준 3월~다음 해 2월로 계산
  studentId: string;
  type: PointType;
  score: number; // 상점 +, 벌점 - 로 저장
  reason: string;
  date: string;
  teacherId: string;
  reflected: boolean;
  reflectedArea?: AreaName;
  editHistory?: { editorId: string; reason: string; at: string }[];
}

export type CertStatus = "인증 가능" | "미달성" | "검토중" | "보완 필요";

export type GradeLevel = "S" | "A" | "B" | "미달성";

export interface AreaResult {
  gradingPolicy?: "provisional";
  area: AreaName;
  score: number;
  maxScore: number;
  grade: GradeLevel;
  status: "충족" | "보완 필요";
}
