import { it, expect, vi } from "vitest";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { and, desc, eq, inArray } from "drizzle-orm";

dotenv.config({ path: ".env.local", quiet: true });
vi.mock("server-only", () => ({}));

it.skipIf(process.env.RUN_LIVE_REFERENCE_CLOUD !== "true")("completes a real Production Companion job for an existing unpublished post", async () => {
  const { getDb } = await import("@/db");
  const { contentItems, imageModePreferences, companionImageJobs, visualAssets } = await import("@/db/schema");
  const { createServiceClient } = await import("@/lib/supabase/service");
  const { enqueueCompanionImage } = await import("@/lib/companion/image-jobs");
  const db = getDb();
  const [preference] = await db.select().from(imageModePreferences).where(eq(imageModePreferences.mode, "local_companion")).limit(1);
  expect(preference, "ChatGPT Account Mode must be selected").toBeDefined();
  const [item] = await db.select().from(contentItems).where(and(eq(contentItems.workspaceId, preference.workspaceId),
    inArray(contentItems.status, ["draft", "ready_for_review"]))).orderBy(desc(contentItems.createdAt)).limit(1);
  expect(item, "A real unpublished post is required; this test does not create dummy posts").toBeDefined();
  const storage = createServiceClient();
  const queued = await enqueueCompanionImage({ workspaceId: preference.workspaceId, userId: preference.userId,
    contentItemId: item.id, idempotencyKey: `reference-verification:${randomUUID()}`, storage });
  expect(queued).toBeTruthy();
  const started = Date.now();
  while (Date.now() - started < 280_000) {
    const [job] = await db.select().from(companionImageJobs).where(eq(companionImageJobs.id, queued!.id)).limit(1);
    if (job.status === "failed") throw new Error(`Production Companion job failed: ${job.error}`);
    if (job.status === "completed") {
      expect(job.visualAssetId).toBeTruthy();
      const [asset] = await db.select().from(visualAssets).where(and(eq(visualAssets.id, job.visualAssetId!), eq(visualAssets.workspaceId, preference.workspaceId))).limit(1);
      const downloaded = await storage.storage.from("brand-assets").download(asset.storagePath);
      expect(downloaded.error).toBeNull();
      const output = join(process.cwd(), ".public-qa", "reference-account");
      await mkdir(output, { recursive: true });
      await writeFile(join(output, "production-generated.png"), Buffer.from(await downloaded.data!.arrayBuffer()));
      const roles = (job.referenceAssets ?? []) as { role?: string }[];
      const report = { status: job.status, mode: "chatgpt-account", references: roles.length,
        logo: roles.filter(ref => ref.role === "logo").length,
        profileAvatar: roles.filter(ref => ref.role === "profileAvatar").length,
        designReferences: roles.filter(ref => ref.role === "designReference").length,
        mediaPersisted: true, publishingPerformed: false };
      await writeFile(join(output, "production-result.json"), JSON.stringify(report, null, 2));
      console.info("[production-reference-result]", report);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 2500));
  }
  throw new Error("Production Companion job did not reach a terminal state within the test window.");
}, 300_000);
