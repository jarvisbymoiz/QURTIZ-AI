import "server-only";

import { and, desc, eq } from "drizzle-orm";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDb } from "@/db";
import { agentRuns, brandAssets, brands, contentItems, contentVariants, visualAssets } from "@/db/schema";
import { generateImage } from "@/lib/ai/image";
import { getWorkspaceImageTarget } from "@/lib/ai/config";
import { renderTemplateVisual } from "@/lib/visuals/template";
import { formatSpecFor } from "@/lib/ai/master-prompt";
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
): Promise<{ data: Buffer; mimeType: string } | null> {
  const db = getDb();
  const [asset] = await db
    .select()
    .from(brandAssets)
    .where(and(eq(brandAssets.workspaceId, workspaceId), eq(brandAssets.kind, kind)))
    .orderBy(desc(brandAssets.createdAt))
    .limit(1);
  if (!asset) return null;

  const { data, error } = await supabase.storage.from(BUCKET).download(asset.storagePath);
  if (error || !data) return null;
  return { data: Buffer.from(await data.arrayBuffer()), mimeType: asset.mimeType };
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
 *   Requires paid billing; returns an honest quota/billing state otherwise.
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
      const avatar = await fetchAsset(supabase, args.workspaceId, "avatar");
      if (avatar) refs.push({ mimeType: avatar.mimeType, base64: avatar.data.toString("base64") });
      const reference = await fetchAsset(supabase, args.workspaceId, "reference");
      if (reference) refs.push({ mimeType: reference.mimeType, base64: reference.data.toString("base64") });

      const styleNote = [
        identity.imageStyle ? `Style: ${identity.imageStyle}.` : "",
        identity.primaryColor ? `Brand accent color: ${identity.primaryColor}.` : "",
        refs.length > 0
          ? "When a person appears, keep the EXACT same face and body as the provided reference photo. Do not alter their identity."
          : "",
        "Leave clean space in the lower-left corner; a logo is composited there afterwards. Do not draw a logo yourself.",
      ]
        .filter(Boolean)
        .join(" ");

      const spec = formatSpecFor(variant?.platform ?? "instagram", variant?.format ?? item.format ?? "single_image");
      const result = await generateImage({
        prompt: `Create a premium, scroll-stopping social media visual for this post — creative-director quality, not a stock template.\nTopic: ${item.topic}\nCreative direction: ${slide?.visualPrompt ?? item.visualConcept ?? item.hook ?? item.topic}\nPlatform format: ${spec.ratio} (${spec.dims}) — ${spec.note} Safe areas: ${spec.safe}\n${styleNote}\nPhotorealistic where appropriate to the stated concept.`,
        references: refs,
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

      // Composite the REAL logo — AI never redraws the brand logo.
      const logo = await fetchAsset(supabase, args.workspaceId, "logo");
      if (logo) {
        const sharp = (await import("sharp")).default;
        const base = await sharp(png).metadata();
        const targetW = Math.round((base.width ?? 1080) * 0.22);
        const logoResized = await sharp(logo.data).resize({ width: targetW }).png().toBuffer();
        const logoMeta = await sharp(logoResized).metadata();
        png = await sharp(png)
          .composite([{ input: logoResized, left: 36, top: (base.height ?? 1350) - (logoMeta.height ?? 100) - 36 }])
          .png()
          .toBuffer();
      }
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

    const storagePath = await uploadVisual(supabase, args.workspaceId, args.contentItemId, png);
    const [savedVisual] = await db
      .insert(visualAssets)
      .values({
        workspaceId: args.workspaceId,
        contentItemId: args.contentItemId,
        kind: args.mode,
        storagePath,
        mimeType: "image/png",
        slideIndex: args.slideIndex ?? null,
        meta: { model: usedModel },
      })
      .returning();

    // Visual attached: content moves to Approval/Review if still a draft —
    // but only when QA passed. Attaching a visual must not promote a
    // QA-failed draft (status "draft" + qa.passed=false); it stays a draft
    // until the content is actually re-QA'd.
    const [freshItem] = await db
      .select({ status: contentItems.status, qa: contentItems.qa })
      .from(contentItems)
      .where(eq(contentItems.id, args.contentItemId));
    const qaPassed = (freshItem?.qa as { passed?: boolean } | null)?.passed === true;
    if (freshItem?.status === "draft" && qaPassed) {
      await db.update(contentItems).set({ status: "ready_for_review", updatedAt: new Date() }).where(eq(contentItems.id, args.contentItemId));
      await db.update(contentVariants).set({ status: "ready_for_review", updatedAt: new Date() }).where(eq(contentVariants.contentItemId, args.contentItemId));
    }

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
