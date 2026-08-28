/**
 * Lightweight text similarity for duplicate/repetition detection.
 * Word-set Jaccard — no external dependency, deterministic, testable.
 */
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "with", "is", "are", "was", "were", "be", "been", "it", "this", "that",
  "your", "you", "we", "our", "they", "their", "as", "by", "from", "will",
]);

export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[#@]/g, " ")
      .split(/[^a-z0-9\u0600-\u06ff]+/)
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w)),
  );
}

export function jaccardSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const w of ta) if (tb.has(w)) intersection++;
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** True when the candidate is too similar to anything in the corpus. */
export function findSimilar(
  candidate: string,
  corpus: readonly string[],
  threshold = 0.6,
): { similar: boolean; best: number } {
  let best = 0;
  for (const text of corpus) {
    const s = jaccardSimilarity(candidate, text);
    if (s > best) best = s;
  }
  return { similar: best >= threshold, best: Math.round(best * 100) / 100 };
}
