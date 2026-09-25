import type { MasterPromptInput } from "@/lib/ai/master-prompt";
import { formatSpecFor } from "@/lib/ai/master-prompt";

export type VisualBriefInput = MasterPromptInput & {
  mainCopy?: string | null;
  slideIndex?: number;
  memoryPreferences?: string[];
  referenceLabels?: string[];
};

export type VisualBrief = {
  prompt: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  negativePrompt: string;
  sources: string[];
};

const clean = (value: string | null | undefined) => value?.trim() || "";
const concise = (value: string | null | undefined, max = 280) => {
  const normalized = clean(value).replace(/\s+/g, " ");
  if (normalized.length <= max) return normalized;
  const cut = normalized.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ") > max * 0.7 ? cut.lastIndexOf(" ") : max).trimEnd();
};
const contains = (haystack: string, needle: string) => needle.length > 0 && haystack.toLowerCase().includes(needle.toLowerCase());

/** Shared factual design brief. The saved Visual Prompt remains the primary art direction. */
export function buildVisualGenerationBrief(input: VisualBriefInput): VisualBrief {
  const brand = input.brand;
  const identity = (brand?.visualIdentity ?? {}) as Record<string, unknown>;
  const getIdentity = (key: string) => typeof identity[key] === "string" ? concise(identity[key] as string, 180) : "";
  const slide = input.slideIndex == null ? undefined : input.slides?.find(s => s.index === input.slideIndex);
  const direction = clean(slide?.visualPrompt) || clean(input.visualConcept) || clean(input.hook) || clean(input.title);
  const source = clean(slide?.visualPrompt) ? "slidePrompt" : clean(input.visualConcept) ? "visualPrompt" : clean(input.hook) ? "hook" : "topic";
  const spec = formatSpecFor(input.platform, input.contentType);
  const dimensions = /(\d+)\s*×\s*(\d+)/.exec(spec.dims);
  const width = dimensions ? Number(dimensions[1]) : undefined;
  const height = dimensions ? Number(dimensions[2]) : undefined;
  const aspectRatio = spec.ratio === "—" ? undefined : spec.ratio;
  const sources = [source, "platformFormat"];
  const lines = [
    `Create one finished ${input.platform} ${input.contentType.replaceAll("_", " ")} visual.`,
    `Primary creative direction (preserve this concept): ${direction}`,
  ];

  const hook = concise(slide?.headline || input.hook, 120);
  if (hook && !contains(direction, hook)) {
    const explicitOnImageCopy = /\bheadline\b|["“][^"”]{4,100}["”]/i.test(direction);
    lines.push(explicitOnImageCopy
      ? `Post hook for message context (keep the on-image wording specified above): ${hook}`
      : `On-image headline, if text is part of the concept: ${hook}`);
    sources.push("hook");
  }
  if (!contains(direction, input.title)) { lines.push(`Post subject: ${concise(input.title, 180)}`); sources.push("topic"); }
  const objective = clean(input.objective);
  if (objective && objective.length <= 180 && !/\b(?:auto run strategy|reference data|synced post metrics)\b|[{}]/i.test(objective)) {
    lines.push(`Communication goal: ${objective}`); sources.push("objective");
  }

  const messageSentences = clean(input.mainCopy || input.caption).split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
  const postMessage = concise(messageSentences, 240);
  if (postMessage && !contains(direction, postMessage)) { lines.push(`Message to express visually (do not render this whole copy): ${postMessage}`); sources.push("postMessage"); }
  const topicCues = (input.hashtags ?? []).map(tag => tag.replace(/^#/, "").trim()).filter(tag =>
    tag.length >= 5 && !contains(direction, tag) && !contains(input.title, tag)).slice(0, 3);
  if (topicCues.length) { lines.push(`Optional subject cues from post tags (never render as hashtags): ${topicCues.join(", ")}`); sources.push("hashtags"); }
  const cta = concise(input.cta || brand?.cta, 120);
  if (cta && !contains(direction, cta)) {
    lines.push(/call.to.action|\bCTA\b|button graphic/i.test(direction)
      ? `Conversion intent (keep the on-image CTA wording specified above): ${cta}`
      : `CTA wording or intent, only if suitable on-image: ${cta}`);
    sources.push("cta");
  }

  const promotional = /offer|sale|discount|price|pricing|buy|order|shop|book|whatsapp|contact|deal|promo|%/i
    .test([input.objective, direction, input.caption, cta].join(" "));
  if (promotional) {
    const offer = concise(brand?.offers, 180);
    const pricing = concise(brand?.pricing, 140);
    if (offer && !contains(direction, offer)) { lines.push(`Verified offer: ${offer}`); sources.push("brandOffer"); }
    if (pricing && !contains(direction, pricing)) { lines.push(`Verified pricing (show only if relevant to this post): ${pricing}`); sources.push("brandPricing"); }
    const contact = concise(brand?.contact, 120);
    if (contact && !contains(direction, contact)) { lines.push(`Contact/WhatsApp, if the CTA asks for contact: ${contact}`); sources.push("brandContact"); }
    const website = concise(brand?.website, 120);
    if (website && !contains(direction, website)) { lines.push(`Website, if the CTA needs a destination: ${website}`); sources.push("brandWebsite"); }
  }
  // A first comment often carries a useful link or offer. Extract only its
  // relevance; never render the whole comment or hashtags into the image.
  const comment = clean(input.firstComment);
  if (promotional && comment && /https?:\/\/|whatsapp|price|discount|offer/i.test(comment)) {
    const link = comment.match(/https?:\/\/[^\s|]+/i)?.[0];
    lines.push(`First-comment context (not on-image copy): ${link ? `Link: ${link}` : concise(comment, 100)}`);
    sources.push("firstComment");
  }

  if (clean(brand?.businessName)) { lines.push(`Brand: ${concise(brand?.businessName, 100)}`); sources.push("brandName"); }
  const business = concise(brand?.products || brand?.services || brand?.description, 120);
  if (business && !contains(direction, business)) { lines.push(`Real product/service context: ${business}`); sources.push("brandBusiness"); }
  const audience = (brand?.audience ?? {}) as Record<string, unknown>;
  const target = concise(brand?.targetMarket || (typeof audience.goals === "string" ? audience.goals : ""), 160);
  if (target) { lines.push(`Audience: ${target}`); sources.push("audience"); }
  const voice = concise(brand?.voiceCustom || brand?.voicePresets?.join(", "), 120);
  if (voice) { lines.push(`Brand tone: ${voice}`); sources.push("brandVoice"); }
  const colors = [getIdentity("primaryColor"), getIdentity("secondaryColor")].filter(Boolean);
  if (colors.length) { lines.push(`Brand palette: ${colors.join(" / ")}`); sources.push("brandPalette"); }
  if (getIdentity("imageStyle")) { lines.push(`Visual style: ${getIdentity("imageStyle")}`); sources.push("brandStyle"); }
  if (getIdentity("fonts")) { lines.push(`Typography direction: ${getIdentity("fonts")}`); sources.push("brandFonts"); }
  const memories = (input.memoryPreferences ?? []).map(value => concise(value, 160)).filter(Boolean).slice(0, 3);
  if (memories.length) { lines.push(`Saved visual preferences: ${memories.join("; ")}`); sources.push("memory"); }

  lines.push("Hierarchy: the specified subject is the focal point; if text belongs on-image, show one short headline, then a verified offer/price and a distinct CTA. Keep type high-contrast and readable.");
  lines.push("Composition: honor the described scene, separate subject from background, and use supporting graphics only when they clarify the message. Keep text inside safe margins.");
  lines.push(`Composition and output: ${spec.ratio} (${spec.dims}). ${spec.note} ${spec.safe}`);
  if (input.contentType === "carousel") {
    const ordered = (input.slides ?? []).slice().sort((a, b) => a.index - b.index);
    lines.push(`Carousel design system: keep one grid, typography, palette, motif and margin system across ${ordered.length || "all"} slides; give this slide a distinct idea and composition.`);
    if (slide) { lines.push(`This is slide ${slide.index}${ordered.length ? ` of ${ordered.length}` : ""}. ${slide.headline ? `Slide headline: ${slide.headline}.` : ""}`); sources.push("carouselSlide"); }
  }
  if (input.contentType === "reel") lines.push("This is a cover/thumbnail only; do not imitate a video frame or replace the uploaded Reel video.");
  const labels = (input.referenceLabels ?? []).map(value => concise(value, 80)).filter(Boolean).slice(0, 4);
  if (labels.length) { lines.push(`Generation reference labels: ${labels.join("; ")}. Match image details only if the provider received the reference pixels; otherwise use these labels as limited style cues and invent no unseen details.`); sources.push("references"); }
  lines.push("Reserve a clean lower-left area for the real logo, which Qurtiz adds after generation even if the concept mentions another logo location. Do not draw or approximate the logo.");
  const negativePrompt = "No invented brand claims, fake logos, watermarks, placeholder text, garbled lettering, crowded layout, or full-caption text.";
  lines.push(`Avoid: ${negativePrompt}`);
  return { prompt: lines.join("\n"), width, height, aspectRatio, negativePrompt, sources };
}
