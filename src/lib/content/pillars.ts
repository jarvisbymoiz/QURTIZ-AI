import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { contentPillars } from "@/db/schema";

export const DEFAULT_PILLARS = [
  { name: "Educational", description: "Teach something useful", targetShare: 40 },
  { name: "Promotional", description: "Offers and products", targetShare: 20 },
  { name: "Social proof", description: "Testimonials and results", targetShare: 15 },
  { name: "Engagement", description: "Questions and community", targetShare: 15 },
  { name: "Behind the scenes", description: "Process and people", targetShare: 10 },
];

/** Idempotently ensure the workspace has default content pillars. */
export async function ensureDefaultPillars(workspaceId: string): Promise<void> {
  const db = getDb();
  const existing = await db
    .select({ id: contentPillars.id })
    .from(contentPillars)
    .where(and(eq(contentPillars.workspaceId, workspaceId), eq(contentPillars.active, true)));
  if (existing.length > 0) return;
  await db
    .insert(contentPillars)
    .values(DEFAULT_PILLARS.map((p) => ({ workspaceId, ...p })));
}
