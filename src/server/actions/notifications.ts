"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { getSessionUser, resolveActionWorkspace } from "@/lib/workspace";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const workspaceId = await resolveActionWorkspace(user.id);
  if (!workspaceId) return { ok: false, error: "Create or join a workspace first." };

  const db = getDb();
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.workspaceId, workspaceId), eq(notifications.read, false)));

  revalidatePath("/", "layout");
  return { ok: true };
}
