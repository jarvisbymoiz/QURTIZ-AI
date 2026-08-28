import { describe, expect, it } from "vitest";
import { sumTotals, groupPerformance, bestPostingHours, type MetricsRow } from "@/lib/analytics/compute";

const row = (over: Partial<MetricsRow>): MetricsRow => ({
  platform: "facebook",
  contentItemId: null,
  metrics: {},
  postedAt: null,
  hourOfDay: null,
  format: null,
  topic: null,
  ...over,
});

describe("sumTotals", () => {
  it("sums reach/impressions/engagement and computes rate", () => {
    const t = sumTotals([
      row({ metrics: { reach: 100, impressions: 200, likes: 5, comments: 2, shares: 1, saves: 2 } }),
      row({ metrics: { reach: 300, impressions: 400, likes: 10, comments: 5 } }),
    ]);
    expect(t.posts).toBe(2);
    expect(t.reach).toBe(400);
    expect(t.impressions).toBe(600);
    expect(t.engagement).toBe(25);
    expect(t.engagementRate).toBe(6.3);
  });

  it("returns zero rate when no reach data", () => {
    const t = sumTotals([row({ metrics: { likes: 5 } })]);
    expect(t.engagementRate).toBe(0);
  });
});

describe("groupPerformance", () => {
  it("groups by format and sorts by engagement", () => {
    const g = groupPerformance(
      [
        row({ format: "carousel", metrics: { reach: 100, likes: 20 } }),
        row({ format: "single_image", metrics: { reach: 100, likes: 5 } }),
        row({ format: "carousel", metrics: { reach: 100, likes: 10 } }),
      ],
      (r) => r.format ?? "unknown",
    );
    expect(g[0].key).toBe("carousel");
    expect(g[0].totals.engagement).toBe(30);
  });
});

describe("bestPostingHours", () => {
  it("ranks hours by average engagement", () => {
    const g = bestPostingHours([
      row({ hourOfDay: 18, metrics: { likes: 10 } }),
      row({ hourOfDay: 18, metrics: { likes: 20 } }),
      row({ hourOfDay: 9, metrics: { likes: 2 } }),
    ]);
    expect(g[0].hour).toBe(18);
    expect(g[0].avgEngagement).toBe(15);
    expect(g[1].hour).toBe(9);
  });
});
