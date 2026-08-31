import type { BrandBrainRow } from "@/lib/ai/brand-summary";
import { summarizeBrandBrain } from "@/lib/ai/brand-summary";

export type MasterPromptInput = {
  brand: BrandBrainRow | null;
  platform: string;
  contentType: string;
  title: string;
  hook: string | null;
  caption: string | null;
  firstComment: string | null;
  hashtags: string[];
  visualConcept: string | null;
  slides?: { index: number; headline?: string; visualPrompt?: string }[] | null;
  script?: {
    hook?: string;
    scenes?: { text?: string; voiceover?: string; visualDirection?: string; onScreenText?: string; transition?: string; durationSeconds?: number }[];
    outro?: string;
    totalDuration?: number;
  } | null;
  referenceNote: string;
};

/**
 * Builds a complete external-AI-ready prompt from the actual post + Brand
 * Brain data. No fabrication: every section comes from stored data.
 */
export function buildMasterPrompt(input: MasterPromptInput): string {
  const b = input.brand;
  const identity = (b?.visualIdentity ?? {}) as Record<string, string | undefined>;
  const lines: string[] = [];

  lines.push("You are creating the visual for a social media post. Follow this brief exactly.");
  lines.push("");
  lines.push("## Brand context");
  lines.push(summarizeBrandBrain(b));
  const colors: string[] = [];
  if (identity.primaryColor) colors.push("primary " + identity.primaryColor);
  if (identity.secondaryColor) colors.push("secondary " + identity.secondaryColor);
  lines.push("");
  lines.push("## Visual style");
  if (identity.imageStyle) lines.push("Style: " + identity.imageStyle);
  if (colors.length) lines.push("Brand colors: " + colors.join(", "));
  if (identity.fonts) lines.push("Fonts: " + identity.fonts);
  lines.push("Aspect ratio: portrait 4:5 (1080x1350), clean composition, no watermarks, no distorted logos.");
  lines.push("Reference images: " + (input.referenceNote || "A brand logo will be composited bottom-left afterwards; leave clean space there. Do not draw the logo yourself."));

  lines.push("");
  lines.push("## Post");
  lines.push("Platform: " + input.platform);
  lines.push("Content type: " + input.contentType);
  if (input.title) lines.push("Title: " + input.title);
  if (input.hook) lines.push("Hook: " + input.hook);
  if (input.caption) lines.push("Caption: " + input.caption);
  if (input.firstComment) lines.push("First comment: " + input.firstComment);
  if (input.hashtags.length) lines.push("Hashtags: " + input.hashtags.map((h) => "#" + h).join(" "));

  lines.push("");
  lines.push("## Visual direction");
  if (input.visualConcept) lines.push(input.visualConcept);

  if (input.contentType === "carousel" && input.slides && input.slides.length > 0) {
    lines.push("");
    lines.push("## Carousel slides (one visual per slide, consistent theme)");
    for (const s of input.slides) {
      lines.push("Slide " + s.index + (s.headline ? " — " + s.headline : "") + ": " + (s.visualPrompt ?? ""));
    }
  }

  if (input.contentType === "reel" && input.script) {
    lines.push("");
    lines.push("## Reel script (total " + (input.script.totalDuration ?? 30) + "s)");
    if (input.script.hook) lines.push("Hook: " + input.script.hook);
    for (const s of input.script.scenes ?? []) {
      const parts: string[] = [];
      if (s.durationSeconds) parts.push(s.durationSeconds + "s");
      if (s.text) parts.push("VO: " + s.text);
      if (s.visualDirection) parts.push("Visual: " + s.visualDirection);
      if (s.onScreenText) parts.push('On-screen: "' + s.onScreenText + '"');
      if (s.transition) parts.push("Transition: " + s.transition);
      if (parts.length) lines.push("- " + parts.join(" | "));
    }
    if (input.script.outro) lines.push("Outro: " + input.script.outro);
  }

  lines.push("");
  lines.push("## Output");
  lines.push("Produce the final visual for the stated platform and content type, matching every requirement above.");

  return lines.join("\n");
}
