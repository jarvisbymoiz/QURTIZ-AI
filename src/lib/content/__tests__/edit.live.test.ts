import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { and, eq, sql } from "drizzle-orm";
import { stepCountIs, streamText } from "ai";
import type { LanguageModelV2, LanguageModelV2StreamPart } from "@ai-sdk/provider";
import { getDb, resetDbPool } from "@/db";
import { agentRuns, contentItems, contentVariants, platformConnections, publishingJobs, visualAssets, workspaceMembers, workspaces } from "@/db/schema";
import { editContent } from "../edit";
import { findPosts, readContent } from "../query";
import { transitionItem } from "../lifecycle";
import { unscheduleContent } from "@/lib/scheduling/unschedule";
import { scheduleItem } from "@/lib/scheduling/engine";
import { reorderVisualUploads } from "@/lib/visuals/media-order";
import { encryptToken } from "@/lib/crypto/tokens";
import { buildAgentTools } from "@/lib/ai/tools";
import { createLazyChatTools } from "@/lib/ai/chat-tools";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Only the generator is a fixture: Agent tools, authorization, transactions,
// stored post IDs, chat tool results and subsequent edits use the real database.
vi.mock("@/lib/ai/content", async original => ({ ...await original<typeof import("@/lib/ai/content")>(), generateAndPersistContent: async (args: { workspaceId: string; userId: string; input: { topic: string } }) => {
  const [item] = await getDb().insert(contentItems).values({ workspaceId: args.workspaceId, createdBy: args.userId, topic: args.input.topic, caption: "Synthetic offer caption", status: "ready_for_review" }).returning();
  await getDb().insert(contentVariants).values({ workspaceId: args.workspaceId, contentItemId: item.id, platform: "facebook", format: "single_image", caption: "Synthetic offer caption", status: "ready_for_review" });
  return { itemId: item.id, qa: { score: 100, passed: true, issues: [] } };
} }));

