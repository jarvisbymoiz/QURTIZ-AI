import { it, expect } from "vitest";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns, campaignItems, jobs } from "@/db/schema";
import { manageCampaign } from "../manage";

it.skipIf(!process.env.CAMPAIGN_RETRY_TEST_ID)("requeues an explicitly selected failed QA campaign without losing saved content", async () => {
  config({ path: ".env.local", quiet: true });
  const db = getDb();
  const id = process.env.CAMPAIGN_RETRY_TEST_ID!;
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
  expect(campaign.name).toMatch(/^Campaign verification/);
  const before = await db.select().from(campaignItems).where(eq(campaignItems.campaignId, id));
  const [job] = await db.select().from(jobs).where(eq(jobs.id, campaign.jobId!));
  expect(job.status).toBe("failed");
  await manageCampaign(campaign.workspaceId, id, { type: "retry" });
  const [after] = await db.select().from(jobs).where(eq(jobs.id, job.id));
  expect(after.status).toBe("queued");
  expect(after.progress).toBe(job.progress);
  expect(after.error).toBeNull();
  expect(after.result).toEqual({});
  expect(await db.select().from(campaignItems).where(eq(campaignItems.campaignId, id))).toEqual(before);
}, 60000);
