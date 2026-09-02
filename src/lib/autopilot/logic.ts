/**
 * Pure autopilot run logic. Deliberately zod-free and free of server-only
 * imports so the settings card (a client component) and the pg-boss worker
 * share one implementation without pulling the zod schema into the client
 * bundle or touching the database.
 *
 * Settings live in the `settings` JSON row (key "autopilot"); `runTimes`
 * are one or more 24-hour local "HH:MM" slots per day and `lastRunKey`
 * ("YYYY-MM-DDTHH:MM" in the workspace timezone) dedupes the per-minute
 * worker scan against the occurrence that already ran.
 */

/** 24h "HH:MM" — exactly what a native <input type="time"> emits. */
export const RUN_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const MAX_RUN_TIMES = 6;
/** Pre-filled when enabling Autopilot with no run times configured. */
export const DEFAULT_RUN_TIMES = ["18:30"] as const;
/** Slot used when the workspace has no measured best-hour data yet. */
export const FALLBACK_SLOT_TIME = "18:30";

/**
 * Normalize arbitrary stored JSON into valid, unique, capped "HH:MM" times.
 * Stored rows predate `runTimes`, so worker/UI reads never trust the shape.
 */
export function sanitizeRunTimes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v === "string" && RUN_TIME_RE.test(v) && !seen.has(v)) {
      seen.add(v);
      out.push(v);
      if (out.length >= MAX_RUN_TIMES) break;
    }
  }
  return out;
}

/** Clamp a stored maxPostsPerRun into 1..3 regardless of legacy garbage. */
export function sanitizeMaxPosts(raw: unknown): number {
  const n = Math.round(typeof raw === "number" ? raw : Number(raw ?? NaN));
  if (!Number.isFinite(n)) return 1;
  return Math.min(3, Math.max(1, n));
}

/** Occurrence key: one per run time per local calendar day. */
export function autopilotClaimKey(localDateIso: string, localHm: string): string {
  return `${localDateIso}T${localHm}`;
}

/**
 * The run is due when the workspace-local wall-clock time is one of the
 * configured run times AND that occurrence (day + time) was not already
 * claimed. `lastRunKey` covers both the completed and the in-flight run, so
 * the per-minute scan never fires twice for the same occurrence.
 */
export function isAutopilotDue(
  cfg: { runTimes?: unknown; lastRunKey?: string | null },
  localDateIso: string,
  localHm: string,
): boolean {
  if (!sanitizeRunTimes(cfg.runTimes).includes(localHm)) return false;
  return cfg.lastRunKey !== autopilotClaimKey(localDateIso, localHm);
}

/**
 * Pick the auto-schedule slot time from measured performance. `hours` is the
 * Analytics page reading (bestPostingHours: per-hour average engagement in
 * workspace time). Falls back to 18:30 when there is no evidence: fewer than
 * 3 measured posts, no hour data, or a best hour with zero engagement.
 */
export function pickEngagementSlot(
  hours: { hour: number; avgEngagement: number; posts: number }[],
  metricsRowCount: number,
  fallback: string = FALLBACK_SLOT_TIME,
): string {
  if (metricsRowCount < 3) return fallback;
  const best = hours[0]; // bestPostingHours sorts by avgEngagement desc
  if (!best || best.avgEngagement <= 0) return fallback;
  // %24 normalizes the hour12:false midnight reading ("24") to 00.
  return `${String(best.hour % 24).padStart(2, "0")}:00`;
}
