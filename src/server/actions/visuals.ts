"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { brandAssets, brands, contentItems, contentVariants, visualAssets } from "@/db/schema";
import { can, type Capability } from "@/lib/permissions";
import { rateLimit } from "@/lib/security/rate-limit";
import { generateVisual, type VisualMode } from "@/lib/visuals/generate";
import { getSessionUser, getMembership } from "@/lib/workspace";

export type ActionResult = { ok: true } | { ok: false; error: string };

type Ctx = { error: string } | { userId: string; workspaceId: string };

async function activeContext(capability: Capability): Promise<Ctx> {
  const user = await getSessionUser();
  if (!user) return { error: "You must be signed in." };
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("qurtiz_workspace")?.value;
  if (!workspaceId) return { error: "No active workspace." };
  const membership = await getMembership(user.id, workspaceId);
  if (!membership) return { error: "You are not a member of this workspace." };
  if (!can(membership.role, capability)) return { error: "You do not have permission for this action." };
  return { userId: user.id, workspaceId };
}

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

export async function uploadBrandAssetAction(formData: FormData): Promise<ActionResult> {
  const ctx = await activeContext("brand:write");
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
  const ctx = await activeContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const db = getDb();
  const [asset] = await db
    .select()
    .from(brandAssets)
    .where(and(eq(brandAssets.id, assetId), eq(brandAssets.workspaceId, ctx.workspaceId)));
  if (!asset) return { ok: false, error: "Asset not found." };

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.storage.from("brand-assets").remove([asset.storagePath]);
  await db.delete(brandAssets).where(eq(brandAssets.id, assetId));

  revalidatePath("/brand-brain");
  return { ok: true };
}

export async function generateVisualAction(
  contentItemId: string,
  mode: VisualMode,
  slideIndex?: number,
): Promise<ActionResult & { visualId?: string; model?: string }> {
  const ctx = await activeContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const rl = rateLimit("visual-gen:" + ctx.workspaceId, 6, 10 * 60_000);
  if (!rl.allowed) return { ok: false, error: "Visual generation limit reached. Try again in a few minutes." };

  try {
    const result = await generateVisual({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      contentItemId,
      mode,
      slideIndex,
    });
    if (!result.ok) return { ok: false, error: result.message };
    revalidatePath("/content-studio");
    return { ok: true, visualId: result.visualId, model: result.model };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Visual generation failed" };
  }
}

export async function getAssetSignedUrl(storagePath: string): Promise<string | null> {
  // M9: signed URLs are bearer URLs — require a session AND workspace
  // membership, not just the forgeable qurtiz_workspace cookie.
  const user = await getSessionUser();
  if (!user) return null;
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("qurtiz_workspace")?.value;
  if (!workspaceId) return null;
  const membership = await getMembership(user.id, workspaceId);
  if (!membership) return null;
  if (!storagePath.startsWith(`${workspaceId}/`)) return null;
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase.storage.from("brand-assets").createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? null;
}

export async function listAssetSignedUrls(paths: string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const p of paths) out[p] = await getAssetSignedUrl(p);
  return out;
}



/**
 * Manual visual upload: the user attaches their own image for a content item
 * (or a specific carousel slide). Marks the item Ready for Review if it was
 * still a draft, per the approval-first workflow.
 */
export async function uploadVisualUploadAction(formData: FormData): Promise<ActionResult> {
  const ctx = await activeContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const rl = rateLimit("visual-upload:" + ctx.workspaceId, 10, 10 * 60_000);
  if (!rl.allowed) return { ok: false, error: "Upload limit reached. Try again in a few minutes." };

  const itemId = String(formData.get("itemId") ?? "");
  const slideIndexRaw = formData.get("slideIndex");
  const slideIndex = slideIndexRaw === null || slideIndexRaw === "" ? null : Number(slideIndexRaw);
  const file = formData.get("file");

  if (!itemId) return { ok: false, error: "Missing content item." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image file." };
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    return { ok: false, error: "Only PNG, JPEG or WebP images are allowed." };
  }
  if (file.size > 9 * 1024 * 1024) return { ok: false, error: "Image must be 9MB or smaller." };

  // M8: the itemId is user-supplied — verify the content item belongs to this
  // workspace BEFORE uploading/inserting, or a cross-workspace visual_assets
  // row (and storage object) could be injected.
  const db = getDb();
  const [item] = await db
    .select({ id: contentItems.id, status: contentItems.status })
    .from(contentItems)
    .where(and(eq(contentItems.id, itemId), eq(contentItems.workspaceId, ctx.workspaceId)));
  if (!item) return { ok: false, error: "Content item not found in this workspace." };

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const storagePath = ctx.workspaceId + "/visuals/" + itemId + "-upload-" + Date.now() + "." + ext;
  const { error: uploadError } = await supabase.storage
    .from("brand-assets")
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) return { ok: false, error: "Upload failed: " + uploadError.message };

  await db.insert(visualAssets).values({
    workspaceId: ctx.workspaceId,
    contentItemId: itemId,
    kind: "upload",
    slideIndex: slideIndex === null || Number.isNaN(slideIndex) ? null : slideIndex,
    storagePath,
    mimeType: file.type,
    meta: { source: "manual-upload" },
  });

  // Approval transition: draft -> ready_for_review once a visual exists.
  if (item.status === "draft") {
    await db
      .update(contentItems)
      .set({ status: "ready_for_review", updatedAt: new Date() })
      .where(eq(contentItems.id, itemId));
    await db
      .update(contentVariants)
      .set({ status: "ready_for_review", updatedAt: new Date() })
      .where(eq(contentVariants.contentItemId, itemId));
  }

  revalidatePath("/content-studio");
  return { ok: true };
}


export async function buildMasterPromptAction(itemId: string, variantId?: string): Promise<
  { ok: true; prompt: string } | { ok: false; error: string }
> {
  const ctx = await activeContext("brand:read");
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

  const { buildMasterPrompt } = await import("@/lib/ai/master-prompt");
  const prompt = buildMasterPrompt({
    brand: brand ?? null,
    platform: variant.platform,
    contentType: variant.format,
    title: item.topic,
    hook: item.hook,
    caption: variant.caption || item.caption,
    cta: variant.cta ?? item.cta,
    firstComment: variant.firstComment ?? item.firstComment,
    hashtags: variant.hashtags?.length ? variant.hashtags : item.hashtags,
    visualConcept: item.visualConcept,
    slides: (variant.slides ?? []) as { index: number; headline?: string; visualPrompt?: string }[],
    script: variant.format === "reel" ? (variant.script as Record<string, unknown> as never) : null,
    referenceNote: "Uploaded brand/reference images from Brand Brain are used as style references; the logo is composited afterwards.",
  });

  return { ok: true, prompt };
}
