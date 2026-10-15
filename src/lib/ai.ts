import { AREA_NAMES, AreaName, EvalItem } from "./types";
import { areaKeywordMap, PROVISIONAL_GRADING_NOTICE } from "./grading";

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
   * (키워드 기반 추천 — 서버 없이 프론트엔드에서 동작)
 */
export function classifySubmission(
  detail: string,
  description: string,
  areaItems: Partial<Record<AreaName, EvalItem[]>>
): AiClassification[] {
  const text = `${detail} ${description}`.toLowerCase();

  const scored = AREA_NAMES.map((area) => {
    const keywords = areaKeywordMap[area];
    const matched = keywords.filter((k) => text.includes(k.toLowerCase()));
    const confidence = Math.min(1, matched.length / 2);
    return { area, matched, confidence };
  }).sort((a, b) => b.confidence - a.confidence);

  return scored
    .filter((s) => s.confidence > 0 && areaItems[s.area]?.some((it) => it.active && !it.autoCalculated && it.id !== "item-405"))
    .slice(0, 2)
    .map((s) => {
      const items = (areaItems[s.area] ?? []).filter((it) => it.active && !it.autoCalculated && it.id !== "item-405");
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
  const progress = Number.isFinite(ratio) ? Math.round(Math.max(0, Math.min(1, ratio)) * 100) : 0;
  return `${area} 영역의 배점 대비 달성률은 ${progress}%입니다. ${ratio >= 0.9 ? "현재 활동을 유지하세요." : "해당 영역의 평가 항목과 증빙 요건을 확인하고 활동 실적을 보완해 보세요."} ${PROVISIONAL_GRADING_NOTICE}`;
}
