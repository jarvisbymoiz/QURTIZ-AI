import type { ContentRulesInput } from "@/lib/validation";
import { findSimilar } from "./similarity";

export type QaIssue = {
  severity: "error" | "warning";
  check: string;
  message: string;
};

export type QaResult = {
  passed: boolean;
  score: number; // 0-100
  issues: QaIssue[];
};

const PLATFORM_CAPTION_LIMITS: Record<string, number> = {
  facebook: 2000,
  instagram: 2200,
};

const HYPE_PATTERNS: RegExp[] = [
  /guaranteed\s+(results?|income|profit)/i,
  /100%\s+(guarantee|risk[- ]free)/i,
  /get\s+rich\s+quick/i,
  /\bno\.?\s*1\b\s+(in|for)\s+(the\s+)?(world|country|pakistan)/i,
  /\bmiracle\b/i,
];

/**
 * Deterministic content QA. Runs before a post becomes Ready for Review.
 * AI scores are estimates; these checks are hard rules from the Brand Brain
 * and platform constraints.
 */
export function runContentQa(input: {
  caption: string;
  hashtags: readonly string[];
  cta: string | null;
  platform: string;
  rules: Partial<ContentRulesInput> | null;
  existingCaptions?: readonly string[];
}): QaResult {
  const issues: QaIssue[] = [];
  const caption = input.caption ?? "";
  const rules = input.rules ?? {};

  // Brand avoid-lists (hard constraints)
  for (const word of rules.avoidWords ?? []) {
    if (word && caption.toLowerCase().includes(word.toLowerCase())) {
      issues.push({ severity: "error", check: "avoid_words", message: `Contains avoided word: "${word}"` });
    }
  }
  for (const claim of rules.avoidClaims ?? []) {
    if (claim && caption.toLowerCase().includes(claim.toLowerCase())) {
      issues.push({ severity: "error", check: "avoid_claims", message: `Contains avoided claim: "${claim}"` });
    }
  }
  for (const topic of rules.avoidTopics ?? []) {
    if (topic && caption.toLowerCase().includes(topic.toLowerCase())) {
      issues.push({ severity: "error", check: "avoid_topics", message: `Touches avoided topic: "${topic}"` });
    }
  }

  // Hype / unsupported-claim heuristics
  for (const pattern of HYPE_PATTERNS) {
    if (pattern.test(caption)) {
      issues.push({ severity: "error", check: "unsupported_claims", message: `Possible unsupported claim` });
    }
  }

  // Platform caption length
  const limit = PLATFORM_CAPTION_LIMITS[input.platform];
  if (limit && caption.length > limit) {
    issues.push({ severity: "error", check: "caption_length", message: `Caption exceeds ${input.platform} limit (${caption.length}/${limit})` });
  }

  // CTA rules
  if (rules.ctaRule && input.cta) {
    const keyword = rules.ctaRule.match(/WhatsApp|DM|comment|link/i)?.[0];
    if (keyword && !input.cta.toLowerCase().includes(keyword.toLowerCase())) {
      issues.push({ severity: "warning", check: "cta_rule", message: `CTA rule suggests "${keyword}" but CTA is: "${input.cta.slice(0, 60)}"` });
    }
  }
  if (!input.cta || input.cta.trim().length === 0) {
    issues.push({ severity: "warning", check: "cta_missing", message: "No CTA set" });
  }

  // Hashtag count sanity
  if (input.hashtags.length > 30) {
    issues.push({ severity: "warning", check: "hashtag_count", message: `${input.hashtags.length} hashtags — max 30` });
  }

  // Duplicate/repetition detection against published/drafted captions
  if (input.existingCaptions && input.existingCaptions.length > 0) {
    const { similar, best } = findSimilar(caption, input.existingCaptions);
    if (similar) {
      issues.push({ severity: "error", check: "duplicate", message: `Too similar to existing content (${Math.round(best * 100)}% match) — try a new angle` });
    }
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.length - errors;
  const score = Math.max(0, 100 - errors * 30 - warnings * 8);

  return { passed: errors === 0, score, issues };
}
