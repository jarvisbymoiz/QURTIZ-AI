"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { platformConnections } from "@/db/schema";
import { rateLimit } from "@/lib/security/rate-limit";
import { getSessionUser, getMembership } from "@/lib/workspace";
import {
  isPublishProvider,
  updateWorkspacePublishProvider,
  type PublishProvider,
} from "@/lib/publish/provider";

export type ActionResult = { ok: true } | { ok: false; error: string };

const publishingProviderSchema = z
  .string()
  .min(1)
  .max(16)
  .refine((v) => isPublishProvider(v), "Invalid publishing provider.");

/** Disconnect one platform connection row for a publishing provider
 *  ("meta" | "buffer"). Provider-scoped: a workspace can hold one row per
 *  provider per platform, and the Connections UI shows both. */
export async function disconnectPlatformAction(
  platform: "facebook" | "instagram",
  provider: string = "meta",
): Promise<ActionResult> {
  if (!isPublishProvider(provider)) return { ok: false, error: "Invalid connection provider." };
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("qurtiz_workspace")?.value;
  if (!workspaceId) return { ok: false, error: "No active workspace." };
  const membership = await getMembership(user.id, workspaceId);
  if (!membership) {
    return { ok: false, error: "You are not a member of this workspace." };
  }

  const db = getDb();
  await db
    .update(platformConnections)
    .set({ status: "not_connected", encryptedToken: null, meta: {}, channelRef: null, updatedAt: new Date() })
    .where(
      and(
        eq(platformConnections.workspaceId, workspaceId),
        eq(platformConnections.platform, platform),
        eq(platformConnections.provider, provider),
      ),
    );

  revalidatePath("/connections");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Set the workspace-wide publishing provider ("meta" | "buffer"). Persisted to
 * the settings row key "publishing" → { provider }; jobs scheduled afterwards
 * snapshot it (existing queued jobs keep their original provider). Defaults to
 * "meta" when the key is absent.
 */
export async function updatePublishingProviderAction(provider: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("qurtiz_workspace")?.value;
  if (!workspaceId) return { ok: false, error: "No active workspace." };
  const membership = await getMembership(user.id, workspaceId);
  if (!membership) {
    return { ok: false, error: "You are not a member of this workspace." };
  }

  const rl = rateLimit("publishing-provider:" + workspaceId, 10, 10 * 60_000);
  if (!rl.allowed) {
    return { ok: false, error: "Publishing provider update limit reached. Try again in a few minutes." };
  }

  const parsed = publishingProviderSchema.safeParse(provider);
  if (!parsed.success) return { ok: false, error: "Invalid publishing provider." };

  await updateWorkspacePublishProvider(workspaceId, parsed.data as PublishProvider);

  revalidatePath("/connections");
  revalidatePath("/");
  return { ok: true };
}
