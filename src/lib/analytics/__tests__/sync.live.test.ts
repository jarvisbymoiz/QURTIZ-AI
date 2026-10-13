import { config } from "dotenv";
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { platformConnections, postMetrics } from "@/db/schema";
import { syncInsightsForWorkspace } from "../sync";
describe("real Meta analytics sync", () => {
 it.skipIf(process.env.RUN_LIVE_INSIGHTS !== "true")("saves real metrics and rejects an overlapping lease", async () => {
  config({path: ".env.local", quiet: true, override: true});
  const db=getDb();
  const [connection]=await db.select().from(platformConnections).where(eq(platformConnections.provider,"meta")).limit(1);
  expect(connection).toBeTruthy();
  const pending=syncInsightsForWorkspace(connection.workspaceId);
  await new Promise(resolve=>setTimeout(resolve,1000));
  const overlapping=await syncInsightsForWorkspace(connection.workspaceId,{automatic:true});
  expect(overlapping.busy).toBe(true);
  let result=await pending;
  while (result.remaining) result=await syncInsightsForWorkspace(connection.workspaceId,{automatic:true,limit:40,budgetMs:75000});
  console.info("[insights:live-summary]",JSON.stringify(result));
  expect(result.synced).toBeGreaterThan(0);
  expect(result.checked).toBe(result.synced+result.skipped+result.failed);
  const rows=await db.select().from(postMetrics).where(eq(postMetrics.workspaceId,connection.workspaceId));
  console.info("[insights:live-persistence]",JSON.stringify(rows.slice(0,3).map(row=>({platform:row.platform,postId:row.externalPostId,metrics:row.metrics,collectedAt:row.collectedAt}))));
  expect(rows.some(row=>row.platform==='facebook')).toBe(true);
  expect(rows.some(row=>row.platform==='instagram')).toBe(true);
 },750000);
});
