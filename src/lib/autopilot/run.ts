import { CORE_AGENT_IDENTITY } from "@/lib/ai/identity";
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { generateText } from "ai";
import { z } from "zod";
import { getDb } from "@/db";
import { agentRuns, brands, contentItems, contentVariants, jobs, notifications, researchItems, settings, visualAssets, workspaces } from "@/db/schema";
import { getBoss, QUEUES } from "@/lib/jobs/boss";
import { buildAutopilotRunContext } from "@/lib/jobs/workflows";
import { hasWorkspaceAIConfig, getWorkspaceTextModel } from "@/lib/ai/config";
import { AI_GENERATION_TIMEOUT_MS, generateAndPersistContent } from "@/lib/ai/content";
import { summarizeBrandBrain } from "@/lib/ai/brand-summary";
import { estimateCostFromUsage } from "@/lib/ai/provider";
import { researchTopics } from "@/lib/ai/research";
import { generateVisual } from "@/lib/visuals/generate";
import { createServiceClient } from "@/lib/supabase/service";
import { approveItem } from "@/lib/content/lifecycle";
import { schedulePost, selectItemMedia } from "@/lib/publishing/service";
import { autopilotSettingsSchema, type AutopilotSettings } from "./schema";
import { dueOccurrence, postingTimes } from "./timing";

type RunInput = { config: AutopilotSettings; occurrence: string; timezone: string };
type Checkpoint = { attempts?: number; topics?: string[]; createdIds?: string[]; errors?: string[]; stage?: string; context?: Awaited<ReturnType<typeof buildAutopilotRunContext>> };
export function autoRunItemId(jobId: string, index: number, attempt: number): string {
  const hex = createHash("sha256").update(`${jobId}:${index}:${attempt}`).digest("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

/** Transactionally claim occurrences and persist jobs before sending to pg-boss.
 * Catch up missed occurrences within 24h, one per workspace per scan. */
export async function scanAutoRuns(): Promise<void> {
  const db = getDb();
  const rows = await db.select({ workspaceId: settings.workspaceId }).from(settings).where(eq(settings.key, "autopilot"));
  for (const row of rows) {
    try {
      await db.transaction(async tx => {
        const [saved] = await tx.select().from(settings).where(and(eq(settings.workspaceId, row.workspaceId), eq(settings.key, "autopilot"))).for("update");
        const parsed = autopilotSettingsSchema.safeParse(saved?.value);
        if (!parsed.success || !parsed.data.enabled) return;
        const [workspace] = await tx.select().from(workspaces).where(eq(workspaces.id, row.workspaceId));
        if (!workspace) return;
        const runtime = saved.value as { lastRunKey?: string; enabledSince?: string };
        const prior = runtime.lastRunKey;
        const occurrence = dueOccurrence(parsed.data.runTimes, parsed.data.runDays, workspace.timezone, new Date(), { afterKey: prior ?? "", enabledSince: runtime.enabledSince ? new Date(runtime.enabledSince) : undefined });
        if (!occurrence || (prior && prior >= occurrence)) return;
        const existing = await tx.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.workspaceId, row.workspaceId), eq(jobs.type, "autopilot"), sql`${jobs.input}->>'occurrence' = ${occurrence}`));
        if (!existing.length) await tx.insert(jobs).values({ id: randomUUID(), workspaceId: row.workspaceId, userId: workspace.createdBy, type: "autopilot", total: parsed.data.maxPostsPerRun,
          input: { config: parsed.data, occurrence, timezone: workspace.timezone }, result: { stage: "Queued", createdIds: [] } });
        await tx.update(settings).set({ value: sql`${settings.value} || ${JSON.stringify({ lastRunKey: occurrence })}::jsonb` }).where(and(eq(settings.workspaceId, row.workspaceId), eq(settings.key, "autopilot")));
      });
    } catch (error) { console.error("[autopilot] occurrence scan failed", error instanceof Error ? error.message : "Invalid configuration"); }
  }
  // Per-phase heartbeats + bounded AI requests allow safe restart recovery.
  await db.update(jobs).set({ status: "queued", updatedAt: new Date() }).where(and(eq(jobs.type, "autopilot"), eq(jobs.status, "running"), sql`${jobs.updatedAt} < now() - interval '30 minutes'`));
  const queued = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.type, "autopilot"), eq(jobs.status, "queued"))).orderBy(asc(jobs.createdAt)).limit(50);
  if (!queued.length) return;
  const boss = await getBoss();
  for (const job of queued) await boss.send(QUEUES.autopilotRun, { jobId: job.id }, { singletonKey: job.id, singletonSeconds: 60, retryLimit: 3, retryDelay: 60, expireInSeconds: 1800 });
}

