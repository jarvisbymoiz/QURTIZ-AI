"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { imageModePreferences } from "@/db/schema";
import { rateLimit } from "@/lib/security/rate-limit";
import { getActiveContext } from "@/lib/workspace";

export type ImageMode = "api" | "local_companion";
export type ImageModePreference = { mode: ImageMode; modelId: string | null };
const preferenceInput = z.object({
  mode: z.enum(["api", "local_companion"]),
  modelId: z.string().max(160).nullable(),
});

export async function getImageModePreferenceAction(): Promise<
  { ok: true; preference: ImageModePreference; userId: string; workspaceId: string } | { ok: false; error: string }
> {
  const ctx = await getActiveContext("brand:read");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const [row] = await getDb().select({ mode: imageModePreferences.mode, modelId: imageModePreferences.modelId })
    .from(imageModePreferences)
    .where(and(eq(imageModePreferences.workspaceId, ctx.workspaceId), eq(imageModePreferences.userId, ctx.userId)))
    .limit(1);
  if (!row || row.mode === "api") {
    return { ok: true, preference: { mode: "api", modelId: null }, userId: ctx.userId, workspaceId: ctx.workspaceId };
  }
  if (row.mode !== "local_companion") return { ok: false, error: "Saved image mode is not supported." };
  return { ok: true, preference: { mode: "local_companion", modelId: row.modelId }, userId: ctx.userId, workspaceId: ctx.workspaceId };
}

export async function saveImageModePreferenceAction(input: unknown): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const ctx = await getActiveContext("brand:read");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!rateLimit(`image-mode:${ctx.workspaceId}:${ctx.userId}`, 15, 10 * 60_000).allowed) {
    return { ok: false, error: "Too many image-mode changes. Try again later." };
  }
  const parsed = preferenceInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid image-mode preference." };
  const modelId = parsed.data.mode === "api" ? null : parsed.data.modelId?.trim() ?? null;
  if (parsed.data.modelId && /[\x00-\x1f\x7f]/.test(parsed.data.modelId)) {
    return { ok: false, error: "Invalid image model preference." };
  }
  await getDb().insert(imageModePreferences).values({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    mode: parsed.data.mode,
    modelId,
  }).onConflictDoUpdate({
    target: [imageModePreferences.workspaceId, imageModePreferences.userId],
    set: { mode: parsed.data.mode, modelId, updatedAt: new Date() },
  });
  return { ok: true };
}
