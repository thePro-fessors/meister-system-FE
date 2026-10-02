import { AreaResult, CertStatus, PointRecord, Submission, User } from "./types";
import { generateCoachingTip } from "./ai";

export interface ChatbotContext {
  student: User;
  year: number;
  results: AreaResult[];
  certStatus: CertStatus;
  totalScore: number;
  submissions: Submission[];
  points: PointRecord[];
}

export interface BotReply {
  text: string;
  suggestions?: string[];
}

const DEFAULT_SUGGESTIONS = [
  "내 총점 알려줘",
  "어떤 영역이 부족해?",
  "증빙자료 어떻게 제출해?",
  "상벌점 내역 보여줘",
  "등급 기준이 뭐야?",
];

function includesAny(text: string, keywords: string[]) {
  return keywords.some((k) => text.includes(k));
}

export function answerStudentQuestion(rawInput: string, ctx: ChatbotContext): BotReply {
  const text = rawInput.trim().toLowerCase();

  if (!text) {
    return { text: "궁금한 점을 입력해 주세요!", suggestions: DEFAULT_SUGGESTIONS };
  }

  if (includesAny(text, ["안녕", "hi", "hello", "반가"])) {
    return {
      text: `안녕하세요, ${ctx.student.name}님! 마이스터역량인증제 도우미예요. 인증 현황, 제출 방법, 상벌점 등 무엇이든 물어보세요.`,
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  // 총점 / 내 점수
  if (includesAny(text, ["총점", "내 점수", "점수 알려", "몇 점"])) {
    return {
      text: `현재 ${ctx.year}학년도 총점은 ${ctx.totalScore.toFixed(1)}점이고, 전체 인증 상태는 '${ctx.certStatus}'입니다.`,
      suggestions: ["어떤 영역이 부족해?", "인증 상태가 무슨 뜻이야?"],
    };
  }

  // 영역별 점수
  if (includesAny(text, ["영역별", "영역 점수", "영역 등급", "성적표"])) {
    if (ctx.results.length === 0) {
      return { text: "아직 등록된 인증 기준이 없어서 영역별 점수를 계산할 수 없어요." };
    }
    const lines = ctx.results
      .map((r) => `· ${r.area}: ${r.score}/${r.maxScore}점 (${r.grade === "미달성" ? "미달성" : r.grade + "등급"})`)
      .join("\n");
    return { text: `영역별 현황이에요.\n${lines}`, suggestions: ["어떤 영역이 부족해?", "미달성이면 어떻게 해?"] };
  }

  // 미달 / 보완
  if (includesAny(text, ["미달", "부족한 영역", "보완", "약점", "어떤 영역이 부족"])) {
    if (ctx.results.length === 0) {
      return { text: "아직 계산할 수 있는 영역 데이터가 없어요. 증빙자료를 먼저 제출해 보세요!" };
    }
    const weakest = [...ctx.results].sort((a, b) => a.score / a.maxScore - b.score / b.maxScore)[0];
    const tip = generateCoachingTip(weakest.area, weakest.score / weakest.maxScore);
    return {
      text: `가장 보완이 필요한 영역은 '${weakest.area}'예요 (${weakest.score}/${weakest.maxScore}점).\n${tip}`,
      suggestions: ["증빙자료 어떻게 제출해?"],
    };
  }

  // 상벌점
  if (includesAny(text, ["상벌점", "벌점", "상점"])) {
    const total = ctx.points.reduce((sum, p) => sum + p.score, 0);
    if (ctx.points.length === 0) {
      return { text: "등록된 상벌점 내역이 없어요." };
    }
    const latest = [...ctx.points].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    return {
      text: `누적 상벌점은 ${total > 0 ? `+${total}` : total}점이에요. 가장 최근 내역: ${latest.date} ${latest.type} ${
        latest.score > 0 ? `+${latest.score}` : latest.score
      }점 (${latest.reason})`,
      suggestions: ["내 총점 알려줘"],
    };
  }

  // 반려 사유
  if (includesAny(text, ["왜 반려", "반려 사유", "반려됐"])) {
    const rejected = ctx.submissions
      .filter((s) => s.status === "반려")
      .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))[0];
    if (!rejected) {
      return { text: "현재 반려된 증빙자료가 없어요." };
    }
    return {
      text: `'${rejected.itemName} · ${rejected.detail}' 자료가 반려되었어요.\n사유: ${
        rejected.teacherComment ?? "등록된 사유가 없습니다."
      }\n제출 내역 페이지에서 보완 후 재제출할 수 있어요.`,
      suggestions: ["재제출은 어떻게 해?"],
    };
  }

  // 재제출
  if (includesAny(text, ["재제출"])) {
    return {
      text: "제출 내역 페이지에서 반려된 자료 아래의 '보완하여 재제출' 버튼을 눌러 설명이나 파일/링크를 수정한 뒤 다시 제출하면 상태가 '검토중'으로 바뀌어요.",
      suggestions: ["증빙자료 어떻게 제출해?"],
    };
  }

  // 제출 방법
  if (includesAny(text, ["제출", "증빙", "어떻게 올려", "파일 첨부", "링크 첨부"])) {
    return {
      text: "왼쪽 메뉴의 '증빙자료 제출'에서 인증 영역과 평가 항목을 선택하고, 활동일과 설명을 적은 뒤 파일 또는 링크 중 하나 이상을 첨부하면 돼요. 설명을 입력하면 AI가 어울리는 영역을 자동으로 추천해 줘요.",
      suggestions: ["등급 기준이 뭐야?", "인증 상태가 무슨 뜻이야?"],
    };
  }

  // 등급 기준
  if (includesAny(text, ["등급 기준", "s등급", "a등급", "b등급", "등급은 어떻게"])) {
    return {
      text: "영역별 점수 비율에 따라 등급이 자동 계산돼요.\nS: 최대점의 90% 이상\nA: 80% 이상\nB: 70% 이상\n미달성: 70% 미만",
      suggestions: ["내 총점 알려줘"],
    };
  }

  // 인증 상태 의미
  if (includesAny(text, ["인증 상태", "인증 가능", "인증이 뭐야", "검토중이 뭐야", "보완 필요가 뭐야"])) {
    return {
      text: "인증 상태는 다음과 같은 의미예요.\n· 인증 가능: 모든 필수 영역이 기준을 충족\n· 보완 필요: 특정 영역 점수가 부족\n· 검토중: 제출 자료가 아직 검토 중이라 최종 판정이 어려움\n· 미달성: 하나 이상의 영역이 기준에 미달",
      suggestions: ["내 총점 알려줘"],
    };
  }

  // 로그아웃/계정
  if (includesAny(text, ["로그아웃", "로그인 정보", "내 정보"])) {
    return {
      text: `${ctx.student.name}님은 ${ctx.student.grade}학년 ${ctx.student.classNo}반 ${ctx.student.number}번으로 등록되어 있어요. 로그아웃은 왼쪽 하단의 로그아웃 버튼을 이용하세요.`,
    };
  }

  return {
    text: "아직 그 질문은 정확히 이해하지 못했어요. 아래 예시 질문 중 하나를 눌러보시겠어요?",
    suggestions: DEFAULT_SUGGESTIONS,
  };
}

export { DEFAULT_SUGGESTIONS };
