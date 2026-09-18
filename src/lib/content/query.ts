import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { agentRuns, agentSteps, contentItems, contentVariants, publishingJobs, visualAssets, workspaceMembers, workspaces } from "@/db/schema";
import { can } from "@/lib/permissions";
import { effectiveContent, type ContentActor } from "./edit";

async function authorize(actor: ContentActor) {
  const [member] = await getDb().select({ role: workspaceMembers.role }).from(workspaceMembers).innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id)).where(and(eq(workspaceMembers.workspaceId, actor.workspaceId), eq(workspaceMembers.userId, actor.userId), isNull(workspaces.deletedAt)));
  if (!member || !can(member.role, "brand:read")) throw Error("Permission to read content denied.");
}
export async function findPosts(actor: ContentActor, input: { query?: string; mine?: boolean; agentCreatedOnly?: boolean; limit?: number; order?: "created" | "updated" }) {
  await authorize(actor);
  const query = input.query?.trim();
  const pattern = query ? "%" + query.replace(/[\\%_]/g, "\\$&") + "%" : null;
  const rows = await getDb().select({ id: contentItems.id, topic: contentItems.topic, status: contentItems.status, format: contentItems.format, createdAt: contentItems.createdAt, updatedAt: contentItems.updatedAt, scheduledAt: contentItems.scheduledAt }).from(contentItems)
    .where(and(eq(contentItems.workspaceId, actor.workspaceId), isNull(contentItems.deletedAt), input.mine !== false ? eq(contentItems.createdBy, actor.userId) : undefined,
      pattern ? sql`(${contentItems.topic} ilike ${pattern} OR ${contentItems.caption} ilike ${pattern} OR EXISTS (SELECT 1 FROM ${contentVariants} WHERE ${contentVariants.contentItemId}=${contentItems.id} AND ${contentVariants.workspaceId}=${actor.workspaceId} AND ${contentVariants.caption} ilike ${pattern}))` : undefined,
      input.agentCreatedOnly ? sql`EXISTS (SELECT 1 FROM ${agentSteps} JOIN ${agentRuns} ON ${agentSteps.runId}=${agentRuns.id} WHERE ${agentRuns.workspaceId}=${actor.workspaceId} AND ${agentRuns.userId}=${actor.userId} AND ${agentSteps.workspaceId}=${actor.workspaceId} AND ${agentSteps.toolName}='create_content' AND ${agentSteps.output}->>'itemId'=${contentItems.id}::text)` : undefined))
    .orderBy(desc(input.order === "updated" ? contentItems.updatedAt : contentItems.createdAt), desc(contentItems.id)).limit(Math.min(10, Math.max(1, input.limit ?? 5)));
  return { results: rows, selection: "Use a known conversation ID first. Explicit last/recent means first result; multiple matches without a clear target need one short clarification." };
}

export type DetailSection = "copy" | "visual" | "slides" | "script" | "media" | "delivery";
export async function readContent(actor: ContentActor, itemId: string, options: { variantId?: string; sections?: DetailSection[]; slideNumber?: number } = {}) {
  await authorize(actor);
  const db = getDb();
  const [item] = await db.select().from(contentItems).where(and(eq(contentItems.id, itemId), eq(contentItems.workspaceId, actor.workspaceId), isNull(contentItems.deletedAt)));
  if (!item) throw Error("Content not found in this workspace.");
  const variants = await db.select().from(contentVariants).where(and(eq(contentVariants.contentItemId, itemId), eq(contentVariants.workspaceId, actor.workspaceId))).orderBy(contentVariants.createdAt, contentVariants.id);
  const effective = effectiveContent(item, variants);
  const sections = new Set(options.sections ?? ["copy", "visual", "slides", "script", "media", "delivery"]);
  const fields = ["id", "topic", "format", "status", "updatedAt", "createdAt", "scheduledAt", "publishedAt", ...(sections.has("copy") ? ["caption", "hook", "mainCopy", "objective", "cta", "firstComment", "hashtags"] : []), ...(sections.has("visual") ? ["visualConcept"] : [])];
  const summary = Object.fromEntries(fields.map(key => [key, effective.item[key as keyof typeof effective.item]]));
  const selected = options.variantId ? effective.variants.filter(variant => variant.id === options.variantId) : effective.variants;
  if (options.variantId && !selected.length) throw Error("Variant not found in this post.");
  const details = selected.map(variant => ({ id: variant.id, platform: variant.platform, format: variant.format, status: variant.status, updatedAt: variant.updatedAt,
    ...(sections.has("copy") ? { caption: variant.caption, hashtags: variant.hashtags, firstComment: variant.firstComment ?? effective.item.firstComment, cta: variant.cta } : {}),
    ...(sections.has("slides") && variant.format === "carousel" ? { slides: ((variant.slides ?? []) as Record<string, unknown>[]).map((slide, index) => ({ ...slide, slideNumber: index + 1 })).filter(slide => !options.slideNumber || slide.slideNumber === options.slideNumber) } : {}),
    ...(sections.has("script") && variant.format === "reel" ? { script: variant.script } : {}), qa: variant.qa }));
  const media = sections.has("media") ? await db.select({ id: visualAssets.id, kind: visualAssets.kind, mimeType: visualAssets.mimeType, slideIndex: visualAssets.slideIndex, width: visualAssets.width, height: visualAssets.height }).from(visualAssets).where(and(eq(visualAssets.contentItemId, itemId), eq(visualAssets.workspaceId, actor.workspaceId))).orderBy(sql`${visualAssets.slideIndex} ASC NULLS LAST`, visualAssets.createdAt) : undefined;
  const delivery = sections.has("delivery") ? await db.select({ id: publishingJobs.id, platform: publishingJobs.platform, status: publishingJobs.status, scheduledAt: publishingJobs.scheduledAt, provider: publishingJobs.provider }).from(publishingJobs).where(and(eq(publishingJobs.contentItemId, itemId), eq(publishingJobs.workspaceId, actor.workspaceId))) : undefined;
  return { ok: true, item: summary, variants: details, media, delivery, hasInternalCorrections: Object.keys(item.internalEdits as object).length > 0, editing: "Use edit_content with item.updatedAt as expectedUpdatedAt. Patch only requested fields. slideNumber is one-based; media URLs/uploads are managed through Studio's safe uploader. Published corrections are Qurtiz-only." };
}
