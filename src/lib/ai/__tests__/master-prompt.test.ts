import { describe, expect, it } from "vitest";
import type { BrandBrainRow } from "@/lib/ai/brand-summary";
import { buildMasterPrompt, type MasterPromptInput } from "@/lib/ai/master-prompt";

function makeBrand(): BrandBrainRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    workspaceId: "22222222-2222-2222-2222-222222222222",
    businessName: "Aurora Coffee Co.",
    description: "Specialty coffee roaster",
    industry: "Food & beverage",
    products: "Single-origin beans, cold brew",
    services: null,
    pricing: null,
    offers: null,
    locations: "Seattle",
    website: "auroracoffee.example",
    contact: null,
    cta: "Order now",
    targetMarket: "Urban coffee lovers 25-40",
    audience: {
      demographics: "25-40 urban professionals",
      interests: "specialty coffee, design",
      problems: "no time for slow mornings",
    },
    voicePresets: ["Premium", "Friendly"],
    voiceCustom: null,
    visualIdentity: {
      primaryColor: "#6d28d9",
      secondaryColor: "#f59e0b",
      fonts: "Modern geometric sans",
      imageStyle: "editorial photography",
    },
    contentRules: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as unknown as BrandBrainRow;
}

function baseInput(overrides: Partial<MasterPromptInput> = {}): MasterPromptInput {
  return {
    brand: makeBrand(),
    platform: "instagram",
    contentType: "single_image",
    title: "Cold brew season is here",
    objective: "Drive online orders",
    hook: "Your mornings, but colder",
    caption:
      "Our new single-origin cold brew is here. Slow-steeped for 18 hours for a smooth, chocolatey cup that keeps your afternoon going.",
    cta: "Order now",
    firstComment: "Which origin should we roast next?",
    hashtags: ["coldbrew", "coffee"],
    visualConcept: "Frosted glass of cold brew with coffee beans swirling around it",
    slides: null,
    script: null,
    referenceImages: [{ kind: "brand", label: "packaging hero shot" }],
    ...overrides,
  };
}

