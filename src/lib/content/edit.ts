import "server-only";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { brands, contentItems, contentVariants, publishingJobs, workspaceMembers, workspaces } from "@/db/schema";
import { can } from "@/lib/permissions";
import { runContentQa } from "./qa";
import type { ContentRulesInput } from "@/lib/validation";

const tags = z.array(z.string().trim().min(1).max(100)).max(30).transform(values => [...new Set(values.map(value => value.replace(/^#+/, "")).filter(Boolean))]);
const slideEdit = z.object({ slideNumber: z.number().int().min(1).max(20), headline: z.string().max(120).optional(), visualPrompt: z.string().max(10000).optional() }).strict().refine(value => value.headline !== undefined || value.visualPrompt !== undefined, "Provide slide content or prompt");
const script = z.object({ hook: z.string().max(3000).optional(), outro: z.string().max(3000).optional(), totalDuration: z.number().positive().max(600).optional(), scenes: z.array(z.object({ text: z.string().max(3000).optional(), voiceover: z.string().max(3000).optional(), visualDirection: z.string().max(3000).optional(), onScreenText: z.string().max(1000).optional(), transition: z.string().max(500).optional(), durationSeconds: z.number().positive().max(600).optional() }).strict()).max(30).optional() }).strict();
const fields = z.object({ caption: z.string().trim().min(1).max(3000).optional(), hashtags: tags.optional(), firstComment: z.string().max(2200).optional(), cta: z.string().max(1000).optional(), platform: z.enum(["facebook", "instagram"]).optional(), slideEdits: z.array(slideEdit).min(1).max(20).optional(), script: script.optional() }).strict();
const editContentBase = z.object({
  itemId: z.string().uuid(), expectedUpdatedAt: z.string().datetime().optional(), internalOnly: z.boolean().default(false),
  topic: z.string().trim().min(1).max(500).optional(), hook: z.string().max(3000).optional(), mainCopy: z.string().max(10000).optional(), objective: z.string().max(300).optional(), visualConcept: z.string().max(10000).optional(),
  variants: z.array(fields.extend({ variantId: z.string().uuid() })).max(4).optional(),
  addVariants: z.array(fields.omit({ platform: true, slideEdits: true }).extend({ platform: z.enum(["facebook", "instagram"]), caption: z.string().trim().min(1).max(3000) })).max(2).optional(),
  removeVariantIds: z.array(z.string().uuid()).max(4).optional(),
}).strict();
export const editContentSchema = editContentBase.refine(value => [value.topic, value.hook, value.mainCopy, value.objective, value.visualConcept].some(value => value !== undefined) || value.variants?.some(variant => Object.keys(variant).length > 1) || !!value.addVariants?.length || !!value.removeVariantIds?.length, "No editable changes supplied");
// Keep the primary Agent schema small: platform additions/removals have a
// separate schema and reuse this same transaction/service.
export const agentEditContentSchema = editContentBase.omit({ variants: true }).pick({ itemId: true, expectedUpdatedAt: true, internalOnly: true, topic: true, hook: true, mainCopy: true, objective: true, visualConcept: true }).safeExtend({ expectedUpdatedAt: z.string().datetime(), variants: z.array(fields.omit({ script: true }).extend({ variantId: z.string().uuid() })).max(4).optional() });
export type ContentEdit = z.input<typeof editContentSchema>;
export type ContentActor = { workspaceId: string; userId: string };
type Item = typeof contentItems.$inferSelect;
type Variant = typeof contentVariants.$inferSelect;
type InternalEdits = { item?: Partial<Item>; variants?: Record<string, Partial<Variant>>; updatedBy?: string; updatedAt?: string };

/** Display-only published corrections. Publishing/retry always reads original delivery fields. */
export function effectiveContent(item: Item, variants: Variant[]) {
  const edits = item.internalEdits as InternalEdits;
  return { item: { ...item, ...(edits?.item ?? {}) }, variants: variants.map(variant => ({ ...variant, ...(edits?.variants?.[variant.id] ?? {}) })) };
}

/** Shared Studio/Agent write flow: scoped auth, parent lock, fresh QA and approval invalidation. */
export async function editContent(actor: ContentActor, raw: ContentEdit) {
  const input = editContentSchema.parse(raw);
  return getDb().transaction(async tx => {
    const [member] = await tx.select({ role: workspaceMembers.role }).from(workspaceMembers).innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id)).where(and(eq(workspaceMembers.workspaceId, actor.workspaceId), eq(workspaceMembers.userId, actor.userId), isNull(workspaces.deletedAt)));
    if (!member || !can(member.role, "brand:write")) throw Error("Permission to edit content denied.");
    const [item] = await tx.select().from(contentItems).where(and(eq(contentItems.id, input.itemId), eq(contentItems.workspaceId, actor.workspaceId), isNull(contentItems.deletedAt))).for("update");
    if (!item) throw Error("Content not found in this workspace.");
    if (input.expectedUpdatedAt && item.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime()) throw Error("This post changed since you read it. Read it again before editing.");
    const variants = await tx.select().from(contentVariants).where(and(eq(contentVariants.contentItemId, item.id), eq(contentVariants.workspaceId, actor.workspaceId)));
    const delivery = await tx.select().from(publishingJobs).where(and(eq(publishingJobs.contentItemId, item.id), eq(publishingJobs.workspaceId, actor.workspaceId)));
    if (delivery.some(job => (job.result as Record<string, unknown> | null)?.reconciliationRequired)) throw Error("Publishing delivery is unconfirmed. Verify its result before editing.");
    if (delivery.some(job => job.status === "processing")) throw Error("Publishing is in progress. Wait before editing.");
    if (item.status === "generating" || variants.some(variant => variant.status === "generating")) throw Error("Content generation is in progress. Wait before editing.");
    if (item.status === "scheduled" || variants.some(variant => variant.status === "scheduled") || delivery.some(job => job.status === "pending")) throw Error("Unschedule this post before editing; changes require review again.");
    if (item.status === "archived") throw Error("Move archived content back to review before editing.");
    const published = item.status === "published" || variants.some(variant => variant.status === "published") || delivery.some(job => !!job.providerPostId);
    if (published && !input.internalOnly) throw Error("Published delivery is immutable. Set internalOnly for a Qurtiz-only correction; the social post will not change.");
    if (published && (input.addVariants?.length || input.removeVariantIds?.length || input.variants?.some(variant => variant.platform !== undefined))) throw Error("Published platform relationships cannot be changed.");
    const current = effectiveContent(item, variants);
    const itemPatch = Object.fromEntries(["topic", "hook", "mainCopy", "objective", "visualConcept"].filter(key => input[key as keyof typeof input] !== undefined).map(key => [key, input[key as keyof typeof input]])) as Partial<Item>;
    const patches = new Map<string, Partial<Variant>>();
    for (const patch of input.variants ?? []) {
      const variant = current.variants.find(variant => variant.id === patch.variantId);
      if (!variant || patches.has(patch.variantId)) throw Error("Variant not found in this post, or repeated.");
      const { variantId, slideEdits, ...values } = patch;
      const changes: Partial<Variant> = values;
      if (slideEdits) {
        if (variant.format !== "carousel") throw Error("Slide editing requires a carousel variant.");
        const slides = (variant.slides ?? []) as { index: number; headline?: string; visualPrompt?: string }[];
        const seen = new Set<number>();
        changes.slides = slides.map(slide => ({ ...slide }));
        for (const edit of slideEdits) {
          if (seen.has(edit.slideNumber) || !slides[edit.slideNumber - 1]) throw Error("Carousel slide not found or repeated.");
          seen.add(edit.slideNumber);
          const target = (changes as Partial<Variant>).slides as typeof slides;
          target[edit.slideNumber - 1] = { ...target[edit.slideNumber - 1], ...(edit.headline !== undefined ? { headline: edit.headline } : {}), ...(edit.visualPrompt !== undefined ? { visualPrompt: edit.visualPrompt } : {}) };
        }
      }
      if (patch.script !== undefined && variant.format !== "reel") throw Error("Script editing requires a Reel variant.");
      if (patch.script !== undefined) changes.script = { ...(variant.script as object), ...patch.script };
      patches.set(variantId, changes as Partial<Variant>);
    }
    const removed = new Set(input.removeVariantIds ?? []);
    if (removed.size !== (input.removeVariantIds ?? []).length || [...removed].some(id => !variants.some(variant => variant.id === id) || patches.has(id))) throw Error("Invalid platform removal.");
    const resulting = current.variants.filter(variant => !removed.has(variant.id)).map(variant => ({ ...variant, ...patches.get(variant.id) }));
    const additions = (input.addVariants ?? []).map(addition => ({ ...addition, format: item.format, hashtags: addition.hashtags ?? item.hashtags, cta: addition.cta ?? item.cta, firstComment: addition.firstComment ?? item.firstComment, script: addition.script ?? (item.format === "reel" ? current.variants.find(variant => variant.format === "reel")?.script ?? {} : {}), slides: item.format === "carousel" ? current.variants.find(variant => variant.format === "carousel")?.slides ?? [] : [] }));
    const platforms = [...resulting.map(variant => variant.platform), ...additions.map(variant => variant.platform)];
    if (!platforms.length) throw Error("Keep at least one platform variant.");
    for (const platform of platforms) {
      const before = current.variants.filter(variant => variant.platform === platform).length;
      const after = platforms.filter(value => value === platform).length;
      if (after > 1 && after > before) throw Error("Duplicate platform variants are not allowed.");
    }
    // Synchronize shared copy when it represents the changed variant/all variants.
    for (const field of ["caption", "hashtags", "firstComment", "cta"] as const) {
      const changed = current.variants.filter(variant => patches.get(variant.id)?.[field] !== undefined);
      if (changed.length && (changed.length === current.variants.length || JSON.stringify(current.item[field]) === JSON.stringify(changed[0][field]))) {
        (itemPatch as Record<string, unknown>)[field] = patches.get(changed[0].id)![field];
      }
    }
    const now = new Date(Math.max(Date.now(), item.updatedAt.getTime() + 1));
    if (published) {
      const prior = item.internalEdits as InternalEdits;
      const corrected: InternalEdits = { item: { ...prior?.item, ...itemPatch }, variants: { ...prior?.variants }, updatedBy: actor.userId, updatedAt: now.toISOString() };
      for (const [id, patch] of patches) corrected.variants![id] = { ...corrected.variants![id], ...patch };
      await tx.update(contentItems).set({ internalEdits: corrected, updatedAt: now }).where(eq(contentItems.id, item.id));
      return { ok: true, updated: true, itemId: item.id, status: item.status, internalOnly: true, changedFields: [...Object.keys(itemPatch), ...[...patches.values()].flatMap(Object.keys)], updatedAt: now.toISOString(), message: "Qurtiz internal record updated; original delivery, external post and provider retries are unchanged." };
    }
    const [brand] = await tx.select().from(brands).where(eq(brands.workspaceId, actor.workspaceId));
    const rules = (brand?.contentRules ?? {}) as Partial<ContentRulesInput>;
    const evaluations = [];
    for (const variant of resulting) {
      const qa = runContentQa({ caption: variant.caption, hashtags: variant.hashtags, cta: variant.cta, platform: variant.platform, rules });
      evaluations.push(qa);
      await tx.update(contentVariants).set({ ...patches.get(variant.id), qa, status: qa.passed ? "ready_for_review" : "failed", updatedAt: now }).where(and(eq(contentVariants.id, variant.id), eq(contentVariants.workspaceId, actor.workspaceId)));
    }
    for (const addition of additions) {
      const qa = runContentQa({ caption: addition.caption, hashtags: addition.hashtags, cta: addition.cta, platform: addition.platform, rules }); evaluations.push(qa);
      await tx.insert(contentVariants).values({ ...addition, contentItemId: item.id, workspaceId: actor.workspaceId, qa, status: qa.passed ? "ready_for_review" : "failed", updatedAt: now });
    }
    for (const id of removed) {
      if (delivery.some(job => job.contentVariantId === id)) throw Error("This platform has delivery history. Keep its relationship intact.");
      await tx.delete(contentVariants).where(and(eq(contentVariants.id, id), eq(contentVariants.workspaceId, actor.workspaceId)));
    }
    const passed = evaluations.every(qa => qa.passed);
    const qa = { passed, score: Math.min(...evaluations.map(qa => qa.score)), issues: evaluations.flatMap(qa => qa.issues) };
    await tx.update(contentItems).set({ ...itemPatch, qa, status: passed ? "ready_for_review" : "draft", scheduledAt: null, updatedAt: now }).where(eq(contentItems.id, item.id));
    return { ok: true, updated: true, itemId: item.id, status: passed ? "ready_for_review" : "draft", internalOnly: false, changedFields: [...Object.keys(itemPatch), ...[...patches.values()].flatMap(Object.keys), ...(additions.length || removed.size ? ["platforms"] : [])], updatedAt: now.toISOString(), qa, message: "Existing post updated. Review and approve the changed content before scheduling." };
  });
}
