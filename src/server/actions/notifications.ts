"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { getSessionUser, getMembership } from "@/lib/workspace";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("qurtiz_workspace")?.value;
  if (!workspaceId) return { ok: false, error: "No active workspace." };
  const membership = await getMembership(user.id, workspaceId);
  if (!membership) return { ok: false, error: "Not a member." };

  const db = getDb();
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.workspaceId, workspaceId), eq(notifications.read, false)));

  revalidatePath("/", "layout");
  return { ok: true };
}
