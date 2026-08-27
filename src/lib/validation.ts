import { z } from "zod";

/* ── Workspace ─────────────────────────────────────────────────────── */

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, "Workspace name must be at least 2 characters").max(80),
  industry: z.string().trim().max(120).optional().or(z.literal("")),
  timezone: z.string().trim().min(1).default("Asia/Karachi"),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(80),
  timezone: z.string().trim().min(1),
});
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

/* ── Brand Brain ───────────────────────────────────────────────────── */

export const businessInfoSchema = z.object({
  businessName: z.string().trim().max(120).optional().or(z.literal("")),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  industry: z.string().trim().max(120).optional().or(z.literal("")),
  products: z.string().trim().max(4000).optional().or(z.literal("")),
  services: z.string().trim().max(4000).optional().or(z.literal("")),
  pricing: z.string().trim().max(2000).optional().or(z.literal("")),
  offers: z.string().trim().max(2000).optional().or(z.literal("")),
  locations: z.string().trim().max(1000).optional().or(z.literal("")),
  website: z.string().trim().max(300).optional().or(z.literal("")),
  contact: z.string().trim().max(500).optional().or(z.literal("")),
  cta: z.string().trim().max(500).optional().or(z.literal("")),
  targetMarket: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type BusinessInfoInput = z.infer<typeof businessInfoSchema>;

export const audienceSchema = z.object({
  demographics: z.string().trim().max(2000).optional().or(z.literal("")),
  interests: z.string().trim().max(2000).optional().or(z.literal("")),
  problems: z.string().trim().max(2000).optional().or(z.literal("")),
  goals: z.string().trim().max(2000).optional().or(z.literal("")),
  buyingMotivations: z.string().trim().max(2000).optional().or(z.literal("")),
  objections: z.string().trim().max(2000).optional().or(z.literal("")),
  preferredLanguage: z.string().trim().max(200).optional().or(z.literal("")),
});
export type AudienceInput = z.infer<typeof audienceSchema>;

export const VOICE_PRESETS = [
  "Professional",
  "Friendly",
  "Premium",
  "Casual",
  "Educational",
  "Bold",
  "Direct",
  "Humorous",
] as const;

export const voiceSchema = z.object({
  presets: z.array(z.enum(VOICE_PRESETS)).max(8).default([]),
  custom: z.string().trim().max(4000).optional().or(z.literal("")),
});
export type VoiceInput = z.infer<typeof voiceSchema>;

export const visualIdentitySchema = z.object({
  primaryColor: z.string().trim().max(32).optional().or(z.literal("")),
  secondaryColor: z.string().trim().max(32).optional().or(z.literal("")),
  fonts: z.string().trim().max(300).optional().or(z.literal("")),
  imageStyle: z.string().trim().max(1000).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type VisualIdentityInput = z.infer<typeof visualIdentitySchema>;

/**
 * Content rules: list fields are entered as line-separated text in the UI
 * and stored as arrays in jsonb.
 */
export const contentRulesSchema = z.object({
  avoidWords: z.array(z.string().trim().min(1)).max(100).default([]),
  avoidClaims: z.array(z.string().trim().min(1)).max(100).default([]),
  avoidTopics: z.array(z.string().trim().min(1)).max(100).default([]),
  ctaRule: z.string().trim().max(1000).optional().or(z.literal("")),
  hashtagRules: z.string().trim().max(1000).optional().or(z.literal("")),
  languageRules: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type ContentRulesInput = z.infer<typeof contentRulesSchema>;

/** UI helper: textarea (one item per line) ⇄ string[] */
export function linesToArray(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export function arrayToLines(value: readonly string[] | null | undefined): string {
  return (value ?? []).join("\n");
}

/* ── Brand memory ──────────────────────────────────────────────────── */

export const memoryTypeSchema = z.enum(["preference", "fact", "rule"]);
export type MemoryType = z.infer<typeof memoryTypeSchema>;

export const addMemorySchema = z.object({
  type: memoryTypeSchema,
  content: z.string().trim().min(3, "Memory content is too short").max(1000),
});
export type AddMemoryInput = z.infer<typeof addMemorySchema>;

export const updateMemorySchema = z.object({
  id: z.string().uuid(),
  type: memoryTypeSchema.optional(),
  content: z.string().trim().min(3).max(1000).optional(),
  active: z.boolean().optional(),
});
export type UpdateMemoryInput = z.infer<typeof updateMemorySchema>;
