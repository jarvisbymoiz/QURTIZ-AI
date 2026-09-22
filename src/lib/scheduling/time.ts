/**
 * Timezone-aware scheduling helpers. Pure and deterministic — tested.
 */
function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - date.getTime();
}

/**
 * Convert a wall-clock date+time in `tz` to a UTC Date.
 * Two-pass offset resolution handles DST boundaries.
 */
export function zonedToUtc(
  year: number,
  month: number, // 1-based
  day: number,
  hour: number,
  minute: number,
  tz: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let offset = tzOffsetMs(new Date(guess), tz);
  let ts = guess - offset;
  offset = tzOffsetMs(new Date(ts), tz);
  ts = guess - offset;
  return new Date(ts);
}

/** Parse "YYYY-MM-DD" + "HH:mm" in tz → UTC Date. */
export function parseZonedDateTime(dateIso: string, timeStr: string, tz: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeStr) || !isValidTimezone(tz)) return new Date(NaN);
  const [y, m, d] = dateIso.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  const instant = zonedToUtc(y, m, d, h, min, tz);
  // Invalid calendar dates and nonexistent DST wall times must not silently
  // move to a different date/hour. Ambiguous fall-back times use the
  // deterministic offset selected by zonedToUtc.
  return dateIsoInTz(tz, instant) === dateIso && hmInTz(tz, instant) === timeStr ? instant : new Date(NaN);
}

/**
 * "YYYY-MM-DD" of the instant `at` as seen in `tz` — the same en-CA keying
 * the calendar uses for its day cells. Passing `at` keeps this pure and
 * deterministic for tests; default is the current instant.
 */
export function dateIsoInTz(tz: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(at);
}

/** True when `tz` is a valid IANA timezone (e.g. "Asia/Karachi"). */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Local wall-clock time "HH:MM" (24h, zero-padded) of the instant `at` as
 * seen in `tz`. hourCycle "h23" pins midnight to "00:00" — the default
 * en-US hour12:false cycle can emit "24:00", which is not a valid HH:MM.
 */
export function hmInTz(tz: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
}

/**
 * "YYYY-MM-DD" of the NEXT calendar day after the instant `at` as seen in
 * `tz` (tomorrow). Adds one calendar day to the local date key, so it is
 * correct across DST transitions and late-night UTC rollovers where
 * `at + 86400000` would skip a local day.
 */
export function tomorrowIsoInTz(tz: string, at: Date = new Date()): string {
  const [y, m, d] = dateIsoInTz(tz, at).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** The default posting slot for a given day in tz: 18:30 local. */
export function defaultSlotFor(dateIso: string, tz: string): Date {
  return parseZonedDateTime(dateIso, "18:30", tz);
}

/**
 * Plan content days over a horizon: every other weekday starting tomorrow,
 * capped at `count` posts. Pure.
 */
export function planContentDays(fromUtc: Date, count: number, maxPostsPerDay = 1): string[] {
  const days: string[] = [];
  const cursor = new Date(fromUtc.getTime());
  cursor.setUTCDate(cursor.getUTCDate() + 1); // start tomorrow
  let guard = 0;
  while (days.length < count && guard < 120) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      days.push(cursor.toISOString().slice(0, 10));
      if (maxPostsPerDay === 1) cursor.setUTCDate(cursor.getUTCDate() + 2); // every other weekday
      else cursor.setUTCDate(cursor.getUTCDate() + 1);
    } else {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    guard++;
  }
  return days;
}
