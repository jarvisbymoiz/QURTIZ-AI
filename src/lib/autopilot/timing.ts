import { bestPostingHours, type MetricsRow } from "@/lib/analytics/compute";
import { dateIsoInTz, hmInTz, parseZonedDateTime } from "@/lib/scheduling/time";
import { DEFAULT_POSTING_TIMES, sanitizeRunTimes } from "./logic";

export type TimingPolicy = { timezone: string; fallbackTimes: string[]; minGapMinutes: number; maxPostsPerDay: number };
export function postingTimes(metrics: MetricsRow[], platform: string, format: string, fallback: string[]) {
  const platformRows = metrics.filter(m => m.platform === platform && m.postedAt);
  const formatRows = platformRows.filter(m => m.format === format);
  const rows = formatRows.length >= 3 ? formatRows : platformRows;
  const hours = rows.length >= 3 ? bestPostingHours(rows).filter(h => h.avgEngagement > 0 && h.posts >= 2).slice(0, 3) : [];
  return { times: hours.length ? hours.map(h => `${String(h.hour % 24).padStart(2, "0")}:00`) : sanitizeRunTimes(fallback).length ? sanitizeRunTimes(fallback) : DEFAULT_POSTING_TIMES,
    source: hours.length ? "measured-post-performance" : "configured-fallback" };
}

/** Try ranked slots across future local dates; never invent engagement numbers. */
export function choosePostingSlot(policy: TimingPolicy, times: string[], occupied: Date[], now = new Date()): Date {
  const today = dateIsoInTz(policy.timezone, now);
  const date = new Date(`${today}T12:00:00Z`);
  for (let offset = 1; offset <= 60; offset++) {
    const day = new Date(date); day.setUTCDate(date.getUTCDate() + offset);
    const iso = day.toISOString().slice(0, 10);
    if (occupied.filter(d => dateIsoInTz(policy.timezone, d) === iso).length >= policy.maxPostsPerDay) continue;
    for (const time of times) {
      let slot: Date;
      try { slot = parseZonedDateTime(iso, time, policy.timezone); } catch { continue; }
      if (!Number.isFinite(slot.getTime())) continue;
      if (hmInTz(policy.timezone, slot) !== time || dateIsoInTz(policy.timezone, slot) !== iso) continue;
      if (slot.getTime() <= now.getTime() || occupied.some(d => Math.abs(d.getTime() - slot.getTime()) < policy.minGapMinutes * 60_000)) continue;
      return slot;
    }
  }
  throw new Error("No conflict-free posting slot within 60 days. Adjust fallback times or calendar limits.");
}

export function dueOccurrence(runTimes: string[], runDays: number[], timezone: string, now: Date, options?: { afterKey: string; enabledSince?: Date }): string | null {
  const today = dateIsoInTz(timezone, now);
  const dates = [new Date(`${today}T12:00:00Z`)];
  const yesterday = new Date(dates[0]); yesterday.setUTCDate(yesterday.getUTCDate() - 1); dates.push(yesterday);
  const candidates: { key: string; at: Date }[] = [];
  for (const date of dates) {
    if (!runDays.includes(date.getUTCDay())) continue;
    const day = date.toISOString().slice(0, 10);
    for (const time of sanitizeRunTimes(runTimes)) {
      try {
        const at = parseZonedDateTime(day, time, timezone);
        if (hmInTz(timezone, at) !== time || dateIsoInTz(timezone, at) !== day) continue;
        const key = `${day}T${time}`;
        if (options && (key <= options.afterKey || (options.enabledSince && at < options.enabledSince))) continue;
        if (at <= now && now.getTime() - at.getTime() < 24 * 3600_000) candidates.push({ key, at });
      } catch { /* DST gaps do not correspond to real instants. */ }
    }
  }
  return candidates.sort((a,b) => options ? a.at.getTime() - b.at.getTime() : b.at.getTime() - a.at.getTime())[0]?.key ?? null;
}
