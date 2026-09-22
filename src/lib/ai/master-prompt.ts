import type { BrandBrainRow } from "@/lib/ai/brand-summary";

export type MasterPromptSlide = {
  index: number;
  headline?: string;
  visualPrompt?: string;
};

export type MasterPromptScene = {
  text?: string;
  voiceover?: string;
  visualDirection?: string;
  onScreenText?: string;
  transition?: string;
  durationSeconds?: number;
};

export type MasterPromptScript = {
  hook?: string;
  scenes?: MasterPromptScene[];
  outro?: string;
  totalDuration?: number;
};

/** Reference images that accompany the prompt in the external tool. */
export type MasterPromptReference = { kind: "brand" | "post"; label: string | null };

export type MasterPromptInput = {
  brand: BrandBrainRow | null;
  platform: string;
  contentType: string;
  title: string;
  objective?: string | null;
  hook: string | null;
  caption: string | null;
  cta: string | null;
  firstComment: string | null;
  hashtags: string[];
  visualConcept: string | null;
  slides?: MasterPromptSlide[] | null;
  script?: MasterPromptScript | null;
  referenceImages?: MasterPromptReference[] | null;
};

/* ── Deterministic variety seeds ─────────────────────────────────────
   Every post must get a fresh art direction. The pools below are picked
   by a hash of the post's stable identity (topic + platform + format +
   copy), so the same post always reproduces the same direction while
   different posts land on different combinations (10 archetypes × 6
   palettes × 8 moods × 6 typography × 6 lighting = 17k+ combos). The
   pools are direction cues, never example outputs. */

type LayoutArchetype = {
  layout: string;
  subject: string;
  textHierarchy: string;
  cta: string;
};

