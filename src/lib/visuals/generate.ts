import "server-only";

import { and, desc, eq, gt } from "drizzle-orm";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDb } from "@/db";
import { agentRuns, brandAssets, brands, contentItems, contentVariants, visualAssets } from "@/db/schema";
import { generateImage } from "@/lib/ai/image";
import { getWorkspaceImageTarget } from "@/lib/ai/config";
import { renderTemplateVisual } from "@/lib/visuals/template";
import { buildVisualGenerationBrief } from "@/lib/ai/visual-brief";
import { createClient } from "@/lib/supabase/server";

export type VisualMode = "template" | "ai";

const BUCKET = "brand-assets";

export type VisualGenResult =
  | { ok: true; visualId: string; mode: VisualMode; model?: string }
  | { ok: false; reason: string; message: string };

async function fetchAsset(
  supabase: SupabaseClient,
  workspaceId: string,
  kind: "logo" | "avatar" | "reference",
): Promise<{ data: Buffer; mimeType: string; label: string | null } | null> {
  const db = getDb();
  const [asset] = await db
    .select()
    .from(brandAssets)
    .where(and(eq(brandAssets.workspaceId, workspaceId), eq(brandAssets.kind, kind),
      eq(brandAssets.cleanupStatus, "permanent"), gt(brandAssets.refCount, 0)))
    .orderBy(desc(brandAssets.createdAt))
    .limit(1);
  if (!asset) return null;

  const { data, error } = await supabase.storage.from(BUCKET).download(asset.storagePath);
  if (error || !data) {
    if (kind === "logo") throw new Error("The saved brand logo could not be loaded. The logo is still attached; retry the visual or check Storage access.");
    return null;
  }
  return { data: Buffer.from(await data.arrayBuffer()), mimeType: asset.mimeType, label: asset.label };
}

async function fetchGenerationReferences(supabase: SupabaseClient, workspaceId: string): Promise<
  { data: Buffer; mimeType: string; label: string | null; kind: string }[]
> {
  const db = getDb();
  const avatar = await fetchAsset(supabase, workspaceId, "avatar");
  const rows = await db.select().from(brandAssets)
    .where(and(eq(brandAssets.workspaceId, workspaceId), eq(brandAssets.kind, "reference"),
      eq(brandAssets.cleanupStatus, "permanent"), gt(brandAssets.refCount, 0)))
    .orderBy(desc(brandAssets.createdAt)).limit(3);
  const downloads = await Promise.all(rows.map(async asset => {
    const { data, error } = await supabase.storage.from(BUCKET).download(asset.storagePath);
    return error || !data ? null : { data: Buffer.from(await data.arrayBuffer()), mimeType: asset.mimeType, label: asset.label, kind: asset.kind };
  }));
  return [
    ...(avatar ? [{ ...avatar, kind: "avatar" }] : []),
    ...downloads.filter((value): value is NonNullable<typeof value> => value !== null),
  ];
}

async function uploadVisual(
  supabase: SupabaseClient,
  workspaceId: string,
  contentItemId: string,
  png: Buffer,
): Promise<string> {
  const storagePath = `${workspaceId}/visuals/${contentItemId}-${Date.now()}.png`;
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, png, { contentType: "image/png", upsert: false });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return storagePath;
}

/**
 * Generate a visual for a content item.
 * - template: deterministic brand graphic (satori) with the real logo embedded. Free.
 * - ai: photographic generation; avatar/reference images are passed to the model so
 *   people keep the same face/body; the real logo is composited on top afterwards.
 *   API Mode uses the configured workspace image provider.
 *
 * `storage` is optional and defaults to the request-scoped client (server
 * actions). Background workers (pg-boss) have no request scope, so they pass
 * the service-role client explicitly — the pipeline is otherwise identical.
 */
