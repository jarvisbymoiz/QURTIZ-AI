import { expect, it, vi } from "vitest";
import dotenv from "dotenv";
import { and, eq, inArray } from "drizzle-orm";
vi.mock("server-only", () => ({}));

it.skipIf(process.env.RUN_LIVE_STUDIO !== "true")("creates a real two-post review-only bulk plan through research and resumable slices", async () => {
  // Explicit live opt-in only. Existing encrypted provider settings require the
  // actual server key, rather than the hermetic suite's encryption fixture.
  dotenv.config({ path: ".env.local", override: true, quiet: true });
  const workspaceId = process.env.STUDIO_TEST_WORKSPACE_ID;
  if (!workspaceId) throw new Error("STUDIO_TEST_WORKSPACE_ID is required.");
  process.env.DISABLE_BACKGROUND_WORKER = "true";
  const { getDb, resetDbPool } = await import("@/db");
  const { workspaceMembers, jobs, contentItems, contentVariants, publishingJobs } = await import("@/db/schema");
  const { startBulkPlanCore, runBulkPlan } = await import("../bulk");
  const db = getDb();
  const [owner] = await db.select({ userId: workspaceMembers.userId }).from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.role, "owner"))).limit(1);
  if (!owner) throw new Error("Workspace owner not found.");
  const result = await startBulkPlanCore({ workspaceId, userId: owner.userId, count: 2, niche: "Canva accessibility and readable inclusive social media designs" });
  if (!result.ok) throw new Error(result.error);
  console.info("[studio-live]", { jobId: result.jobId, stage: "queued", count: 2 });
  try {
    for (let slice = 0; slice < 3; slice++) {
      await runBulkPlan(result.jobId, { onePost: true });
      const [job] = await db.select().from(jobs).where(and(eq(jobs.id, result.jobId), eq(jobs.workspaceId, workspaceId)));
      console.info("[studio-live]", { slice, status: job.status, progress: job.progress });
      if (job.status === "failed") throw new Error(job.error ?? "Bulk generation failed");
    }
    const [job] = await db.select().from(jobs).where(eq(jobs.id, result.jobId));
    const state = job.result as { createdIds: string[]; checkpoint: { intelligence: { evidence: { sources: unknown[] } } } };
    expect(job.status).toBe("completed");
    expect(state.createdIds).toHaveLength(2);
    expect(state.checkpoint.intelligence.evidence.sources.length).toBeGreaterThan(0);
    const posts = await db.select().from(contentItems).where(and(eq(contentItems.workspaceId, workspaceId), inArray(contentItems.id, state.createdIds)));
    expect(posts).toHaveLength(2);
    for (const post of posts) {
      expect(["ready_for_review", "draft"]).toContain(post.status);
      expect(post.caption?.length).toBeGreaterThan(50);
      expect((post.aiScores as { research: { sources: unknown[] } }).research.sources.length).toBeGreaterThan(0);
    }
    const variants = await db.select().from(contentVariants).where(inArray(contentVariants.contentItemId, state.createdIds));
    expect(variants).toHaveLength(4);
    const scheduled = await db.select({ id: publishingJobs.id }).from(publishingJobs).where(inArray(publishingJobs.contentItemId, state.createdIds));
    expect(scheduled).toHaveLength(0);
    console.info("[studio-live]", { completed: true, posts: posts.length, variants: variants.length, sources: state.checkpoint.intelligence.evidence.sources.length, scheduled: scheduled.length });
  } finally {
    const { getBoss } = await import("../boss");
    await (await getBoss()).stop();
    resetDbPool();
  }
}, 20 * 60_000);
