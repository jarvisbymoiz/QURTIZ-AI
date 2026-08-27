"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { brands } from "@/db/schema";
import {
  audienceSchema,
  businessInfoSchema,
  contentRulesSchema,
  visualIdentitySchema,
  voiceSchema,
} from "@/lib/validation";
import { requireRoleForActiveWorkspace } from "./workspace";

export type ActionResult = { ok: true } | { ok: false; error: string };

function emptyToNull(v: string | undefined | null): string | null {
  const s = (v ?? "").trim();
  return s.length > 0 ? s : null;
}

async function getBrandRow(workspaceId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(brands)
    .where(and(eq(brands.workspaceId, workspaceId)));
  return rows[0] ?? null;
}

export async function updateBusinessInfoAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireRoleForActiveWorkspace("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = businessInfoSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  const db = getDb();
  const existing = await getBrandRow(ctx.workspaceId);
  if (!existing) {
    await db.insert(brands).values({ workspaceId: ctx.workspaceId });
  }

  await db
    .update(brands)
    .set({
      businessName: emptyToNull(d.businessName),
      description: emptyToNull(d.description),
      industry: emptyToNull(d.industry),
      products: emptyToNull(d.products),
      services: emptyToNull(d.services),
      pricing: emptyToNull(d.pricing),
      offers: emptyToNull(d.offers),
      locations: emptyToNull(d.locations),
      website: emptyToNull(d.website),
      contact: emptyToNull(d.contact),
      cta: emptyToNull(d.cta),
      targetMarket: emptyToNull(d.targetMarket),
      updatedAt: new Date(),
    })
    .where(eq(brands.workspaceId, ctx.workspaceId));

  revalidatePath("/brand-brain");
  revalidatePath("/");
  return { ok: true };
}

export async function updateAudienceAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireRoleForActiveWorkspace("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = audienceSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  const db = getDb();
  const existing = await getBrandRow(ctx.workspaceId);
  if (!existing) {
    await db.insert(brands).values({ workspaceId: ctx.workspaceId });
  }

  await db
    .update(brands)
    .set({
      audience: {
        demographics: emptyToNull(d.demographics),
        interests: emptyToNull(d.interests),
        problems: emptyToNull(d.problems),
        goals: emptyToNull(d.goals),
        buyingMotivations: emptyToNull(d.buyingMotivations),
        objections: emptyToNull(d.objections),
        preferredLanguage: emptyToNull(d.preferredLanguage),
      },
      updatedAt: new Date(),
    })
    .where(eq(brands.workspaceId, ctx.workspaceId));

  revalidatePath("/brand-brain");
  return { ok: true };
}

export async function updateVoiceAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireRoleForActiveWorkspace("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const presets = formData.getAll("presets").map(String).filter(Boolean);
  const parsed = voiceSchema.safeParse({
    presets,
    custom: formData.get("custom") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const db = getDb();
  const existing = await getBrandRow(ctx.workspaceId);
  if (!existing) {
    await db.insert(brands).values({ workspaceId: ctx.workspaceId });
  }

  await db
    .update(brands)
    .set({
      voicePresets: parsed.data.presets,
      voiceCustom: emptyToNull(parsed.data.custom),
      updatedAt: new Date(),
    })
    .where(eq(brands.workspaceId, ctx.workspaceId));

  revalidatePath("/brand-brain");
  return { ok: true };
}

export async function updateVisualIdentityAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireRoleForActiveWorkspace("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = visualIdentitySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  const db = getDb();
  const existing = await getBrandRow(ctx.workspaceId);
  if (!existing) {
    await db.insert(brands).values({ workspaceId: ctx.workspaceId });
  }

  await db
    .update(brands)
    .set({
      visualIdentity: {
        primaryColor: emptyToNull(d.primaryColor),
        secondaryColor: emptyToNull(d.secondaryColor),
        fonts: emptyToNull(d.fonts),
        imageStyle: emptyToNull(d.imageStyle),
        notes: emptyToNull(d.notes),
      },
      updatedAt: new Date(),
    })
    .where(eq(brands.workspaceId, ctx.workspaceId));

  revalidatePath("/brand-brain");
  return { ok: true };
}

export async function updateContentRulesAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireRoleForActiveWorkspace("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = contentRulesSchema.safeParse({
    avoidWords: formData.getAll("avoidWords[]").map(String).filter(Boolean),
    avoidClaims: formData.getAll("avoidClaims[]").map(String).filter(Boolean),
    avoidTopics: formData.getAll("avoidTopics[]").map(String).filter(Boolean),
    ctaRule: formData.get("ctaRule") ?? "",
    hashtagRules: formData.get("hashtagRules") ?? "",
    languageRules: formData.get("languageRules") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  const db = getDb();
  const existing = await getBrandRow(ctx.workspaceId);
  if (!existing) {
    await db.insert(brands).values({ workspaceId: ctx.workspaceId });
  }

  await db
    .update(brands)
    .set({
      contentRules: {
        avoidWords: d.avoidWords,
        avoidClaims: d.avoidClaims,
        avoidTopics: d.avoidTopics,
        ctaRule: emptyToNull(d.ctaRule),
        hashtagRules: emptyToNull(d.hashtagRules),
        languageRules: emptyToNull(d.languageRules),
      },
      updatedAt: new Date(),
    })
    .where(eq(brands.workspaceId, ctx.workspaceId));

  revalidatePath("/brand-brain");
  return { ok: true };
}