const LAYOUT_ARCHETYPES: LayoutArchetype[] = [
  {
    layout:
      "Editorial split — asymmetric 60/40 vertical split: the subject dominates the left 60% with generous negative space, a bold typographic statement occupies the right 40% aligned to a strict margin grid; thin structural rules and a baseline grid keep it gallery-quality.",
    subject:
      "Main subject anchored on the left third, cropped confidently, with supporting elements arranged along the grid lines — never overlapping the text column.",
    textHierarchy:
      "Hierarchy: oversized headline (top of the text column) → one-line supporting label → CTA at the bottom; all text left-aligned on the same baseline.",
    cta: "CTA pinned to the bottom of the right column, inside safe margins, as a solid high-contrast button.",
  },
  {
    layout:
      "Centered hero — one dominant subject dead center on a clean stage, headline above it, a compact caption band below; symmetric balance, everything optically centered, museum-poster restraint.",
    subject:
      "Main subject centered with breathing room on all sides; supporting elements (small icons or graphic chips) arranged symmetrically around it.",
    textHierarchy:
      "Hierarchy: headline centered above the subject, supporting line centered below, CTA bottom-center; equal optical margins on both sides.",
    cta: "CTA centered at the bottom of the frame inside the safe zone, full-width pill button or underlined text link.",
  },
  {
    layout:
      "Full-bleed scene + floating card — an immersive background scene fills the entire frame; a floating rounded card (subtle shadow, slight translucency) sits bottom-center and carries the message so the scene stays unobstructed.",
    subject:
      "Main subject lives inside the background scene (rule of thirds), while the card holds all text; keep the scene's focal point above the card zone.",
    textHierarchy:
      "Hierarchy: headline inside the card, supporting line under it, CTA as a button on the card; nothing rendered over the busy scene.",
    cta: "CTA button on the floating card, bottom edge, inside safe margins.",
  },
  {
    layout:
      "Typographic poster — type is the visual: an enormous headline acts as the hero graphic; the subject is secondary (small, cropped, or abstract); layout feels like a limited-edition print.",
    subject:
      "Subject used as a small accent (corner, behind the type, or as a textured backdrop) — the headline is the focal point.",
    textHierarchy:
      "Hierarchy: hero headline at 60-80% of frame width → small supporting line → CTA; letterforms may touch frame edges intentionally but never clip.",
    cta: "CTA set as a small outlined badge or underlined link directly beneath the headline block.",
  },
  {
    layout:
      "Diagonal dynamic — strong diagonal composition with motion energy: subject on the main diagonal, text blocks aligned to a secondary diagonal, background split into two tonal fields along the axis.",
    subject:
      "Main subject placed on the diagonal sweep with implied motion; supporting elements follow the same axis for a unified flow.",
    textHierarchy:
      "Hierarchy: headline rotated-free but set along the diagonal angle, supporting line beneath, CTA anchored to the lower-right corner of the axis.",
    cta: "CTA in the lower-right corner along the diagonal, inside safe margins, as a filled chip or button.",
  },
  {
    layout:
      "Layered depth stack — foreground, midground and background layers with soft depth-of-field; the subject sits in midground, graphic shapes and text float in the foreground layer with gentle blur behind.",
    subject:
      "Main subject in sharp focus at midground; foreground layer carries translucent shapes or product details; background is an atmospheric wash.",
    textHierarchy:
      "Hierarchy: headline in the foreground layer (sharp), supporting line beneath it, CTA at the bottom; background text never competes with the subject.",
    cta: "CTA at the bottom of the foreground layer, inside the safe zone, on a solid scrim for readability.",
  },
  {
    layout:
      "Rule-of-thirds + info column — subject occupies the left third; the right two-thirds form a structured info column (key points, stat chips, short bullet lines) that turns the post into a scannable brief.",
    subject:
      "Main subject on the left third, vertically centered; supporting elements are the info chips and divider lines of the right column.",
    textHierarchy:
      "Hierarchy: short headline on top of the column → 2-3 scannable point lines → CTA; consistent chip sizes and spacing.",
    cta: "CTA button at the bottom of the info column, full column width, inside safe margins.",
  },
  {
    layout:
      "Mosaic collage — 3-4 image panels in an asymmetric grid with one focal anchor panel; text sits over the anchor panel; the grid reads as a curated set, not a generic template.",
    subject:
      "Focal subject in the largest anchor panel; smaller panels show supporting visuals that reinforce the message; one panel may be a solid brand-color block with text.",
    textHierarchy:
      "Hierarchy: headline over the anchor panel with a subtle scrim, supporting line beneath, CTA on a bottom strip spanning the grid.",
    cta: "CTA as a full-width bottom strip below the grid, inside safe margins.",
  },
  {
    layout:
      "Minimal negative space — extreme restraint: a small, perfectly placed subject on a vast clean field; premium minimalism where absence of decoration is the design.",
    subject:
      "Single subject placed with deliberate precision (center or lower third); no supporting clutter beyond one graphic accent.",
    textHierarchy:
      "Hierarchy: small tracked-caps label at the top, subject center, one short headline and CTA at the bottom; whitespace is the hero.",
    cta: "CTA as a slim text link or minimal outline button, bottom-center, inside safe margins.",
  },
  {
    layout:
      "Frame-in-frame — the subject is framed by an architectural or graphic element (arch, window, geometric frame); text sits in the frame's corners; the frame adds depth and a curated view.",
    subject:
      "Main subject inside the inner frame, fully visible; supporting elements decorate the frame itself (thin lines, corner accents).",
    textHierarchy:
      "Hierarchy: headline in the top corner inside the frame, supporting line bottom-left, CTA bottom-right; text never covers the subject.",
    cta: "CTA bottom-right inside the frame, inside safe margins, as a compact button.",
  },
];

type PaletteTreatment = {
  base: string;
  background: string;
  contrast: string;
};