describe("buildMasterPrompt — premium art direction", () => {
  it("frames the output as expert creative direction, not a basic brief", () => {
    const p = buildMasterPrompt(baseInput());
    expect(p).toContain("Expert Creative Director");
    expect(p).toContain("Professional Graphic Designer");
    expect(p).toContain("Social Media Visual Strategist");
    expect(p).toContain("premium, scroll-stopping");
  });

  it("covers the full premium-direction checklist", () => {
    const p = buildMasterPrompt(baseInput());
    const required = [
      "Creative concept & visual storytelling",
      "Composition & layout",
      "Main subject",
      "Background, color & visual identity",
      "Typography",
      "Exact text that must appear",
      "Icons, graphics & decorative details",
      "Lighting, shadows, reflections, depth & atmosphere",
      "Premium design style & theme",
      "CTA placement",
      "Platform format, dimensions & safe areas",
      "Strictly avoid",
    ];
    for (const token of required) expect(p).toContain(token);
  });

  it("includes the explicit avoid list", () => {
    const p = buildMasterPrompt(baseInput());
    for (const token of [
      "Distorted anatomy",
      "garbled, misspelled or placeholder text",
      "Unwanted objects",
      "Watermarks",
      "Logos",
      "never draw a logo",
    ]) {
      expect(p).toContain(token);
    }
  });

  it("anchors the direction in brand colors, audience and CTA data", () => {
    const p = buildMasterPrompt(baseInput());
    expect(p).toContain("#6d28d9");
    expect(p).toContain("#f59e0b");
    expect(p).toContain("Aurora Coffee Co.");
    expect(p).toContain("Urban coffee lovers 25-40");
    expect(p).toContain("Order now");
    expect(p).toContain("editorial photography");
  });

  it("treats the caption as message context, never as in-design text", () => {
    const p = buildMasterPrompt(baseInput());
    expect(p).toContain("Message to express visually");
    expect(p).toContain("Never render the full caption inside the design");
    // The long caption is context; the exact in-design text is the hook + CTA.
    expect(p).toContain('Headline: "Your mornings, but colder"');
    expect(p).not.toContain('Headline: "Our new single-origin cold brew is here');
  });

  it("derives platform-specific dimensions and safe areas", () => {
    const reel = buildMasterPrompt(baseInput({ platform: "instagram", contentType: "reel" }));
    expect(reel).toContain("9:16");
    expect(reel).toContain("1080 × 1920");
    expect(reel).toContain("safe zone");

    const square = buildMasterPrompt(baseInput({ platform: "instagram", contentType: "single_image" }));
    expect(square).toContain("1:1");
    expect(square).toContain("1080 × 1080");

    const fb = buildMasterPrompt(baseInput({ platform: "facebook", contentType: "single_image" }));
    expect(fb).toContain("1:1");

    const textPost = buildMasterPrompt(baseInput({ contentType: "text_post" }));
    expect(textPost).toContain("text-only post");
  });

  it("directs every carousel slide under one consistent design system", () => {
    const slides = [
      { index: 1, headline: "Cold brew, explained", visualPrompt: "Frosted glass front and center" },
      { index: 2, headline: "18-hour steep", visualPrompt: "Slow pour over ice" },
      { index: 3, headline: "Try it today", visualPrompt: "Can with beans scattered around" },
    ];
    const p = buildMasterPrompt(baseInput({ contentType: "carousel", slides }));
    expect(p).toContain("ONE consistent design system");
    expect(p).toContain("Slide 1:");
    expect(p).toContain("Slide 2:");
    expect(p).toContain("Slide 3:");
    expect(p).toContain("Cover slide");
    expect(p).toContain("Closing slide");
    expect(p).toContain("Cold brew, explained");
    expect(p).toContain("Slow pour over ice");
  });

  it("directs reels scene by scene with timing and transitions", () => {
    const script = {
      hook: "18 hours of patience",
      totalDuration: 30,
      scenes: [
        {
          durationSeconds: 4,
          visualDirection: "Macro shot of coffee dripping",
          onScreenText: "18 hours",
          text: "Good things take time.",
          transition: "Hard cut",
        },
        {
          durationSeconds: 6,
          visualDirection: "Pour over a frosted glass",
          onScreenText: "Slow-steeped",
          text: "Slow-steeped to be smooth.",
          transition: "Whip pan",
        },
      ],
      outro: "Order your first batch today",
    };
    const p = buildMasterPrompt(baseInput({ contentType: "reel", script }));
    expect(p).toContain("scene-by-scene visual direction");
    expect(p).toContain("Scene 1:");
    expect(p).toContain("Scene 2:");
    expect(p).toContain("Opening hook: 18 hours of patience");
    expect(p).toContain("Transition: Hard cut");
    expect(p).toContain("On-screen text: \"Slow-steeped\"");
    expect(p).toContain("Outro:");
  });

  it("describes reference images when present and says when none exist", () => {
    const withRefs = buildMasterPrompt(
      baseInput({ referenceImages: [{ kind: "brand", label: "packaging hero shot" }] }),
    );
    expect(withRefs).toContain("packaging hero shot");
    expect(withRefs).toContain("style, composition, mood");
    expect(withRefs).toContain("Never copy their subjects");

    const none = buildMasterPrompt(baseInput({ referenceImages: [] }));
    expect(none).toContain("No reference images were provided for this post");
  });

  it("gives every post a fresh concept (never identical across posts)", () => {
    const a = buildMasterPrompt(baseInput());
    const b = buildMasterPrompt(
      baseInput({
        title: "Roastery tour signups open",
        objective: "Grow the email list",
        hook: "See where the magic happens",
        caption: "Join a behind-the-scenes roastery tour, taste three origins, and meet the roast master.",
        cta: "Reserve a spot",
        visualConcept: "Open roastery doors with warm light spilling out onto the street",
      }),
    );
    expect(a).not.toBe(b);
    // The variety must extend to composition and palette, not just copy.
    const layoutA = a.split("\n").find((l) => l.startsWith("Layout: "));
    const layoutB = b.split("\n").find((l) => l.startsWith("Layout: "));
    const paletteA = a.split("\n").find((l) => l.startsWith("Palette: "));
    const paletteB = b.split("\n").find((l) => l.startsWith("Palette: "));
    expect([layoutA, paletteA].join("|")).not.toBe([layoutB, paletteB].join("|"));
  });

  it("is deterministic for the same post (stable, reproducible direction)", () => {
    expect(buildMasterPrompt(baseInput())).toBe(buildMasterPrompt(baseInput()));
  });

  it("works without a brand brain (sensible defaults, still premium)", () => {
    const p = buildMasterPrompt(baseInput({ brand: null, cta: null }));
    expect(p).toContain("Expert Creative Director");
    expect(p).toContain("Palette:");
    expect(p).toContain("CTA: invent a short, on-brand call to action");
  });
});