describe.skipIf(process.env.RUN_LIVE_TESTS !== "true")("existing-post editing against Postgres", { timeout: 30000 }, () => {
  const a = randomUUID(), b = randomUUID(), user = randomUUID(), editor = randomUUID(), viewer = randomUUID();
  const actor = { workspaceId: a, userId: user };
  async function fixture(format: "single_image" | "carousel" | "reel" = "single_image", workspaceId = a) {
    const [item] = await getDb().insert(contentItems).values({ workspaceId, createdBy: user, topic: "Synthetic test offer " + randomUUID(), format, caption: "Original caption", firstComment: "Original comment", hashtags: ["original"], visualConcept: "Original visual", status: "ready_for_review" }).returning();
    const [variant] = await getDb().insert(contentVariants).values({ workspaceId, contentItemId: item.id, platform: "facebook", format, caption: "Original caption", firstComment: "Original comment", hashtags: ["original"], status: "ready_for_review", slides: format === "carousel" ? [{ index: 0, headline: "First", visualPrompt: "Visual one" }, { index: 1, headline: "Second", visualPrompt: "Visual two" }, { index: 2, headline: "Third", visualPrompt: "Visual three" }] : [], script: format === "reel" ? { hook: "Original hook", outro: "Original outro", scenes: [{ text: "Original scene", durationSeconds: 10 }] } : {} }).returning();
    return { item, variant };
  }
  async function patch(itemId: string, changes: Omit<Parameters<typeof editContent>[1], "itemId">) {
    const details = await readContent(actor, itemId, { sections: ["copy"] });
    return editContent(actor, { itemId, expectedUpdatedAt: (details.item.updatedAt as Date).toISOString(), ...changes });
  }
  beforeAll(async () => {
    config({ path: ".env.local", quiet: true, override: true });
    await getDb().insert(workspaces).values([{ id: a, name: "Disposable editing test A", slug: a, createdBy: user }, { id: b, name: "Disposable editing test B", slug: b, createdBy: user }]);
    await getDb().insert(workspaceMembers).values([{ workspaceId: a, userId: user, role: "owner" }, { workspaceId: b, userId: user, role: "owner" }, { workspaceId: a, userId: editor, role: "editor" }, { workspaceId: a, userId: viewer, role: "viewer" }]);
    // Synthetic, encrypted token. Scheduling never calls a social provider.
    // Future jobs are cleaned up with these workspaces before becoming due.
    await getDb().insert(platformConnections).values({ workspaceId: a, platform: "facebook", provider: "meta", status: "connected", encryptedToken: encryptToken("synthetic-editing-test-no-real-token"), meta: { pageId: "synthetic-test-page" } });
  });
  afterAll(async () => { await getDb().delete(workspaces).where(eq(workspaces.id, a)); await getDb().delete(workspaces).where(eq(workspaces.id, b)); });

  it("edits a caption in place and invalidates approval without losing other fields", async () => {
    const { item, variant } = await fixture();
    await transitionItem(a, item.id, "approved");
    const before = await findPosts(actor, { limit: 10 });
    expect(await patch(item.id, { variants: [{ variantId: variant.id, caption: "Professional updated caption" }] })).toMatchObject({ ok: true, itemId: item.id, status: "ready_for_review" });
    const saved = await readContent(actor, item.id);
    expect(saved.item.caption).toBe("Professional updated caption");
    expect(saved.variants[0]).toMatchObject({ id: variant.id, caption: "Professional updated caption", hashtags: ["original"], firstComment: "Original comment", status: "ready_for_review" });
    expect(saved.item.visualConcept).toBe("Original visual");
    expect((await findPosts(actor, { limit: 10 })).results).toHaveLength(before.results.length);
  });
  it("clears only hashtags, then first comment, with no fallback to removed values", async () => {
    const { item, variant } = await fixture();
    await patch(item.id, { variants: [{ variantId: variant.id, hashtags: [] }] });
    let saved = await readContent(actor, item.id);
    expect(saved.item.hashtags).toEqual([]); expect(saved.variants[0].hashtags).toEqual([]); expect(saved.variants[0].caption).toBe("Original caption");
    await patch(item.id, { variants: [{ variantId: variant.id, firstComment: "" }] });
    saved = await readContent(actor, item.id);
    expect(saved.item.firstComment).toBe(""); expect(saved.variants[0].firstComment).toBe("");
  });
  it("edits the shared Visual Prompt and one carousel slide while preserving other slides/media", async () => {
    const { item, variant } = await fixture("carousel");
    const uploads = await getDb().insert(visualAssets).values([0, 1, 2].map(index => ({ workspaceId: a, contentItemId: item.id, kind: "upload", slideIndex: index, mimeType: "image/png", storagePath: a + "/synthetic-" + index }))).returning();
    await patch(item.id, { visualConcept: "Updated master visual", variants: [{ variantId: variant.id, slideEdits: [{ slideNumber: 2, headline: "Replacement second", visualPrompt: "New second visual" }] }] });
    const saved = await readContent(actor, item.id);
    expect(saved.item.visualConcept).toBe("Updated master visual");
    expect(saved.variants[0].slides).toEqual([{ index: 0, headline: "First", visualPrompt: "Visual one", slideNumber: 1 }, { index: 1, headline: "Replacement second", visualPrompt: "New second visual", slideNumber: 2 }, { index: 2, headline: "Third", visualPrompt: "Visual three", slideNumber: 3 }]);
    expect(saved.media?.map(asset => asset.id)).toEqual(uploads.map(asset => asset.id));
    expect((await readContent(actor, item.id, { sections: ["slides"], slideNumber: 2 })).variants[0].slides).toHaveLength(1);
  });
  it("edits Reel copy and partial script without replacing its video or other script fields", async () => {
    const { item, variant } = await fixture("reel");
    const [video] = await getDb().insert(visualAssets).values({ workspaceId: a, contentItemId: item.id, kind: "upload", slideIndex: 0, mimeType: "video/quicktime", storagePath: a + "/synthetic-reel.mov" }).returning();
    await patch(item.id, { variants: [{ variantId: variant.id, caption: "Updated Reel caption", script: { hook: "New hook" } }] });
    const saved = await readContent(actor, item.id);
    expect(saved.variants[0]).toMatchObject({ caption: "Updated Reel caption", script: { hook: "New hook", outro: "Original outro", scenes: [{ text: "Original scene", durationSeconds: 10 }] } });
    expect(saved.media?.[0]).toMatchObject({ id: video.id, mimeType: "video/quicktime" });
  });
  it("rejects stale writes, invalid slides and cross-post variant IDs atomically", async () => {
    const { item, variant } = await fixture("carousel"); const other = await fixture();
    const stamp = item.updatedAt.toISOString();
    await patch(item.id, { visualConcept: "New visual" });
    await expect(editContent(actor, { itemId: item.id, expectedUpdatedAt: stamp, topic: "Stale overwrite" })).rejects.toThrow("changed");
    await expect(patch(item.id, { topic: "Bad overwrite", variants: [{ variantId: variant.id, slideEdits: [{ slideNumber: 4, headline: "Missing" }] }] })).rejects.toThrow("slide");
    await expect(patch(item.id, { variants: [{ variantId: other.variant.id, caption: "Wrong post" }] })).rejects.toThrow("Variant");
    expect((await readContent(actor, item.id)).item.topic).toBe(item.topic);
  });
  it("enforces workspace, membership and write permissions for reads and edits", async () => {
    const { item, variant } = await fixture(); const foreign = await fixture("single_image", b);
    await expect(readContent(actor, foreign.item.id)).rejects.toThrow("workspace");
    await expect(editContent(actor, { itemId: foreign.item.id, topic: "Cross tenant" })).rejects.toThrow("workspace");
    await expect(editContent({ workspaceId: a, userId: viewer }, { itemId: item.id, topic: "Viewer write" })).rejects.toThrow("Permission");
    await expect(readContent({ workspaceId: b, userId: editor }, foreign.item.id)).rejects.toThrow("Permission");
    expect((await findPosts({ workspaceId: b, userId: user }, { mine: true })).results.map(row => row.id)).toContain(foreign.item.id);
    expect((await findPosts(actor, { mine: true })).results.map(row => row.id)).not.toContain(foreign.item.id);
    await editContent({ workspaceId: a, userId: editor }, { itemId: item.id, variants: [{ variantId: variant.id, caption: "Authorized shared edit" }] });
    expect((await readContent(actor, item.id)).variants[0].caption).toBe("Authorized shared edit");
  });
  it("schedules/reschedules the existing post through the existing centralized pipeline", async () => {
    const { item } = await fixture(); await transitionItem(a, item.id, "approved");
    const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    expect(await scheduleItem({ workspaceId: a, itemId: item.id, dateIso: date, timeStr: "10:15", timezone: "Asia/Karachi" })).toMatchObject({ ok: true });
    await expect(patch(item.id, { visualConcept: "Scheduled edit" })).rejects.toThrow("Unschedule");
    expect(await scheduleItem({ workspaceId: a, itemId: item.id, dateIso: date, timeStr: "15:45", timezone: "Asia/Karachi" })).toMatchObject({ ok: true });
    const jobs = await getDb().select().from(publishingJobs).where(eq(publishingJobs.contentItemId, item.id));
    expect(jobs).toHaveLength(1); expect(jobs[0].scheduledAt.toISOString()).toBe(date + "T10:45:00.000Z");
    expect(await unscheduleContent(actor, item.id)).toMatchObject({ ok: true, unscheduledVariants: 1 });
    expect((await getDb().select().from(publishingJobs).where(eq(publishingJobs.contentItemId, item.id)))[0].status).toBe("cancelled");
    await patch(item.id, { topic: "Edited after unscheduling" });
    expect(await scheduleItem({ workspaceId: a, itemId: item.id, dateIso: date, timeStr: "15:45", timezone: "Asia/Karachi" })).toMatchObject({ ok: false });
  });
  it("stores published corrections internally without changing delivery or First Comment retry copy", async () => {
    const { item, variant } = await fixture();
    await getDb().update(contentItems).set({ status: "published" }).where(eq(contentItems.id, item.id));
    await getDb().update(contentVariants).set({ status: "published" }).where(eq(contentVariants.id, variant.id));
    const [job] = await getDb().insert(publishingJobs).values({ workspaceId: a, contentItemId: item.id, contentVariantId: variant.id, platform: "facebook", status: "published", scheduledAt: new Date(), providerPostId: "synthetic-delivery-id", result: { comment: { status: "failed" } } }).returning();
    await expect(patch(item.id, { variants: [{ variantId: variant.id, caption: "Unsafe correction" }] })).rejects.toThrow("immutable");
    await patch(item.id, { internalOnly: true, variants: [{ variantId: variant.id, caption: "Internal correction", firstComment: "Internal comment" }] });
    const shown = await readContent(actor, item.id);
    expect(shown.variants[0]).toMatchObject({ caption: "Internal correction", firstComment: "Internal comment", status: "published" });
    const [raw] = await getDb().select().from(contentVariants).where(eq(contentVariants.id, variant.id));
    expect(raw.caption).toBe("Original caption"); expect(raw.firstComment).toBe("Original comment");
    expect((await getDb().select().from(publishingJobs).where(eq(publishingJobs.id, job.id)))[0]).toEqual(job);
    await expect(patch(item.id, { internalOnly: true, variants: [{ variantId: variant.id, platform: "instagram" }] })).rejects.toThrow("relationships");
  });
  it("blocks edits and unscheduling when a publisher owns the post", async () => {
    const { item, variant } = await fixture();
    await getDb().insert(publishingJobs).values({ workspaceId: a, contentItemId: item.id, contentVariantId: variant.id, platform: "facebook", status: "processing", scheduledAt: new Date() });
    await expect(patch(item.id, { topic: "Racing edit" })).rejects.toThrow("in progress");
    await expect(unscheduleContent(actor, item.id)).rejects.toThrow("in progress");
    await getDb().update(publishingJobs).set({ status: "failed", result: { reconciliationRequired: true } }).where(eq(publishingJobs.contentItemId, item.id));
    await expect(patch(item.id, { topic: "Unconfirmed edit" })).rejects.toThrow("unconfirmed");
    await expect(unscheduleContent(actor, item.id)).rejects.toThrow("unconfirmed");
  });
  it("adds/removes platforms without making a duplicate content item", async () => {
    const { item, variant } = await fixture();
    await patch(item.id, { addVariants: [{ platform: "instagram", caption: "Adapted Instagram copy" }] });
    expect((await readContent(actor, item.id)).variants).toHaveLength(2);
    await expect(patch(item.id, { addVariants: [{ platform: "instagram", caption: "Duplicate platform" }] })).rejects.toThrow("Duplicate");
    await patch(item.id, { removeVariantIds: [variant.id] });
    const saved = await readContent(actor, item.id);
    expect(saved.item.id).toBe(item.id); expect(saved.variants).toHaveLength(1); expect(saved.variants[0].platform).toBe("instagram");
    await expect(patch(item.id, { removeVariantIds: [saved.variants[0].id] })).rejects.toThrow("at least one");
  });
  it("reorders only this post's existing uploads, retaining paths, IDs and MIME types", async () => {
    const { item } = await fixture("carousel");
    const rows = await getDb().insert(visualAssets).values([0, 1].map(index => ({ workspaceId: a, contentItemId: item.id, kind: "upload", slideIndex: index, mimeType: "image/png", storagePath: a + "/safe-order-" + index }))).returning();
    expect(await reorderVisualUploads(actor, item.id, [rows[1].id, rows[0].id], "image/")).toEqual({ ok: true });
    const saved = await getDb().select().from(visualAssets).where(eq(visualAssets.contentItemId, item.id)).orderBy(visualAssets.slideIndex);
    expect(saved.map(row => row.storagePath)).toEqual([rows[1].storagePath, rows[0].storagePath]);
    expect(await reorderVisualUploads(actor, item.id, [rows[0].id], "image/")).toMatchObject({ ok: false });
    expect(await reorderVisualUploads({ workspaceId: b, userId: user }, item.id, [rows[0].id, rows[1].id], "image/")).toMatchObject({ ok: false });
  });
  it("searches caption and literal wildcards and gives ambiguity guidance", async () => {
    const { item, variant } = await fixture();
    await patch(item.id, { variants: [{ variantId: variant.id, caption: "Unique 75%_literal campaign" }] });
    expect((await findPosts(actor, { query: "75%_literal" })).results.map(row => row.id)).toEqual([item.id]);
    const all = await findPosts(actor, { limit: 2 }); expect(all.results).toHaveLength(2); expect(all.selection).toContain("clarification");
  });
  it("runs create → read → edit streaming tools, then finds and edits in a fresh session", async () => {
    const [run] = await getDb().insert(agentRuns).values({ ...actor, kind: "chat", status: "running" }).returning();
    const tools = buildAgentTools({ ...actor, runId: run.id });
    const created = await tools.create_content.execute!({ topic: "Synthetic cross-session offer", platforms: ["facebook"] }, { toolCallId: "create", messages: [] }) as { itemId: string; created: boolean };
    expect(created.created).toBe(true);
    const details = await readContent(actor, created.itemId, { sections: ["copy"] });
    let call = 0;
    const model: LanguageModelV2 = { specificationVersion: "v2", provider: "fixture", modelId: "fixture", supportedUrls: {}, doGenerate: async () => { throw Error("unused"); }, doStream: async () => {
      const parts: LanguageModelV2StreamPart[] = call++ === 0 ? [{ type: "tool-call", toolName: "get_content", toolCallId: "read", input: JSON.stringify({ itemId: created.itemId, sections: ["copy"] }) }, { type: "finish", finishReason: "tool-calls", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }] : call === 2 ? [{ type: "tool-call", toolName: "edit_content", toolCallId: "edit", input: JSON.stringify({ itemId: created.itemId, expectedUpdatedAt: (details.item.updatedAt as Date).toISOString(), variants: [{ variantId: details.variants[0].id, caption: "Same-chat revision" }] }) }, { type: "finish", finishReason: "tool-calls", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }] : [{ type: "text-start", id: "t" }, { type: "text-delta", id: "t", delta: "Updated your existing post." }, { type: "text-end", id: "t" }, { type: "finish", finishReason: "stop", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }];
      return { stream: new ReadableStream({ start(controller) { parts.forEach(part => controller.enqueue(part)); controller.close(); } }) };
    } };
    const lazy = createLazyChatTools(tools, "Change the caption of the post you just created");
    const result = streamText({ model, tools: lazy.tools, prepareStep: lazy.prepareStep, stopWhen: stepCountIs(4), messages: [{ role: "user", content: "Change the caption of the post you just created" }] });
    expect(await result.text).toContain("Updated"); expect((await result.steps)[1].toolResults[0].output).toMatchObject({ ok: true, itemId: created.itemId });
    resetDbPool();
    const found = await findPosts({ ...actor }, { agentCreatedOnly: true }); expect(found.results[0].id).toBe(created.itemId);
    await patch(found.results[0].id, { variants: [{ variantId: details.variants[0].id, caption: "New-session revision" }] });
    expect((await readContent(actor, created.itemId)).variants[0].caption).toBe("New-session revision");
    expect((await getDb().select().from(contentItems).where(and(eq(contentItems.workspaceId, a), eq(contentItems.topic, "Synthetic cross-session offer"))))).toHaveLength(1);
  });
  it("keeps content tables under RLS with browser grants revoked", async () => {
    const result = await getDb().execute(sql`SELECT relname, relrowsecurity, has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE') AS anon_access, has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE') AS browser_access FROM pg_class WHERE oid IN ('public.content_items'::regclass,'public.content_variants'::regclass)`);
    expect(result.rows).toHaveLength(2);
    for (const row of result.rows) expect(row).toMatchObject({ relrowsecurity: true, anon_access: false, browser_access: false });
  });
});