/** Palette treatments anchored to the brand's real colors when present. */
const BRAND_PALETTES: PaletteTreatment[] = [
  {
    base: "Monochromatic brand gradient — a refined deep-to-light sweep of the brand primary, with the brand secondary reserved for accents only.",
    background: "Background built from the brand gradient; large flat fields, never noisy textures.",
    contrast: "Text in near-white or near-black depending on the gradient stop it sits on — always maximum contrast.",
  },
  {
    base: "Duotone brand contrast — the two brand colors as a duotone treatment over the subject, with near-black and near-white for text.",
    background: "Background is the duotone-treated imagery itself; no separate backdrop.",
    contrast: "Text in the opposite extreme of the duotone range; crisp edge-to-edge readability.",
  },
  {
    base: "Soft tonal brand wash — pale tinted version of the brand primary as the background, brand secondary for highlights and accents.",
    background: "Pale, airy background tinted with the brand color at low saturation.",
    contrast: "Text in deep neutral (near-black with a hint of the brand primary); accents pop in full-saturation secondary.",
  },
  {
    base: "Dark editorial — near-black or deep charcoal base with the brand colors used as glowing accents (text highlights, thin lines, buttons).",
    background: "Dark premium base with subtle vignette; texture kept to gradients and grain, never patterns.",
    contrast: "Headline in off-white; brand colors reserved for accents and the CTA.",
  },
  {
    base: "Clean light studio — off-white and light gray fields with the brand primary used for the headline and CTA, secondary for small accents.",
    background: "Bright, clean, minimal background with very soft shadows.",
    contrast: "Strong value contrast between the brand-colored headline and the light field.",
  },
  {
    base: "Two-tone split — the frame split diagonally between brand primary and secondary; content sits on the calmer half.",
    background: "Two bold brand-color fields split by a clean diagonal or vertical edge.",
    contrast: "Text on the calmer half in white or near-black, chosen per half for contrast.",
  },
];

/** Palette treatments when the brand has no colors configured. */
const DEFAULT_PALETTES: PaletteTreatment[] = [
  {
    base: "Warm neutral editorial — cream, sand and warm gray fields with deep espresso-brown text.",
    background: "Warm, slightly textured neutral background (paper-like grain).",
    contrast: "Espresso text on cream fields; one warm accent (amber or terracotta) for the CTA.",
  },
  {
    base: "Deep navy + champagne gold — a premium night palette with metallic gold accents.",
    background: "Deep navy base with soft radial glow behind the subject.",
    contrast: "Champagne-gold headline and off-white body text; gold reserved for the CTA.",
  },
  {
    base: "Sage + charcoal minimal — soft sage-green fields with charcoal text and white accents.",
    background: "Flat sage background with generous negative space.",
    contrast: "Charcoal headline, white supporting text on any charcoal chip elements.",
  },
  {
    base: "Crisp monochrome + one saturated accent — white, near-black and gray with a single vivid accent color chosen to match the subject's mood.",
    background: "Clean white or light gray field.",
    contrast: "Black headline, gray supporting line, the single accent only for the CTA and small highlights.",
  },
  {
    base: "Terracotta + cream — warm, earthy editorial palette with a sun-baked feel.",
    background: "Cream background with a soft terracotta glow or arch-shaped field.",
    contrast: "Deep rust/brown text; white text only on terracotta fields.",
  },
  {
    base: "Slate blue-grey + electric accent — calm cool base with a single electric accent for energy.",
    background: "Slate gradient field, slightly darker at the edges.",
    contrast: "Off-white headline; the electric accent strictly for the CTA and one highlight line.",
  },
];

type Mood = { mood: string; atmosphere: string; lighting: string };

const MOODS: Mood[] = [
  {
    mood: "Ambitious & aspirational",
    atmosphere: "A confident, upward-looking energy; the subject feels larger than life.",
    lighting: "Dramatic directional lighting with strong highlights and deep, clean shadows (chiaroscuro).",
  },
  {
    mood: "Premium & restrained luxury",
    atmosphere: "Quiet opulence: minimal elements, expensive materials (stone, metal, glass, satin), nothing loud.",
    lighting: "Soft, controlled studio lighting with gentle falloff and a subtle rim light.",
  },
  {
    mood: "Energetic & vibrant",
    atmosphere: "High energy with motion, bold shapes and saturated color blocks; designed to stop a fast scroll.",
    lighting: "High-key, punchy lighting with crisp shadows and saturated color.",
  },
  {
    mood: "Calm, trustworthy & clear",
    atmosphere: "Orderly, breathable and reassuring: clean geometry, steady rhythm, no clutter.",
    lighting: "Even, diffused lighting with minimal shadow drama.",
  },
  {
    mood: "Bold, confident & disruptive",
    atmosphere: "A statement piece: oversized elements, unexpected scale, deliberate tension in the layout.",
    lighting: "Contrasty lighting with hard shadows and defined edges.",
  },
  {
    mood: "Warm, approachable & human",
    atmosphere: "Genuine and friendly: soft shapes, imperfect details, a human scale to every element.",
    lighting: "Warm golden-hour light with soft, rounded shadows.",
  },
  {
    mood: "Dramatic & cinematic",
    atmosphere: "Film-still atmosphere with depth, haze and a strong single light source.",
    lighting: "Cinematic key light with cool ambient fill and visible atmosphere (haze, volumetric light).",
  },
  {
    mood: "Playful & modern",
    atmosphere: "Playful but design-literate: geometric shapes, subtle 3D elements, confident color blocking.",
    lighting: "Flat, clean vector-style lighting with soft gradient shading.",
  },
];