export async function generateVisual(args: {
  workspaceId: string;
  userId: string;
  contentItemId: string;
  mode: VisualMode;
  slideIndex?: number;
  variantId?: string;
  storage?: SupabaseClient;
}): Promise<VisualGenResult> {
  const db = getDb();
  const [item] = await db
    .select()
    .from(contentItems)
    .where(and(eq(contentItems.id, args.contentItemId), eq(contentItems.workspaceId, args.workspaceId)));
  if (!item) return { ok: false, reason: "not_found", message: "Content item not found." };

  const [variant] = await db
    .select()
    .from(contentVariants)
    .where(and(eq(contentVariants.contentItemId, args.contentItemId), eq(contentVariants.workspaceId, args.workspaceId),
      args.variantId ? eq(contentVariants.id, args.variantId) : undefined))
    .limit(1);
  if (args.variantId && !variant) return { ok: false, reason: "not_found", message: "Content variant not found." };
  const slide = Array.isArray(variant?.slides)
    ? (variant.slides as { index: number; visualPrompt?: string; headline?: string }[]).find(entry => entry.index === args.slideIndex)
    : undefined;
  const [brand] = await db.select().from(brands).where(eq(brands.workspaceId, args.workspaceId));
  const identity = (brand?.visualIdentity ?? {}) as Record<string, string | undefined>;

  const [run] = await db
    .insert(agentRuns)
    .values({
      workspaceId: args.workspaceId,
      userId: args.userId,
      kind: "visual_generation",
      model: args.mode === "ai" ? "workspace-image-model" : "satori-template",
    })
    .returning();

  try {
    let png: Buffer;
    let usedModel: string;

    // Request-scoped cookies() client by default; workers pass the service
    // client via `storage` (cookies() would throw outside a request scope).
    const supabase = args.storage ?? (await createClient());

    if (args.mode === "ai") {
      // Workspace-isolated: the image provider/model/key come from THIS
      // workspace's AI config. Throws AIConfigError when unset.
      const target = await getWorkspaceImageTarget(args.workspaceId);

      const refs: { mimeType: string; base64: string }[] = [];
      const referenceLabels: string[] = [];
      const generationRefs = await fetchGenerationReferences(supabase, args.workspaceId);
      for (const reference of generationRefs) {
        refs.push({ mimeType: reference.mimeType, base64: reference.data.toString("base64") });
        referenceLabels.push(reference.label || (reference.kind === "avatar" ? "Brand avatar" : "Brand visual reference"));
      }
      let memoryPreferences: string[] = [];
      try {
        const { retrieveAgentMemory } = await import("@/lib/ai/persistent-memory");
        const learned = await retrieveAgentMemory({ workspaceId: args.workspaceId, userId: args.userId }, `visual design for ${item.topic} on ${variant?.platform ?? "instagram"}`);
        memoryPreferences = [...learned.workspace, ...learned.personal]
          .filter(entry => /visual|design|image|photo|palette|colour|color|typography|layout|style/i.test(`${entry.key} ${entry.content}`))
          .slice(0, 3).map(entry => entry.content);
      } catch { /* Missing memory cannot block image generation. */ }
      const brief = buildVisualGenerationBrief({
        brand: brand ?? null, platform: variant?.platform ?? "instagram", contentType: variant?.format ?? item.format ?? "single_image",
        title: item.topic, objective: item.objective, hook: item.hook, mainCopy: item.mainCopy,
        caption: variant?.caption || item.caption, cta: variant?.cta || item.cta,
        firstComment: variant?.firstComment || item.firstComment, hashtags: variant?.hashtags ?? item.hashtags,
        visualConcept: item.visualConcept, slides: (variant?.slides ?? []) as { index: number; headline?: string; visualPrompt?: string }[],
        slideIndex: args.slideIndex, memoryPreferences, referenceLabels,
      });
      const result = await generateImage({
        prompt: brief.prompt,
        references: refs,
        options: { width: brief.width, height: brief.height, aspectRatio: brief.aspectRatio, negativePrompt: brief.negativePrompt },
        debug: { sources: brief.sources, workspaceId: args.workspaceId, contentItemId: args.contentItemId },
        provider: target.provider,
        apiKey: target.apiKey,
        modelId: target.modelId,
        baseUrl: target.baseUrl,
      });
      if (!result.ok) {
        await db.update(agentRuns).set({ status: "failed", error: result.message, finishedAt: new Date() }).where(eq(agentRuns.id, run.id));
        return { ok: false, reason: result.reason, message: result.message };
      }
      png = result.png;
      usedModel = result.model;

      png = await compositeBrandLogo(supabase, args.workspaceId, png);
    } else {
      const logo = await fetchAsset(supabase, args.workspaceId, "logo");
      png = await renderTemplateVisual({
        primaryColor: identity.primaryColor ?? "#6366f1",
        secondaryColor: identity.secondaryColor ?? "#0ea5e9",
        headline: slide?.headline ?? item.hook ?? item.topic,
        subline: (item.mainCopy ?? "").slice(0, 160),
        cta: item.cta ?? "",
        brandName: brand?.businessName ?? "",
        logoDataUrl: logo ? `data:${logo.mimeType};base64,${logo.data.toString("base64")}` : null,
        layout: item.format === "text_post" ? "statement" : "promo",
      });
      usedModel = "satori-template";
    }

    const savedVisual = await persistVisual({ supabase, workspaceId: args.workspaceId, contentItemId: args.contentItemId,
      slideIndex: args.slideIndex, mode: args.mode, png, model: usedModel });

    await db
      .update(agentRuns)
      .set({ status: "completed", finishedAt: new Date(), model: usedModel })
      .where(eq(agentRuns.id, run.id));

    return { ok: true, visualId: savedVisual.id, mode: args.mode, model: usedModel };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Visual generation failed";
    await db.update(agentRuns).set({ status: "failed", error: message, finishedAt: new Date() }).where(eq(agentRuns.id, run.id));
    return { ok: false, reason: "api_error", message };
  }
}

