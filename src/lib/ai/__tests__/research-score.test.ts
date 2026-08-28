import { describe, expect, it } from "vitest";
import { overallOpportunity } from "@/lib/ai/research";

describe("overallOpportunity", () => {
  it("weights business relevance and audience fit highest", () => {
    const high = overallOpportunity({ trend: 5, audience: 10, search: 5, competition: 5, business: 10, viral: 5, conversion: 5 });
    const low = overallOpportunity({ trend: 10, audience: 0, search: 5, competition: 5, business: 0, viral: 10, conversion: 5 });
    expect(high).toBeGreaterThan(low);
  });

  it("rewards low competition", () => {
    const lowComp = overallOpportunity({ trend: 5, audience: 5, search: 5, competition: 1, business: 5, viral: 5, conversion: 5 });
    const highComp = overallOpportunity({ trend: 5, audience: 5, search: 5, competition: 9, business: 5, viral: 5, conversion: 5 });
    expect(lowComp).toBeGreaterThan(highComp);
  });

  it("all 10s score exactly 10", () => {
    const s = { trend: 10, audience: 10, search: 10, competition: 10, business: 10, viral: 10, conversion: 10 };
    expect(overallOpportunity(s)).toBe(9); // competition inverted: (10-10)*0.1 = 0
  });
});