type TypographyDirection = { direction: string; hierarchy: string };

const TYPOGRAPHY: TypographyDirection[] = [
  {
    direction:
      "Oversized high-contrast serif headline (editorial elegance) paired with a small clean sans-serif for supporting text.",
    hierarchy: "Scale contrast is the tool: huge serif headline → small caps or light sans labels → compact CTA text.",
  },
  {
    direction:
      "Bold condensed grotesque for the headline — tight tracking, uppercase — with a neutral sans for body lines.",
    hierarchy: "Uppercase condensed headline dominates; body lines stay light and airy; CTA in the same condensed family.",
  },
  {
    direction:
      "Geometric sans with generous letter-spacing; uppercase for short labels, sentence case for the headline.",
    hierarchy: "Wide-tracked labels above a confident headline, thin divider lines, CTA in a filled rounded shape.",
  },
  {
    direction:
      "Modern high-contrast serif headline with monospace accents for data-like lines (stats, short numbers).",
    hierarchy: "Serif headline, mono accents for numbers/chips, sans for the supporting line; three voices, one system.",
  },
  {
    direction:
      "Soft rounded sans-serif across all text — approachable, medium weights, never thin or heavy extremes.",
    hierarchy: "Friendly rounded headline, comfortable leading, CTA as a soft rounded button.",
  },
  {
    direction:
      "Expressive display type with italic accents on key words; supporting text in a neutral grotesque.",
    hierarchy: "One expressive word carries the emotion in italic; the rest stays quiet and legible.",
  },
];

const LIGHTING_CUES: { lighting: string; depth: string }[] = [
  {
    lighting: "Soft diffused studio light with gentle, natural shadows and no harsh highlights.",
    depth: "Subtle depth through controlled focus and light falloff; reflections kept soft and realistic.",
  },
  {
    lighting: "Dramatic single-source light (chiaroscuro) with deep shadows on one side.",
    depth: "Strong depth: bright focal area recedes into shadow; atmosphere adds mood.",
  },
  {
    lighting: "Golden-hour warmth: low warm sun with long soft shadows and a glowing horizon feel.",
    depth: "Depth through warm/cool separation and atmospheric perspective.",
  },
  {
    lighting: "Cool cinematic light with a subtle rim light separating the subject from the background.",
    depth: "Layered depth: foreground, midground and background separated by light, not just blur.",
  },
  {
    lighting: "Clean, flat, even light — no dramatic shadows; color and shape carry the design.",
    depth: "Depth expressed through overlapping shapes, scale and opacity, not lighting.",
  },
  {
    lighting: "High-key, bright, airy lighting with white fill and almost no shadow.",
    depth: "Soft, minimal depth; edges are gentle and the frame feels weightless.",
  },
];

/* ── Platform dimensions & safe areas ─────────────────────────────── */

type FormatSpec = { ratio: string; dims: string; safe: string; note: string };

