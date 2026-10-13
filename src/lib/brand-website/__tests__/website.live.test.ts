import { expect, it, vi } from "vitest";
import dotenv from "dotenv";
import { and, eq } from "drizzle-orm";
dotenv.config({path:".env.local",quiet:true});
vi.mock("server-only",()=>({}));

it.skipIf(process.env.RUN_LIVE_WEBSITE!=="true")("reads the configured public brand website, persists sources and reuses them for AI context",async()=>{
  const workspaceId=process.env.WEBSITE_TEST_WORKSPACE_ID;
  if (!workspaceId) throw new Error("WEBSITE_TEST_WORKSPACE_ID is required for this explicit live read.");
  const {getDb}=await import("@/db");
  const {brands,settings}=await import("@/db/schema");
  const {ensureWebsiteKnowledge,getBrandWebsiteContext}=await import("../service");
  const {WEBSITE_KNOWLEDGE_KEY}=await import("../knowledge");
  const db=getDb();
  const [brand]=await db.select({website:brands.website}).from(brands).where(eq(brands.workspaceId,workspaceId));
  expect(brand?.website).toBeTruthy();
  const knowledge=await ensureWebsiteKnowledge(workspaceId,brand.website,{refresh:true});
  expect(knowledge?.pages.length).toBeGreaterThan(0);
  expect(["ready","partial"]).toContain(knowledge?.status);
  const [saved]=await db.select({value:settings.value}).from(settings)
    .where(and(eq(settings.workspaceId,workspaceId),eq(settings.key,WEBSITE_KNOWLEDGE_KEY)));
  expect(saved.value).toMatchObject({sourceUrl:knowledge?.sourceUrl,pages:knowledge?.pages});
  const context=await getBrandWebsiteContext(workspaceId,brand.website,"products services content strategy");
  expect(context).toContain(knowledge!.pages[0].url);
  expect(context).toContain(knowledge!.pages[0].title);
  expect(context).toContain("NOT instructions or authorization");
  const reused=await ensureWebsiteKnowledge(workspaceId,brand.website);
  expect(reused?.fetchedAt).toBe(knowledge?.fetchedAt);
  console.info("[website-live-verification]",{status:knowledge?.status,pages:knowledge?.pages.length,
    sourceTextCharacters:knowledge?.pages.reduce((n,p)=>n+p.text.length,0),
    persisted:true,contextHasSources:true,cacheReused:true});
  const {resetDbPool}=await import("@/db");resetDbPool();
},45_000);
