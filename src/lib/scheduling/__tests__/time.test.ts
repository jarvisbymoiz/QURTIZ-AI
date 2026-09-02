import { describe, expect, it } from "vitest";
import { parseZonedDateTime, planContentDays, defaultSlotFor, isValidTimezone, dateIsoInTz, hmInTz, tomorrowIsoInTz } from "@/lib/scheduling/time";

describe("parseZonedDateTime", () => {
  it("converts Asia/Karachi 18:30 to 13:30 UTC (no DST)", () => {
    const d = parseZonedDateTime("2026-09-01", "18:30", "Asia/Karachi");
    expect(d.toISOString()).toBe("2026-09-01T13:30:00.000Z");
  });

  it("handles DST: New York July 18:30 EDT = 22:30 UTC", () => {
    const d = parseZonedDateTime("2026-07-15", "18:30", "America/New_York");
    expect(d.toISOString()).toBe("2026-07-15T22:30:00.000Z");
  });

  it("handles DST: New York Jan 18:30 EST = 23:30 UTC", () => {
    const d = parseZonedDateTime("2026-01-15", "18:30", "America/New_York");
    expect(d.toISOString()).toBe("2026-01-15T23:30:00.000Z");
  });
});

describe("defaultSlotFor", () => {
  it("uses 18:30 in the workspace timezone", () => {
    const d = defaultSlotFor("2026-09-02", "Asia/Karachi");
    expect(d.toISOString()).toBe("2026-09-02T13:30:00.000Z");
  });
});

describe("dateIsoInTz", () => {
  it("returns the YYYY-MM-DD calendar date of the instant as seen in tz", () => {
    const at = new Date("2026-09-02T23:30:00.000Z");
    expect(dateIsoInTz("Asia/Karachi", at)).toBe("2026-09-03"); // UTC+5, already next day
    expect(dateIsoInTz("UTC", at)).toBe("2026-09-02");
    expect(dateIsoInTz("America/Los_Angeles", at)).toBe("2026-09-02"); // UTC-7 (PDT), still Sep 2
    expect(dateIsoInTz("UTC", new Date("2026-09-02T01:00:00.000Z"))).toBe("2026-09-02");
  });

  it("keys the same day as the calendar's en-CA day cells", () => {
    // Calendar day cells are keyed with Intl.DateTimeFormat("en-CA", { timeZone })
    // — dateIsoInTz must produce identical keys so guard/tests and grid agree.
    const at = new Date("2026-09-02T12:00:00.000Z");
    const viaCalendarKeying = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(at);
    expect(dateIsoInTz("Asia/Karachi", at)).toBe(viaCalendarKeying);
  });

  it("throws RangeError for an invalid timezone", () => {
    expect(() => dateIsoInTz("Mars/Olympus")).toThrow(RangeError);
  });
});

describe("isValidTimezone", () => {
  it("accepts real IANA timezones", () => {
    expect(isValidTimezone("Asia/Karachi")).toBe(true);
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
  });

  it("rejects garbage and empty strings", () => {
    expect(isValidTimezone("Mars/Olympus")).toBe(false);
    expect(isValidTimezone("not-a-tz")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
  });
});

describe("hmInTz", () => {
  it("returns the local 24-hour HH:MM of the instant as seen in tz", () => {
    const at = new Date("2026-09-02T23:30:00.000Z"); // 2026-09-03 04:30 in Asia/Karachi (UTC+5)
    expect(hmInTz("Asia/Karachi", at)).toBe("04:30");
    expect(hmInTz("UTC", at)).toBe("23:30");
    expect(hmInTz("America/New_York", at)).toBe("19:30"); // EDT (UTC-4)
  });

  it("pins midnight to 00:00 (hourCycle h23) instead of 24:00", () => {
    // 2026-09-02 07:00 UTC is exactly midnight in Los Angeles (PDT, UTC-7).
    const midnight = new Date("2026-09-02T07:00:00.000Z");
    expect(hmInTz("America/Los_Angeles", midnight)).toBe("00:00");
    expect(/^([01]\d|2[0-3]):[0-5]\d$/.test(hmInTz("America/Los_Angeles", midnight))).toBe(true);
  });

  it("zero-pads single-digit hours and minutes", () => {
    expect(hmInTz("Asia/Karachi", new Date("2026-09-03T00:05:00.000Z"))).toBe("05:05"); // 05:05 local (UTC+5)
  });
});

describe("tomorrowIsoInTz", () => {
  it("adds one local calendar day to the instant as seen in tz", () => {
    const at = new Date("2026-09-02T23:30:00.000Z"); // already 2026-09-03 in Asia/Karachi
    expect(tomorrowIsoInTz("Asia/Karachi", at)).toBe("2026-09-04");
    expect(tomorrowIsoInTz("UTC", at)).toBe("2026-09-03");
  });

  it("survives DST spring-forward where a naive +86400000 skips a local day", () => {
    // New York DST starts 2026-03-08 07:00Z. 04:30Z is Mar 7 23:30 EST; adding
    // 24 real hours lands Mar 9 00:30 EDT — the naive UTC add skips Mar 8,
    // while the local-calendar add must yield the next local day, Mar 8.
    const at = new Date("2026-03-08T04:30:00.000Z");
    expect(dateIsoInTz("America/New_York", at)).toBe("2026-03-07");
    expect(tomorrowIsoInTz("America/New_York", at)).toBe("2026-03-08");
    expect(new Date(at.getTime() + 86400000).toISOString().slice(0, 10)).toBe("2026-03-09");
  });

  it("handles DST boundaries (spring-forward local day still advances by one)", () => {
    // New York: 2026-03-08 06:30Z is 2026-03-08 01:30 EST (DST starts 07:00Z).
    const at = new Date("2026-03-08T06:30:00.000Z");
    expect(dateIsoInTz("America/New_York", at)).toBe("2026-03-08");
    expect(tomorrowIsoInTz("America/New_York", at)).toBe("2026-03-09");
  });
});

describe("planContentDays", () => {
  it("plans weekdays only, every other day", () => {
    const days = planContentDays(new Date("2026-09-07T00:00:00Z"), 4);
    expect(days).toEqual(["2026-09-08", "2026-09-10", "2026-09-14", "2026-09-16"]);
  });

  it("caps at the requested count", () => {
    const days = planContentDays(new Date("2026-09-07T00:00:00Z"), 2);
    expect(days).toHaveLength(2);
  });
});