const FORMAT_SPECS: Record<string, FormatSpec> = {
  "instagram:single_image": {
    ratio: "1:1",
    dims: "1080 × 1080 px",
    safe: "Keep all critical content (subject, text, CTA) within the central 90%; reserve ~5% margin on every edge.",
    note: "Instagram feed square — designed to be seen small, so the concept must read instantly at thumbnail size.",
  },
  "instagram:carousel": {
    ratio: "1:1",
    dims: "1080 × 1080 px per slide",
    safe: "Identical margins and grid on every slide; critical content inside the central 90%.",
    note: "Instagram feed carousel — every slide must feel like one designed set with a clear narrative arc.",
  },
  "instagram:reel": {
    ratio: "9:16",
    dims: "1080 × 1920 px",
    safe: "Text and faces inside the central safe zone: top 250 px and bottom 250 px stay clean for UI overlays; right ~140 px for the action icons.",
    note: "Instagram Reels — vertical motion design; the first 1-2 seconds decide whether the viewer stays.",
  },
  "instagram:story": {
    ratio: "9:16",
    dims: "1080 × 1920 px",
    safe: "Top 250 px (profile UI) and bottom 250 px (link area) stay clean; message placed above the fold.",
    note: "Instagram Story — one glance, one message; no fine details or small text.",
  },
  "facebook:single_image": {
    ratio: "1:1",
    dims: "1080 × 1080 px",
    safe: "Critical content inside the central 90%; ~5% margins on every edge.",
    note: "Facebook feed square — the caption area already carries context, so the visual should intrigue, not repeat the text.",
  },
  "facebook:carousel": {
    ratio: "1:1",
    dims: "1080 × 1080 px per slide",
    safe: "Consistent margins and grid on every slide; central 90% rule.",
    note: "Facebook feed carousel — first slide is the cover and must earn the swipe.",
  },
  "facebook:reel": {
    ratio: "9:16",
    dims: "1080 × 1920 px",
    safe: "Top 250 px / bottom 250 px clean; right ~140 px icon column.",
    note: "Facebook Reels — vertical motion with a strong hook in the first seconds.",
  },
  "facebook:story": {
    ratio: "9:16",
    dims: "1080 × 1920 px",
    safe: "Top 250 px and bottom 250 px stay clean.",
    note: "Facebook Story — single glance, oversized text, one idea.",
  },
  "text_post": {
    ratio: "—",
    dims: "No image required — this is a text-only post.",
    safe: "If a thumbnail/cover is generated anyway, use 1:1 at 1080 × 1080 with central-90% safe margins.",
    note: "Text-only post; the master prompt below focuses on type, layout and any optional cover.",
  },
};

const DEFAULT_SPEC: FormatSpec = {
  ratio: "1:1",
  dims: "1080 × 1080 px",
  safe: "Critical content inside the central 90%; ~5% margins on every edge.",
  note: "Default social feed format.",
};

export type { FormatSpec };

export function formatSpecFor(platform: string, contentType: string): FormatSpec {
  if (contentType === "text_post") return FORMAT_SPECS["text_post"];
  return FORMAT_SPECS[`${platform}:${contentType}`] ?? DEFAULT_SPEC;
}

/* ── Deterministic picker ──────────────────────────────────────────── */

