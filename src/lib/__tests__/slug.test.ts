import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Moiz Creator")).toBe("moiz-creator");
  });

  it("strips non url-friendly characters", () => {
    expect(slugify("QURTIZ AI! (2026)")).toBe("qurtiz-ai-2026");
  });

  it("collapses repeated separators", () => {
    expect(slugify("a   --  b")).toBe("a-b");
  });

  it("falls back to workspace when the name is empty", () => {
    expect(slugify("!!!")).toBe("workspace");
  });

  it("caps length at 48 chars", () => {
    expect(slugify("a".repeat(80)).length).toBe(48);
  });
});

describe("uniqueSlug", () => {
  it("returns the root slug when free", () => {
    expect(uniqueSlug("Eagle Delivery", ["moiz-creator"])).toBe("eagle-delivery");
  });

  it("appends a numeric suffix when taken", () => {
    expect(uniqueSlug("Eagle", ["eagle"])).toBe("eagle-2");
    expect(uniqueSlug("Eagle", ["eagle", "eagle-2"])).toBe("eagle-3");
  });

  it("never collides within the provided list", () => {
    const taken = ["x", "x-2", "x-3"];
    expect(uniqueSlug("x", taken)).toBe("x-4");
  });
});
