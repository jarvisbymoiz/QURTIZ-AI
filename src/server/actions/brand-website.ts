"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { brands } from "@/db/schema";
import { requireRoleForActiveWorkspace } from "./workspace";
import { ensureWebsiteKnowledge } from "@/lib/brand-website/service";
import { WEBSITE_ERROR_MESSAGES, websiteKnowledgeView, type WebsiteKnowledgeView } from "@/lib/brand-website/knowledge";
import { rateLimit } from "@/lib/security/rate-limit";

export async function refreshBrandWebsiteAction():Promise<
  {ok:true;knowledge:WebsiteKnowledgeView}|{ok:false;error:string;knowledge?:WebsiteKnowledgeView}> {
  const ctx=await requireRoleForActiveWorkspace("brand:write");
  if ("error" in ctx) return {ok:false,error:ctx.error};
  if (!rateLimit(`brand-website:${ctx.workspaceId}`,3,10*60_000).allowed) return {ok:false,error:"Website refresh limit reached. Try again later."};
  const [brand]=await getDb().select({website:brands.website}).from(brands).where(eq(brands.workspaceId,ctx.workspaceId));
  if (!brand?.website) return {ok:false,error:"Save the website in Business information first."};
  try {
    const knowledge=websiteKnowledgeView(await ensureWebsiteKnowledge(ctx.workspaceId,brand.website,{refresh:true}));
    revalidatePath("/brand-brain");
    if (!knowledge) return {ok:false,error:"The saved website changed during this read. Refresh Brand Brain and try again."};
    if (knowledge.status==="failed") return {ok:false,error:knowledge.warnings.map(c=>WEBSITE_ERROR_MESSAGES[c]).join(" ") || "Website reading failed.",knowledge};
    return {ok:true,knowledge};
  } catch {return {ok:false,error:WEBSITE_ERROR_MESSAGES.storage_error};}
}