export async function executeAutoRun(jobId: string): Promise<void> {
  const db = getDb();
  const [job] = await db.update(jobs).set({ status: "running", updatedAt: new Date() }).where(and(eq(jobs.id, jobId), eq(jobs.type, "autopilot"), eq(jobs.status, "queued"))).returning();
  if (!job) return;
  const input = job.input as RunInput;
  const state = (job.result ?? {}) as Checkpoint;
  state.createdIds ??= []; state.errors ??= []; state.attempts = (state.attempts ?? 0) + 1;
  const checkpoint = async (stage: string) => {
    state.stage = stage;
    await db.update(jobs).set({ result: state as Record<string, unknown>, progress: state.createdIds!.length, updatedAt: new Date() }).where(eq(jobs.id, job.id));
  };
  const currentConfig = async () => {
    const [row] = await db.select().from(settings).where(and(eq(settings.workspaceId, job.workspaceId), eq(settings.key, "autopilot")));
    const current = autopilotSettingsSchema.safeParse(row?.value);
    if (!current.success || !current.data.enabled) throw new Error("AUTO_RUN_DISABLED");
    return current.data;
  };
  try {
    const parsedConfig = autopilotSettingsSchema.safeParse(input?.config);
    if (!parsedConfig.success) throw new Error("INVALID_AUTO_RUN_CONFIG: saved run settings are invalid. Save Auto Run settings again.");
    const cfg = parsedConfig.data;
    await currentConfig();
    if (!(await hasWorkspaceAIConfig(job.workspaceId))) throw new Error("Configure an AI provider in Workspace Settings before Auto Run.");
    await checkpoint("Analyzing brand, analytics and Calendar");
    state.context ??= await buildAutopilotRunContext(job.workspaceId, input.timezone, job.userId);
    if (!state.topics) {
      const research = await researchTopics({ workspaceOnlyMemory: true, workspaceId: job.workspaceId, userId: job.userId, niche: cfg.nicheFocus || "the brand's niche", context: state.context.text, notes: `Auto Run: find at least ${cfg.maxPostsPerRun} distinct opportunities. Formats: ${cfg.formats.join(", ")}.` });
      const candidates = research.ok && research.insertedIds?.length ? await db.select().from(researchItems).where(and(eq(researchItems.workspaceId, job.workspaceId), inArray(researchItems.id, research.insertedIds))) : [];
      if (!research.ok) state.errors.push(`Research unavailable: ${research.message}`);
      const [brand] = await db.select().from(brands).where(eq(brands.workspaceId, job.workspaceId));
      const { model, modelId } = await getWorkspaceTextModel(job.workspaceId, "content");
      const planRunId = randomUUID();
      await db.insert(agentRuns).values({ id: planRunId, workspaceId: job.workspaceId, userId: job.userId, kind: "autopilot_strategy", model: modelId });
      try {
      const response = await generateText({ model, system: state.context.identity ?? CORE_AGENT_IDENTITY, maxRetries: 1, abortSignal: AbortSignal.timeout(AI_GENERATION_TIMEOUT_MS),
        prompt: `Plan exactly ${cfg.maxPostsPerRun} distinct post topics as a JSON array of strings, no other text. Use brand, measured performance and research intelligently. Do not claim unsourced ideas are current trends. Brand: ${summarizeBrandBrain(brand ?? null)}. Focus: ${cfg.nicheFocus || "brand content"}. Platforms: ${cfg.platforms.join(", ")}. Formats: ${cfg.formats.join(", ")}. Context: ${state.context.text}. Research: ${JSON.stringify(candidates.map(c => ({ topic: c.topic, summary: c.summary, source: c.sourceUrl }))).slice(0, 4000)}.` });
      const start = response.text.indexOf("["); const end = response.text.lastIndexOf("]");
      const topics = z.array(z.string().min(4).max(200)).length(cfg.maxPostsPerRun).parse(JSON.parse(response.text.slice(start, end + 1)));
      await db.update(agentRuns).set({ status: "completed", inputTokens: response.usage?.inputTokens ?? null, outputTokens: response.usage?.outputTokens ?? null,
        costUsd: response.usage ? estimateCostFromUsage(modelId, response.usage).toFixed(6) : null, finishedAt: new Date() }).where(eq(agentRuns.id, planRunId));
      if (new Set(topics.map(t => t.toLowerCase().trim())).size !== cfg.maxPostsPerRun) throw new Error("AI returned duplicate topics; retrying the plan.");
      state.topics = topics;
      await checkpoint("Strategy saved");
      } catch (error) {
        await db.update(agentRuns).set({ status: "failed", error: error instanceof Error ? error.message : "Strategy failed", finishedAt: new Date() }).where(eq(agentRuns.id, planRunId));
        throw error;
      }
    }
    let storage: ReturnType<typeof createServiceClient> | null = null;
    try { storage = createServiceClient(); } catch { state.errors.push("Image storage unavailable; affected content remains for review."); }
    for (let index = 0; index < cfg.maxPostsPerRun; index++) {
      await currentConfig();
      let itemId = state.createdIds[index];
      if (!itemId) {
        for (let attempt = 0; attempt < 3; attempt++) {
          await checkpoint(`Creating post ${index + 1} / ${cfg.maxPostsPerRun}`);
          const generated = await generateAndPersistContent({ workspaceId: job.workspaceId, userId: job.userId, workspaceOnlyMemory: true, contentItemId: autoRunItemId(job.id, index, attempt), abortSignal: AbortSignal.timeout(AI_GENERATION_TIMEOUT_MS),
            input: { topic: state.topics[index], objective: `Auto Run strategy: ${state.context.text}. Distinct angle ${index + 1}; QA attempt ${attempt + 1}.`, platforms: cfg.platforms, preferredFormat: cfg.formats[index % cfg.formats.length] } });
          if (generated.qa.passed) { itemId = generated.itemId; break; }
        }
        if (!itemId) throw new Error(`Post ${index + 1} failed QA after three attempts. Valid saved posts are preserved.`);
        state.createdIds[index] = itemId;
        await checkpoint("Post saved");
      }
      const [item] = await db.select().from(contentItems).where(and(eq(contentItems.id, itemId), eq(contentItems.workspaceId, job.workspaceId)));
      if (!item) throw new Error("A saved Auto Run post was removed. Review the run before retrying.");
      const variants = await db.select().from(contentVariants).where(and(eq(contentVariants.contentItemId, itemId), eq(contentVariants.workspaceId, job.workspaceId)));
      if (["scheduled", "published", "archived"].includes(item.status)) continue;
      if (cfg.generateImages && storage && item.format !== "reel" && item.format !== "text_post") {
        const slides = item.format === "carousel" ? (variants[0]?.slides ?? []) as { index: number }[] : [{ index: -1 }];
        for (const slide of slides) {
          const assets = await db.select().from(visualAssets).where(and(eq(visualAssets.contentItemId, itemId), eq(visualAssets.workspaceId, job.workspaceId)));
          if (assets.some(a => a.kind === "upload" || (slide.index === -1 ? a.slideIndex == null : a.slideIndex === slide.index))) continue;
          await currentConfig(); await checkpoint("Creating visual");
          const visual = await generateVisual({ workspaceId: job.workspaceId, userId: job.userId, contentItemId: itemId, mode: "ai", storage, ...(slide.index === -1 ? {} : { slideIndex: slide.index, variantId: variants[0]?.id }) });
          if (!visual.ok) { state.errors.push(`Visual unavailable: ${visual.message}`); break; }
        }
      }
      const live = await currentConfig();
      // Use the same upload precedence and regenerated-slide deduplication as publishing.
      const media = await selectItemMedia({ workspaceId: job.workspaceId, contentItemId: itemId });
      const readyMedia = item.format === "reel" ? media.kind === "video" : item.format === "carousel" ? media.kind === "images" && media.paths.length >= Math.max(2, ((variants[0]?.slides ?? []) as unknown[]).length) : item.format === "text_post" ? !cfg.platforms.includes("instagram") : media.kind === "image" || media.kind === "images";
      if (!readyMedia) state.errors.push(`Post ${index + 1} needs complete ${item.format === "reel" ? "video" : "image"} media; retained for review.`);
      if (cfg.requireApproval || live.requireApproval || !cfg.autoSchedule || !live.autoSchedule || !readyMedia || item.status === "rejected" || !(item.qa as { passed?: boolean }).passed) continue;
      if (item.status !== "approved") await approveItem(job.workspaceId, itemId);
      for (const variant of variants) {
        await currentConfig();
        if (variant.status === "scheduled" || variant.status === "published") continue;
        const metrics = state.context.metrics.map(m => ({ ...m, postedAt: m.postedAt ? new Date(m.postedAt) : null }));
        const timing = postingTimes(metrics, variant.platform, variant.format, cfg.fallbackTimes);
        const result = await schedulePost({ workspaceId: job.workspaceId, contentItemId: itemId, contentVariantId: variant.id, platform: variant.platform, scheduledAt: new Date(Date.now() + 60_000),
          autoTiming: { timezone: input.timezone, times: timing.times, source: timing.source, fallbackTimes: cfg.fallbackTimes, minGapMinutes: cfg.minGapMinutes, maxPostsPerDay: cfg.maxPostsPerDay } });
        if (!result.ok) throw new Error(`${variant.platform} schedule failed: ${result.message}`);
        await checkpoint("Saving calendar slots");
      }
    }
    await checkpoint(state.errors.length ? "Completed with warnings" : "Completed");
    await db.update(jobs).set({ status: "completed", error: null, updatedAt: new Date() }).where(eq(jobs.id, job.id));
    await db.insert(notifications).values({ workspaceId: job.workspaceId, userId: job.userId, kind: "content_ready", title: "Auto Run completed", body: `${state.createdIds.length} / ${cfg.maxPostsPerRun} QA-passed posts saved. ${state.errors.length ? state.errors.join("; ").slice(0, 600) : "Check Content Studio and Calendar for review and scheduling status."}`, link: "/content-studio" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auto Run failed";
    const disabled = message === "AUTO_RUN_DISABLED";
    const terminal = state.attempts >= 3 || message.startsWith("INVALID_AUTO_RUN_CONFIG:");
    await db.update(jobs).set({ status: disabled ? "cancelled" : terminal ? "failed" : "queued", error: message, result: state as Record<string, unknown>, updatedAt: new Date() }).where(eq(jobs.id, job.id));
    if (disabled || terminal) await db.insert(notifications).values({ workspaceId: job.workspaceId, userId: job.userId, kind: "system", title: disabled ? "Auto Run stopped" : "Auto Run failed", body: `${state.createdIds.length} / ${job.total} valid posts preserved. ${disabled ? "Disabled in Settings." : message}`, link: "/content-studio" });
    else throw error;
  }
}
