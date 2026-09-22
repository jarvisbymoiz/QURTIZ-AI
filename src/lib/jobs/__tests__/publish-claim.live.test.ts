import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { and, eq, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { getDb, resetDbPool } from "@/db";
import { contentItems, contentVariants, notifications, publishingJobs, workspaceMembers, workspaces } from "@/db/schema";
import { claimScheduledPublishJob } from "../publish-claim";
import { attemptPublish, refreshPendingDeliveryNotifications } from "../workflows";

// Real Postgres, isolated fixtures, NO provider credentials and NO external
// publishing. Cleanup is restricted to the UUID created by this test suite.
describe.skipIf(process.env.RUN_LIVE_TESTS !== "true")("durable scheduled publishing database integration", { timeout: 30000 }, () => {
  const workspaceId = randomUUID(), userId = randomUUID();
  beforeAll(async () => {
    config({ path: ".env.local", quiet: true });
    await getDb().insert(workspaces).values({ id: workspaceId, slug: workspaceId, name: "Scheduler integration fixture", createdBy: userId, timezone: "America/New_York" });
    await getDb().insert(workspaceMembers).values({ workspaceId, userId, role: "owner" });
  });
  afterAll(async () => {
    await getDb().delete(workspaces).where(and(eq(workspaces.id, workspaceId), eq(workspaces.slug, workspaceId)));
    resetDbPool();
  });
  async function fixture(scheduledAt = new Date(Date.now() - 1000)) {
    const [item] = await getDb().insert(contentItems).values({ workspaceId, topic: "Scheduler test only", createdBy: userId, status: "scheduled" }).returning();
    const [variant] = await getDb().insert(contentVariants).values({ workspaceId, contentItemId: item.id, platform: "facebook", format: "text_post", status: "scheduled" }).returning();
    const [job] = await getDb().insert(publishingJobs).values({ workspaceId, contentItemId: item.id, contentVariantId: variant.id, platform: "facebook", status: "pending", scheduledAt }).returning();
    return { item, variant, job };
  }
  it("selects every column defined by the actual application schema against live Postgres", async () => {
    const tables = Object.values(schema).filter(value => is(value, PgTable));
    expect(tables.length).toBe(32);
    for (const table of tables) await getDb().select().from(table).limit(0);
  });
  it("two real concurrent transactions claim a due post exactly once", async () => {
    const { job } = await fixture();
    const claims = await Promise.all([claimScheduledPublishJob(job.id), claimScheduledPublishJob(job.id)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(claims.find(Boolean)?.attempts).toBe(1);
  });
  it("preserves pending schedules and claimed attempts after connection/process state is discarded", async () => {
    const { job } = await fixture();
    resetDbPool();
    expect((await claimScheduledPublishJob(job.id))?.status).toBe("processing");
    resetDbPool();
    expect(await claimScheduledPublishJob(job.id)).toBeUndefined();
  });
  it("does not publish a future or cancelled schedule", async () => {
    const { job } = await fixture(new Date(Date.now() + 3600_000));
    expect(await claimScheduledPublishJob(job.id)).toBeUndefined();
    await getDb().update(publishingJobs).set({ scheduledAt: new Date(0), status: "cancelled" }).where(eq(publishingJobs.id, job.id));
    expect(await claimScheduledPublishJob(job.id)).toBeUndefined();
  });
  it("serializes worker claims behind the same item lock used by manual publish/reschedule", async () => {
    const { item, job } = await fixture();
    let competing: ReturnType<typeof claimScheduledPublishJob> | undefined;
    await getDb().transaction(async tx => {
      await tx.select().from(contentItems).where(eq(contentItems.id, item.id)).for("update");
      competing = claimScheduledPublishJob(job.id);
      await tx.update(publishingJobs).set({ status: "cancelled" }).where(eq(publishingJobs.id, job.id));
    });
    expect(await competing).toBeUndefined();
  });
  it("a permanent missing connection persists failure and an actionable notification", async () => {
    const { job } = await fixture();
    await attemptPublish(job.id);
    const [saved] = await getDb().select().from(publishingJobs).where(eq(publishingJobs.id, job.id));
    expect(saved.status).toBe("failed");
    expect(saved.attempts).toBe(1);
    expect(saved.providerPostId).toBeNull();
    const notes = await getDb().select().from(notifications).where(eq(notifications.workspaceId, workspaceId));
    expect(notes.some(n => n.kind === "publishing_failed" && (n.meta as { contentItemId?: string }).contentItemId === job.contentItemId)).toBe(true);
  });
  it("storage authorization enforces actual membership across workspace boundaries", async () => {
    await getDb().transaction(async tx => {
      await tx.execute(sql`select set_config('request.jwt.claim.sub', ${userId}, true)`);
      await tx.execute(sql`SET LOCAL ROLE authenticated`);
      const result = await tx.execute(sql`select public.qurtiz_storage_access(${workspaceId + '/test.png'},true) allowed, public.qurtiz_storage_access(${randomUUID() + '/test.png'},false) denied`);
      expect(result.rows[0]).toEqual({ allowed: true, denied: false });
    });
  });
  it("updates a pending Buffer notification from persisted delivery confirmation", async () => {
    const { job } = await fixture();
    await getDb().update(publishingJobs).set({ provider: "buffer", status: "published", providerPostId: "test-fixture-no-external-post", result: { status: "sent" } }).where(eq(publishingJobs.id, job.id));
    const [notice] = await getDb().insert(notifications).values({ workspaceId, userId, kind: "publishing_completed", title: "Accepted", meta: { contentItemId: job.contentItemId, jobId: job.id, publishStatus: "pending" } }).returning();
    await refreshPendingDeliveryNotifications(workspaceId);
    const [saved] = await getDb().select().from(notifications).where(eq(notifications.id, notice.id));
    expect(saved.title).toBe("Published successfully");
    expect(saved.meta).toMatchObject({ publishStatus: "published", contentItemId: job.contentItemId });
  });
});
