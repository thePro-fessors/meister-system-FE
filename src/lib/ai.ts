import { AREA_NAMES, AreaName, EvalItem } from "./types";
import { areaKeywordMap } from "./grading";

export interface AiClassification {
  area: AreaName;
  itemGuess: string;
  confidence: number; // 0~1
  matchedKeywords: string[];
  scoreHint?: string;
}

/**
 * AI 기능: 학생이 입력한 세부항목/설명 텍스트를 분석해
 * 가장 유력한 인증 영역과 평가 항목을 추천하고, 예상 점수 산정 방식을 안내한다.
 * (경량 키워드 임베딩 방식의 온디바이스 분류기 — 서버 없이 프론트엔드에서 동작)
 */
export function classifySubmission(
  detail: string,
  description: string,
  areaItems: Record<AreaName, EvalItem[]>
): AiClassification[] {
  const text = `${detail} ${description}`.toLowerCase();

  const scored = AREA_NAMES.map((area) => {
    const keywords = areaKeywordMap[area];
    const matched = keywords.filter((k) => text.includes(k.toLowerCase()));
    const confidence = Math.min(1, matched.length / 2);
    return { area, matched, confidence };
  }).sort((a, b) => b.confidence - a.confidence);

  return scored
    .filter((s) => s.confidence > 0 && (areaItems[s.area]?.length ?? 0) > 0)
    .slice(0, 2)
    .map((s) => {
      const items = areaItems[s.area] ?? [];
      const bestItem =
        items.find((it) =>
          s.matched.some((k) => it.name.toLowerCase().includes(k) || k.includes(it.name.toLowerCase()))
        ) ?? items[0];
      return {
        area: s.area,
        itemGuess: bestItem?.name ?? "해당 영역 내 항목",
        confidence: s.confidence,
        matchedKeywords: s.matched,
        scoreHint: bestItem
          ? `${bestItem.scoringType} · 최대 ${bestItem.maxScore}점`
          : undefined,
      };
    });
}

/** 등급/총점 기반의 간단한 보완 추천 문구 생성 (AI 코멘트) */
export function generateCoachingTip(area: AreaName, ratio: number): string {
  if (ratio >= 0.9) return `${area} 영역은 이미 최상위 등급입니다. 현재 활동을 유지하세요.`;
  if (ratio >= 0.8) return `${area} 영역은 A등급입니다. 조금만 더 채우면 S등급까지 도달할 수 있어요.`;
  if (ratio >= 0.7) return `${area} 영역은 B등급입니다. 관련 자격증이나 활동 실적을 추가로 제출해 보세요.`;
  return `${area} 영역이 기준에 미달합니다. 관련 항목의 증빙자료 제출을 서둘러 보완하는 것을 추천합니다.`;
}
