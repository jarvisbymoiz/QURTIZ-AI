import { describe, expect, it } from "vitest";
import { runContentQa } from "@/lib/content/qa";
import { jaccardSimilarity, findSimilar } from "@/lib/content/similarity";

describe("jaccardSimilarity", () => {
  it("identical text scores 1", () => {
    expect(jaccardSimilarity("students love canva templates", "students love canva templates")).toBe(1);
  });

  it("disjoint text scores 0", () => {
    expect(jaccardSimilarity("mobile prices drop", "cooking pasta at home")).toBe(0);
  });

  it("ignores stop words", () => {
    const s = jaccardSimilarity("the canva course is live", "canva course live");
    expect(s).toBe(1);
  });
});

describe("findSimilar", () => {
  it("flags near-duplicates above threshold", () => {
    const r = findSimilar(
      "5 canva features students should know today",
      ["5 canva features students must know today", "unrelated topic"],
      0.6,
    );
    expect(r.similar).toBe(true);
  });

  it("passes distinct content", () => {
    const r = findSimilar("new campus opening in lahore", ["mobile price drop"], 0.6);
    expect(r.similar).toBe(false);
  });
});

describe("runContentQa", () => {
  const base = {
    hashtags: ["canva"],
    cta: "DM us on WhatsApp",
    platform: "facebook",
    rules: {} as Record<string, never>,
  };

  it("passes clean content", () => {
    const r = runContentQa({ ...base, caption: "Learn Canva with our new course." });
    expect(r.passed).toBe(true);
    expect(r.issues.some((i) => i.severity === "error")).toBe(false);
  });

  it("errors on avoided words", () => {
    const r = runContentQa({
      ...base,
      caption: "This cheap offer ends soon.",
      rules: { avoidWords: ["cheap"] } as never,
    });
    expect(r.passed).toBe(false);
    expect(r.issues.some((i) => i.check === "avoid_words")).toBe(true);
  });

  it("errors on hype patterns", () => {
    const r = runContentQa({ ...base, caption: "Get guaranteed results in 7 days!" });
    expect(r.passed).toBe(false);
    expect(r.issues.some((i) => i.check === "unsupported_claims")).toBe(true);
  });

  it("flags duplicates against existing captions", () => {
    const r = runContentQa({
      ...base,
      caption: "5 canva features students must know today and use daily",
      existingCaptions: ["5 canva features students must know today and use daily in class"],
    });
    expect(r.issues.some((i) => i.check === "duplicate")).toBe(true);
  });

  it("warns when CTA missing", () => {
    const r = runContentQa({ ...base, caption: "Nice post", cta: null });
    expect(r.issues.some((i) => i.check === "cta_missing")).toBe(true);
  });
});
