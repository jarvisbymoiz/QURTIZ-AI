import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { brands, settings } from "@/db/schema";
import { normalizeWebsiteUrl, readBrandWebsite } from "./reader";
import { formatWebsiteKnowledge, WEBSITE_FRESH_MS, WEBSITE_KNOWLEDGE_KEY, WEBSITE_LEASE_MS,
  WEBSITE_REFRESH_GAP_MS, WEBSITE_RETRY_MS, websiteKnowledgeSchema, type WebsiteKnowledge } from "./knowledge";

function stored(value:unknown, sourceUrl:string):WebsiteKnowledge | null {
  const parsed=websiteKnowledgeSchema.safeParse(value);
  if (!parsed.success || parsed.data.sourceUrl!==sourceUrl) return null;
  try {if (parsed.data.pages.some(p=>normalizeWebsiteUrl(p.url)!==p.url)) return null;} catch {return null;}
  const leaseUntil=Date.parse(parsed.data.leaseUntil ?? "");
  if (parsed.data.status==="reading" && (!Number.isFinite(leaseUntil) || leaseUntil<=Date.now())) {
    return {...parsed.data,status:"failed",warnings:["timeout"]};
  }
  return parsed.data;
}

/** Read cached state only; rendering Brand Brain never starts a network request. */
export async function getSavedWebsiteKnowledge(workspaceId:string, website:string | null | undefined):Promise<WebsiteKnowledge | null> {
  if (!website) return null;
  let source:string;
  try {source=normalizeWebsiteUrl(website);} catch {return null;}
  const [row]=await getDb().select({value:settings.value}).from(settings)
    .where(and(eq(settings.workspaceId,workspaceId),eq(settings.key,WEBSITE_KNOWLEDGE_KEY)));
  return stored(row?.value,source);
}

/** A bounded read through the existing tenant settings table. Durable leases avoid
 * repeated crawls across cold starts/concurrent workers. No provider/model key is
 * needed and no business fields, user memory, or approval state are overwritten. */
export async function ensureWebsiteKnowledge(workspaceId:string, website:string | null | undefined,
  options:{refresh?:boolean;signal?:AbortSignal}={}):Promise<WebsiteKnowledge | null> {
  if (!website) return null;
  options.signal?.throwIfAborted();
  let source:string;
  try {source=normalizeWebsiteUrl(website);} catch {
    return {version:1,sourceUrl:website.slice(0,2048),status:"failed",attemptedAt:new Date().toISOString(),
      fetchedAt:null,pages:[],warnings:["invalid_url"]};
  }
  const db=getDb(); const leaseId=randomUUID(); const now=Date.now();
  const claim=await db.transaction(async tx => {
    // Same lock order when claiming and finishing. A URL edited during a read
    // invalidates its results; stale sources cannot replace the newly saved brand.
    const [brand]=await tx.select({website:brands.website}).from(brands)
      .where(eq(brands.workspaceId,workspaceId)).for("update");
    try {if (!brand?.website || normalizeWebsiteUrl(brand.website)!==source) return {claimed:false,value:null};}
    catch {return {claimed:false,value:null};}
    await tx.insert(settings).values({workspaceId,key:WEBSITE_KNOWLEDGE_KEY,value:{}}).onConflictDoNothing();
    const [row]=await tx.select({value:settings.value}).from(settings)
      .where(and(eq(settings.workspaceId,workspaceId),eq(settings.key,WEBSITE_KNOWLEDGE_KEY))).for("update");
    const value=stored(row?.value,source);
    const activeLease=value?.status==="reading" && Date.parse(value.leaseUntil ?? "")>now;
    const recentAttempt=value && now-Date.parse(value.attemptedAt)<WEBSITE_REFRESH_GAP_MS;
    const fresh=value?.fetchedAt && now-Date.parse(value.fetchedAt)<WEBSITE_FRESH_MS;
    const retryLater=value?.retryAt && Date.parse(value.retryAt)>now;
    if (activeLease || recentAttempt || (!options.refresh && (fresh || retryLater))) return {claimed:false,value};
    const pending:WebsiteKnowledge={version:1,sourceUrl:source,status:"reading",attemptedAt:new Date(now).toISOString(),
      fetchedAt:value?.fetchedAt ?? null,pages:value?.pages ?? [],warnings:[],leaseId,
      leaseUntil:new Date(now+WEBSITE_LEASE_MS).toISOString()};
    await tx.update(settings).set({value:pending,updatedAt:new Date(now)})
      .where(and(eq(settings.workspaceId,workspaceId),eq(settings.key,WEBSITE_KNOWLEDGE_KEY)));
    return {claimed:true,value:pending};
  });
  if (!claim.claimed || !claim.value) return claim.value;
  let result:Awaited<ReturnType<typeof readBrandWebsite>>;
  try {result=await readBrandWebsite(source,{signal:options.signal});}
  catch(error) {
    // Persist a recoverable terminal state even if the initiating chat was stopped.
    result={pages:[],warnings:["timeout"]};
    if (!options.signal?.aborted) console.warn("[brand-website] read failed",{code:"http_error"});
    void error;
  }
  const finished=Date.now();
  const value:WebsiteKnowledge={version:1,sourceUrl:source,
    status:result.pages.length?result.warnings.length?"partial":"ready":"failed",
    attemptedAt:claim.value.attemptedAt,
    fetchedAt:result.pages.length?new Date(finished).toISOString():claim.value.fetchedAt,
    pages:result.pages.length?result.pages:claim.value.pages,
    warnings:result.warnings,
    ...(!result.pages.length?{retryAt:new Date(finished+WEBSITE_RETRY_MS).toISOString()}:{}),
  };
  const committed=await db.transaction(async tx=>{
    const [brand]=await tx.select({website:brands.website}).from(brands)
      .where(eq(brands.workspaceId,workspaceId)).for("update");
    try {if (!brand?.website || normalizeWebsiteUrl(brand.website)!==source) return false;}
    catch {return false;}
    const saved=await tx.update(settings).set({value,updatedAt:new Date(finished)})
      .where(and(eq(settings.workspaceId,workspaceId),eq(settings.key,WEBSITE_KNOWLEDGE_KEY),
        sql`${settings.value}->>'leaseId' = ${leaseId}`)).returning({key:settings.key});
    return saved.length>0;
  });
  console.info("[brand-website]",{status:value.status,pages:result.pages.length,reasons:result.warnings});
  options.signal?.throwIfAborted();
  return committed?value:null;
}

/** Common automatic context for chat, Studio, bulk and Auto Run. Optional website
 * failures never destroy the user's manually supplied Brand Brain or core flow. */
export async function getBrandWebsiteContext(workspaceId:string, website:string | null | undefined,
  task="",signal?:AbortSignal):Promise<string> {
  if (!website) return "";
  try {return formatWebsiteKnowledge(await ensureWebsiteKnowledge(workspaceId,website,{signal}),task);}
  catch {
    signal?.throwIfAborted();
    console.warn("[brand-website] context unavailable",{code:"storage_error"});
    return "Website knowledge is unavailable. Use saved Brand Brain details; do not claim the website was read.";
  }
}
