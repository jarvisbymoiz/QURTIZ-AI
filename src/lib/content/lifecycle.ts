import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { contentItems, contentVariants, publishingJobs } from "@/db/schema";

export async function approveItem(workspaceId: string, itemId: string): Promise<void> {
  const db = getDb();
  await db
    .update(contentItems)
    .set({ status: "approved", updatedAt: new Date() })
    .where(and(eq(contentItems.id, itemId), eq(contentItems.workspaceId, workspaceId)));
  await db
    .update(contentVariants)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(contentVariants.contentItemId, itemId));
}

export async function rejectItem(workspaceId: string, itemId: string, reason: string | null): Promise<void> {
  const db = getDb();
  await db
    .update(contentItems)
    .set({ status: "rejected", objective: reason ?? undefined, updatedAt: new Date() })
    .where(and(eq(contentItems.id, itemId), eq(contentItems.workspaceId, workspaceId)));
  await db
    .delete(publishingJobs)
    .where(and(eq(publishingJobs.contentItemId, itemId), eq(publishingJobs.status, "pending")));
}

export async function archiveItem(workspaceId: string, itemId: string): Promise<void> {
  const db = getDb();
  await db
    .update(contentItems)
    .set({ status: "archived", updatedAt: new Date() })
    .where(and(eq(contentItems.id, itemId), eq(contentItems.workspaceId, workspaceId)));
  await db
    .update(contentVariants)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(contentVariants.contentItemId, itemId));
}

export async function getItem(workspaceId: string, itemId: string) {
  const db = getDb();
  const [item] = await db
    .select()
    .from(contentItems)
    .where(and(eq(contentItems.id, itemId), eq(contentItems.workspaceId, workspaceId)));
  return item ?? null;
}
