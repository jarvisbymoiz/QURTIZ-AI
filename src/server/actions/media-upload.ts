"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { contentItems, contentVariants, publishingJobs, visualAssets } from "@/db/schema";
import { getActiveContext } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { encryptToken, decryptToken } from "@/lib/crypto/tokens";
import { rateLimit } from "@/lib/security/rate-limit";
import { matchesMediaHeader } from "@/lib/security/media-file";
import { orderVisuals } from "@/lib/publishing/media";
import { checkUploadQuota, queueMediaCleanup } from "@/lib/media/lifecycle";

const uploadSchema = z.object({ itemId: z.string().uuid(), name: z.string().min(1).max(255),
  mime: z.enum(["image/png", "image/jpeg", "image/webp", "video/mp4", "video/quicktime", "video/webm"]),
  size: z.number().int().positive().max(50 * 1024 * 1024), slideIndex: z.number().int().min(0).max(19).optional(), variantId: z.string().uuid().optional() });
const ticketSchema = uploadSchema.extend({ purpose: z.literal("studio-upload"), workspaceId: z.string().uuid(),
  userId: z.string().uuid(), path: z.string(), id: z.string().uuid(), expiresAt: z.number() });
const editable = ["draft", "ready_for_review", "rejected", "failed"];

export async function beginMediaUploadAction(input: z.infer<typeof uploadSchema>) {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false as const, error: ctx.error };
  const parsed = uploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid media file." };
  const data = parsed.data;
  if (data.mime.startsWith("image/") && data.size > 9 * 1024 * 1024) return { ok: false as const, error: "Images must be at most 9MB." };
  if (!rateLimit(`media-ticket:${ctx.workspaceId}`, 60, 10 * 60_000).allowed) return { ok: false as const, error: "Upload limit reached. Try again later." };
  const [item] = await getDb().select().from(contentItems).where(and(eq(contentItems.id, data.itemId), eq(contentItems.workspaceId, ctx.workspaceId)));
  if (!item || !editable.includes(item.status)) return { ok: false as const, error: "Move this post back to review before changing its media." };
  let format = item.format;
  if (data.variantId) {
    const [variant] = await getDb().select().from(contentVariants).where(and(eq(contentVariants.id, data.variantId), eq(contentVariants.contentItemId, data.itemId), eq(contentVariants.workspaceId, ctx.workspaceId)));
    if (!variant || ["scheduled", "published", "archived"].includes(variant.status)) return { ok: false as const, error: "This platform variant cannot accept media. Move it back to review." };
    format = variant.format;
  }
  if (format === "reel" ? !data.mime.startsWith("video/") : data.mime.startsWith("video/")) {
    return { ok: false as const, error: "Reels require a video; image posts require images." };
  }
  // Workspace quota check (size + storage cap). Rejects before we mint a
  // signed upload URL so a denied upload never produces a Storage object.
  const quotaReason = await checkUploadQuota({
    workspaceId: ctx.workspaceId,
    proposedBytes: data.size,
    isVideo: data.mime.startsWith("video/"),
  });
  if (quotaReason) return { ok: false as const, error: quotaReason.message };
  try {
    const uploads = await getDb().select({ id: visualAssets.id }).from(visualAssets).where(and(eq(visualAssets.contentItemId, data.itemId), eq(visualAssets.workspaceId, ctx.workspaceId), eq(visualAssets.kind, "upload"), sql`${visualAssets.mimeType} like ${data.mime.startsWith("video/") ? "video/%" : "image/%"}`));
    if (uploads.length >= (format === "carousel" ? 10 : 1)) return { ok: false as const, error: "Remove an existing file before adding more media to this post." };
    const id = randomUUID();
    const path = `${ctx.workspaceId}/visuals/${data.itemId}/${id}`;
    const supabase = await createClient();
    const signed = await supabase.storage.from("brand-assets").createSignedUploadUrl(path, { upsert: false });
    if (signed.error || !signed.data) return { ok: false as const, error: signed.error?.message ?? "Storage upload signing failed." };
    const ticket = encryptToken(JSON.stringify({ ...data, purpose: "studio-upload", workspaceId: ctx.workspaceId,
      userId: ctx.userId, id, path, expiresAt: Date.now() + 30 * 60_000 }));
    return { ok: true as const, ticket, path, token: signed.data.token };
  } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Upload could not start." }; }
}

