import "server-only";

import { generateText } from "ai";
import { getWorkspaceTextModel } from "@/lib/ai/config";
import { AI_GENERATION_TIMEOUT_MS } from "@/lib/ai/content";
import { buildMasterPrompt, formatSpecFor, type MasterPromptInput } from "@/lib/ai/master-prompt";
import { summarizeBrandBrain } from "@/lib/ai/brand-summary";

/**
 * Dynamic Master AI Prompt generation ("Copy Master AI Prompt").
 *
 * The button must NOT return a static shell: this module makes a real call
 * to the workspace's configured strongest text model (the "content" task
 * model — task override aware, never a hard-coded model name) and has it
 * write a bespoke, premium master prompt for the ACTUAL post: topic,
 * hook, caption, hashtags, first comment, visual prompt, Brand Brain,
 * memory preferences, platform and content type.
 *
 * The deterministic buildMasterPrompt() builder survives ONLY as an honest
 * fallback when the AI call is unavailable/fails (result carries
 * source: "template") — the button never breaks, and the static shell is
 * never silently presented as an AI-generated prompt to the caller: the
 * source flag makes the provenance explicit.
 */

/** Required section headings in the AI-written master prompt. */
export const MASTER_PROMPT_SECTIONS = [
  "Creative brief",
  "Brand context",
  "Objective",
  "Audience",
  "Message",
  "Creative direction",
  "Composition & layout",
  "Color palette",
  "Typography",
  "Visual hierarchy",
  "CTA",
  "Contact details",
  "Platform dimensions & safe areas",
  "Strict avoid rules",
  "Output requirement",
] as const;

/** Template-filler phrases that mark a lazy, generic prompt — banned. */
const BANNED_FILLER = [
  "A 5-slide carousel",
  "Show this, then show that",
  "Show this... then show that",
  "Clean, modern design",
  "Eye-catching design",
  "Bold and vibrant",
  "Make it pop",
  "High-quality image of",
];

const MASTER_PROMPT_PERSONA = `You are a world-class Creative Director + Senior Social Media Designer + expert AI-image prompt engineer.
You write MASTER AI PROMPTS: complete, self-contained creative briefs that an external AI image/video tool (Gemini, ChatGPT image tools, Midjourney, Flux) can execute flawlessly.
Your prompts are bespoke works of art direction — every line is specific to the post and brand at hand. You never write generic design boilerplate, and you never summarize; you DIRECT.`;

/**
 * Build the generation instruction (input data + required structure) for
 * the AI call. Pure and exported for tests.
 */
