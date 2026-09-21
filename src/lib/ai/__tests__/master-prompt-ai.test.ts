import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Copy Master AI Prompt: the button must produce a DYNAMIC, AI-generated
 * premium master prompt from the post's real data — never a static shell.
 */

const { getWorkspaceTextModelMock, generateTextMock } = vi.hoisted(() => ({
  getWorkspaceTextModelMock: vi.fn(),
  generateTextMock: vi.fn(),
}));

vi.mock("@/lib/ai/config", () => ({
  getWorkspaceTextModel: getWorkspaceTextModelMock,
}));

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: generateTextMock,
}));

import { buildMasterPrompt, type MasterPromptInput } from "@/lib/ai/master-prompt";
import { buildMasterPromptInstruction, generateMasterPrompt, MASTER_PROMPT_SECTIONS } from "@/lib/ai/master-prompt-ai";
import { AIConfigError } from "@/lib/ai/provider";

const brand = {
  id: "brand-1",
  workspaceId: "ws-1",
  businessName: "Chai & Co",
  description: "Premium chai cafe",
  industry: "Food & Beverage",
  products: "Karak chai, saffron chai",
  services: "Cafe, catering",
  pricing: "Karak chai PKR 250",
  offers: "Buy 2 get 1 free on weekends",
  locations: "DHA Phase 6, Karachi",
  website: "https://chaiandco.pk",
  contact: "WhatsApp 0300-1234567",
  cta: "Order on WhatsApp",
  targetMarket: "Chai lovers in Karachi, 18-40",
  audience: { demographics: "18-40 Karachi", interests: "chai culture, cafes", problems: "no late-night chai spots", goals: "", objections: "", preferredLanguage: "Urdu/English mix" },
  voicePresets: ["warm", "playful"],
  voiceCustom: "Desi-warm tone",
  visualIdentity: { primaryColor: "#7C3AED", secondaryColor: "#F59E0B", fonts: "Serif display + clean sans", imageStyle: "Cozy editorial photography" },
  contentRules: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
} as unknown as MasterPromptInput["brand"];

const carouselInput: MasterPromptInput = {
  brand,
  platform: "instagram",
  contentType: "carousel",
  title: "Weekend chai offer",
  objective: "Drive WhatsApp orders",
  hook: "Karachi, your weekend just got warmer",
  caption: "Weekend deal for chai lovers — buy 2, get 1 free.\nKarak chai PKR 250.\nOrder on WhatsApp 0300-1234567.",
  cta: "Order on WhatsApp",
  firstComment: "Open till 2am — DHA Phase 6.",
  hashtags: ["chai", "karachi", "weekendvibes"],
  visualConcept: "Cozy cup photograph with brand colors",
  slides: [
    { index: 1, headline: "Weekend Chai Deal", visualPrompt: "Steaming karak cup hero" },
    { index: 2, headline: "Buy 2 Get 1", visualPrompt: "Three cups lineup" },
    { index: 3, headline: "Order Now", visualPrompt: "WhatsApp order panel" },
  ],
  script: null,
  referenceImages: null,
};

const reelInput: MasterPromptInput = {
  ...carouselInput,
  contentType: "reel",
  slides: null,
  script: {
    hook: "POV: it's 1am and you need chai",
    scenes: [{ text: "Scene one", visualDirection: "Steam rises from cup", onScreenText: "Open till 2am", durationSeconds: 4, transition: "whip pan" }],
    outro: "Order on WhatsApp",
    totalDuration: 20,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildMasterPromptInstruction (the real generation brief)", () => {
  it("carries the post's real data: topic, exact hook, exact CTA, caption, hashtags, first comment, approved visual prompt", () => {
    const brief = buildMasterPromptInstruction({ input: carouselInput });
    expect(brief).toContain("Weekend chai offer");
    expect(brief).toContain("Karachi, your weekend just got warmer");
    expect(brief).toContain("Order on WhatsApp");
    expect(brief).toContain("#chai #karachi #weekendvibes");
    expect(brief).toContain("Open till 2am — DHA Phase 6.");
    expect(brief).toContain("Cozy cup photograph with brand colors");
  });

  it("uses Brand Brain automatically: contact/WhatsApp, website, pricing, offers, locations, colors, fonts, audience", () => {
    const brief = buildMasterPromptInstruction({ input: carouselInput });
    expect(brief).toContain("WhatsApp 0300-1234567");
    expect(brief).toContain("https://chaiandco.pk");
    expect(brief).toContain("Karak chai PKR 250");
    expect(brief).toContain("Buy 2 get 1 free on weekends");
    expect(brief).toContain("DHA Phase 6, Karachi");
    expect(brief).toContain("#7C3AED");
    expect(brief).toContain("Serif display + clean sans");
    expect(brief).toContain("no late-night chai spots"); // audience problems
  });

  it("demands every required section of the premium master prompt", () => {
    const brief = buildMasterPromptInstruction({ input: carouselInput });
    for (const section of MASTER_PROMPT_SECTIONS) {
      expect(brief).toContain(`## ${section}`);
    }
    expect(brief).toContain("## Slide-by-slide guidance"); // carousel
  });

  it("includes reel scene direction requirements for reels and feed dimensions for carousels", () => {
    const reelBrief = buildMasterPromptInstruction({ input: reelInput });
    expect(reelBrief).toContain("## Reel scene direction");
    expect(reelBrief).toContain("1080 × 1920");
    expect(reelBrief).toContain("Scene 1");
    const feedBrief = buildMasterPromptInstruction({ input: { ...carouselInput, contentType: "single_image", slides: null } });
    expect(feedBrief).toContain("1080 × 1080");
    expect(feedBrief).not.toContain("## Slide-by-slide guidance");
  });

  it("bans template filler and folds in workspace memory preferences", () => {
    const brief = buildMasterPromptInstruction({ input: carouselInput, memoryLines: "- prefers minimal layouts" });
    expect(brief).toContain("NEVER write these filler phrases");
    expect(brief).toContain("A 5-slide carousel");
    expect(brief).toContain("prefers minimal layouts");
  });
});

