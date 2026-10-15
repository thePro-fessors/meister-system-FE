import { AreaCriteria, DemoUser, EvalItem, PointRecord, ScoringType, Submission, YearCriteria } from "./types";

export const SEED_USERS: DemoUser[] = [
  ...Array.from({ length: 16 }, (_, index): DemoUser => ({
    id: `student${index + 1}`, studentId: index + 1, password: "password123!",
    name: index === 0 ? "김민준" : index === 1 ? "이서연" : `학생${index + 1}`,
    role: "student", grade: 1, classNo: index < 8 ? 1 : 2, number: index % 8 + 1,
  })),
  { id: "teacher1", teacherId: 1, password: "password123!", name: "1-1 담임교사", role: "teacher", homeroom: "1-1", teacherDuty: "homeroom", teacherScope: { grade: 1, classrooms: ["1-1"] } },
  { id: "teacher2", teacherId: 2, password: "password123!", name: "1-2 담임교사", role: "teacher", homeroom: "1-2", teacherDuty: "homeroom", teacherScope: { grade: 1, classrooms: ["1-2"] } },
  { id: "head1", teacherId: 3, password: "password123!", name: "1학년 부장교사", role: "teacher", teacherDuty: "grade_head", teacherScope: { grade: 1 } },
  { id: "vp", teacherId: 4, password: "password123!", name: "교감", role: "teacher", teacherDuty: "vice_principal", teacherScope: { schoolWide: true } },
  { id: "admin", password: "admin1234!", name: "관리자", role: "admin" },
];

type ItemRow = [number, string, number, ScoringType, boolean, string];
function items(rows: ItemRow[]): EvalItem[] {
  return rows.map(([id, name, maxScore, scoringType, requiresEvidence, description]) => ({
    id: `item-${id}`, name, maxScore, scoringType, requiresEvidence, description,
    active: true, ...(id === 405 ? { autoCalculated: true } : {}),
  }));
}

const areas: AreaCriteria[] = [
  { area: "전공역량", maxScore: 25, items: items([
    [101, "전공 교과 성적 우수", 10, "누적합산형", false, "전공 교과 성취도 A 또는 학기말 성적 우수자 (NEIS연동)"],
    [102, "전공 프로젝트 포트폴리오", 10, "누적합산형", true, "깃허브 레포지토리 링크 또는 소프트웨어 산출물 PDF"],
    [103, "교내 전공 경진대회 수상", 8, "최고점수반영형", true, "해커톤, 알고리즘 대회, 임베디드 경진대회 입상 (상장 사본)"],
    [104, "대외 전공 경진대회 입상", 10, "최고점수반영형", true, "전국 기능경기대회, 정부/공공기관 주최 IT 공모전 수상 (상장 사본)"],
    [105, "전공 동아리 우수 활동", 5, "고정점수형", true, "전공심화동아리 80% 이상 출석 및 결과물 발표 (활동일지)"],
    [106, "산학협력 프로젝트 참여", 8, "누적합산형", true, "기업 연계 산학맞춤 멘토링 및 실무 프로젝트 완수 (수행확인서)"],
    [107, "오픈소스 기여 (Pull Request)", 5, "누적합산형", true, "공개 오픈소스 저장소 PR 머지 또는 기술 아티클 기고 (PR 링크)"],
  ]) },
  { area: "외국어역량", maxScore: 20, items: items([
    [201, "TOEIC 성적 우수 (700점 이상)", 15, "최고점수반영형", true, "공인 토익 700점 이상(15점), 600점 이상(10점) (성적표 사본)"],
    [202, "TOEIC Bridge 우수 (140점 이상)", 10, "최고점수반영형", true, "토익 브릿지 140점 이상 달성 시 취득 (성적표 사본)"],
    [203, "교내 영어 말하기/어휘 대회", 8, "최고점수반영형", true, "교내 실무 영어 프레젠테이션 및 보카 경시대회 입상 (상장 사본)"],
    [204, "방과후 실무영어 성실 이수", 5, "고정점수형", true, "영어 방과후 학교 프로그램 80% 이상 출석 및 수료 (이수증)"],
    [205, "원어 기술 문서 번역/작성", 5, "누적합산형", true, "영문 오픈소스 공식 문서 번역 및 기술 블로그 포스팅 (번역문/원본)"],
    [206, "제2외국어 기초 회화 이수", 5, "고정점수형", false, "일본어/중국어 등 기초 외국어 과정 수료 (확인서 선택)"],
  ]) },
  { area: "자격취득", maxScore: 20, items: items([
    [301, "정보처리기능사 취득", 10, "고정점수형", true, "한국산업인력공단 국가기술자격증 정보처리기능사 (자격증 사본)"],
    [302, "정보보안기능사 / 네트워크관리사", 10, "고정점수형", true, "네트워크관리사 2급 또는 정보보안 분야 공인 자격증 (자격증 사본)"],
    [303, "SQLD / 리눅스마스터", 8, "고정점수형", true, "SQL 개발자(SQLD) 또는 리눅스마스터 2급 이상 (자격증 사본)"],
    [304, "AWS / 클라우드 국제공인자격", 10, "최고점수반영형", true, "AWS Certified Cloud Practitioner, SAA, GCP, Azure 등 (디지털 배지/자격증)"],
    [305, "컴퓨터활용능력 / 사무자격", 5, "최고점수반영형", true, "컴퓨터활용능력 1급/2급, MOS Master 등 (자격증 사본)"],
    [306, "기타 공인 기술 자격증", 5, "누적합산형", true, "교과협의회에서 인정한 전공 유관 IT 공인 자격증 (자격증 사본)"],
  ]) },
  { area: "인성/봉사", maxScore: 20, items: items([
    [401, "교내외 봉사활동 시간 (40시간 이상)", 10, "누적합산형", true, "1365 또는 VMS 공인 봉사활동 시간 누적 증빙"],
    [402, "학급 임원 및 학생회 간부 활동", 8, "고정점수형", false, "반장, 부반장, 학생회 부서장 활동 성실 수행 (생활기록부 선택)"],
    [403, "교내 선행 / 효행 / 모범 표창", 8, "누적합산형", true, "교내외 모범 학생 표창 및 선행상 수상 (표창장)"],
    [404, "학교폭력 예방 및 또래상담 활동", 5, "고정점수형", true, "또래상담부 수료 및 캠페인 참여 (활동확인서)"],
    [405, "상벌점 순상점 우수 (상점-벌점 >= 10)", 5, "고정점수형", false, "시스템 내 누적 순상점이 10점 이상인 경우 자동 가산"],
    [406, "환경 정화 및 멘토링 봉사", 5, "누적합산형", true, "후배 전공 지도 멘토링 또는 지역사회 환경정화 (활동보고서)"],
    [407, "교내 행사 질서/안전 도우미", 5, "누적합산형", false, "입학설명회, 축제, 체육대회 운영요원 성실 참여 (교사확인서 선택)"],
  ]) },
  { area: "창체/독서", maxScore: 15, items: items([
    [501, "전공/인문 독서 활동 (10권 이상)", 8, "누적합산형", true, "독서교육종합지원시스템 등록 또는 서평 보고서 (독후감/서평)"],
    [502, "인문학 소양 아카데미 수료", 5, "고정점수형", true, "교내 인문학 특강 및 교양 프로그램 80% 수강 (이수증)"],
    [503, "창의적 체험활동 우수 산출물", 5, "누적합산형", true, "자율/진로활동 탐구보고서 발표 및 우수작 선정 (산출물 링크/파일)"],
    [504, "동아리 축제 부스 운영", 5, "고정점수형", true, "교내 마이스터제 축제 전공/취미 동아리 부스 주도 (활동사진/보고서)"],
    [505, "진로 탐색 및 기업 탐방 참여", 5, "누적합산형", true, "산업체 현장견학 및 IT 기업 멘토링 참여 보고서 (소감문)"],
    [506, "문화예술 / 체육활동 참가", 5, "누적합산형", false, "교내외 예술 동아리 발표 또는 스포츠 클럽 대회 참가 (참가증빙 선택)"],
    [507, "자기주도학습 플래너 우수자", 4, "고정점수형", false, "학기별 자기주도 학습 플래너 작성 성실 이수자 (플래너 검사 선택)"],
  ]) },
];

