import { AreaName, AreaResult, CertStatus, PointRecord, Submission, YearCriteria } from "./types";

export function academicYear(date: string): number {
  const [year, month] = date.split("-").map(Number);
  return month >= 3 ? year : year - 1;
}

export function isUnderReview(submission: Submission): boolean {
  return ["제출완료", "검토중", "재제출요청"].includes(submission.status);
}

export const PROVISIONAL_GRADING_NOTICE = "영역별 취득 점수 및 배점 기준에 따라 실시간 인증 현황을 산출합니다.";

/** Compatibility-only demo thresholds, not official certification rules. */
export function gradeFromRatio(ratio: number): "S" | "A" | "B" | "미달성" {
  if (ratio >= 0.9) return "S";
  if (ratio >= 0.8) return "A";
  if (ratio >= 0.7) return "B";
  return "미달성";
}

export function netPointsForYear(studentId: string, year: number, points: PointRecord[]): number {
  return points
    .filter((p) => p.studentId === studentId && !p.deletedAt && (p.year ?? academicYear(p.date)) === year)
    .reduce((sum, p) => sum + (Number.isFinite(p.score) ? (p.type === "벌점" ? -Math.abs(p.score) : Math.abs(p.score)) : 0), 0);
}

/** Approved item scores are capped before applying the area cap. */
export function computeAreaResults(
  studentId: string,
  year: number,
  grade: number,
  criteria: YearCriteria | undefined,
  submissions: Submission[],
  points: PointRecord[]
): AreaResult[] {
  const gradeCriteria = criteria?.gradeCriteria.find((g) => g.grade === grade);
  if (!gradeCriteria || criteria?.year !== year) return [];
  const netPoints = netPointsForYear(studentId, year, points);

  return gradeCriteria.areas.map((areaCrit) => {
    const approved = submissions.filter(
      (s) =>
        s.studentId === studentId &&
        s.year === year &&
        s.area === areaCrit.area &&
        s.status === "인정완료"
    );
    const submittedScore = areaCrit.items.reduce((sum, item) => {
      if (item.autoCalculated) {
        return sum + (netPoints >= 10 ? Math.min(5, Math.max(0, item.maxScore)) : 0);
      }
      const scores = approved.filter((s) => s.itemId === item.id)
        .map((s) => Number.isFinite(s.score) ? Math.max(0, s.score!) : 0);
      const score = ["최상위인정형", "최고점수반영형", "고정점수형"].includes(item.scoringType)
        ? Math.max(0, ...scores)
        : scores.reduce((total, value) => total + value, 0);
      return sum + Math.min(score, Math.max(0, item.maxScore));
    }, 0);

    const total = Math.max(0, Math.min(submittedScore, areaCrit.maxScore));

    const ratio = areaCrit.maxScore > 0 ? total / areaCrit.maxScore : 0;
    const grade_ = gradeFromRatio(ratio);

    return {
      gradingPolicy: "provisional",
      area: areaCrit.area,
      score: Math.round(total * 10) / 10,
      maxScore: areaCrit.maxScore,
      grade: grade_,
      status: grade_ === "미달성" ? "보완 필요" : "충족",
    };
  });
}

/** Provisional legacy demo policy; the CSV does not define certification thresholds. */
export function computeCertStatus(
  results: AreaResult[],
  hasUnderReview: boolean
): CertStatus {
  if (results.length === 0) return "검토중";
  const allAOrAbove = results.every((r) => r.grade === "S" || r.grade === "A");
  if (allAOrAbove) return "인증 가능";
  const anyClose = results.some((r) => r.grade === "미달성" && r.score / r.maxScore >= 0.5);
  if (hasUnderReview) return "검토중";
  if (anyClose) return "보완 필요";
  return "미달성";
}

export const areaKeywordMap: Record<AreaName, string[]> = {
  "전공역량": ["프로젝트", "포트폴리오", "깃허브", "github", "해커톤", "알고리즘", "경진대회", "산학", "오픈소스", "pull request", "전공"],
  "외국어역량": ["토익", "toeic", "영어", "어휘", "번역", "외국어", "회화", "브릿지"],
  "자격취득": ["자격증", "기능사", "네트워크관리사", "sqld", "리눅스마스터", "aws", "클라우드", "컴퓨터활용능력", "mos"],
  "인성/봉사": ["봉사", "vms", "1365", "임원", "학생회", "선행", "표창", "또래상담", "멘토링 봉사", "안전 도우미"],
  "창체/독서": ["독서", "독후", "서평", "인문", "창의적", "축제", "기업 탐방", "진로", "체육", "플래너"],
  "직업기초능력": ["의사소통", "문제해결", "협업", "발표", "보고서", "프로젝트 수행", "팀플"],
  "전문기술역량": ["자격증", "산업기사", "기능사", "기사", "대회", "공모전", "코딩", "제작", "실습"],
  "인성/직업의식": ["봉사", "봉사활동", "선행", "규정", "생활", "출결", "리더십", "학급"],
  "인문학적 소양": ["독서", "독후", "인문", "글쓰기", "감상문", "토론", "역사"],
  "외국어 능력": ["토익", "toeic", "영어", "opic", "토플", "toefl", "외국어", "회화"],
};
