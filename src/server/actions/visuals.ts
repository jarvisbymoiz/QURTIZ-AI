"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { brandAssets } from "@/db/schema";
import { can, type Capability } from "@/lib/permissions";
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
): Promise<ActionResult & { visualId?: string; model?: string }> {
  const ctx = await activeContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  try {
    const result = await generateVisual({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      contentItemId,
      mode,
    });
    if (!result.ok) return { ok: false, error: result.message };
    revalidatePath("/content-studio");
    return { ok: true, visualId: result.visualId, model: result.model };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Visual generation failed" };
  }
}

export async function getAssetSignedUrl(storagePath: string): Promise<string | null> {
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("qurtiz_workspace")?.value;
  if (!workspaceId || !storagePath.startsWith(`${workspaceId}/`)) return null;
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