export function buildMasterPromptInstruction(args: {
  input: MasterPromptInput;
  memoryLines?: string | null;
}): string {
  const { input } = args;
  const b = input.brand;
  const spec = formatSpecFor(input.platform, input.contentType);
  const identity = (b?.visualIdentity ?? {}) as Record<string, string | undefined>;

  const contactBits: string[] = [];
  if (b?.contact?.trim()) contactBits.push("Contact/WhatsApp: " + b.contact.trim());
  if (b?.website?.trim()) contactBits.push("Website: " + b.website.trim());
  if (b?.cta?.trim()) contactBits.push("Brand's primary CTA: " + b.cta.trim());
  if (b?.locations?.trim()) contactBits.push("Locations: " + b.locations.trim());

  const slides = (input.slides ?? []).slice().sort((a, z) => a.index - z.index);
  const scenes = input.script?.scenes ?? [];

  const lines: string[] = [];
  lines.push("Write the MASTER AI PROMPT for the post below. Follow the REQUIRED STRUCTURE exactly (use ## headings), and make every line specific to THIS post and THIS brand.");
  lines.push("");
  lines.push("=== POST DATA (use all of it; carry exact strings where instructed) ===");
  lines.push("Title / topic: " + input.title);
  lines.push("Platform: " + input.platform + " · Content type: " + input.contentType.replaceAll("_", " "));
  lines.push("Objective: " + (input.objective?.trim() || "Engagement + awareness"));
  if (input.hook?.trim()) lines.push("Hook (exact first line of the caption): " + input.hook.trim());
  if (input.caption?.trim()) lines.push("Caption (express visually; the design must NEVER render the full caption): " + input.caption.trim());
  if (input.cta?.trim()) lines.push("CTA (exact button/link text to render): " + input.cta.trim());
  if (input.firstComment?.trim()) lines.push("First comment: " + input.firstComment.trim());
  if (input.hashtags.length > 0) lines.push("Hashtags: " + input.hashtags.map((h) => (h.startsWith("#") ? h : "#" + h)).join(" "));
  if (input.visualConcept?.trim()) lines.push("Visual prompt already approved for this post (elevate it into full art direction — more advanced and refined than this, never just repeat it): " + input.visualConcept.trim());
  lines.push("");
  lines.push("=== BRAND BRAIN (use automatically — never ask for these details again) ===");
  lines.push(summarizeBrandBrain(b));
  if (contactBits.length > 0) lines.push("Contact block to include where relevant: " + contactBits.join(" · "));
  if (identity.primaryColor || identity.secondaryColor || identity.fonts || identity.imageStyle) {
    lines.push(
      "Visual identity: primary " +
        (identity.primaryColor ?? "—") +
        ", secondary " +
        (identity.secondaryColor ?? "—") +
        (identity.fonts ? ", fonts: " + identity.fonts : "") +
        (identity.imageStyle ? ", style: " + identity.imageStyle : ""),
    );
  }
  if (args.memoryLines?.trim()) {
    lines.push("");
    lines.push("=== WORKSPACE MEMORY / PREFERENCES (respect them) ===");
    lines.push(args.memoryLines.trim());
  }
  lines.push("");
  lines.push("=== PLATFORM FORMAT ===");
  lines.push(`${spec.ratio} · ${spec.dims} · ${spec.note} Safe areas: ${spec.safe}`);

  if (input.contentType === "carousel" && slides.length > 0) {
    lines.push("");
    lines.push("=== CAROUSEL SLIDES (give EACH slide its own art direction in ONE shared design system) ===");
    for (const s of slides) {
      lines.push(
        `Slide ${s.index}: headline "${s.headline?.trim() ?? ""}"${s.visualPrompt?.trim() ? " — current direction: " + s.visualPrompt.trim() : ""}`,
      );
    }
    lines.push("Strong narrative arc required: slide 1 = hook-cover that stops the scroll; middle slides each advance ONE distinct idea (no repetition); final slide = strongest CTA, mirroring the cover so the set feels bookended.");
  }

  if (input.contentType === "reel" && input.script) {
    lines.push("");
    lines.push("=== REEL SCRIPT (turn into scene-by-scene visual direction with timing) ===");
    if (input.script.hook?.trim()) lines.push("Opening hook: " + input.script.hook.trim());
    scenes.forEach((s, i) => {
      const parts: string[] = [];
      if (s.durationSeconds) parts.push(`${s.durationSeconds}s`);
      if (s.visualDirection?.trim()) parts.push(s.visualDirection.trim());
      if (s.onScreenText?.trim()) parts.push(`on-screen: "${s.onScreenText.trim()}"`);
      if (s.text?.trim()) parts.push("VO: " + s.text.trim());
      if (s.transition?.trim()) parts.push("transition: " + s.transition.trim());
      lines.push(`Scene ${i + 1}: ` + (parts.join(" | ") || "(fill in creatively from the message)"));
    });
    if (input.script.outro?.trim()) lines.push("Outro: " + input.script.outro.trim());
  }

  lines.push("");
  lines.push("=== REQUIRED STRUCTURE (markdown, every section present and bespoke) ===");
  for (const s of MASTER_PROMPT_SECTIONS) lines.push(`## ${s}`);
  if (input.contentType === "carousel") lines.push("## Slide-by-slide guidance");
  if (input.contentType === "reel") lines.push("## Reel scene direction");
  lines.push("");
  lines.push("=== QUALITY BAR (non-negotiable) ===");
  lines.push("- Specific to this post: quote the exact hook, CTA, offer and pricing where they belong; name the brand's real products/services, not generic category nouns.");
  lines.push("- Creative direction reads like it came from a Creative Director: ONE strong visual metaphor, deliberate composition, exact text hierarchy (headline ≤8 words), precise typography direction, palette anchored to brand colors.");
  lines.push("- Contact details section: include the WhatsApp/phone/website/CTA from Brand Brain with placement guidance; write \"none provided — do not invent\" only when the Brand Brain has none.");
  lines.push("- Logo: reserve a clean corner space for the real logo (it is composited later) — never instruct the tool to draw or invent a logo.");
  lines.push("- Strict avoid rules: no garbled/placeholder text, no watermarks, no logos drawn, no clutter, no style drift, no text outside safe areas, never render the full caption inside the design.");
  lines.push("- Output requirement: state the exact deliverable — dimensions, file/quality expectations, and the quality bar (top-tier agency design, not a stock template).");
  lines.push("- Length: a complete, dense brief (roughly 350-650 words of direction). Markdown headings only — no preamble, no commentary, no closing remarks.");
  lines.push(`- NEVER write these filler phrases: ${BANNED_FILLER.map((f) => `"${f}"`).join(", ")}.`);

  return lines.join("\n");
}

/** Quick sanity check: the AI text must look like a real brief, not a stub. */
function looksLikeMasterPrompt(text: string): boolean {
  if (text.length < 800) return false;
  const requiredHits = ["creative brief", "palette", "typography", "cta", "avoid", "output"].filter((s) =>
    text.toLowerCase().includes(s),
  ).length;
  if (requiredHits < 4) return false;
  return !BANNED_FILLER.some((f) => text.toLowerCase().includes(f.toLowerCase()));
}

/**
 * Generate the Master AI Prompt dynamically with the workspace's strongest
 * configured content model. Falls back to the deterministic premium
 * template ONLY when the AI path is unavailable or fails — the `source`
 * flag always tells the caller which one was produced.
 */
export async function generateMasterPrompt(args: {
  workspaceId: string;
  input: MasterPromptInput;
  memoryLines?: string | null;
}): Promise<{ ok: true; prompt: string; source: "ai" | "template"; model?: string }> {
  const fallback = (): { ok: true; prompt: string; source: "template" } => ({
    ok: true,
    prompt: buildMasterPrompt(args.input),
    source: "template",
  });

  try {
    const resolved = await getWorkspaceTextModel(args.workspaceId, "content");
    const instruction = buildMasterPromptInstruction({ input: args.input, memoryLines: args.memoryLines });
    const result = await generateText({
      model: resolved.model,
      system: MASTER_PROMPT_PERSONA,
      prompt: instruction,
      maxOutputTokens: 4096,
      abortSignal: AbortSignal.timeout(AI_GENERATION_TIMEOUT_MS),
      maxRetries: 1,
    });
    const text = result.text.trim();
    if (!looksLikeMasterPrompt(text)) {
      console.info("[master-prompt] AI output failed the quality gate — serving deterministic template instead.");
      return fallback();
    }
    return { ok: true, prompt: text, source: "ai", model: resolved.modelId };
  } catch (error) {
    console.info(
      "[master-prompt] dynamic AI generation unavailable (" +
        (error instanceof Error ? error.message.slice(0, 120) : "unknown") +
        ") — serving deterministic template instead.",
    );
    return fallback();
  }
}

export { BANNED_FILLER };