async function compositeBrandLogo(supabase: SupabaseClient, workspaceId: string, png: Buffer): Promise<Buffer> {
  const logo = await fetchAsset(supabase, workspaceId, "logo");
  if (!logo) return png;
  const sharp = (await import("sharp")).default;
  const base = await sharp(png).metadata();
  const targetW = Math.round((base.width ?? 1080) * 0.22);
  const logoResized = await sharp(logo.data).resize({ width: targetW }).png().toBuffer();
  const logoMeta = await sharp(logoResized).metadata();
  return sharp(png).composite([{ input: logoResized, left: 36,
    top: (base.height ?? 1350) - (logoMeta.height ?? 100) - 36 }]).png().toBuffer();
}

async function persistVisual(args: { supabase: SupabaseClient; workspaceId: string; contentItemId: string;
  slideIndex?: number; mode: VisualMode; png: Buffer; model: string }) {
  const db = getDb();
  const storagePath = await uploadVisual(args.supabase, args.workspaceId, args.contentItemId, args.png);
  const [savedVisual] = await db.insert(visualAssets).values({
    workspaceId: args.workspaceId, contentItemId: args.contentItemId, kind: args.mode,
    storagePath, mimeType: "image/png", slideIndex: args.slideIndex ?? null, meta: { model: args.model },
  }).returning();
  const [freshItem] = await db.select({ status: contentItems.status, qa: contentItems.qa })
    .from(contentItems).where(and(eq(contentItems.id, args.contentItemId), eq(contentItems.workspaceId, args.workspaceId)));
  const qaPassed = (freshItem?.qa as { passed?: boolean } | null)?.passed === true;
  if (freshItem?.status === "draft" && qaPassed) {
    await db.update(contentItems).set({ status: "ready_for_review", updatedAt: new Date() })
      .where(and(eq(contentItems.id, args.contentItemId), eq(contentItems.workspaceId, args.workspaceId)));
    await db.update(contentVariants).set({ status: "ready_for_review", updatedAt: new Date() })
      .where(and(eq(contentVariants.contentItemId, args.contentItemId), eq(contentVariants.workspaceId, args.workspaceId)));
  }
  return savedVisual;
}

