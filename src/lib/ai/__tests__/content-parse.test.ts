import { describe, expect, it } from "vitest";
import {
  AIContentParseError,
  extractJsonCandidate,
  parseGeneratedContentObject,
  validateGeneratedContent,
} from "@/lib/ai/content";

/** Minimal object that satisfies every required field of the schema. */
const VALID = {
  hook: "Stop scrolling — this changes how you post",
  mainCopy: "Here is why a consistent posting system matters for your brand.",
  cta: "Book a free demo",
  firstComment: "More tips in the comments — follow for daily tactics!",
  hashtags: ["marketing", "socialmedia"],
  keywords: ["content strategy"],
  visualConcept: "Bold headline over a clean product photo",
  relevanceScore: 8,
  engagementScore: 7,
  variants: [
    {
      platform: "facebook",
      format: "single_image",
      caption: "Facebook caption body",
      hashtags: ["marketing"],
      cta: "Learn more",
    },
  ],
};

describe("extractJsonCandidate", () => {
  const json = JSON.stringify(VALID);

  it("passes plain JSON through", () => {
    expect(extractJsonCandidate(json)).toBe(json);
  });

  it("strips a ```json fence", () => {
    expect(extractJsonCandidate("```json\n" + json + "\n```")).toBe(json);
  });

  it("strips a plain fence and tolerates trailing prose", () => {
    expect(extractJsonCandidate("```\n" + json + "\n```\nHope this helps!")).toBe(json);
  });

  it("extracts JSON that follows prose", () => {
    expect(extractJsonCandidate("Sure! Here is your post:\n" + json)).toBe(json);
  });

  it("returns null when there is no brace-delimited object", () => {
    expect(extractJsonCandidate("Sorry, I cannot help with that.")).toBeNull();
  });
});

describe("parseGeneratedContentObject", () => {
  it("parses a valid plain JSON object", () => {
    const r = parseGeneratedContentObject(JSON.stringify(VALID));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.hook).toBe(VALID.hook);
  });

  it("parses a fenced valid object", () => {
    const r = parseGeneratedContentObject("```json\n" + JSON.stringify(VALID) + "\n```");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.variants).toHaveLength(1);
  });

  it("parses a fenced object wrapped in prose", () => {
    const r = parseGeneratedContentObject(
      "Here you go:\n```json\n" + JSON.stringify(VALID) + "\n```\nEnjoy!",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.mainCopy).toBe(VALID.mainCopy);
  });

  it("fails with issues on invalid JSON", () => {
    const r = parseGeneratedContentObject('{"hook": "a",}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues).toContain("invalid JSON");
  });

  it("reports validation issues when mainCopy is missing", () => {
    const r = parseGeneratedContentObject(JSON.stringify({ ...VALID, mainCopy: undefined }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues).toContain("mainCopy");
  });
});

describe("validateGeneratedContent", () => {
  it("clamps out-of-range scores and defaults missing ones", () => {
    const clamped = validateGeneratedContent({ ...VALID, relevanceScore: 250, engagementScore: -3 });
    expect(clamped.ok).toBe(true);
    if (clamped.ok) {
      expect(clamped.data.relevanceScore).toBe(10);
      expect(clamped.data.engagementScore).toBe(0);
    }

    const defaulted = validateGeneratedContent({
      ...VALID,
      relevanceScore: undefined,
      engagementScore: undefined,
    });
    expect(defaulted.ok).toBe(true);
    if (defaulted.ok) {
      expect(defaulted.data.relevanceScore).toBe(7);
      expect(defaulted.data.engagementScore).toBe(7);
    }
  });

  it("applies defaults for omitted optional fields", () => {
    const r = validateGeneratedContent({
      ...VALID,
      cta: undefined,
      firstComment: undefined,
      keywords: undefined,
      visualConcept: undefined,
      variants: [
        {
          platform: "instagram",
          caption: "Instagram caption",
          format: "video", // unknown value must map to the single_image default
          hashtags: undefined,
          cta: undefined,
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.cta).toBe("");
      expect(r.data.firstComment).toBe("");
      expect(r.data.keywords).toEqual([]);
      expect(r.data.visualConcept).toBe("");
      expect(r.data.variants[0]?.format).toBe("single_image");
      expect(r.data.variants[0]?.hashtags).toEqual([]);
      expect(r.data.variants[0]?.cta).toBe("");
    }
  });

  it("enforces at least one variant and required variant fields", () => {
    const noVariants = validateGeneratedContent({ ...VALID, variants: [] });
    expect(noVariants.ok).toBe(false);
    if (!noVariants.ok) expect(noVariants.issues).toContain("variants");

    const emptyCaption = validateGeneratedContent({
      ...VALID,
      variants: [{ ...VALID.variants[0], caption: "" }],
    });
    expect(emptyCaption.ok).toBe(false);
    if (!emptyCaption.ok) expect(emptyCaption.issues).toContain("caption");
  });
});

describe("AIContentParseError", () => {
  it("carries a short response-shape summary, never the raw model text", () => {
    const rawModelText = "```json\n" + JSON.stringify(VALID).repeat(10) + "\n```";
    const error = new AIContentParseError({
      rawLength: rawModelText.length,
      hadFence: true,
      hadBraces: true,
      issues: "invalid JSON",
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AIContentParseError");
    expect(error.message).toContain(`raw length ${rawModelText.length}`);
    expect(error.message).toContain("markdown-fenced");
    expect(error.message).toContain("invalid JSON");
    // No field of the diagnostics (or the message) carries the model text.
    expect(JSON.stringify(error.diagnostics)).not.toContain(VALID.hook);
    expect(error.message).not.toContain(VALID.hook);
  });
});
