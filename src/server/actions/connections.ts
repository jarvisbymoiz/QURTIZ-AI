"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { platformConnections } from "@/db/schema";
import { can } from "@/lib/permissions";
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

export async function disconnectPlatformAction(platform: "facebook" | "instagram"): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("qurtiz_workspace")?.value;
  if (!workspaceId) return { ok: false, error: "No active workspace." };
  const membership = await getMembership(user.id, workspaceId);
  if (!membership || !can(membership.role, "workspace:manage")) {
    return { ok: false, error: "Only admins can disconnect accounts." };
  }

  const db = getDb();
  // Provider-scoped: this disconnects the Meta row the Connections UI manages
  // today. Once the provider toggle UI ships (Batch B), disconnect becomes
  // provider-aware per connection row.
  await db
    .update(platformConnections)
    .set({ status: "not_connected", encryptedToken: null, meta: {}, channelRef: null, updatedAt: new Date() })
    .where(
      and(
        eq(platformConnections.workspaceId, workspaceId),
        eq(platformConnections.platform, platform),
        eq(platformConnections.provider, "meta"),
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
  if (!membership || !can(membership.role, "workspace:manage")) {
    return { ok: false, error: "Only admins can change the publishing provider." };
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
