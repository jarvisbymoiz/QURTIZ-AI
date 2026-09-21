import { retrieveAgentMemory } from "@/lib/ai/persistent-memory";
import { boundedAgentReference } from "@/lib/ai/memory-policy";
import "server-only";

import { and, desc, eq, ne } from "drizzle-orm";
import { generateObject } from "ai";
import { z } from "zod";
import { getDb } from "@/db";
import {
  agentRuns,
  brands,
  contentItems,
  contentPillars,
  jobs,
  notifications,
  postMetrics,
  researchItems,
  workspaces,
} from "@/db/schema";
import { generateAndPersistContent, AI_GENERATION_TIMEOUT_MS } from "@/lib/ai/content";
import { GLOBAL_AI_INSTRUCTION } from "@/lib/ai/global-instruction";
import { summarizeBrandBrain } from "@/lib/ai/brand-summary";
import { withRateLimitRetry } from "@/lib/ai/provider";
import { getWorkspaceTextModel } from "@/lib/ai/config";
import { ensureDefaultPillars } from "@/lib/content/pillars";
import { planContentDays } from "@/lib/scheduling/time";
import { renderTemplateVisual } from "@/lib/visuals/template";
import { createServiceClient } from "@/lib/supabase/service";

export type BulkStage =
  | "Preparing"
  | "Analyzing Brand Brain"
  | "Analyzing content library"
  | "Checking analytics"
  | "Checking research"
  | "Creating content strategy"
  | "Generating posts"
  | "Verifying"
  | "Completed"
  | "Cancelled"
  | "Failed";

const planSchema = z.object({
  items: z
    .array(
      z.object({
        topic: z.string().min(4).max(200),
        pillar: z.string().max(80).default(""),
        angle: z.string().max(300).default(""),
        format: z.enum(["single_image", "carousel", "reel", "text_post"]).default("single_image"),
      }),
    )
    .min(1),
});

type PlanItem = z.infer<typeof planSchema>["items"][number];

async function setStage(jobId: string, stage: BulkStage, progress?: number, total?: number): Promise<void> {
  const db = getDb();
  const [current] = await db.select({ result: jobs.result }).from(jobs).where(eq(jobs.id, jobId));
  const patch: Record<string, unknown> = {
    result: { ...((current?.result ?? {}) as Record<string, unknown>), stage },
    updatedAt: new Date(),
  };
  if (progress !== undefined) patch.progress = progress;
  if (total !== undefined) patch.total = total;
  await db.update(jobs).set(patch).where(eq(jobs.id, jobId));
}

/**
 * The real bulk pipeline:
 * Brand Brain -> content library -> analytics -> research -> AI strategy ->
 * per-post generation (with brand context + QA) -> template visual ->
 * Ready for Review. Cancellation-aware; failures tracked per item.
 */
