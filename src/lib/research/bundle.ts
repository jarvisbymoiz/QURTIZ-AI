import "server-only";

import { searchResearch, type ResearchFailure } from "./service";
import type { ResearchStrategy } from "./strategies";

/**
 * Multi-source trend research: for requests like "what is trending in my
 * niche right now" a single broad web search is not enough. This bundles
 * focused searches across source classes — Google Trends/search-interest
 * signals, current news, and Reddit/community (optionally YouTube
 * creators) — through the SAME shared Brave integration, then merges them
 * into one deduplicated source list.
 *
 * Partial success is a first-class outcome: if one strategy fails (quota,
 * transient upstream error) the others still contribute sources and the
 * failure is recorded in `failures` for honest reporting + diagnostics.
 * Nothing here fabricates sources — an empty `sources` array means "no
 * current results retrieved", which callers must surface as such rather
 * than substituting model knowledge.
 */

export type TrendSource = { url: string; title: string; strategy: ResearchStrategy };

export type TrendSourceBundle = {
  ok: boolean;
  /** Unique sources across strategies, in priority order (URL-deduped). */
  sources: TrendSource[];
  /** Strategies that produced at least one current result. */
  succeeded: ResearchStrategy[];
  /** Strategies that returned ok:false (with their honest failure). */
  failures: { strategy: ResearchStrategy; reason: string; message: string }[];
};

const DEFAULT_TREND_STRATEGIES: ResearchStrategy[] = ["trends", "news", "community"];

export async function trendSourceBundle(
  ctx: { workspaceId: string; userId: string },
  query: string,
  opts?: { strategies?: ResearchStrategy[]; countPerStrategy?: number },
): Promise<TrendSourceBundle> {
  const strategies = opts?.strategies ?? DEFAULT_TREND_STRATEGIES;
  const countPerStrategy = opts?.countPerStrategy ?? 6;

  const outcomes = await Promise.all(
    strategies.map((strategy) =>
      searchResearch({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        query,
        strategy,
        count: countPerStrategy,
      }).then((outcome) => ({ strategy, outcome })),
    ),
  );

  const seen = new Set<string>();
  const sources: TrendSource[] = [];
  const succeeded: ResearchStrategy[] = [];
  const failures: { strategy: ResearchStrategy; reason: string; message: string }[] = [];

  for (const { strategy, outcome } of outcomes) {
    if (!outcome.ok) {
      const failure = outcome as ResearchFailure;
      failures.push({ strategy, reason: failure.reason, message: failure.message });
      continue;
    }
    if (outcome.results.length === 0) {
      failures.push({ strategy, reason: "no_results", message: "No current results for this source." });
      continue;
    }
    succeeded.push(strategy);
    for (const result of outcome.results) {
      if (seen.has(result.url)) continue;
      seen.add(result.url);
      sources.push({ url: result.url, title: result.title || result.url, strategy });
    }
  }

  const ok = sources.length > 0;
  // Diagnostic: which source classes contributed / failed. No keys, no
  // private tenant context — the query is truncated for log hygiene.
  console.info(
    `[research] trend bundle "${query.slice(0, 120)}" strategies=${strategies.join(",")} succeeded=${succeeded.join(",") || "-"} failures=${failures
      .map((f) => `${f.strategy}:${f.reason}`)
      .join(",") || "-"} sources=${sources.length}`,
  );

  return { ok, sources, succeeded, failures };
}