describe("generateMasterPrompt (dynamic AI call with honest fallback)", () => {
  const GOOD_AI_TEXT = [
    "## Creative brief",
    "Weekend chai offer for Chai & Co — WhatsApp order driver.",
    "## Brand context",
    "Premium Karachi chai cafe, DHA Phase 6.",
    "## Objective",
    "Drive WhatsApp orders this weekend.",
    "## Audience",
    "Karachi chai lovers 18-40.",
    "## Message",
    "Buy 2 get 1 free — Karak chai PKR 250.",
    "## Creative direction",
    "A single steaming karak glass on a walnut table, steam forming a subtle crescent.",
    "## Composition & layout",
    "Centered hero composition, headline top, offer chip mid, CTA bottom.",
    "## Color palette",
    "Deep #7C3AED base with #F59E0B steam glow.",
    "## Typography",
    "Serif display headline + clean sans support.",
    "## Visual hierarchy",
    "Cup → headline → offer → CTA.",
    "## CTA",
    '"Order on WhatsApp" solid button bottom-center.',
    "## Contact details",
    "WhatsApp 0300-1234567 — small footer; site https://chaiandco.pk",
    "## Platform dimensions & safe areas",
    "1:1, 1080 × 1080 px per slide, central 90% safe.",
    "## Strict avoid rules",
    "No logos drawn, no watermarks, no garbled text, never render the full caption.",
    "## Output requirement",
    "Agency-grade feed visual at exact dimensions.",
  ].join("\n");

  it("returns the AI-written prompt (source ai) through the configured content model — no hard-coded model name", async () => {
    getWorkspaceTextModelMock.mockResolvedValue({ model: { m: 1 }, modelId: "configured-strong-model" });
    generateTextMock.mockResolvedValue({ text: GOOD_AI_TEXT });
    const out = await generateMasterPrompt({ workspaceId: "ws-1", input: carouselInput, memoryLines: null });
    expect(out.source).toBe("ai");
    expect(out.model).toBe("configured-strong-model");
    expect(out.prompt).toBe(GOOD_AI_TEXT);
    expect(getWorkspaceTextModelMock).toHaveBeenCalledWith("ws-1", "content");
    // The AI actually received the real post + brand data:
    const call = generateTextMock.mock.calls[0][0];
    expect(call.prompt).toContain("Weekend chai offer");
    expect(call.prompt).toContain("WhatsApp 0300-1234567");
    expect(call.system).toContain("Creative Director");
  });

  it("rejects stub/garbled AI output and serves the deterministic template honestly (source template)", async () => {
    getWorkspaceTextModelMock.mockResolvedValue({ model: { m: 1 }, modelId: "m" });
    generateTextMock.mockResolvedValue({ text: "ok" });
    const out = await generateMasterPrompt({ workspaceId: "ws-1", input: carouselInput });
    expect(out.source).toBe("template");
    expect(out.prompt).toBe(buildMasterPrompt(carouselInput));
  });

  it("rejects AI output containing banned template filler", async () => {
    getWorkspaceTextModelMock.mockResolvedValue({ model: { m: 1 }, modelId: "m" });
    const longButLazy = GOOD_AI_TEXT.replace("A single steaming karak glass", "A 5-slide carousel with a bold and vibrant look, high-quality image of chai");
    generateTextMock.mockResolvedValue({ text: longButLazy });
    const out = await generateMasterPrompt({ workspaceId: "ws-1", input: carouselInput });
    expect(out.source).toBe("template");
  });

  it("falls back to the template when no AI is configured — never throws, never presents the template as AI output", async () => {
    getWorkspaceTextModelMock.mockRejectedValue(new AIConfigError("CONFIGURATION_REQUIRED", "no config"));
    const out = await generateMasterPrompt({ workspaceId: "ws-1", input: reelInput });
    expect(out.source).toBe("template");
    expect(out.prompt).toContain("Creative brief"); // deterministic premium template still useful
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("falls back to the template when the model call fails (quota/timeout) instead of crashing the button", async () => {
    getWorkspaceTextModelMock.mockResolvedValue({ model: { m: 1 }, modelId: "m" });
    generateTextMock.mockRejectedValue(new Error("429 quota"));
    const out = await generateMasterPrompt({ workspaceId: "ws-1", input: carouselInput });
    expect(out.source).toBe("template");
  });
});
