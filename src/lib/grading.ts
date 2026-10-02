import { AreaName, AreaResult, CertStatus, PointRecord, Submission, YearCriteria } from "./types";

export function academicYear(date: string): number {
  const [year, month] = date.split("-").map(Number);
  return month >= 3 ? year : year - 1;
}

export function isUnderReview(submission: Submission): boolean {
  return ["제출완료", "검토중", "재제출요청"].includes(submission.status);
}

export function gradeFromRatio(ratio: number): "S" | "A" | "B" | "미달성" {
  if (ratio >= 0.9) return "S";
  if (ratio >= 0.8) return "A";
  if (ratio >= 0.7) return "B";
  return "미달성";
}

/** 학생의 인정완료 제출 + 반영된 상벌점을 합산해 영역별 결과를 계산한다. */
export function computeAreaResults(
  studentId: string,
  year: number,
  grade: number,
  criteria: YearCriteria | undefined,
  submissions: Submission[],
  points: PointRecord[]
): AreaResult[] {
  const gradeCriteria = criteria?.gradeCriteria.find((g) => g.grade === grade);
  if (!gradeCriteria) return [];

  return gradeCriteria.areas.map((areaCrit) => {
    const approved = submissions.filter(
      (s) =>
        s.studentId === studentId &&
        s.year === year &&
        s.area === areaCrit.area &&
        s.status === "인정완료"
    );
    const submittedScore = areaCrit.items.reduce((sum, item) => {
      const scores = approved.filter((s) => s.itemId === item.id)
        .map((s) => Number.isFinite(s.score) ? Math.max(0, s.score!) : 0);
      const score = item.scoringType === "최상위인정형"
        ? Math.max(0, ...scores)
        : scores.reduce((total, value) => total + value, 0);
      return sum + Math.min(score, item.maxScore);
    }, 0);

    const reflectedPoints = points
      .filter((p) => p.studentId === studentId && (p.year ?? academicYear(p.date)) === year && p.reflected && p.reflectedArea === areaCrit.area)
      .reduce((sum, p) => sum + p.score, 0);

    let total = submittedScore + reflectedPoints;
    total = Math.max(0, Math.min(total, areaCrit.maxScore));

    const ratio = areaCrit.maxScore > 0 ? total / areaCrit.maxScore : 0;
    const grade_ = gradeFromRatio(ratio);

    return {
      area: areaCrit.area,
      score: Math.round(total * 10) / 10,
      maxScore: areaCrit.maxScore,
      grade: grade_,
      status: grade_ === "미달성" ? "보완 필요" : "충족",
    };
  });
}

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
  "직업기초능력": ["의사소통", "문제해결", "협업", "발표", "보고서", "프로젝트 수행", "팀플"],
  "전문기술역량": ["자격증", "산업기사", "기능사", "기사", "대회", "공모전", "코딩", "제작", "실습"],
  "인성/직업의식": ["봉사", "봉사활동", "선행", "규정", "생활", "출결", "리더십", "학급"],
  "인문학적 소양": ["독서", "독후", "인문", "글쓰기", "감상문", "토론", "역사"],
  "외국어 능력": ["토익", "toeic", "영어", "opic", "토플", "toefl", "외국어", "회화"],
};
