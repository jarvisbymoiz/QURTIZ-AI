"use server";

import { reorderVisualUploads } from "@/lib/visuals/media-order";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { brandAssets, brands, contentItems, contentVariants, publishingJobs, visualAssets } from "@/db/schema";
import { rateLimit } from "@/lib/security/rate-limit";
import type { VisualMode } from "@/lib/visuals/generate";
import { getActiveContext } from "@/lib/workspace";
import {
  DEFAULT_SOFT_DELETE_GRACE_HOURS,
  markBrandAssetForCleanup,
  markVisualAssetForCleanup,
} from "@/lib/media/lifecycle";

export type ActionResult = { ok: true } | { ok: false; error: string };

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

export async function uploadBrandAssetAction(formData: FormData): Promise<ActionResult> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const kind = String(formData.get("kind") ?? "");
  if (!["logo", "avatar", "reference"].includes(kind)) {
    return { ok: false, error: "Invalid asset kind." };
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image file." };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, error: "Only PNG, JPEG or WebP images are allowed." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Image must be 5MB or smaller." };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const storagePath = `${ctx.workspaceId}/${kind}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("brand-assets")
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    return { ok: false, error: `Upload failed: ${uploadError.message}` };
  }

  const db = getDb();
  await db.insert(brandAssets).values({
    workspaceId: ctx.workspaceId,
    kind: kind as "logo" | "avatar" | "reference",
    label: (formData.get("label") as string) || null,
    storagePath,
    mimeType: file.type,
    sizeBytes: file.size,
    createdBy: ctx.userId,
  });

  revalidatePath("/brand-brain");
  return { ok: true };
}

export async function deleteBrandAssetAction(assetId: string): Promise<ActionResult> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const queued = await markBrandAssetForCleanup({
    workspaceId: ctx.workspaceId,
    brandAssetId: assetId,
    reason: "asset_removed",
    graceHours: DEFAULT_SOFT_DELETE_GRACE_HOURS,
    createdBy: ctx.userId,
  });
  if (!queued) return { ok: false, error: "Asset not found." };

  revalidatePath("/brand-brain");
  return { ok: true };
}

export async function generateVisualAction(
  contentItemId: string,
  mode: VisualMode,
  slideIndex?: number,
  variantId?: string,
): Promise<ActionResult & { visualId?: string; model?: string }> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const rl = rateLimit("visual-gen:" + ctx.workspaceId, 6, 10 * 60_000);
  if (!rl.allowed) return { ok: false, error: "Visual generation limit reached. Try again in a few minutes." };

  try {
    const { generateVisual } = await import("@/lib/visuals/generate");
    const result = await generateVisual({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      contentItemId,
      mode,
      slideIndex,
      variantId,
    });
    if (!result.ok) return { ok: false, error: result.message };
    revalidatePath("/content-studio");
    return { ok: true, visualId: result.visualId, model: result.model };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Visual generation failed";
    return { ok: false, error: message === "CONFIGURATION_REQUIRED" ? "AI is not configured for this workspace — add your provider + API key in Workspace Settings." : message };
  }
}

export async function getAssetSignedUrl(storagePath: string): Promise<string | null> {
  // Signed URLs are bearer URLs — require a session AND workspace
  // membership, not just the forgeable qurtiz_workspace cookie.
  const ctx = await getActiveContext("brand:read");
  if ("error" in ctx) return null;
  if (!storagePath.startsWith(`${ctx.workspaceId}/`)) return null;
  const { createServiceClient } = await import("@/lib/supabase/service");
  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY ? createServiceClient() : await (await import("@/lib/supabase/server")).createClient();
  const { data, error } = await supabase.storage.from("brand-assets").createSignedUrl(storagePath, 3600);
  if (error) console.error("[media-preview] signing failed", error.message);
  return data?.signedUrl ?? null;
}

export async function listAssetSignedUrls(paths: string[]): Promise<Record<string, string | null>> {
  const ctx = await getActiveContext("brand:read");
  if ("error" in ctx) return {};
  const authorized = [...new Set(paths)].filter(p => p.startsWith(`${ctx.workspaceId}/`)).slice(0, 200);
  const out: Record<string, string | null> = Object.fromEntries(authorized.map(p => [p, null]));
  if (!authorized.length) return out;
  const { createServiceClient } = await import("@/lib/supabase/service");
  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY ? createServiceClient() : await (await import("@/lib/supabase/server")).createClient();
  const { data, error } = await supabase.storage.from("brand-assets").createSignedUrls(authorized, 3600);
  if (error) console.error("[media-preview] batch signing failed", error.message);
  for (const row of data ?? []) if (row.path) out[row.path] = row.signedUrl ?? null;
  return out;
}



/** Remove ONE uploaded media item. Soft-delete: the row + Storage object are
 *  marked for cleanup after the configured grace period (default 24h) so
 *  a misclick can be undone within the window. Hard-deletes still happen
 *  via the cleanup worker, not from this action. Workspace-scoped; only
 *  kind="upload" rows can be removed this way. */
export async function removeVisualUploadAction(visualId: string): Promise<ActionResult> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const db = getDb();
  const [row] = await db
    .select({ id: visualAssets.id, storagePath: visualAssets.storagePath, itemId: visualAssets.contentItemId })
    .from(visualAssets)
    .where(
      and(
        eq(visualAssets.id, visualId),
        eq(visualAssets.workspaceId, ctx.workspaceId),
        eq(visualAssets.kind, "upload"),
      ),
    );
  if (!row) return { ok: false, error: "Media item not found." };
  try {
    // Validate the post is in an editable state BEFORE we mark anything
    // for cleanup. We do this outside the lifecycle transaction so a failed
    // status check never leaves a queued cleanup row behind.
    const [item] = await db.select({ status: contentItems.status }).from(contentItems)
      .where(and(eq(contentItems.id, row.itemId), eq(contentItems.workspaceId, ctx.workspaceId))).for("update");
    if (!item || !["draft", "ready_for_review", "failed", "rejected"].includes(item.status)) {
      throw new Error("Move this post back to review before changing its media.");
    }
    const active = await db.select({ id: publishingJobs.id }).from(publishingJobs)
      .where(and(eq(publishingJobs.contentItemId, row.itemId), eq(publishingJobs.status, "processing")));
    if (active.length) throw new Error("Publishing is in progress; media cannot be changed.");
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not remove media." };
  }

  const queued = await markVisualAssetForCleanup({
    workspaceId: ctx.workspaceId,
    visualId: row.id,
    reason: "asset_removed",
    graceHours: DEFAULT_SOFT_DELETE_GRACE_HOURS,
    createdBy: ctx.userId,
  });
  if (!queued) return { ok: false, error: "Media item not found." };

  revalidatePath("/content-studio");
  return { ok: true };
}

/** Persist a new order for the item's uploaded media (`slideIndex` is the
 *  order key). Rejects any id that is not an upload of this workspace/item. */
export async function reorderVisualUploadsAction(itemId: string, orderedIds: string[], mediaType?: "image/" | "video/"): Promise<ActionResult> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const result = await reorderVisualUploads(ctx, itemId, orderedIds, mediaType);
  if (result.ok) revalidatePath("/content-studio");
  return result;
}

export async function buildMasterPromptAction(itemId: string, variantId?: string): Promise<
  { ok: true; prompt: string; source: "ai" | "template"; model?: string } | { ok: false; error: string }
> {
  const ctx = await getActiveContext("brand:read");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const db = getDb();
  const [item] = await db
    .select()
    .from(contentItems)
    .where(and(eq(contentItems.id, itemId), eq(contentItems.workspaceId, ctx.workspaceId)));
  if (!item) return { ok: false, error: "Content item not found." };

  const variants = await db
    .select()
    .from(contentVariants)
    .where(eq(contentVariants.contentItemId, itemId));
  const variant = variantId ? variants.find((v) => v.id === variantId) ?? variants[0] : variants[0];
  if (!variant) return { ok: false, error: "No platform variant found for this post." };

  const [brand] = await db.select().from(brands).where(eq(brands.workspaceId, ctx.workspaceId));

  // Reference images the prompt describes: brand reference assets (style
  // references) and visuals the user uploaded for this post. The images
  // themselves travel with the user to the external tool; the prompt tells
  // the tool how to use them.
  const brandRefs = await db
    .select({ label: brandAssets.label })
    .from(brandAssets)
    .where(and(eq(brandAssets.workspaceId, ctx.workspaceId), eq(brandAssets.kind, "reference")));
  const postUploads = await db
    .select({ kind: visualAssets.kind })
    .from(visualAssets)
    .where(and(eq(visualAssets.contentItemId, itemId), eq(visualAssets.kind, "upload")));
  const referenceImages = [
    ...brandRefs.map((r) => ({ kind: "brand" as const, label: r.label })),
    ...postUploads.map(() => ({ kind: "post" as const, label: null })),
  ];

  // Workspace/user memory preferences shape the AI-written prompt
  // (best-effort — memory must never break the button).
  let memoryLines: string | null = null;
  try {
    const { retrieveAgentMemory } = await import("@/lib/ai/persistent-memory");
    const { boundedAgentReference } = await import("@/lib/ai/memory-policy");
    const learned = await retrieveAgentMemory(
      { workspaceId: ctx.workspaceId, userId: ctx.userId },
      "master visual prompt for post: " + item.topic,
    );
    memoryLines = boundedAgentReference(learned);
  } catch {
    memoryLines = null;
  }

  // Dynamic AI generation first (this post's real data → premium bespoke
  // master prompt); the deterministic premium template is the honest
  // fallback only when the AI path is unavailable.
  const { generateMasterPrompt } = await import("@/lib/ai/master-prompt-ai");
  const result = await generateMasterPrompt({
    workspaceId: ctx.workspaceId,
    input: {
      brand: brand ?? null,
      platform: variant.platform,
      contentType: variant.format,
      title: item.topic,
      objective: item.objective,
      hook: item.hook,
      caption: variant.caption || item.caption,
      cta: variant.cta ?? item.cta,
      firstComment: variant.firstComment ?? item.firstComment,
      hashtags: variant.hashtags ?? item.hashtags,
      visualConcept: item.visualConcept,
      slides: (variant.slides ?? []) as { index: number; headline?: string; visualPrompt?: string }[],
      script: variant.format === "reel" ? (variant.script as Record<string, unknown> as never) : null,
      referenceImages,
    },
    memoryLines,
  });

  return { ok: true, prompt: result.prompt, source: result.source, model: result.model };
}
