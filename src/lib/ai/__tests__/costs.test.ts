import { describe, expect, it } from "vitest";
import { estimateCost, MODEL_COSTS } from "@/lib/ai/provider";

describe("estimateCost", () => {
  it("prices 1M input + 1M output for gemini-2.5-flash at $2.80", () => {
    expect(estimateCost("gemini-2.5-flash", 1_000_000, 1_000_000)).toBeCloseTo(2.8, 6);
  });

  it("scales linearly with token counts", () => {
    expect(estimateCost("gemini-2.5-flash", 100_000, 50_000)).toBeCloseTo(0.155, 6);
  });

  it("prices gemini-3.6-flash at intro rates (0.75/3.75)", () => {
    expect(estimateCost("gemini-3.6-flash", 1_000_000, 1_000_000)).toBeCloseTo(4.5, 6);
  });

  it("prices gemini-2.5-pro correctly", () => {
    expect(estimateCost("gemini-2.5-pro", 1_000_000, 1_000_000)).toBeCloseTo(11.25, 6);
  });

  it("returns 0 for unknown models instead of guessing", () => {
    expect(estimateCost("nonexistent-model", 500_000, 500_000)).toBe(0);
  });

  it("has rates for every model in the registry", () => {
    for (const model of Object.keys(MODEL_COSTS)) {
      expect(MODEL_COSTS[model].input).toBeGreaterThan(0);
      expect(MODEL_COSTS[model].output).toBeGreaterThan(0);
    }
  });
});


