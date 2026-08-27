import { describe, expect, it } from "vitest";
import {
  addMemorySchema,
  contentRulesSchema,
  linesToArray,
  arrayToLines,
  createWorkspaceSchema,
} from "@/lib/validation";

describe("createWorkspaceSchema", () => {
  it("accepts a normal workspace name with default timezone", () => {
    const r = createWorkspaceSchema.safeParse({ name: "Moiz Creator", industry: "", timezone: "Asia/Karachi" });
    expect(r.success).toBe(true);
  });

  it("rejects a too-short name", () => {
    const r = createWorkspaceSchema.safeParse({ name: "M" });
    expect(r.success).toBe(false);
  });
});

describe("linesToArray / arrayToLines", () => {
  it("splits, trims and drops empty lines", () => {
    expect(linesToArray("cheap\n\n  guaranteed  \n")).toEqual(["cheap", "guaranteed"]);
  });

  it("handles null/undefined", () => {
    expect(linesToArray(null)).toEqual([]);
    expect(linesToArray(undefined)).toEqual([]);
  });

  it("round-trips", () => {
    expect(linesToArray(arrayToLines(["a", "b"]))).toEqual(["a", "b"]);
  });
});

describe("contentRulesSchema", () => {
  it("defaults list fields to empty arrays", () => {
    const r = contentRulesSchema.parse({
      avoidWords: [],
      avoidClaims: [],
      avoidTopics: [],
      ctaRule: "",
      hashtagRules: "",
      languageRules: "",
    });
    expect(r.avoidWords).toEqual([]);
  });
});

describe("addMemorySchema", () => {
  it("accepts a valid memory", () => {
    const r = addMemorySchema.safeParse({ type: "preference", content: "No emojis in business posts" });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown type", () => {
    const r = addMemorySchema.safeParse({ type: "vibe", content: "something" });
    expect(r.success).toBe(false);
  });

  it("rejects a too-short content", () => {
    const r = addMemorySchema.safeParse({ type: "fact", content: "ab" });
    expect(r.success).toBe(false);
  });
});
