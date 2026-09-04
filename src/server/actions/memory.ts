"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { brandMemory } from "@/db/schema";
import { addMemorySchema, updateMemorySchema } from "@/lib/validation";
import { getSessionUser, getMembership, resolveActionWorkspace } from "@/lib/workspace";
import { can } from "@/lib/permissions";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Resolved active workspace for the signed-in user (null when they have none). */
async function activeWorkspaceId(): Promise<string | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return resolveActionWorkspace(user.id);
}

export async function addMemoryAction(formData: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const workspaceId = await activeWorkspaceId();
  if (!workspaceId) return { ok: false, error: "No active workspace." };

  const membership = await getMembership(user.id, workspaceId);
  if (!membership || !can(membership.role, "brand:write")) {
    return { ok: false, error: "You do not have permission to edit brand memory." };
  }

  const parsed = addMemorySchema.safeParse({
    type: formData.get("type"),
    content: formData.get("content"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const db = getDb();
  await db.insert(brandMemory).values({
    workspaceId,
    type: parsed.data.type,
    content: parsed.data.content,
    source: "manual",
    createdBy: user.id,
  });

  revalidatePath("/brand-brain");
  return { ok: true };
}

export async function updateMemoryAction(
  id: string,
  data: { type?: "preference" | "fact" | "rule"; content?: string; active?: boolean },
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const workspaceId = await activeWorkspaceId();
  if (!workspaceId) return { ok: false, error: "No active workspace." };

  const membership = await getMembership(user.id, workspaceId);
  if (!membership || !can(membership.role, "brand:write")) {
    return { ok: false, error: "You do not have permission to edit brand memory." };
  }

  const parsed = updateMemorySchema.safeParse({ id, ...data });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const db = getDb();
  const patch: Partial<typeof brandMemory.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.type !== undefined) patch.type = parsed.data.type;
  if (parsed.data.content !== undefined) patch.content = parsed.data.content;
  if (parsed.data.active !== undefined) patch.active = parsed.data.active;

  await db
    .update(brandMemory)
    .set(patch)
    .where(and(eq(brandMemory.id, parsed.data.id), eq(brandMemory.workspaceId, workspaceId)));

  revalidatePath("/brand-brain");
  return { ok: true };
}

export async function deleteMemoryAction(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const workspaceId = await activeWorkspaceId();
  if (!workspaceId) return { ok: false, error: "No active workspace." };

  const membership = await getMembership(user.id, workspaceId);
  if (!membership || !can(membership.role, "brand:write")) {
    return { ok: false, error: "You do not have permission to delete brand memory." };
  }

  const db = getDb();
  await db
    .delete(brandMemory)
    .where(and(eq(brandMemory.id, id), eq(brandMemory.workspaceId, workspaceId)));

  revalidatePath("/brand-brain");
  return { ok: true };
}
