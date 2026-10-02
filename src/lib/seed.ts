import { DemoUser, PointRecord, Submission, YearCriteria } from "./types";

export const SEED_USERS: DemoUser[] = [
  {
    id: "student1",
    password: "1234",
    name: "김민준",
    role: "student",
    grade: 1,
    classNo: 2,
    number: 5,
  },
  {
    id: "student2",
    password: "1234",
    name: "이서연",
    role: "student",
    grade: 1,
    classNo: 2,
    number: 8,
  },
  {
    id: "teacher1",
    password: "1234",
    name: "박정훈",
    role: "teacher",
    homeroom: "1학년 2반",
  },
  {
    id: "admin1",
    password: "1234",
    name: "관리자",
    role: "admin",
  },
];

export const SEED_CRITERIA: YearCriteria[] = [
  {
    year: 2026,
    active: true,
    gradeCriteria: [
      {
        grade: 1,
        areas: [
          {
            area: "직업기초능력",
            maxScore: 40,
            items: [
              {
                id: "a1-1",
                name: "프로젝트 수행",
                maxScore: 20,
                scoringType: "등급환산형",
                active: true,
                requiresEvidence: true,
                description: "S=20, A=16, B=12",
              },
              {
                id: "a1-2",
                name: "협업/발표활동",
                maxScore: 20,
                scoringType: "고정점수형",
                active: true,
                requiresEvidence: true,
                description: "참여 1회당 5점, 최대 20점",
              },
            ],
          },
          {
            area: "전문기술역량",
            maxScore: 120,
            items: [
              {
                id: "a2-1",
                name: "자격증",
                maxScore: 60,
                scoringType: "고정점수형",
                active: true,
                requiresEvidence: true,
                description: "정보처리기능사 25점, 산업기사 40점 등",
              },
              {
                id: "a2-2",
                name: "대회",
                maxScore: 60,
                scoringType: "가산점형",
                active: true,
                requiresEvidence: true,
                description: "교내대회 입상 시 최대 30점 가산",
              },
            ],
          },
          {
            area: "인성/직업의식",
            maxScore: 80,
            items: [
              {
                id: "a3-1",
                name: "봉사활동",
                maxScore: 40,
                scoringType: "시간계산형",
                active: true,
                requiresEvidence: true,
                description: "봉사시간 × 0.3점",
              },
              {
                id: "a3-2",
                name: "출결/생활태도",
                maxScore: 40,
                scoringType: "감점형",
                active: true,
                requiresEvidence: false,
                description: "기본 40점에서 결석/지각 시 감점",
              },
            ],
          },
          {
            area: "인문학적 소양",
            maxScore: 80,
            items: [
              {
                id: "a4-1",
                name: "독후활동",
                maxScore: 50,
                scoringType: "최대점제한형",
                active: true,
                requiresEvidence: true,
                description: "독후감 1편당 10점, 최대 50점",
              },
              {
                id: "a4-2",
                name: "인문 소양 강좌",
                maxScore: 30,
                scoringType: "고정점수형",
                active: true,
                requiresEvidence: true,
              },
            ],
          },
          {
            area: "외국어 능력",
            maxScore: 80,
            items: [
              {
                id: "a5-1",
                name: "공인 어학 성적",
                maxScore: 80,
                scoringType: "구간점수형",
                active: true,
                requiresEvidence: true,
                description: "TOEIC 800↑=30, 700~795=25 등",
              },
            ],
          },
        ],
      },
    ],
  },
];

const today = new Date();
const iso = (d: number) => {
  const dt = new Date(today);
  dt.setDate(dt.getDate() - d);
  return dt.toISOString().slice(0, 10);
};

export const SEED_SUBMISSIONS: Submission[] = [
  {
    id: "sub-1",
    studentId: "student1",
    year: 2026,
    area: "전문기술역량",
    itemId: "a2-1",
    itemName: "자격증",
    detail: "정보처리기능사",
    activityDate: iso(20),
    fileName: "정보처리기능사_합격증.pdf",
    description: "정보처리기능사 필기·실기 합격 후 자격증을 취득했습니다.",
    status: "인정완료",
    score: 25,
    teacherComment: "자격증 사본 확인 완료. 25점 인정합니다.",
    submittedAt: iso(20),
    reviewedAt: iso(18),
    reviewerId: "teacher1",
  },
  {
    id: "sub-2",
    studentId: "student1",
    year: 2026,
    area: "인성/직업의식",
    itemId: "a3-1",
    itemName: "봉사활동",
    detail: "지역아동센터 학습멘토링 30시간",
    activityDate: iso(10),
    link: "https://1365.go.kr",
    description: "방과후 지역아동센터에서 초등학생 대상 학습 멘토링 봉사를 진행했습니다.",
    status: "검토중",
    submittedAt: iso(10),
  },
  {
    id: "sub-3",
    studentId: "student1",
    year: 2026,
    area: "인문학적 소양",
    itemId: "a4-1",
    itemName: "독후활동",
    detail: "「데미안」 독후감",
    activityDate: iso(5),
    fileName: "데미안_독후감.docx",
    description: "헤르만 헤세의 데미안을 읽고 자아 성찰에 관한 독후감을 작성했습니다.",
    status: "반려",
    teacherComment: "독후감 분량이 기준(A4 1매)에 미달합니다. 보완 후 재제출 바랍니다.",
    submittedAt: iso(5),
    reviewedAt: iso(3),
    reviewerId: "teacher1",
  },
  {
    id: "sub-4",
    studentId: "student2",
    year: 2026,
    area: "전문기술역량",
    itemId: "a2-2",
    itemName: "대회",
    detail: "교내 코딩 경진대회 대상",
    activityDate: iso(15),
    fileName: "대회_상장.jpg",
    description: "교내 코딩 경진대회에서 대상을 수상했습니다.",
    status: "인정완료",
    score: 30,
    teacherComment: "상장 확인 완료. 대상 기준 30점 인정.",
    submittedAt: iso(15),
    reviewedAt: iso(13),
    reviewerId: "teacher1",
  },
];

export const SEED_POINTS: PointRecord[] = [
  {
    id: "pt-1",
    studentId: "student1",
    type: "상점",
    score: 2,
    reason: "학급 활동 적극 참여",
    date: iso(12),
    teacherId: "teacher1",
    reflected: true,
    reflectedArea: "인성/직업의식",
  },
  {
    id: "pt-2",
    studentId: "student1",
    type: "벌점",
    score: -1,
    reason: "지각",
    date: iso(8),
    teacherId: "teacher1",
    reflected: true,
    reflectedArea: "인성/직업의식",
  },
  {
    id: "pt-3",
    studentId: "student2",
    type: "벌점",
    score: -1,
    reason: "무단결과",
    date: iso(6),
    teacherId: "teacher1",
    reflected: false,
  },
];
