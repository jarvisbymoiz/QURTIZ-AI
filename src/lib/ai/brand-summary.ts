import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { brands } from "@/db/schema";

export type BrandBrainRow = typeof brands.$inferSelect;

/** Human-readable summary of the Brand Brain row for prompts/tools. */
export function summarizeBrandBrain(brand: BrandBrainRow | null): string {
  if (!brand) return "No brand information configured yet.";
  const parts: string[] = [];
  const add = (label: string, v: string | null | undefined) => {
    if (v && v.trim().length > 0) parts.push(label + ": " + v.trim());
  };
  add("Business", brand.businessName);
  add("Description", brand.description);
  add("Industry", brand.industry);
  add("Products", brand.products);
  add("Services", brand.services);
  add("Pricing", brand.pricing);
  add("Offers", brand.offers);
  add("Locations", brand.locations);
  add("Website", brand.website);
  add("Contact", brand.contact);
  add("Primary CTA", brand.cta);
  add("Target market", brand.targetMarket);
  const a = (brand.audience ?? {}) as Record<string, unknown>;
  add("Audience demographics", String(a.demographics ?? ""));
  add("Audience interests", String(a.interests ?? ""));
  add("Audience problems", String(a.problems ?? ""));
  add("Audience goals", String(a.goals ?? ""));
  add("Audience objections", String(a.objections ?? ""));
  add("Audience preferred language", String(a.preferredLanguage ?? ""));
  if (brand.voicePresets.length > 0) parts.push("Brand voice: " + brand.voicePresets.join(", "));
  add("Voice instructions", brand.voiceCustom);
  add("Visual identity", JSON.stringify(brand.visualIdentity ?? {}));
  add("Content rules", JSON.stringify(brand.contentRules ?? {}));
  return parts.length > 0 ? parts.join("\n") : "Brand Brain is empty - ask the user to fill it in.";
}