export const SEED_CRITERIA: YearCriteria[] = [{
  year: 2026, active: true,
  gradeCriteria: [1, 2, 3].map((grade) => ({ grade, areas: areas.map((area) => ({
    ...area, items: area.items.map((item) => ({ ...item })),
  })) })),
}];

export const SEED_SUBMISSIONS: Submission[] = [
  { id: "sub-1", studentId: "student1", year: 2026, area: "자격취득", itemId: "item-301", itemName: "정보처리기능사 취득", detail: "정보처리기능사", activityDate: "2026-09-01", fileName: "정보처리기능사_합격증.pdf", description: "정보처리기능사 자격증을 취득했습니다.", status: "인정완료", score: 10, teacherComment: "자격증 사본 확인 완료. 10점 인정합니다.", submittedAt: "2026-09-01", reviewedAt: "2026-09-02", reviewerId: "teacher1" },
  { id: "sub-2", studentId: "student1", year: 2026, area: "인성/봉사", itemId: "item-401", itemName: "교내외 봉사활동 시간 (40시간 이상)", detail: "지역아동센터 학습멘토링 40시간", activityDate: "2026-09-10", link: "https://1365.go.kr", description: "학습 멘토링 봉사 40시간 증빙입니다.", status: "검토중", submittedAt: "2026-09-10" },
  { id: "sub-3", studentId: "student1", year: 2026, area: "창체/독서", itemId: "item-501", itemName: "전공/인문 독서 활동 (10권 이상)", detail: "데미안 독후감", activityDate: "2026-09-15", fileName: "데미안_독후감.docx", description: "데미안 독후감입니다.", status: "반려", teacherComment: "10권 이상 독서 활동 증빙을 보완해 주세요.", submittedAt: "2026-09-15", reviewedAt: "2026-09-16", reviewerId: "teacher1" },
  { id: "sub-4", studentId: "student2", year: 2026, area: "전공역량", itemId: "item-103", itemName: "교내 전공 경진대회 수상", detail: "교내 코딩 경진대회 대상", activityDate: "2026-09-05", fileName: "대회_상장.jpg", description: "교내 코딩 경진대회 수상입니다.", status: "인정완료", score: 8, teacherComment: "상장 확인 완료. 8점 인정합니다.", submittedAt: "2026-09-05", reviewedAt: "2026-09-06", reviewerId: "teacher1" },
];

export const SEED_POINTS: PointRecord[] = [
  { id: "pt-1", year: 2026, studentId: "student1", type: "상점", score: 11, reason: "학급 활동 적극 참여", date: "2026-09-10", teacherId: "teacher1", reflected: true, reflectedArea: "인성/봉사" },
  { id: "pt-2", year: 2026, studentId: "student1", type: "벌점", score: -1, reason: "지각", date: "2026-09-12", teacherId: "teacher1", reflected: true, reflectedArea: "인성/봉사" },
  { id: "pt-3", year: 2026, studentId: "student2", type: "벌점", score: -1, reason: "무단결과", date: "2026-09-14", teacherId: "teacher1", reflected: false },
];
