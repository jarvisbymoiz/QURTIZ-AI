import { describe, expect, it } from "vitest";
import { buildContentSystemPrompt, generatedContentSchema } from "@/lib/ai/content";

/**
 * Content Studio generation quality: the system prompt + schema must push
 * the model toward strong captions, designer-grade visual prompts and
 * consistent carousel systems — not generic one-liners.
 */

const system = buildContentSystemPrompt({
  brandName: "Chai & Co",
  brandSummary: "Business: Chai & Co",
  memoryLines: "(none)",
});

describe("content generation system prompt — caption craft", () => {
  it("demands audience-first, specific, structured captions with matching CTA intent", () => {
    expect(system).toMatch(/Strategy and human copy/i);
    expect(system).toMatch(/audience/i);
    expect(system).toMatch(/goal-matched CTA/i);
  });

  it("bans generic openers and clichés explicitly", () => {
    expect(system).toContain("Exciting news");
    expect(system).toContain("Check this out");
    expect(system).toMatch(/corporate filler/i);
  });

  it("difference-trains the platforms and the hashtags", () => {
    expect(system).toMatch(/Instagram benefits from a strong first line/i);
    expect(system).toMatch(/Facebook can be warmer/i);
    expect(system).toMatch(/niche, locality, and offer/i);
  });

  it("requires automatic use of known Brand Brain details (no re-asking)", () => {
    expect(system).toMatch(/WhatsApp, and links only when supplied/i);
    expect(system).toMatch(/Do not make the user repeat known information/i);
  });
});

describe("content generation system prompt — visual direction bar", () => {
  it("demands a designer-executable creative brief, not a one-liner", () => {
    expect(system).toMatch(/Visual creative direction/i);
    expect(system).toContain("aspect ratio");
    expect(system).toMatch(/hierarchy/i);
    expect(system).toMatch(/exact short on-image headline/i);
    expect(system).toMatch(/not a vague adjective list/i);
  });

  it("requires one consistent carousel design system with a narrative arc and CTA closer", () => {
    expect(system).toMatch(/one coherent palette, grid, typography/i);
    expect(system).toMatch(/varied value progression/i);
    expect(system).toMatch(/CTA close/i);
  });

  it("pins the logo rule and promotional contact/trust elements", () => {
    expect(system).toMatch(/never ask an image model to draw, approximate, or render the brand logo/i);
    expect(system).toMatch(/product or offer treatment, contact placement/i);
  });
});

describe("generated content schema — higher quality bars", () => {
  it("accepts detailed slide prompts beyond the old 400-character cap", () => {
    const sample = {
      hook: "Karachi, your weekend just got warmer",
      mainCopy: "Weekend deal for chai lovers.",
      cta: "Order on WhatsApp",
      firstComment: "Open till 2am.",
      hashtags: ["chai"],
      keywords: [],
      visualConcept: "x".repeat(600), // long creative-direction brief now welcome
      relevanceScore: 8,
      engagementScore: 8,
      variants: [
        {
          platform: "instagram",
          format: "carousel",
          caption: "Strong caption",
          hashtags: ["chai"],
          cta: "Order",
          slides: [
            { index: 1, headline: "Slide One", visualPrompt: "y".repeat(500) }, // > old 400 cap
            { index: 2, headline: "Slide Two", visualPrompt: "Show the product use clearly." },
            { index: 3, headline: "Slide Three", visualPrompt: "Finish with the exact CTA." },
          ],
        },
      ],
    };
    const parsed = generatedContentSchema.safeParse(sample);
    expect(parsed.success).toBe(true);
  });

  it("still caps slide prompts at the new 1200-character ceiling", () => {
    const base = {
      hook: "h",
      mainCopy: "m",
      hashtags: ["a"],
      variants: [{ platform: "instagram", format: "carousel", caption: "c", slides: [{ index: 1, headline: "h", visualPrompt: "z".repeat(1300) }] }],
    };
    const parsed = generatedContentSchema.safeParse(base);
    expect(parsed.success).toBe(false);
  });

  it("schema descriptions themselves teach the quality bar (structured-output guidance)", () => {
    const shape = generatedContentSchema.shape;
    expect(String(shape.visualConcept.description)).toMatch(/creative-direction brief/i);
    expect(String(shape.hook.description)).toMatch(/no clichés/i);
    const variantCaption = shape.variants.element.shape.caption;
    expect(String(variantCaption.description)).toMatch(/Never generic filler/i);
  });
});
