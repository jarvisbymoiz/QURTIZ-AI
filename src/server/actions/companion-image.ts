"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { companionImageJobs } from "@/db/schema";
import { enqueueCompanionImage, enqueueCompanionTestImage } from "@/lib/companion/image-jobs";
import { rateLimit } from "@/lib/security/rate-limit";
import { getActiveContext } from "@/lib/workspace";

const enqueueInput = z.object({ contentItemId: z.string().uuid(), variantId: z.string().uuid().optional(),
  slideIndex: z.number().int().min(0).max(99).optional(),
  idempotencyKey: z.string().min(16).max(160) }).strict();

export async function enqueueCompanionImageAction(input: unknown) {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false as const, error: ctx.error };
  const parsed = enqueueInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid image request." };
  if (!rateLimit(`companion-image:${ctx.workspaceId}:${ctx.userId}`, 6, 10 * 60_000).allowed) {
    return { ok: false as const, error: "Image generation limit reached. Try again later." };
  }
  try {
    const job = await enqueueCompanionImage({ ...parsed.data, workspaceId: ctx.workspaceId, userId: ctx.userId });
    return { ok: true as const, job };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not queue image." };
  }
}

export async function getCompanionImageJobAction(jobId: string) {
  const ctx = await getActiveContext("brand:read");
  if ("error" in ctx) return { ok: false as const, error: ctx.error };
  if (!z.string().uuid().safeParse(jobId).success) return { ok: false as const, error: "Invalid image job." };
  const [row] = await getDb().select({ id: companionImageJobs.id, status: companionImageJobs.status,
    error: companionImageJobs.error, visualAssetId: companionImageJobs.visualAssetId,
    updatedAt: companionImageJobs.updatedAt })
    .from(companionImageJobs).where(and(eq(companionImageJobs.id, jobId),
      eq(companionImageJobs.workspaceId, ctx.workspaceId), eq(companionImageJobs.userId, ctx.userId))).limit(1);
  return row ? { ok: true as const, job: row } : { ok: false as const, error: "Image job not found." };
}

export async function enqueueCompanionTestImageAction(idempotencyKey: string) {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false as const, error: ctx.error };
  if (!z.string().uuid().safeParse(idempotencyKey).success) {
    return { ok: false as const, error: "Invalid test request." };
  }
  if (!rateLimit(`companion-test:${ctx.workspaceId}:${ctx.userId}`, 2, 10 * 60_000).allowed) {
    return { ok: false as const, error: "Test image limit reached. Try again later." };
  }
  try {
    const job = await enqueueCompanionTestImage({ workspaceId: ctx.workspaceId, userId: ctx.userId, idempotencyKey });
    return { ok: true as const, job };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not queue test image." };
  }
}

export async function getPendingCompanionImageJobAction(contentItemId: string) {
  const ctx = await getActiveContext("brand:read");
  if ("error" in ctx) return { ok: false as const, error: ctx.error };
  if (!z.string().uuid().safeParse(contentItemId).success) return { ok: false as const, error: "Invalid post." };
  const [row] = await getDb().select({ id: companionImageJobs.id, status: companionImageJobs.status })
    .from(companionImageJobs).where(and(eq(companionImageJobs.contentItemId, contentItemId),
      eq(companionImageJobs.workspaceId, ctx.workspaceId), eq(companionImageJobs.userId, ctx.userId),
      inArray(companionImageJobs.status, ["queued", "waiting_for_companion", "claimed", "generating", "uploading"])))
    .orderBy(desc(companionImageJobs.createdAt)).limit(1);
  return { ok: true as const, job: row ?? null };
}
