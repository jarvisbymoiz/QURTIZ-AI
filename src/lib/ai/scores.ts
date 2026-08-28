import type { TopicScores } from "./research-types";

/**
 * AI-estimated overall opportunity score. Weights favor business relevance
 * and audience fit; competition is inverted (low competition = higher score).
 * Deterministic and pure — UI must label all scores as AI-estimated.
 */
export function overallOpportunity(s: TopicScores): number {
  const weighted =
    s.trend * 0.15 +
    s.audience * 0.2 +
    s.search * 0.1 +
    (10 - s.competition) * 0.1 +
    s.business * 0.2 +
    s.viral * 0.15 +
    s.conversion * 0.1;
  return Math.round(weighted * 10) / 10;
}