export async function completeMediaUploadAction(ticket: string) {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false as const, error: ctx.error };
  try {
    if (typeof ticket !== "string" || ticket.length > 8000) throw new Error("Invalid upload ticket.");
    const t = ticketSchema.parse(JSON.parse(decryptToken(ticket) ?? "null"));
    if (t.workspaceId !== ctx.workspaceId || t.userId !== ctx.userId || t.expiresAt < Date.now()) throw new Error("Upload authorization expired or belongs to another workspace.");
    const db = getDb();
    const [existing] = await db.select({ id: visualAssets.id }).from(visualAssets).where(and(eq(visualAssets.id, t.id), eq(visualAssets.workspaceId, ctx.workspaceId)));
    if (existing) return { ok: true as const, id: existing.id, storagePath: t.path, mimeType: t.mime };
    const supabase = await createClient();
    const bucket = supabase.storage.from("brand-assets");
    const info = await bucket.info(t.path);
    if (info.error || !info.data || info.data.size !== t.size || info.data.contentType !== t.mime) throw new Error("The stored file does not match the authorized type and size.");
    const signed = await bucket.createSignedUrl(t.path, 60);
    if (!signed.data) throw new Error("Could not validate the uploaded file.");
    const response = await fetch(signed.data.signedUrl, { headers: { Range: "bytes=0-31" }, signal: AbortSignal.timeout(15_000), redirect: "error" });
    if (!response.ok || !response.body) throw new Error("Could not read the uploaded file.");
    const reader = response.body.getReader();
    const header = new Uint8Array(32);
    let offset = 0;
    try {
      while (offset < header.length) {
        const chunk = await reader.read();
        if (chunk.done) break;
        const slice = chunk.value.subarray(0, header.length - offset);
        header.set(slice, offset); offset += slice.length;
      }
    } finally { await reader.cancel(); }
    if (!matchesMediaHeader(header.subarray(0, offset), t.mime)) {
      await bucket.remove([t.path]);
      throw new Error("The file contents do not match its media type.");
    }
    await db.transaction(async tx => {
      const [item] = await tx.select().from(contentItems).where(and(eq(contentItems.id, t.itemId), eq(contentItems.workspaceId, ctx.workspaceId))).for("update");
      if (!item || !editable.includes(item.status)) throw new Error("The post changed during upload. Move it back to review before attaching media.");
      let format = item.format;
      if (t.variantId) {
        const [variant] = await tx.select().from(contentVariants).where(and(eq(contentVariants.id, t.variantId), eq(contentVariants.contentItemId, t.itemId), eq(contentVariants.workspaceId, ctx.workspaceId)));
        if (!variant || ["scheduled", "published", "archived"].includes(variant.status)) throw new Error("The platform variant changed during upload. Move it back to review.");
        format = variant.format;
      }
      if ((format === "reel") !== t.mime.startsWith("video/")) throw new Error("The post format changed during upload. Select a matching media file.");
      const active = await tx.select({ id: publishingJobs.id }).from(publishingJobs).where(and(eq(publishingJobs.contentItemId, t.itemId), eq(publishingJobs.status, "processing")));
      if (active.length) throw new Error("Publishing is in progress; media cannot be changed.");
      const rows = await tx.select().from(visualAssets).where(and(eq(visualAssets.contentItemId, t.itemId), eq(visualAssets.kind, "upload"), sql`${visualAssets.mimeType} like ${t.mime.startsWith("video/") ? "video/%" : "image/%"}`));
      if (rows.some(r => r.id === t.id)) return;
      if (rows.length >= (format === "carousel" ? 10 : 1)) throw new Error("Remove an existing file before adding more media to this post.");
      // Normalize legacy null/tied positions before appending. New batches must
      // follow every existing image, never jump in front of legacy uploads.
      rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.storagePath.localeCompare(b.storagePath));
      const ordered = orderVisuals(rows);
      for (let i = 0; i < ordered.length; i++) {
        if (ordered[i].slideIndex !== i) await tx.update(visualAssets).set({ slideIndex: i }).where(eq(visualAssets.id, ordered[i].id));
      }
      const position = ordered.length;
      await tx.insert(visualAssets).values({ id: t.id, workspaceId: ctx.workspaceId, contentItemId: t.itemId, kind: "upload",
        storagePath: t.path, mimeType: t.mime, slideIndex: position, meta: { source: "manual-upload", originalName: t.name, sizeBytes: t.size, position } });
      if ((item.qa as { passed?: boolean }).passed === true && item.status === "draft") {
        await tx.update(contentItems).set({ status: "ready_for_review", updatedAt: new Date() }).where(eq(contentItems.id, t.itemId));
        await tx.update(contentVariants).set({ status: "ready_for_review", updatedAt: new Date() }).where(and(eq(contentVariants.contentItemId, t.itemId), eq(contentVariants.status, "ready_for_review")));
      }
    });
    revalidatePath("/content-studio");
    return { ok: true as const, id: t.id, storagePath: t.path, mimeType: t.mime };
  } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Could not finish the upload." }; }
}

