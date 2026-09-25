import { describe, expect, it } from "vitest";
import { buildVisualGenerationBrief } from "@/lib/ai/visual-brief";
import type { MasterPromptInput } from "@/lib/ai/master-prompt";

const post: MasterPromptInput = {
  brand: null, platform: "instagram", contentType: "single_image", title: "Autumn skin consultation",
  objective: "Book consultations", hook: "A calmer skin routine starts here", caption: "Book an autumn skin consultation to build a simple routine.",
  cta: "Message us on WhatsApp", firstComment: null, hashtags: ["#Skincare"],
  visualConcept: "An overhead scene of amber bottles on warm linen with raking afternoon light.",
};

describe("shared image-generation brief", () => {
  it("keeps Visual Prompt first while using verified brand, offer, pricing and contact facts", () => {
    const brief = buildVisualGenerationBrief({ ...post, brand: {
      businessName: "Luma Skin", products: "Botanical serums", pricing: "Consultation $25", offers: "20% off first consultation",
      contact: "+1 555 0100", website: "https://luma.example", targetMarket: "Busy adults with sensitive skin",
      visualIdentity: { primaryColor: "#C76B45", secondaryColor: "#F4E5D5", imageStyle: "Natural-light still life" },
      voicePresets: ["calm"],
    } as NonNullable<MasterPromptInput["brand"]> });
    expect(brief.prompt).toContain(`Primary creative direction (preserve this concept): ${post.visualConcept}`);
    expect(brief.prompt).toContain("Verified pricing (show only if relevant to this post): Consultation $25");
    expect(brief.prompt).toContain("Contact/WhatsApp");
    expect(brief.prompt).toContain("#C76B45");
    expect(brief.prompt).not.toContain("#Skincare");
    expect(brief.sources).toContain("visualPrompt");
    expect(brief.width).toBe(1080);
  });

  it("keeps educational content focused and does not invent sales facts", () => {
    const brief = buildVisualGenerationBrief({ ...post, objective: "Teach a simple routine", cta: "Save this guide", caption: "Cleanse, moisturize, protect.", visualConcept: "Three clear panels showing each step." });
    expect(brief.prompt).toContain("Three clear panels");
    expect(brief.prompt).not.toContain("Verified pricing");
    expect(brief.prompt).not.toContain("Contact/WhatsApp");
  });

  it("uses slide direction and shared design constraints for carousel", () => {
    const brief = buildVisualGenerationBrief({ ...post, contentType: "carousel", slideIndex: 2,
      slides: [{ index: 1, headline: "Start", visualPrompt: "Cover with one large bottle." },
        { index: 2, headline: "Step two", visualPrompt: "Close crop of applying serum." },
        { index: 3, headline: "Book", visualPrompt: "CTA on clean background." }] });
    expect(brief.prompt).toContain("Primary creative direction (preserve this concept): Close crop of applying serum.");
    expect(brief.prompt).toContain("Carousel design system");
    expect(brief.sources).toContain("slidePrompt");
  });

  it("treats blank Visual Prompt as absent and records reference context", () => {
    const brief = buildVisualGenerationBrief({ ...post, visualConcept: "  ", referenceLabels: ["Uploaded brand moodboard"] });
    expect(brief.prompt).toContain("Primary creative direction (preserve this concept): A calmer skin routine starts here");
    expect(brief.prompt).toContain("Uploaded brand moodboard");
    expect(brief.sources).toContain("hook");
  });

  it("does not replace exact text already specified in the saved Visual Prompt", () => {
    const brief = buildVisualGenerationBrief({ ...post,
      visualConcept: 'Use the exact headline "Three steps to a calmer routine" and a CTA button reading "Book today".' });
    expect(brief.prompt).toContain('Primary creative direction (preserve this concept): Use the exact headline "Three steps to a calmer routine"');
    expect(brief.prompt).toContain("Post hook for message context (keep the on-image wording specified above)");
    expect(brief.prompt).toContain("Conversion intent (keep the on-image CTA wording specified above)");
    expect(brief.prompt).not.toContain("On-image headline, if text is part of the concept");
  });
});