export async function runBulkPlan(jobId: string): Promise<void> {
  const db = getDb();
  const [job] = await db.update(jobs).set({ status: "running", updatedAt: new Date() })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, "queued"))).returning();
  if (!job) return;

  const input = (job.input ?? {}) as { count?: number; niche?: string };
  const count = Math.min(Math.max(input.count ?? 12, 1), 30);
  const niche = input.niche?.trim() || null;

  const [run] = await db
    .insert(agentRuns)
    .values({ workspaceId: job.workspaceId, userId: job.userId, kind: "bulk_generation", model: null })
    .returning();

  try {
    // ── 1. Brand Brain ──────────────────────────────────────────────
    await setStage(jobId, "Analyzing Brand Brain");
    const [brand] = await db.select().from(brands).where(eq(brands.workspaceId, job.workspaceId));
    const learned = await retrieveAgentMemory({ workspaceId: job.workspaceId, userId: job.userId }, "Create content strategy posts " + (niche ?? ""));
    const pillars = await db
      .select()
      .from(contentPillars)
      .where(and(eq(contentPillars.workspaceId, job.workspaceId), eq(contentPillars.active, true)));
    if (pillars.length === 0) await ensureDefaultPillars(job.workspaceId);

    // ── 2. Content library (dedupe + prior topics) ──────────────────
    await setStage(jobId, "Analyzing content library");
    const existingItems = await db
      .select({ topic: contentItems.topic, status: contentItems.status })
      .from(contentItems)
      .where(eq(contentItems.workspaceId, job.workspaceId))
      .orderBy(desc(contentItems.createdAt))
      .limit(60);
    const existingTopics = existingItems.map((i) => i.topic);

    // ── 3. Analytics (only if real data exists) ─────────────────────
    await setStage(jobId, "Checking analytics");
    const metricRows = await db
      .select()
      .from(postMetrics)
      .where(eq(postMetrics.workspaceId, job.workspaceId))
      .limit(100);
    let analyticsSummary = "No analytics data yet — base decisions on brand context and best practices, stated honestly.";
    if (metricRows.length >= 3) {
      const items = await db
        .select({ id: contentItems.id, format: contentItems.format, topic: contentItems.topic })
        .from(contentItems)
        .where(eq(contentItems.workspaceId, job.workspaceId));
      const itemById = new Map(items.map((i) => [i.id, i]));
      const perf = metricRows.map((r) => {
        const item = r.contentItemId ? itemById.get(r.contentItemId) : undefined;
        const m = (r.metrics ?? {}) as Record<string, number>;
        return {
          format: item?.format ?? "unknown",
          topic: (item?.topic ?? "").slice(0, 60),
          engagement: (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0),
        };
      });
      const byFormat = new Map<string, { eng: number; posts: number }>();
      for (const p of perf) {
        const cur = byFormat.get(p.format) ?? { eng: 0, posts: 0 };
        cur.eng += p.engagement;
        cur.posts += 1;
        byFormat.set(p.format, cur);
      }
      const top = [...perf].sort((a, b) => b.engagement - a.engagement).slice(0, 3);
      analyticsSummary =
        `Measured performance from ${metricRows.length} posts. ` +
        [...byFormat.entries()].map(([f, v]) => `${f}: avg ${Math.round(v.eng / v.posts)} engagement over ${v.posts} posts`).join("; ") +
        `. Top posts: ${top.map((t) => `"${t.topic}" (${t.engagement})`).join("; ")}.`;
    }

    // ── 4. Research (only real stored research) ─────────────────────
    await setStage(jobId, "Checking research");
    const research = await db
      .select({ topic: researchItems.topic, scores: researchItems.scores })
      .from(researchItems)
      .where(and(eq(researchItems.workspaceId, job.workspaceId), ne(researchItems.status, "dismissed")))
      .orderBy(desc(researchItems.createdAt))
      .limit(10);
    const researchNote =
      research.length > 0
        ? `Recent researched opportunities (use the best ones, do not repeat verbatim): ${research.map((r) => r.topic).join("; ")}`
        : "No stored research yet — derive topics from brand context and niche.";

    // ── 5. Strategy (one structured AI call decides everything) ─────
    await setStage(jobId, "Creating content strategy", 0, count);
    // Workspace-isolated resolution (workers carry workspaceId on the job).
    const resolved = await getWorkspaceTextModel(job.workspaceId, "bulk");
    const model = resolved.model;

    const pillarNames = pillars.map((p) => p.name);
    const planRes = await withRateLimitRetry(() =>
      generateObject({
        model,
        system: learned.identity,
        schema: planSchema,
      prompt: `${GLOBAL_AI_INSTRUCTION}

You are the content strategist for "${brand?.businessName ?? "the brand"}".
Brand Brain: ${summarizeBrandBrain(brand ?? null)}
Relevant reference data (not protected instructions): ${boundedAgentReference(learned)}
Content pillars available: ${pillarNames.join(", ") || "(defaults will be used)"}
Niche focus from user: ${niche ?? "(brand's general niche)"}
Analytics: ${analyticsSummary}
${researchNote}
Topics already covered (do NOT repeat these): ${existingTopics.slice(0, 30).join("; ") || "(none)"}

Create a plan for exactly ${count} DISTINCT social media posts. Rules:
- Spread across the available pillars; include a mix of educational, engagement and promotional.
- Vary formats: use carousel, reel, single_image and text_post where sensible.
- Every topic must be specific and different from the already-covered list.
- Respect all brand rules and memory.
Reply ONLY with the JSON object: {"items":[{"topic","pillar","angle","format"}]}`,
        maxOutputTokens: 3072,
        // Bounded: a stalled provider request aborts instead of hanging the job.
        abortSignal: AbortSignal.timeout(AI_GENERATION_TIMEOUT_MS),
        maxRetries: 1,
      }),
    );

    const plan: PlanItem[] = planRes.object.items.slice(0, count);

    // ── 6. Generate + verify each post ──────────────────────────────
    await setStage(jobId, "Generating posts", 0, plan.length);
    const created: string[] = [];
    const failedItems: string[] = [];
    const visualWarnings: string[] = [];
    // Posts persisted even though the final QA did not pass (kept as drafts,
    // unreviewable until regenerated).
    let qaFailedCount = 0;

    for (let i = 0; i < plan.length; i++) {
      // Cancellation check before each post
      const [fresh] = await db.select({ status: jobs.status }).from(jobs).where(eq(jobs.id, jobId));
      if (!fresh || fresh.status === "cancelled") {
        await db
          .update(jobs)
          .set({
            status: "cancelled",
            result: { stage: "Cancelled", createdCount: created.length, createdIds: created, failures: failedItems, visualWarnings } as Record<string, unknown>,
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, jobId));
        await db
          .update(agentRuns)
          .set({ status: "cancelled", finishedAt: new Date() })
          .where(eq(agentRuns.id, run.id));
        return;
      }

      const planItem = plan[i];
      await db
        .update(jobs)
        .set({ progress: i, result: { stage: `Generating post ${i + 1}/${plan.length}: ${planItem.topic.slice(0, 60)}`,
          createdCount: created.length, createdIds: created, failures: failedItems, visualWarnings } as Record<string, unknown>, updatedAt: new Date() })
        .where(eq(jobs.id, jobId));

      try {
        const { itemId, qa } = await generateAndPersistContent({
          workspaceId: job.workspaceId,
          userId: job.userId,
          input: {
            topic: planItem.angle ? `${planItem.topic} — ${planItem.angle}` : planItem.topic,
            objective: `Pillar: ${planItem.pillar || "general"}`,
            platforms: ["facebook", "instagram"],
            preferredFormat: planItem.format,
          },
        });

        // Verification retry: if QA failed hard, one regeneration attempt.
        let finalItemId = itemId;
        let finalQa = qa;
        let supersededItemId: string | null = null;
        if (!qa.passed) {
          await db
            .update(jobs)
            .set({ result: { stage: `Verifying post ${i + 1}/${plan.length}`, createdCount: created.length,
              createdIds: created, failures: failedItems, visualWarnings } as Record<string, unknown>, updatedAt: new Date() })
            .where(eq(jobs.id, jobId));
          const retry = await generateAndPersistContent({
            workspaceId: job.workspaceId,
            userId: job.userId,
            input: {
              topic: planItem.angle ? `${planItem.topic} — ${planItem.angle}` : planItem.topic,
              objective: `Pillar: ${planItem.pillar || "general"}. Previous attempt failed QA (${qa.issues.map((x) => x.message).slice(0, 3).join("; ")}). Fix those specific issues.`,
              platforms: ["facebook", "instagram"],
              preferredFormat: planItem.format,
            },
          });
          if (retry.qa.passed || retry.qa.score > finalQa.score) {
            supersededItemId = finalItemId;
            finalItemId = retry.itemId;
            finalQa = retry.qa;
          } else {
            supersededItemId = retry.itemId;
          }
        }
        created.push(finalItemId);

        // The superseded attempt is an orphaned draft — mark it failed so the
        // studio shows why it is there instead of leaving it as an unlabeled draft.
        if (supersededItemId) {
          await db
            .update(contentItems)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(contentItems.id, supersededItemId));
        }
        // Honest QA-failed count for the job result/notification.
        if (!finalQa.passed) qaFailedCount++;

        // Free deterministic brand visual for image formats
        if (planItem.format === "single_image" || planItem.format === "carousel") {
          try {
            const [brand] = await db.select().from(brands).where(eq(brands.workspaceId, job.workspaceId));
            const identity = (brand?.visualIdentity ?? {}) as Record<string, string | undefined>;
            const [visualItem] = await db.select().from(contentItems).where(eq(contentItems.id, finalItemId));
            const logo = await fetchLogoDataUrl(job.workspaceId);
            const png = await renderTemplateVisual({
              primaryColor: identity.primaryColor ?? "#6366f1",
              secondaryColor: identity.secondaryColor ?? "#0ea5e9",
              headline: visualItem?.hook ?? planItem.topic,
              subline: (visualItem?.mainCopy ?? "").slice(0, 160),
              cta: visualItem?.cta ?? "",
              brandName: brand?.businessName ?? "",
              logoDataUrl: logo,
              layout: planItem.format === "carousel" ? "promo" : "promo",
            });
            await storeVisual(job.workspaceId, finalItemId, png, job.userId);
          } catch (e) {
            // visual is best-effort; content is still saved — but the
            // failure is recorded on the job result, never silently dropped.
            visualWarnings.push(
              `Post ${i + 1} ("${planItem.topic.slice(0, 50)}"): visual failed — ${e instanceof Error ? e.message : "unknown error"}`,
            );
          }
        }
      } catch (e) {
        const raw = e instanceof Error ? e.message : "failed";
        failedItems.push(
          `Post ${i + 1} ("${planItem.topic.slice(0, 50)}"): ${raw === "CONFIGURATION_REQUIRED" ? "AI is not configured for this workspace — add your provider + API key in Workspace Settings." : raw}`,
        );
      }

      await db.update(jobs).set({ progress: i + 1, updatedAt: new Date() }).where(eq(jobs.id, jobId));
      await db.update(jobs).set({ result: { stage: `Generated ${i + 1}/${plan.length}`,
        createdCount: created.length, createdIds: created, failures: failedItems, visualWarnings,
        qaFailed: qaFailedCount }, updatedAt: new Date() }).where(eq(jobs.id, jobId));

      // Pace API calls: free-tier Gemini caps at ~20 requests/minute.
      // QURTIZ_BULK_INTERVAL_MS overrides (0 = no delay, paid tier).
      if (i < plan.length - 1) {
        const interval = Number(process.env.QURTIZ_BULK_INTERVAL_MS ?? 4000);
        if (interval > 0) await new Promise((r) => setTimeout(r, interval));
      }
    }

    // ── 7. Finish ───────────────────────────────────────────────────
    if (created.length === 0) {
      const reason = failedItems.slice(0, 3).join("; ") || "No posts were generated";
      await db
        .update(jobs)
        .set({
          status: "failed",
          error: reason,
          result: { stage: "Failed", createdCount: 0, createdIds: [], failures: failedItems, visualWarnings } as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));
      await db
        .update(agentRuns)
        .set({ status: "failed", error: reason, finishedAt: new Date() })
        .where(eq(agentRuns.id, run.id));
      await db.insert(notifications).values({
        workspaceId: job.workspaceId,
        userId: job.userId,
        kind: "job_completed",
        title: "Bulk content plan failed",
        body: failedItems.slice(0, 2).join("; ") || "No posts were generated.",
        link: "/content-studio",
        meta: { type: "bulk_plan", runId: run.id, createdCount: 0, failedCount: plan.length, publishStatus: "failed" },
      });
      return;
    }

    await setStage(jobId, "Completed", plan.length, plan.length);
    await db
      .update(jobs)
      .set({
        status: "completed",
        result: {
          stage: "Completed",
          createdCount: created.length,
          createdIds: created,
          failures: failedItems,
          visualWarnings,
          qaFailed: qaFailedCount,
        } as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));
    await db.update(agentRuns).set({ status: "completed", finishedAt: new Date() }).where(eq(agentRuns.id, run.id));
    await db.insert(notifications).values({
      workspaceId: job.workspaceId,
      userId: job.userId,
      kind: "job_completed",
      title: "Bulk content plan ready",
      body: `${created.length - qaFailedCount} of ${plan.length} posts generated and waiting for your approval${qaFailedCount ? `; ${qaFailedCount} failed QA and need regeneration` : ""}${failedItems.length ? ` (${failedItems.length} failed)` : ""}${visualWarnings.length ? ` — ${visualWarnings.length} post${visualWarnings.length === 1 ? "" : "s"} saved without a visual` : ""}.`,
      link: "/content-studio",
      meta: {
        type: "bulk_plan",
        runId: run.id,
        createdCount: created.length,
        failedCount: failedItems.length,
        qaFailedCount,
        publishStatus: qaFailedCount > 0 ? "qa_failed" : "pending_approval",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bulk plan failed";
    await db
      .update(jobs)
      .set({ status: "failed", error: message, result: { stage: "Failed" } as Record<string, unknown>, updatedAt: new Date() })
      .where(eq(jobs.id, jobId));
    await db
      .update(agentRuns)
      .set({ status: "failed", error: message, finishedAt: new Date() })
      .where(eq(agentRuns.id, run.id));
    await db.insert(notifications).values({
      workspaceId: job.workspaceId,
      userId: job.userId,
      kind: "job_completed",
      title: "Bulk content plan failed",
      body: message,
      link: "/content-studio",
      meta: { type: "bulk_plan", runId: run.id, publishStatus: "failed" },
    });
  }
}

async function fetchLogoDataUrl(workspaceId: string): Promise<string | null> {
  try {
    const db = getDb();
    const { brandAssets } = await import("@/db/schema");
    const [asset] = await db
      .select()
      .from(brandAssets)
      .where(and(eq(brandAssets.workspaceId, workspaceId), eq(brandAssets.kind, "logo")))
      .orderBy(desc(brandAssets.createdAt))
      .limit(1);
    if (!asset) return null;
    const supabase = createServiceClient();
    const { data } = await supabase.storage.from("brand-assets").download(asset.storagePath);
    if (!data) return null;
    const buf = Buffer.from(await data.arrayBuffer());
    return `data:${asset.mimeType};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

async function storeVisual(workspaceId: string, contentItemId: string, png: Buffer, userId: string): Promise<void> {
  const { visualAssets } = await import("@/db/schema");
  const supabase = createServiceClient();
  const storagePath = `${workspaceId}/visuals/${contentItemId}-${Date.now()}.png`;
  const { error } = await supabase.storage.from("brand-assets").upload(storagePath, png, { contentType: "image/png" });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const db = getDb();
  await db.insert(visualAssets).values({
    workspaceId,
    contentItemId,
    kind: "template",
    storagePath,
    mimeType: "image/png",
    meta: { model: "satori-template", source: "bulk" },
  });
  void userId;
}

// localized import to avoid circular chunk ordering issues


/** Shared entry used by the server action and the chat agent tool. */
export async function startBulkPlanCore(args: {
  workspaceId: string;
  userId: string;
  count: number;
  niche?: string;
}): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  if (!Number.isInteger(args.count) || args.count < 1 || args.count > 30) {
    return { ok: false, error: "Choose between 1 and 30 posts." };
  }
  const db = getDb();
  const [ws] = await db.select({ timezone: workspaces.timezone }).from(workspaces).where(eq(workspaces.id, args.workspaceId));
  void ws;
  const days = planContentDays(new Date(), args.count);
  const [job] = await db
    .insert(jobs)
    .values({
      workspaceId: args.workspaceId,
      userId: args.userId,
      type: "bulk_plan",
      status: "queued",
      total: args.count,
      input: { count: args.count, days, niche: args.niche || undefined },
    })
    .returning();
  try {
    const { getBoss, QUEUES } = await import("@/lib/jobs/boss");
    const boss = await getBoss();
    const queued = await boss.send(QUEUES.bulkGenerate, { jobId: job.id });
    if (!queued) throw new Error("Queue did not accept the job");
    return { ok: true, jobId: job.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Queue unavailable";
    await db.update(jobs).set({ status: "failed", error: message, updatedAt: new Date() }).where(eq(jobs.id, job.id));
    return { ok: false, error: "Could not queue the bulk plan: " + message };
  }
}
