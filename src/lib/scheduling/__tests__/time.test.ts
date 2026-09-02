import { describe, expect, it } from "vitest";
import { parseZonedDateTime, planContentDays, defaultSlotFor, isValidTimezone, dateIsoInTz } from "@/lib/scheduling/time";

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
