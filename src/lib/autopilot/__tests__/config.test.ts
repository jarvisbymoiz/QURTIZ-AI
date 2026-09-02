import { describe, expect, it } from "vitest";
import { autopilotSettingsSchema } from "@/lib/autopilot/schema";
import {
  autopilotClaimKey,
  isAutopilotDue,
  pickEngagementSlot,
  sanitizeMaxPosts,
  sanitizeRunTimes,
} from "@/lib/autopilot/logic";

describe("autopilotSettingsSchema (runTimes)", () => {
  it("accepts valid 24-hour run times", () => {
    const r = autopilotSettingsSchema.safeParse({
      enabled: true,
      requireApproval: true,
      nicheFocus: "budget phones",
      maxPostsPerRun: 2,
      runTimes: ["09:00", "18:30", "23:59", "00:00"],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.runTimes).toEqual(["09:00", "18:30", "23:59", "00:00"]);
  });

  it("rejects malformed times (25:00, 18:60, 9:00)", () => {
    for (const bad of ["25:00", "18:60", "9:00", "18:5", "pm"]) {
      const r = autopilotSettingsSchema.safeParse({ enabled: true, runTimes: [bad] });
      expect(r.success).toBe(false);
    }
  });

  it("dedupes repeated times", () => {
    const r = autopilotSettingsSchema.safeParse({ enabled: true, runTimes: ["18:30", "18:30", "09:00"] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.runTimes).toEqual(["18:30", "09:00"]);
  });

  it("rejects more than 6 unique run times", () => {
    const r = autopilotSettingsSchema.safeParse({
      enabled: true,
      runTimes: ["01:00", "02:00", "03:00", "04:00", "05:00", "06:00", "07:00"],
    });
    expect(r.success).toBe(false);
  });

  it("defaults runTimes to [] and preserves the legacy fields", () => {
    const r = autopilotSettingsSchema.safeParse({ enabled: false });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.runTimes).toEqual([]);
      expect(r.data.requireApproval).toBe(true);
      expect(r.data.maxPostsPerRun).toBe(1);
    }
  });

  it("enforces maxPostsPerRun 1-3", () => {
    expect(autopilotSettingsSchema.safeParse({ enabled: true, maxPostsPerRun: 4 }).success).toBe(false);
    expect(autopilotSettingsSchema.safeParse({ enabled: true, maxPostsPerRun: 0 }).success).toBe(false);
    expect(autopilotSettingsSchema.safeParse({ enabled: true, maxPostsPerRun: 3 }).success).toBe(true);
  });
});

describe("sanitizeRunTimes", () => {
  it("returns [] for non-array or garbage storage values", () => {
    expect(sanitizeRunTimes(undefined)).toEqual([]);
    expect(sanitizeRunTimes("09:00")).toEqual([]);
    expect(sanitizeRunTimes(["25:00", "nope", 42])).toEqual([]);
  });

  it("filters, dedupes and caps valid entries", () => {
    expect(sanitizeRunTimes(["09:00", "09:00", "10:00"])).toEqual(["09:00", "10:00"]);
    expect(sanitizeRunTimes(Array.from({ length: 9 }, (_, i) => `${String(i).padStart(2, "0")}:00`))).toHaveLength(6);
  });
});

describe("sanitizeMaxPosts", () => {
  it("clamps legacy/garbage values into 1-3", () => {
    expect(sanitizeMaxPosts(undefined)).toBe(1);
    expect(sanitizeMaxPosts(null)).toBe(1);
    expect(sanitizeMaxPosts("x")).toBe(1);
    expect(sanitizeMaxPosts(0)).toBe(1);
    expect(sanitizeMaxPosts(2)).toBe(2);
    expect(sanitizeMaxPosts(9)).toBe(3);
    expect(sanitizeMaxPosts(2.9)).toBe(3);
  });
});

describe("autopilotClaimKey + isAutopilotDue", () => {
  const cfg = { runTimes: ["09:00", "18:30"], lastRunKey: null };

  it("is due when the local time is a run time and the occurrence is unclaimed", () => {
    expect(isAutopilotDue(cfg, "2026-09-03", "09:00")).toBe(true);
    expect(isAutopilotDue(cfg, "2026-09-03", "18:30")).toBe(true);
  });

  it("is not due between run times", () => {
    expect(isAutopilotDue(cfg, "2026-09-03", "09:01")).toBe(false);
    expect(isAutopilotDue(cfg, "2026-09-03", "12:00")).toBe(false);
  });

  it("is not due when the exact occurrence was already claimed", () => {
    const key = autopilotClaimKey("2026-09-03", "09:00");
    expect(key).toBe("2026-09-03T09:00");
    expect(isAutopilotDue({ ...cfg, lastRunKey: key }, "2026-09-03", "09:00")).toBe(false);
    // Same time on another day is a fresh occurrence.
    expect(isAutopilotDue({ ...cfg, lastRunKey: key }, "2026-09-04", "09:00")).toBe(true);
    // A different claimed time does not block this one.
    expect(isAutopilotDue({ ...cfg, lastRunKey: autopilotClaimKey("2026-09-03", "18:30") }, "2026-09-03", "09:00")).toBe(true);
  });

  it("ignores garbage runTimes from legacy rows", () => {
    expect(isAutopilotDue({ runTimes: "09:00", lastRunKey: null }, "2026-09-03", "09:00")).toBe(false);
    expect(isAutopilotDue({ runTimes: ["09:00"], lastRunKey: undefined }, "2026-09-03", "09:00")).toBe(true);
  });
});

describe("pickEngagementSlot", () => {
  const hours = [
    { hour: 18, avgEngagement: 12.5, posts: 3 },
    { hour: 9, avgEngagement: 4.2, posts: 2 },
  ];

  it("returns the best measured local hour as HH:00 with >= 3 metrics rows", () => {
    expect(pickEngagementSlot(hours, 3)).toBe("18:00");
  });

  it("falls back when fewer than 3 metrics rows exist", () => {
    expect(pickEngagementSlot(hours, 2)).toBe("18:30");
    expect(pickEngagementSlot(hours, 0)).toBe("18:30");
  });

  it("falls back with no hour data", () => {
    expect(pickEngagementSlot([], 10)).toBe("18:30");
  });

  it("falls back when the best hour has no measurable engagement", () => {
    expect(pickEngagementSlot([{ hour: 8, avgEngagement: 0, posts: 1 }], 5)).toBe("18:30");
  });

  it("normalizes the hour12:false midnight reading (24 -> 00)", () => {
    expect(pickEngagementSlot([{ hour: 24, avgEngagement: 9, posts: 1 }], 5)).toBe("00:00");
    expect(pickEngagementSlot([{ hour: 7, avgEngagement: 9, posts: 1 }], 5)).toBe("07:00");
  });
});
