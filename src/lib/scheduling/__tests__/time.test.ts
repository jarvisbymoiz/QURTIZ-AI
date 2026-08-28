import { describe, expect, it } from "vitest";
import { parseZonedDateTime, planContentDays, defaultSlotFor } from "@/lib/scheduling/time";

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