/**
 * Scan Supabase Storage for orphaned upload paths — files in
 *   {workspaceId}/visuals/{itemId}/{uuid}
 * that have NO matching visual_assets row (i.e. the upload never
 * completed or was abandoned). The returned paths are queued for
 * cleanup with a short grace period so a near-simultaneous complete
 * upload isn't lost to a race.
 *
 * Called from the mediaCleanup worker (hourly). Workspace-scoped.
 */
export async function sweepAbandonedUploads(workspaceId: string, limit = 50): Promise<{ queued: number }> {
  const { createServiceClient } = await import("@/lib/supabase/service");
  const supabase = createServiceClient();
  if (!supabase) return { queued: 0 };
  let queued = 0;
  try {
    // List the workspace's uploads prefix. Storage.list returns up to 1000
    // entries; for very large workspaces we'd page with limit/offset, but
    // for a sweep this bounded scan is enough.
    const { data: files, error } = await supabase.storage.from("brand-assets").list(`${workspaceId}/visuals`, { limit: 1000 });
    if (error || !files) return { queued: 0 };
    const liveRows = await getDb()
      .select({ storagePath: visualAssets.storagePath })
      .from(visualAssets)
      .where(eq(visualAssets.workspaceId, workspaceId));
    const livePaths = new Set(liveRows.map(r => r.storagePath));
    for (const entry of files) {
      if (queued >= limit) break;
      if (entry.name === ".emptyFolderPlaceholder") continue;
      // Files live one level deeper at {workspaceId}/visuals/{itemId}/{uuid}.
      // We treat any entry at this depth without a matching DB row as abandoned.
      const fullPath = `${workspaceId}/visuals/${entry.name}`;
      if (livePaths.has(fullPath)) continue;
      // Skip directory placeholders that are not files (no metadata).
      if (!entry.metadata || typeof entry.metadata.size !== "number") continue;
      // Skip entries too fresh to call abandoned (under 5 minutes old —
      // a near-simultaneous upload + sweep would otherwise eat a real
      // upload).
      const createdAt = entry.created_at ? new Date(entry.created_at).getTime() : 0;
      if (Date.now() - createdAt < 5 * 60_000) continue;
      await queueMediaCleanup({
        workspaceId,
        storagePath: fullPath,
        sourceTable: "visual_assets",
        sourceRowId: null,
        bytes: entry.metadata.size,
        reason: "abandoned_upload",
        graceHours: 1,
        createdBy: workspaceId, // system action; not user-initiated
      });
      queued++;
    }
  } catch (error) {
    console.error("[abandoned-upload-sweep]", workspaceId, error);
  }
  return { queued };
}
