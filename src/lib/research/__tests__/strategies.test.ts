import { describe, expect, it } from "vitest";
import { asResearchStrategy, RESEARCH_STRATEGIES, RESEARCH_STRATEGY_IDS } from "@/lib/research/strategies";

describe("source-aware research strategies", () => {
  it("covers all required source classes including the broad web fallback", () => {
    expect(RESEARCH_STRATEGY_IDS).toEqual(
      expect.arrayContaining(["web", "trends", "official", "news", "announcements", "community", "creators"]),
    );
  });

  it("shapes community queries toward Reddit signals", () => {
    expect(RESEARCH_STRATEGIES.community.buildQuery("standing desk")).toContain("site:reddit.com");
    expect(RESEARCH_STRATEGIES.community.buildQuery("standing desk")).toContain("standing desk");
  });

  it("shapes creator queries toward YouTube sources", () => {
    expect(RESEARCH_STRATEGIES.creators.buildQuery("plc programming")).toContain("site:youtube.com");
  });

  it("shapes trend queries toward Google Trends / search-interest signals with a monthly default", () => {
    const q = RESEARCH_STRATEGIES.trends.buildQuery("chai brands");
    expect(q).toMatch(/Google Trends/i);
    expect(RESEARCH_STRATEGIES.trends.freshness).toBe("pm");
  });

  it("biases news to the past week and announcements to launches", () => {
    expect(RESEARCH_STRATEGIES.news.freshness).toBe("pw");
    expect(RESEARCH_STRATEGIES.announcements.buildQuery("acme")).toMatch(/launch|release|announcement/i);
  });

  it("keeps the broad web fallback untouched", () => {
    expect(RESEARCH_STRATEGIES.web.buildQuery("raw query")).toBe("raw query");
  });

  it("coerces untrusted input safely", () => {
    expect(asResearchStrategy("news")).toBe("news");
    expect(asResearchStrategy("weird")).toBeNull();
    expect(asResearchStrategy(42)).toBeNull();
    expect(asResearchStrategy(undefined)).toBeNull();
  });
});