function seedFor(input: MasterPromptInput): number {
  let h = 5381;
  const identity = [
    input.title,
    input.platform,
    input.contentType,
    input.caption ?? "",
    input.visualConcept ?? "",
    input.hook ?? "",
  ].join("|");
  for (let i = 0; i < identity.length; i++) {
    h = ((h << 5) + h + identity.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pick<T>(pool: readonly T[], seed: number, salt: number): T {
  const n = pool.length;
  const idx = ((seed ^ Math.imul(2654435761, salt + 1)) >>> 0) % n;
  return pool[idx];
}

/** Objective-based mood bias so the goal shapes the feeling, not just the copy. */
function moodPoolFor(objective: string | null | undefined): readonly Mood[] {
  const o = (objective ?? "").toLowerCase();
  if (/(lead|sale|convert|sign.?up|purchase|order|book|demo)/.test(o)) {
    return MOODS.filter((m) => /premium|luxury|trust|clear|confident/.test(m.mood.toLowerCase()));
  }
  if (/(engage|aware|reach|follow|grow|viral)/.test(o)) {
    return MOODS.filter((m) => /energetic|vibrant|bold|playful|cultural/.test(m.mood.toLowerCase()));
  }
  return MOODS;
}

/* ── Section builders ──────────────────────────────────────────────── */

function audienceBrief(brand: BrandBrainRow | null): string {
  const lines: string[] = [];
  if (brand?.targetMarket?.trim()) lines.push("Target market: " + brand.targetMarket.trim());
  const aud = (brand?.audience ?? {}) as Record<string, unknown>;
  const demographics = String(aud.demographics ?? "").trim();
  const interests = String(aud.interests ?? "").trim();
  const problems = String(aud.problems ?? "").trim();
  if (demographics) lines.push("Demographics: " + demographics);
  if (interests) lines.push("Interests: " + interests);
  if (problems) lines.push("Problems the audience cares about: " + problems);
  return lines.length > 0 ? lines.join("\n") : "No audience data configured — design for a broad, premium feel.";
}

function paletteLines(identity: Record<string, string | undefined>, seed: number): string[] {
  const primary = identity.primaryColor?.trim();
  const secondary = identity.secondaryColor?.trim();
  if (primary || secondary) {
    const p = pick(BRAND_PALETTES, seed, 1);
    const colors: string[] = [];
    if (primary) colors.push("primary " + primary);
    if (secondary) colors.push("secondary " + secondary);
    return [
      "Palette: " + p.base + " Brand colors: " + colors.join(", ") + ".",
      "Background: " + p.background,
      "Contrast: " + p.contrast,
    ];
  }
  const p = pick(DEFAULT_PALETTES, seed, 1);
  return ["Palette: " + p.base, "Background: " + p.background, "Contrast: " + p.contrast];
}

function referenceLines(refs: MasterPromptReference[] | null | undefined): string {
  if (!refs || refs.length === 0) {
    return "No reference images were provided for this post — create the design entirely from this brief.";
  }
  const listed = refs
    .slice(0, 6)
    .map((r) => {
      const name = r.label?.trim() ? `"${r.label.trim()}"` : "an unlabeled image";
      const origin = r.kind === "brand" ? "brand reference from Brand Brain" : "visual uploaded for this post";
      return `- ${name} (${origin})`;
    })
    .join("\n");
  const more = refs.length > 6 ? `\n- +${refs.length - 6} more` : "";
  return (
    "The following reference images accompany this prompt:\n" +
    listed +
    more +
    "\nUse them ONLY to calibrate style, composition, mood and production quality — match their premium art direction. Never copy their subjects, people, logos, watermarks or text: the final design must be original to this brief."
  );
}

function carouselSection(
  slides: MasterPromptSlide[],
  seed: number,
  palette: string[],
  typography: TypographyDirection,
): string {
  const sorted = [...slides].sort((a, b) => a.index - b.index);
  const last = sorted[sorted.length - 1];
  const out: string[] = [];
  out.push(`## Carousel — per-slide art direction (${sorted.length} slides, ONE consistent design system)`);
  out.push(
    "Design system (identical across every slide): " +
      palette.join(" ") +
      " Typography: " +
      typography.direction +
      " Identical margins, grid and safe-area rules on all slides. Every slide must read as part of the same set while each earns its swipe.",
  );
  for (const s of sorted) {
    const isCover = s.index === sorted[0]?.index;
    const isOutro = sorted.length > 1 && s.index === last?.index;
    const role = isCover
      ? "Cover slide — the hook: one bold visual metaphor and a single strong headline; designed to stop the scroll."
      : isOutro
        ? "Closing slide — the payoff: recap in one line, then the CTA as the final element; visual echoes the cover so the set feels bookended."
        : "Content slide — advances the narrative: new focal element, same system, no repetition of the previous slide's composition.";
    const headline = s.headline?.trim() ? ` Text on slide: "${s.headline.trim()}".` : "";
    const visual = s.visualPrompt?.trim() ? " Visual direction: " + s.visualPrompt.trim() : "";
    out.push(`Slide ${s.index}: ${role}${headline}${visual}`);
  }
  return out.join("\n");
}

function reelSection(script: MasterPromptScript): string {
  const scenes = script.scenes ?? [];
  const out: string[] = [];
  out.push(`## Reel — scene-by-scene visual direction (9:16, total ${script.totalDuration ?? 30}s)`);
  out.push(
    "Overall: one continuous visual system — same palette, typography and treatment across scenes; safe zones (top/bottom 250 px) stay clean; the hook scene wins or loses the viewer in the first 2 seconds.",
  );
  if (script.hook?.trim()) out.push("Opening hook: " + script.hook.trim());
  scenes.forEach((s, i) => {
    const parts: string[] = [];
    if (s.durationSeconds) parts.push(`${s.durationSeconds}s`);
    if (s.visualDirection?.trim()) parts.push("Visual: " + s.visualDirection.trim());
    if (s.onScreenText?.trim()) parts.push(`On-screen text: "${s.onScreenText.trim()}"`);
    if (s.text?.trim()) parts.push("VO/dialogue: " + s.text.trim());
    if (s.transition?.trim()) parts.push("Transition: " + s.transition.trim());
    if (parts.length) out.push(`Scene ${i + 1}: ` + parts.join(" | "));
  });
  if (script.outro?.trim()) {
    out.push(
      "Outro: " +
        script.outro.trim() +
        " — end frame holds the CTA and leaves clean space for the logo (composited later).",
    );
  }
  out.push(
    "Motion: camera moves (push-in, pan, tilt) should serve the story, never decorate; on-screen text animates in with the beat and holds long enough to read at phone size.",
  );
  return out.join("\n");
}

const AVOID_LIST = [
  "Distorted anatomy, faces, hands or perspective — everything must be physically believable.",
  "Random, garbled, misspelled or placeholder text (lorem ipsum): every character of text must match the exact strings specified above, nothing invented.",
  "Rendering the full caption inside the image — only the specified headline, label and CTA appear.",
  "Unwanted objects, extra subjects or props beyond this brief.",
  "Watermarks, signatures, stock-photo marks or source-credits.",
  "Logos — the real brand logo is composited onto the final visual afterwards; leave the clean space specified and never draw a logo yourself.",
  "Added frames, borders, rounded-corner masks or device mockups around the artwork.",
  "Text clipped or bleeding outside the safe areas listed above.",
  "Color drift away from the specified palette, or oversaturated/over-filtered looks.",
  "Photorealism when the chosen style is flat/vector/illustration — and vice versa: stay fully inside the stated style.",
];

/**
 * Builds a premium external-AI-ready "master prompt" (for Gemini, ChatGPT
 * image tools, Midjourney, Flux, ...) from the actual post + Brand Brain
 * + audience + reference-image data. No fabrication: every section derives
 * from stored data, and each post gets a fresh deterministic art direction
 * (see pools above) instead of a fixed boilerplate.
 */
export function buildMasterPrompt(input: MasterPromptInput): string {
  const b = input.brand;
  const identity = (b?.visualIdentity ?? {}) as Record<string, string | undefined>;
  const seed = seedFor(input);

  const archetype = pick(LAYOUT_ARCHETYPES, seed, 0);
  const palette = paletteLines(identity, seed);
  const mood = pick(moodPoolFor(input.objective), seed, 2);
  const typography =
    identity.fonts?.trim() && input.contentType !== "text_post"
      ? { direction: `Follow the brand font direction: ${identity.fonts.trim()}`, hierarchy: "" }
      : pick(TYPOGRAPHY, seed, 3);
  const lighting = pick(LIGHTING_CUES, seed, 4);
  const spec = formatSpecFor(input.platform, input.contentType);

  const heroText = input.hook?.trim() || input.title.trim();
  const ctaText = input.cta?.trim();
  const brandName = b?.businessName?.trim();
  const concept = input.visualConcept?.trim();

  const lines: string[] = [];

  lines.push(
    "You are an Expert Creative Director + Professional Graphic Designer + Social Media Visual Strategist. Design a premium, scroll-stopping visual that SELLS the idea — do not illustrate the caption word-for-word. Transform the marketing message below into confident art direction and execute it flawlessly.",
  );
  lines.push("");
  lines.push("## Creative brief");
  lines.push("Brand: " + (brandName || "—"));
  lines.push("Platform / format: " + input.platform + " · " + input.contentType.replaceAll("_", " "));
  lines.push("Goal: " + (input.objective?.trim() || "Engagement + awareness"));
  if (input.title.trim()) lines.push("Topic: " + input.title.trim());
  if (input.caption?.trim()) lines.push("Message to express visually: " + input.caption.trim());
  if (ctaText) lines.push("Call to action: " + ctaText);

  lines.push("");
  lines.push("## Customer requirements (audience brief)");
  lines.push(audienceBrief(b));
  lines.push(
    "Design for THIS audience: every choice of mood, style and tone must fit the audience above — " + mood.mood.toLowerCase() + ".",
  );

  lines.push("");
  lines.push("## Creative concept & visual storytelling");
  if (concept) {
    lines.push(
      "Visual concept from the brief: " + concept + " — refine it into ONE strong visual metaphor; strip anything generic or decorative without purpose.",
    );
  } else {
    lines.push(
      "Build an original visual metaphor around the core message that is specific to this post and instantly readable at feed size. The metaphor, not the caption, carries the story.",
    );
  }
  lines.push("Storytelling: one clear idea per frame — subject, emotion and message must be readable in under 2 seconds.");

  lines.push("");
  lines.push("## Composition & layout");
  lines.push("Layout: " + archetype.layout);
  lines.push("Main subject: " + archetype.subject);
  lines.push("Supporting elements: " + "icons, graphic shapes, 3D accents, dividers or decorative details that reinforce the concept — only where the layout calls for them, never as filler.");
  lines.push("Text hierarchy & placement: " + (typography.hierarchy || archetype.textHierarchy));

  lines.push("");
  lines.push("## Background, color & visual identity");
  for (const p of palette) lines.push(p);
  if (identity.imageStyle?.trim()) {
    lines.push("Brand style anchor: " + identity.imageStyle.trim() + " — the design must be a premium execution of this style.");
  }

  lines.push("");
  lines.push("## Typography");
  lines.push("Font direction: " + typography.direction);
  lines.push("Exact text that must appear in the design:");
  lines.push('- Headline: "' + heroText + '" (hero text — shorten to a punchy phrase if needed, never change its meaning)');
  lines.push(ctaText ? '- CTA: "' + ctaText + '"' : "- CTA: invent a short, on-brand call to action (max 3 words)");
  lines.push(
    brandName
      ? `- Brand name "${brandName}" only as a small credit line if the layout has room — never as a logo.`
      : "- No brand name text is available; do not invent one.",
  );
  lines.push(
    "Never render the full caption inside the design. Use at most TWO type families. No letter is ever misspelled, cut off or clipped.",
  );

  lines.push("");
  lines.push("## Icons, graphics & decorative details");
  lines.push(
    "Use icons, graphic shapes, 3D elements, lines and accents sparingly and with purpose: each one must support the concept, follow the palette and share the same visual language (same stroke style, same roundness, same shadow rules).",
  );

  lines.push("");
  lines.push("## Lighting, shadows, reflections, depth & atmosphere");
  lines.push("Lighting: " + lighting.lighting);
  lines.push("Depth: " + lighting.depth);
  lines.push(
    "Atmosphere & mood: " +
      mood.mood +
      " — " +
      mood.atmosphere +
      " Shadows and reflections must be physically consistent with the light source.",
  );

  lines.push("");
  lines.push("## Premium design style & theme");
  lines.push(
    "Design style: premium, editorial-grade execution — strong visual hierarchy, deliberate negative space, exact alignment, and a contrast plan where the eye path is always: subject → headline → CTA.",
  );
  lines.push("Theme: " + mood.mood + ", consistent from the first pixel to the last.");

  lines.push("");
  lines.push("## CTA placement");
  lines.push(archetype.cta);
  lines.push(
    "The CTA is the final destination of the eye path — it must be visible at a glance, inside the safe area, and never competing with the subject.",
  );

  lines.push("");
  lines.push("## Platform format, dimensions & safe areas");
  lines.push("Aspect ratio: " + spec.ratio + " · " + spec.dims);
  lines.push("Safe areas: " + spec.safe);
  lines.push("Context: " + spec.note);

  lines.push("");
  lines.push("## Reference images");
  lines.push(referenceLines(input.referenceImages));

  if (input.contentType === "carousel" && input.slides?.length) {
    lines.push("");
    lines.push(carouselSection(input.slides, seed, palette, typography));
  }

  if (input.contentType === "reel" && input.script) {
    lines.push("");
    lines.push(reelSection(input.script));
  }

  lines.push("");
  lines.push("## Strictly avoid");
  for (const a of AVOID_LIST) lines.push("- " + a);

  lines.push("");
  lines.push("## Output");
  lines.push(
    "Produce the final visual at the exact dimensions and aspect ratio above, following every requirement in this brief. Quality bar: it must look like a top-tier agency design, not a stock template.",
  );

  return lines.join("\n");
}
