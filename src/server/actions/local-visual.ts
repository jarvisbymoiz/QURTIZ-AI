"use server";

import { and, eq, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { imageModePreferences, jobs } from "@/db/schema";
import { rateLimit } from "@/lib/security/rate-limit";
import { getActiveContext } from "@/lib/workspace";

const prepareInput = z.object({
  contentItemId: z.string().uuid(), variantId: z.string().uuid().optional(),
  slideIndex: z.number().int().min(0).max(99).optional(),
});
const completeInput = z.object({ jobId: z.string().uuid(),
  imageBase64: z.string().min(100).max(9_500_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
});

async function selectedLocalMode(workspaceId: string, userId: string) {
  const [preference] = await getDb().select({ mode: imageModePreferences.mode })
    .from(imageModePreferences)
    .where(and(eq(imageModePreferences.workspaceId, workspaceId), eq(imageModePreferences.userId, userId))).limit(1);
  // The local gateway owns model selection; ignore any legacy manually saved model.
  return preference?.mode === "local_companion" ? null : undefined;
}

export async function prepareLocalVisualAction(input: unknown): Promise<
  { ok: true; jobId: string; modelId: string | null; prompt: string; size: string;
    references: { mimeType: string; base64: string }[] }
  | { ok: false; error: string }
> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = prepareInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid visual request." };
  if (!rateLimit(`local-visual:${ctx.workspaceId}:${ctx.userId}`, 6, 10 * 60_000).allowed) {
    return { ok: false, error: "Visual generation limit reached. Try again in a few minutes." };
  }
  const modelId = await selectedLocalMode(ctx.workspaceId, ctx.userId);
  if (modelId === undefined) return { ok: false, error: "Connect ChatGPT in Settings first." };
  try {
    const { prepareExternalVisual } = await import("@/lib/visuals/generate");
    const { brief, references } = await prepareExternalVisual({ ...parsed.data,
      workspaceId: ctx.workspaceId, userId: ctx.userId });
    const [job] = await getDb().insert(jobs).values({ workspaceId: ctx.workspaceId, userId: ctx.userId,
      type: "local_image", total: 1,
      input: { contentItemId: parsed.data.contentItemId, variantId: parsed.data.variantId ?? null,
        slideIndex: parsed.data.slideIndex ?? null, modelId,
        targetWidth: brief.width ?? null, targetHeight: brief.height ?? null },
    }).returning({ id: jobs.id });
    const size = brief.height && brief.width && brief.height > brief.width ? "1024x1536"
      : brief.height && brief.width && brief.width > brief.height ? "1536x1024" : "1024x1024";
    return { ok: true, jobId: job.id, modelId, prompt: brief.prompt, size, references };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not prepare local image." };
  }
}

export async function completeLocalVisualAction(input: unknown): Promise<
  { ok: true; visualId: string; model: string } | { ok: false; error: string }
> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = completeInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Generated image is malformed or too large." };
  const modelId = await selectedLocalMode(ctx.workspaceId, ctx.userId);
  if (modelId === undefined) return { ok: false, error: "Local image mode was disconnected." };
  const db = getDb();
  const [job] = await db.update(jobs).set({ status: "running", updatedAt: new Date() })
    .where(and(eq(jobs.id, parsed.data.jobId), eq(jobs.workspaceId, ctx.workspaceId),
      eq(jobs.userId, ctx.userId), eq(jobs.type, "local_image"), eq(jobs.status, "queued"),
      gt(jobs.createdAt, new Date(Date.now() - 10 * 60_000))))
    .returning({ id: jobs.id, input: jobs.input });
  if (!job) return { ok: false, error: "Image request expired, was already used, or belongs to another account." };
  const request = job.input as { contentItemId?: string; slideIndex?: number | null; modelId?: string | null;
    targetWidth?: number | null; targetHeight?: number | null };
  if (request.modelId !== modelId || !request.contentItemId) {
    await db.update(jobs).set({ status: "failed", error: "Image mode changed during generation.", updatedAt: new Date() })
      .where(eq(jobs.id, job.id));
    return { ok: false, error: "Image mode changed during generation. Try again." };
  }
  try {
    const { persistExternalVisual } = await import("@/lib/visuals/generate");
    const visualId = await persistExternalVisual({ workspaceId: ctx.workspaceId,
      contentItemId: request.contentItemId, slideIndex: request.slideIndex ?? undefined,
      model: modelId ?? "local-gateway-default", imageBase64: parsed.data.imageBase64,
      targetWidth: request.targetWidth ?? undefined, targetHeight: request.targetHeight ?? undefined });
    await db.update(jobs).set({ status: "completed", progress: 1, result: { visualId }, updatedAt: new Date() })
      .where(eq(jobs.id, job.id));
    revalidatePath("/content-studio");
    return { ok: true, visualId, model: modelId ?? "local-gateway-default" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save local image.";
    await db.update(jobs).set({ status: "failed", error: message.slice(0, 400), updatedAt: new Date() })
      .where(eq(jobs.id, job.id));
    return { ok: false, error: message };
  }
}

export async function failLocalVisualAction(jobId: string): Promise<void> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx || !z.string().uuid().safeParse(jobId).success) return;
  await getDb().update(jobs).set({ status: "failed", error: "Local image generation did not complete.", updatedAt: new Date() })
    .where(and(eq(jobs.id, jobId), eq(jobs.workspaceId, ctx.workspaceId), eq(jobs.userId, ctx.userId),
      eq(jobs.type, "local_image"), eq(jobs.status, "queued")));
}