/** Prepare the same brand-aware brief for a browser-local image transport. */
export async function prepareExternalVisual(args: { workspaceId: string; userId: string;
  contentItemId: string; variantId?: string; slideIndex?: number }) {
  const db = getDb();
  const [item] = await db.select().from(contentItems)
    .where(and(eq(contentItems.id, args.contentItemId), eq(contentItems.workspaceId, args.workspaceId)));
  if (!item) throw new Error("Content item not found.");
  const [variant] = await db.select().from(contentVariants)
    .where(and(eq(contentVariants.contentItemId, args.contentItemId), eq(contentVariants.workspaceId, args.workspaceId),
      args.variantId ? eq(contentVariants.id, args.variantId) : undefined)).limit(1);
  if (args.variantId && !variant) throw new Error("Content variant not found.");
  const [brand] = await db.select().from(brands).where(eq(brands.workspaceId, args.workspaceId));
  const supabase = await createClient();
  const generationRefs = (await fetchGenerationReferences(supabase, args.workspaceId)).slice(0, 1);
  if (generationRefs[0] && (generationRefs[0].data.length > 4 * 1024 * 1024 ||
      !/^image\/(png|jpeg|webp)$/.test(generationRefs[0].mimeType))) {
    throw new Error("The brand reference must be a PNG, JPEG or WebP under 4MB for local generation.");
  }
  const referenceLabels = generationRefs.map(ref => ref.label || (ref.kind === "avatar" ? "Brand avatar" : "Brand visual reference"));
  let memoryPreferences: string[] = [];
  try {
    const { retrieveAgentMemory } = await import("@/lib/ai/persistent-memory");
    const learned = await retrieveAgentMemory({ workspaceId: args.workspaceId, userId: args.userId },
      `visual design for ${item.topic} on ${variant?.platform ?? "instagram"}`);
    memoryPreferences = [...learned.workspace, ...learned.personal]
      .filter(entry => /visual|design|image|photo|palette|colour|color|typography|layout|style/i.test(`${entry.key} ${entry.content}`))
      .slice(0, 3).map(entry => entry.content);
  } catch { /* Missing memory cannot block image generation. */ }
  const brief = buildVisualGenerationBrief({
    brand: brand ?? null, platform: variant?.platform ?? "instagram", contentType: variant?.format ?? item.format ?? "single_image",
    title: item.topic, objective: item.objective, hook: item.hook, mainCopy: item.mainCopy,
    caption: variant?.caption || item.caption, cta: variant?.cta || item.cta,
    firstComment: variant?.firstComment || item.firstComment, hashtags: variant?.hashtags ?? item.hashtags,
    visualConcept: item.visualConcept, slides: (variant?.slides ?? []) as { index: number; headline?: string; visualPrompt?: string }[],
    slideIndex: args.slideIndex, memoryPreferences, referenceLabels,
  });
  return { brief, references: generationRefs.map(ref => ({ mimeType: ref.mimeType, base64: ref.data.toString("base64") })) };
}

/** Save an image generated by a local companion through the ordinary visual asset lifecycle. */
export async function persistExternalVisual(args: { workspaceId: string; contentItemId: string;
  slideIndex?: number; model: string; imageBase64: string; targetWidth?: number; targetHeight?: number }): Promise<string> {
  const [item] = await getDb().select({ id: contentItems.id }).from(contentItems)
    .where(and(eq(contentItems.id, args.contentItemId), eq(contentItems.workspaceId, args.workspaceId)));
  if (!item) throw new Error("Content item was removed before the image completed.");
  const sharp = (await import("sharp")).default;
  const raw = Buffer.from(args.imageBase64, "base64");
  if (!raw.length || raw.length > 7 * 1024 * 1024) throw new Error("Generated image exceeds the 7MB upload limit.");
  let png: Buffer;
  try {
    let image = sharp(raw, { limitInputPixels: 16 * 1024 * 1024 });
    if (args.targetWidth && args.targetHeight && args.targetWidth >= 512 && args.targetHeight >= 512 &&
        args.targetWidth <= 4096 && args.targetHeight <= 4096) {
      // The companion accepts standard portrait/square/landscape sizes. Crop
      // their center to the authored canvas (for example 4:5 from 2:3) before
      // logo compositing and ordinary Qurtiz storage.
      image = image.resize(args.targetWidth, args.targetHeight, { fit: "cover", position: "centre" });
    }
    png = await image.png().toBuffer();
    if (png.length > 16 * 1024 * 1024) throw new Error("oversized");
  } catch { throw new Error("Local companion returned malformed or oversized image data."); }
  const supabase = await createClient();
  png = await compositeBrandLogo(supabase, args.workspaceId, png);
  const saved = await persistVisual({ supabase, workspaceId: args.workspaceId, contentItemId: args.contentItemId,
    slideIndex: args.slideIndex, mode: "ai", png, model: args.model });
  return saved.id;
}
