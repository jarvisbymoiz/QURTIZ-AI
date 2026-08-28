"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { platformConnections } from "@/db/schema";
import { can } from "@/lib/permissions";
import { getSessionUser, getMembership } from "@/lib/workspace";

export type ActionResult = { ok: true } | { ok: false; error: string };

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
  await db
    .update(platformConnections)
    .set({ status: "not_connected", encryptedToken: null, meta: {}, updatedAt: new Date() })
    .where(and(eq(platformConnections.workspaceId, workspaceId), eq(platformConnections.platform, platform)));

  revalidatePath("/connections");
  revalidatePath("/");
  return { ok: true };
}
