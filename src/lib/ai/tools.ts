import { editContent, agentEditContentSchema } from "@/lib/content/edit";
import { findPosts, readContent } from "@/lib/content/query";
import { unscheduleContent } from "@/lib/scheduling/unschedule";
import { reorderVisualUploads } from "@/lib/visuals/media-order";
import { transitionItem } from "@/lib/content/lifecycle";
import { revalidatePath } from "next/cache";
import { tool, type Tool, type ToolCallOptions } from "ai";
import { z } from "zod";
import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { agentRuns, agentSteps, brandMemory, brands, competitors, competitorSnapshots, researchItems, jobs, contentItems, contentVariants, platformConnections } from "@/db/schema";
import { getMembership } from "@/lib/workspace";
import { can } from "@/lib/permissions";
import { rateLimit } from "@/lib/security/rate-limit";
import { summarizeBrandBrain } from "@/lib/ai/brand-summary";
export { summarizeBrandBrain };
import { appendRateLimitHint, capMessage, normalizeToolOutput, scrubCredentials } from "@/lib/ai/stream-errors";
import { AIContentParseError, generateAndPersistContent } from "@/lib/ai/content";
import { AIConfigError, RateLimitExceededError, rateLimitHint } from "@/lib/ai/provider";
import { getWorkspacePublishProvider } from "@/lib/publish/provider";
import { scheduleItem } from "@/lib/scheduling/engine";
import { isValidTimezone } from "@/lib/scheduling/time";
import { startBulkPlanCore } from "@/lib/jobs/bulk";
import { makeWebSearchTool } from "@/lib/ai/search-tool";
import { workspaces } from "@/db/schema";
import { researchTopics } from "@/lib/ai/research";
import { approveItem, rejectItem, getItem } from "@/lib/content/lifecycle";
import { sumTotals } from "@/lib/analytics/compute";
import { postMetrics } from "@/db/schema";
import { generateVisual } from "@/lib/visuals/generate";
import { memoryInputSchema } from "./memory-policy";
import { forgetAgentMemory, retrieveAgentMemory, saveAgentMemory } from "./persistent-memory";

export type BrandMemoryRow = typeof brandMemory.$inferSelect;

export type AgentToolContext = {
  workspaceId: string;
  userId: string;
  runId: string;
  abortSignal?: AbortSignal;
  currentTask?: string;
};

/**
 * Human-readable message for a failed tool execution, safe to hand back to
 * the agent as a tool result. AIConfigError carries its own user-facing
 * detail; anything else is the error message, defensively scrubbed of
 * key-like strings and capped at 300 chars. Rate-limit/timeout failures get
 * an actionable hint instead of a dead end.
 *
 * Special case: RateLimitExceededError (TPD/RPD/quota) carries an
 * actionable hint with the exact retry-after time. We surface THAT hint
 * directly so the agent tells the user "switch to a different model" or
 * "wait N minutes" instead of a generic "rate limited".
 */
function formatAgentToolError(error: unknown): string {
  if (error instanceof AIConfigError) return error.detail;
  if (error instanceof RateLimitExceededError) {
    // Pre-built hint already encodes kind + retry-after. Trim credentials
    // (the cause may include them) and cap to 300 chars to stay tool-safe.
    return capMessage(scrubCredentials(rateLimitHint(error.info)), 300);
  }
  const message =
    error instanceof Error
      ? error.message
      : "The operation failed.";
  // Defensive scrub + cap + hint come from the shared stream-error helpers
  // (same sanitization the chat route applies to provider errors).
  return appendRateLimitHint(capMessage(scrubCredentials(message)));
}

/**
 * Terminal message for AIContentParseError: after the primary structured
 * call and both fallbacks nothing parsable came back, so retrying within
 * the same turn would only burn tokens on a model that cannot produce valid
 * JSON. Same defensive scrub as formatAgentToolError.
 */
function formatContentParseError(error: AIContentParseError): string {
  const message =
    "The AI model's response could not be parsed into a valid post even after retries " +
    `(details: ${error.diagnostics.issues.slice(0, 120)}). ` +
    "Report this error to the user and STOP — do not retry automatically or invent a caption.";
  // Same defensive scrub + cap as formatAgentToolError (no rate-limit hint —
  // a parse failure is not a rate limit).
  return capMessage(scrubCredentials(message));
}

/**
 * Wrap a tool's execute so its return value is normalized (serializability +
 * 24KB cap) before the SDK turns it into a tool-result part. Passthrough for
 * normal outputs — existing tools are untouched; a future tool that returns
 * a circular, BigInt-bearing or oversized value degrades to an honest note
 * instead of breaking the agent stream mid-step. The wrapper mutates the
 * tool object in place (rather than rebuilding it) so the SDK's Tool type
 * stays intact.
 */
function withNormalizedOutput(t: Tool): Tool {
  const execute = t.execute;
  if (!execute) return t;
  const original = execute.bind(t);
  t.execute = (input: unknown, options: ToolCallOptions) =>
    normalizeToolOutput(original(input, options));
  return t;
}

/**
 * Build the M1 agent tool set. All tools are read / internal-write only —
 * publishing and other external actions do not exist at this milestone.
 */
export function buildAgentTools(ctx: AgentToolContext) {
  const db = getDb();
  let stepCounter = 0;

  async function logStep(toolName: string, input: unknown, output: unknown) {
    const idx = stepCounter++;
    try {
      await db.insert(agentSteps).values({
        runId: ctx.runId,
        workspaceId: ctx.workspaceId,
        idx,
        toolName,
        input: (input ?? {}) as Record<string, unknown>,
        output: (output ?? {}) as Record<string, unknown>,
        status: output && typeof output === "object" && ("error" in output || ("ok" in output && output.ok === false)) ? "failed" : "completed",
      });
    } catch {
      // Logging must never break the agent turn.
    }
  }

  async function refreshContent() {
    try { for (const path of ["/content-studio", "/content-library", "/calendar", "/"]) revalidatePath(path); }
    catch { console.warn("[agent-content] cache invalidation unavailable", { workspaceId: ctx.workspaceId, runId: ctx.runId }); }
  }

  const getBrandBrain = tool({
    description:
      "Read the Brand Brain for the current workspace: business info, audience, brand voice, visual identity, and content rules.",
    inputSchema: z.object({}),
    execute: async () => {
      // A DB failure must surface as a tool result the agent can explain —
      // never as a throw that breaks the agent stream.
      try {
        const rows = await db.select().from(brands).where(eq(brands.workspaceId, ctx.workspaceId));
        const summary = summarizeBrandBrain(rows[0] ?? null);
        await logStep("get_brand_brain", {}, { summary });
        return { brandBrain: summary };
      } catch (error) {
        const message = formatAgentToolError(error);
        await logStep("get_brand_brain", {}, { brandBrain: null, error: message });
        return { brandBrain: null, error: message };
      }
    },
  });

  const listWorkspaceFacts = tool({
    description:
      "List the active brand memory entries (preferences, facts, rules) for this workspace.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const context = await retrieveAgentMemory(ctx, ctx.currentTask ?? "brand content strategy");
        const memories = context.workspace;
        await logStep("list_workspace_facts", {}, { memories });
        return { memories };
      } catch (error) {
        const message = formatAgentToolError(error);
        await logStep("list_workspace_facts", {}, { memories: [], error: message });
        return { memories: [], error: message };
      }
    },
  });

  const updateBrandMemory = tool({
    description:
      'Save a durable brand preference, fact, or rule learned from the conversation. Use when the user says things like "remember that...", "always...", or "never use...". Confirm the save to the user afterwards.',
    inputSchema: memoryInputSchema,
    execute: async (input) => {
      const result = await saveAgentMemory(ctx, input, `chat:${ctx.runId}`);
      await logStep("update_brand_memory", { scope: input.scope, key: result.key }, { id: result.id, saved: true });
      return { ...result, scope: input.scope, message: "Saved. Manage this in Settings - Agent Memory." };
    },
  });

  const createContent = tool({
    description:
      "Generate one complete social media post (copy + platform-adapted variants + hashtags + CTA) for this workspace. Use when the user asks to create a post or content about a topic. The post goes to Content Studio as Ready for Review — it is NOT published.",
    inputSchema: z.object({
      topic: z.string().min(4).max(500).describe("What the post is about"),
      platforms: z.array(z.enum(["facebook", "instagram"])).min(1).describe("Target platforms"),
      objective: z.string().max(300).optional().describe("e.g. engagement, leads, sales"),
      preferredFormat: z.enum(["single_image", "carousel", "reel", "story", "text_post"]).optional().describe("Requested content format; infer if unspecified"),
      toneOverride: z.string().max(300).optional().describe("Explicit tone or refinement direction for this version"),
    }),
    execute: async (input) => {
      // A failed generation must surface as a tool result the agent can
      // explain to the user — never as a throw that breaks the agent stream.
      try {
        const { itemId, qa } = await generateAndPersistContent({
          workspaceId: ctx.workspaceId,
          userId: ctx.userId,
          abortSignal: ctx.abortSignal,
          input: {
            topic: input.topic,
            objective: input.objective ?? null,
            platforms: input.platforms,
            preferredFormat: input.preferredFormat ?? null,
            toneOverride: input.toneOverride ?? null,
          },
        });
        await logStep("create_content", input, { itemId, qaScore: qa.score });
        return {
          created: true,
          itemId,
          qaScore: qa.score,
          qaIssues: qa.issues,
          message: `Content created (QA ${qa.score}/100) and saved to Content Studio as ${qa.passed ? "Ready for Review" : "Draft (QA issues found)"}.`,
        };
      } catch (error) {
        // Parse failures after all retries are terminal: instruct the agent
        // to stop instead of looping on a model that cannot produce valid
        // JSON (and never invent a caption as a substitute).
        const message =
          error instanceof AIContentParseError
            ? formatContentParseError(error)
            : formatAgentToolError(error);
        await logStep("create_content", input, { created: false, error: message });
        return { created: false, error: message };
      }
    },
  });

  const researchNiche = tool({
    description:
      "Research content opportunities for a niche or topic: finds topics, scores opportunities (AI-estimated), and saves them to the Research Lab. Use when the user asks what to post about, trends in their niche, or content ideas.",
    inputSchema: z.object({
      niche: z.string().min(4).max(300).describe("The niche, topic, or business area to research"),
      notes: z.string().max(1000).optional().describe("Optional focus from the user"),
    }),
    execute: async (input) => {
      // Research failures surface as a tool result the agent can explain —
      // never as a throw that breaks the agent stream.
      try {
        const result = await researchTopics({
          workspaceId: ctx.workspaceId,
          userId: ctx.userId,
          niche: input.niche,
          notes: input.notes ?? null,
        });
        await logStep("research_niche", input, { ok: result.ok, count: result.ok ? result.count : undefined });
        if (!result.ok) return { found: false, message: result.message };
        return {
          found: true,
          count: result.count,
          researchIds: result.insertedIds,
          note: result.note,
          findings: await db.select({ id: researchItems.id, topic: researchItems.topic, summary: researchItems.summary, sourceUrl: researchItems.sourceUrl })
            .from(researchItems).where(and(eq(researchItems.workspaceId, ctx.workspaceId), inArray(researchItems.id, result.insertedIds ?? []))).limit(12),
          sourced: result.sourced,
          message: `${result.count} opportunities saved to the Research Lab${result.sourced ? " with live web sources" : " (AI estimates — no live sources on current plan)"}.`,
        };
      } catch (error) {
        const message = formatAgentToolError(error);
        await logStep("research_niche", input, { found: false, error: message });
        return { found: false, message };
      }
    },
  });

  const scheduleContent = tool({
    description:
      "Schedule (or reschedule) an APPROVED content item at a specific date and time in the workspace timezone. Use when the user asks to post content at a named date/time. Reschedules the item if it is already scheduled (moves it to the new slot, cancelling the old one). Time defaults to 18:30 workspace time if omitted. Publishing itself still requires a connected platform account. The date must be TODAY or a future date — resolve the year against the current date stated in the system prompt (the engine rejects past dates).",
    inputSchema: z.object({
      contentItemId: z.string().describe("The content item id (returned by create_content or search_content_library)"),
      date: z.string().describe("Schedule date: YYYY-MM-DD (today or later in the workspace timezone)"),
      time: z.string().regex(/^\d{2}:\d{2}$/).optional().describe("Time HH:MM in the target timezone (default 18:30 workspace time)"),
      timezone: z.string().optional().describe("IANA timezone, e.g. Asia/Karachi. Defaults to the workspace timezone."),
    }),
    execute: async (input) => {
      try {
        const db = getDb();
        const [ws] = await db.select({ timezone: workspaces.timezone }).from(workspaces).where(eq(workspaces.id, ctx.workspaceId));
        const tz = input.timezone ?? ws?.timezone ?? "Asia/Karachi";
        if (!isValidTimezone(tz)) {
          return { scheduled: false, message: `Unknown timezone "${tz}". Use an IANA timezone such as Asia/Karachi or America/New_York.` };
        }
        const dateIso = input.date.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
          return { scheduled: false, message: `Invalid date "${input.date}". Use YYYY-MM-DD.` };
        }

        // Workspace-scoped lookup: items outside this workspace simply don't exist.
        const [item] = await db
          .select({ id: contentItems.id, topic: contentItems.topic, status: contentItems.status })
          .from(contentItems)
          .where(and(eq(contentItems.id, input.contentItemId), eq(contentItems.workspaceId, ctx.workspaceId)));
        if (!item) {
          await logStep("schedule_content", input, { ok: false });
          return { scheduled: false, message: "Content item not found in this workspace." };
        }
        // H2 guard: only approved or scheduled items can be booked. Drafts and
        // review items must be approved first; published items are already live.
        if (!["approved", "scheduled"].includes(item.status)) {
          await logStep("schedule_content", input, { ok: false });
          return {
            scheduled: false,
            message:
              item.status === "published"
                ? "This item is already published and cannot be scheduled again."
                : "This content is not approved yet — approve it first.",
          };
        }

        // Per-platform connection pre-flight: scheduleItem stamps the job's
        // provider per variant from the active connection, so the worker
        // routes to the right adapter (Buffer vs Meta). We fail fast with a
        // structured message when NO variant has a routable platform — the
        // agent should not create a job the worker will permanently fail.
        const itemVariants = await db
          .select({ platform: contentVariants.platform })
          .from(contentVariants)
          .where(and(eq(contentVariants.contentItemId, item.id), eq(contentVariants.workspaceId, ctx.workspaceId)));
        const platforms = [...new Set(itemVariants.map((v) => v.platform))];
        if (platforms.length > 0) {
          const conns = await db
            .select({ platform: platformConnections.platform })
            .from(platformConnections)
            .where(and(
              eq(platformConnections.workspaceId, ctx.workspaceId),
              inArray(platformConnections.platform, platforms),
              eq(platformConnections.status, "connected"),
            ));
          const connectedPlatforms = new Set(conns.map((c) => c.platform));
          const workspaceProvider = await getWorkspacePublishProvider(ctx.workspaceId);
          const unrouted = platforms.filter((p) => !connectedPlatforms.has(p));
          if (unrouted.length > 0 && !workspaceProvider) {
            const missing = unrouted.length === 1
              ? unrouted[0]
              : `${unrouted.slice(0, -1).join(", ")} and ${unrouted[unrouted.length - 1]}`;
            await logStep("schedule_content", input, { ok: false, unroutedPlatforms: unrouted });
            return {
              scheduled: false,
              message: `No active social connection for ${missing}. Connect one on the Connections page.`,
            };
          }
        }

        const result = await scheduleItem({
          workspaceId: ctx.workspaceId,
          itemId: item.id,
          dateIso,
          timeStr: input.time,
          timezone: tz,
        });
        await logStep("schedule_content", input, { ok: result.ok, scheduledAt: result.ok ? result.scheduledAt.toISOString() : undefined });
        if (!result.ok) return { scheduled: false, message: result.message };

        await refreshContent();
        // Structured truth for the agent: provider, channel, job id and the
        // queued slot per scheduled variant — so the agent can state WHERE
        // and WHEN each post will go without guessing. `channel` is null for
        // Meta (its routing is page-based, not a Buffer channel id).
        const wallClock = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(result.scheduledAt);
        const destinations = result.jobs
          .map((j) => `${j.platform} via ${j.provider}${j.channelRef ? ` (channel ${j.channelRef})` : ""}`)
          .join(", ");
        return {
          scheduled: true,
          updated: true,
          itemId: input.contentItemId,
          provider: result.jobs[0]?.provider,
          platform: result.jobs[0]?.platform,
          channel: result.jobs[0]?.channelRef ?? null,
          jobId: result.jobs[0]?.jobId,
          jobs: result.jobs,
          failedVariants: result.failedVariants,
          scheduledAt: result.scheduledAt.toISOString(),
          status: "queued" as const,
          variants: result.variants,
          message: `Scheduled "${item.topic}" for ${dateIso} ${wallClock} (${tz}) — ${destinations}. Publish job${result.jobs.length === 1 ? "" : "s"} status: queued.`,
        };
      } catch (error) {
        const message = formatAgentToolError(error);
        await logStep("schedule_content", input, { scheduled: false, error: message });
        return { scheduled: false, message };
      }
    },
  });

  const bulkPlan = tool({
    description:
      "Create a bulk content plan: generate multiple posts (6-30) spread over upcoming weekdays via the background pipeline. Each post is brand-context aware, QA-verified, and lands in Content Studio as Ready for Review. Use when the user asks for many posts at once (e.g. 'create 12 posts', 'content for next month').",
    inputSchema: z.object({
      count: z.number().int().min(4).max(30).default(12).describe("How many posts to generate"),
      niche: z.string().max(300).optional().describe("Optional focus for the plan"),
    }),
    execute: async (input) => {
      try {
        const result = await startBulkPlanCore({
          workspaceId: ctx.workspaceId,
          userId: ctx.userId,
          count: input.count,
          niche: input.niche,
        });
        await logStep("bulk_plan", input, { ok: result.ok, jobId: result.ok ? result.jobId : undefined });
        if (!result.ok) return { queued: false, message: result.error };
        return {
          queued: true,
          jobId: result.jobId,
          message: "Bulk plan queued. Posts generate in the background and appear in Content Studio as Ready for Review.",
        };
      } catch (error) {
        const message = formatAgentToolError(error);
        await logStep("bulk_plan", input, { queued: false, error: message });
        return { queued: false, message };
      }
    },
  });

  const searchContentLibrary = tool({
    description: "Search the workspace's content library (topics and captions) for existing posts. Use before generating new content to avoid repetition.",
    inputSchema: z.object({ query: z.string().min(2).max(200) }),
    execute: async (input) => {
      try {
        const { results: rows } = await findPosts(ctx, { query: input.query, mine: false, limit: 10 });
        await logStep("search_content_library", input, { count: rows.length });
        return { results: rows.map((r) => ({ id: r.id, topic: r.topic, status: r.status })) };
      } catch (error) {
        const message = formatAgentToolError(error);
        await logStep("search_content_library", input, { results: [], error: message });
        return { results: [], error: message };
      }
    },
  });

  const getAnalytics = tool({
    description: "Get the workspace's measured analytics summary (from synced platform data). Returns totals; zero data when nothing is synced yet.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const rows = await db.select().from(postMetrics).where(eq(postMetrics.workspaceId, ctx.workspaceId)).limit(100);
        const totals = sumTotals(
          rows.map((r) => ({
            platform: r.platform,
            contentItemId: r.contentItemId,
            metrics: (r.metrics ?? {}) as Record<string, number>,
            postedAt: r.postedAt,
          })),
        );
        await logStep("get_analytics", {}, { totals });
        return { totals };
      } catch (error) {
        const message = formatAgentToolError(error);
        await logStep("get_analytics", {}, { totals: null, error: message });
        return { totals: null, error: message };
      }
    },
  });

  const generateVisualTool = tool({
    description: "Generate a template brand visual for a content item (uses brand colors, logo and the post's copy). Free and instant.",
    inputSchema: z.object({ itemId: z.string().uuid() }),
    execute: async (input) => {
      try {
        const result = await generateVisual({
          workspaceId: ctx.workspaceId,
          userId: ctx.userId,
          contentItemId: input.itemId,
          mode: "template",
        });
        await logStep("generate_visual", input, { ok: result.ok });
        if (!result.ok) return { generated: false, message: result.message };
        return { generated: true, message: "Visual generated and attached to the content item." };
      } catch (error) {
        const message = formatAgentToolError(error);
        await logStep("generate_visual", input, { generated: false, error: message });
        return { generated: false, message };
      }
    },
  });

  const approveContentTool = tool({
    description: "Approve a content item that is waiting for review. Approved items can then be scheduled.",
    inputSchema: z.object({ itemId: z.string().uuid() }),
    execute: async (input) => {
      try {
        const item = await getItem(ctx.workspaceId, input.itemId);
        if (!item) return { ok: false, message: "Content item not found." };
        if (!["ready_for_review", "rejected"].includes(item.status)) {
          return { ok: false, message: "Only content waiting for review can be approved." };
        }
        await approveItem(ctx.workspaceId, input.itemId);
        await logStep("approve_content", input, { ok: true });
        return { ok: true, message: "Approved. You can schedule it from the Calendar." };
      } catch (error) {
        const message = formatAgentToolError(error);
        await logStep("approve_content", input, { ok: false, error: message });
        return { ok: false, message };
      }
    },
  });

  const rejectContentTool = tool({
    description: "Reject a content item waiting for review, optionally with a reason. Rejected items can be regenerated.",
    inputSchema: z.object({ itemId: z.string().uuid(), reason: z.string().max(300).optional() }),
    execute: async (input) => {
      try {
        const item = await getItem(ctx.workspaceId, input.itemId);
        if (!item) return { ok: false, message: "Content item not found." };
        if (item.status === "published" || item.status === "scheduled") {
          return { ok: false, message: "Published or scheduled content cannot be rejected." };
        }
        await rejectItem(ctx.workspaceId, input.itemId, input.reason ?? null);
        await logStep("reject_content", input, { ok: true });
        return { ok: true, message: input.reason ? "Rejected with reason: " + input.reason : "Rejected." };
      } catch (error) {
        const message = formatAgentToolError(error);
        await logStep("reject_content", input, { ok: false, error: message });
        return { ok: false, message };
      }
    },
  });

  const tools: Record<string, Tool> = {
    retrieve_agent_memory: tool({
      description: "Retrieve relevant personal/workspace memories and profile for this task. Stable keys support updating/forgetting.",
      inputSchema: z.object({ task: z.string().min(1).max(1000) }),
      execute: async ({ task }) => { const { personal, workspace, profile } = await retrieveAgentMemory(ctx, task); return { personal, workspace, profile }; },
    }),
    forget_agent_memory: tool({
      description: "Forget an explicitly user-requested memory by exact key. Default private user scope; workspace scope requires permission. Removes superseded versions too.",
      inputSchema: z.object({ scope: z.enum(["user", "workspace"]).default("user"), key: z.string().min(2).max(80) }),
      execute: async ({ scope, key }) => forgetAgentMemory(ctx, scope, key),
    }),
    find_posts: tool({
      description: "Find existing workspace posts across chats/sessions. Use for my last/recent post or topic search when no real ID is known. Defaults to this user's posts, newest-created first. mine=false searches shared workspace posts. Never create a new post to edit an existing one; clarify genuinely ambiguous multiple matches.",
      inputSchema: z.object({ query: z.string().max(200).optional(), mine: z.boolean().default(true), agentCreatedOnly: z.boolean().optional(), limit: z.number().int().min(1).max(10).default(5), order: z.enum(["created", "updated"]).default("created") }),
      execute: async input => findPosts(ctx, input),
    }),
    get_content: tool({
      description: "Read existing post, real variant IDs and current updatedAt before editing. sections allows ONLY copy (caption/hashtags/comment/CTA), visual (master Visual Prompt), slides, script, media, delivery. Never use caption or hashtags as section names. Omit sections for full details; select one variant/one-based slideNumber for smaller reads. Returns ordered media IDs without credentials or bearer URLs; default reads full details.",
      inputSchema: z.object({ itemId: z.string().uuid(), variantId: z.string().uuid().optional(), sections: z.array(z.enum(["copy", "visual", "slides", "script", "media", "delivery"])).min(1).max(6).optional(), slideNumber: z.number().int().min(1).max(20).optional() }),
      execute: async ({ itemId, ...options }) => readContent(ctx, itemId, options),
    }),
    edit_content: tool({
      description: "Update an EXISTING post, preserving its ID/media/relationships; NEVER duplicates. First read get_content and supply expectedUpdatedAt. Patch only requested fields and variant IDs. hashtags=[] clears tags, firstComment='' clears comment. visualConcept is the shared Visual Prompt; slideEdits use one-based slideNumber and preserve index/other slides/media. Use edit_reel_script for script edits; it never changes video. Existing platform can be changed; use edit_post_platforms to add/remove variants without erasing delivery history. Changes revoke approval and require review. Scheduled/processing posts cannot be edited: use unschedule_content only when the user authorizes cancelling the schedule. For published posts internalOnly=true creates Qurtiz display-only corrections; no social-platform edits or provider retry changes. No arbitrary media URLs/IDs accepted.",
      inputSchema: agentEditContentSchema,
      execute: async input => { const result = await editContent(ctx, input); await logStep("edit_content", input, result); await refreshContent(); return result; },
    }),
    edit_reel_script: tool({
      description: "Patch a Reel script on an existing post after reading get_content sections=[script]. Keeps video, caption and omitted script keys. Provided scenes replace only the scenes array. Same review, scheduling, published-correction and concurrency rules as edit_content.",
      inputSchema: z.object({ itemId: z.string().uuid(), expectedUpdatedAt: z.string().datetime(), variantId: z.string().uuid(), internalOnly: z.boolean().default(false), script: z.object({ hook: z.string().max(3000).optional(), outro: z.string().max(3000).optional(), totalDuration: z.number().positive().max(600).optional(), scenes: z.array(z.object({ text: z.string().max(3000).optional(), voiceover: z.string().max(3000).optional(), visualDirection: z.string().max(3000).optional(), onScreenText: z.string().max(1000).optional(), transition: z.string().max(500).optional(), durationSeconds: z.number().positive().max(600).optional() }).strict()).max(30).optional() }).strict() }).strict(),
      execute: async ({ variantId, script, ...input }) => { const result = await editContent(ctx, { ...input, variants: [{ variantId, script }] }); await logStep("edit_reel_script", input, result); await refreshContent(); return result; },
    }),
    edit_post_platforms: tool({
      description: "Add/remove platform variants on an unpublished existing post. Read current details first; provide adapted caption for additions. Preserve post ID/media. Cannot remove variants with delivery history, remove all platforms or add duplicates. Revokes approval; no automatic scheduling/publishing.",
      inputSchema: z.object({ itemId: z.string().uuid(), expectedUpdatedAt: z.string().datetime(), addVariants: z.array(z.object({ platform: z.enum(["facebook", "instagram"]), caption: z.string().trim().min(1).max(3000), hashtags: z.array(z.string().min(1).max(100)).max(30).optional(), firstComment: z.string().max(2200).optional(), cta: z.string().max(1000).optional() }).strict()).max(2).optional(), removeVariantIds: z.array(z.string().uuid()).max(4).optional() }).strict(),
      execute: async input => { const result = await editContent(ctx, input); await logStep("edit_post_platforms", input, result); await refreshContent(); return result; },
    }),
    unschedule_content: tool({
      description: "Cancel pending deliveries to allow edits ONLY when user requests/authorizes unscheduling. Preserves published deliveries; rejects active publishing. Content changes still need reapproval before rescheduling.",
      inputSchema: z.object({ itemId: z.string().uuid() }),
      execute: async ({ itemId }) => { const result = await unscheduleContent(ctx, itemId); await logStep("unschedule_content", { itemId }, result); await refreshContent(); return result; },
    }),
    set_content_status: tool({
      description: "Move an existing post to draft/review or archive only on user request. Approval/rejection use their dedicated tools; publishing state cannot be assigned directly.",
      inputSchema: z.object({ itemId: z.string().uuid(), status: z.enum(["draft", "ready_for_review", "archived"]) }),
      execute: async ({ itemId, status }) => { await transitionItem(ctx.workspaceId, itemId, status); await refreshContent(); return { ok: true, updated: true, itemId, status }; },
    }),
    reorder_post_media: tool({
      description: "Reorder ALL existing uploaded images or videos of this post using real orderedIds from get_content. Reuses Studio's exact safe upload order service. Does not upload, replace URLs, move files across posts or remove media. Post must be in review/draft; preserves MIME/asset IDs/storage/other media types.",
      inputSchema: z.object({ itemId: z.string().uuid(), orderedIds: z.array(z.string().uuid()).min(1).max(10), mediaType: z.enum(["image/", "video/"]) }),
      execute: async ({ itemId, orderedIds, mediaType }) => { const result = await reorderVisualUploads(ctx, itemId, orderedIds, mediaType); if (!result.ok) return result; await refreshContent(); return { ok: true, updated: true, itemId, orderedIds }; },
    }),
    get_research: tool({
      description: "Read saved research, including sources and estimated scores. Use existing relevant research before making another paid research request.",
      inputSchema: z.object({ query: z.string().max(200).optional() }),
      execute: async ({ query }) => ({ results: await db.select().from(researchItems)
        .where(and(eq(researchItems.workspaceId, ctx.workspaceId), query ? ilike(researchItems.topic, `%${query}%`) : undefined))
        .orderBy(desc(researchItems.createdAt)).limit(12) }),
    }),
    get_competitors: tool({
      description: "Read tracked competitors and their latest measured snapshots and AI analyses. Missing or old data is explicitly distinguishable from current research.",
      inputSchema: z.object({}),
      execute: async () => {
        const tracked = await db.select().from(competitors).where(eq(competitors.workspaceId, ctx.workspaceId)).limit(20);
        return { competitors: await Promise.all(tracked.map(async competitor => {
          const [snapshot] = await db.select().from(competitorSnapshots)
            .where(and(eq(competitorSnapshots.competitorId, competitor.id), eq(competitorSnapshots.workspaceId, ctx.workspaceId)))
            .orderBy(desc(competitorSnapshots.capturedAt)).limit(1);
          return { ...competitor, snapshot: snapshot ?? null };
        })) };
      },
    }),
    refresh_competitor: tool({
      description: "Fetch a tracked competitor through the official Instagram Business Discovery integration and save a fresh analysis. Use only when fresh data is needed; requires a connected Meta Instagram account.",
      inputSchema: z.object({ competitorId: z.string().uuid() }),
      execute: async ({ competitorId }) => {
        const { refreshCompetitor } = await import("@/lib/competitors/discovery");
        const [brand] = await db.select().from(brands).where(eq(brands.workspaceId, ctx.workspaceId));
        return refreshCompetitor({ workspaceId: ctx.workspaceId, competitorId,
          ourSummary: summarizeBrandBrain(brand ?? null), ourTotalsSummary: "Read get_analytics for measured totals; none supplied to this comparison." });
      },
    }),
    get_bulk_status: tool({
      description: "Read a bulk plan's actual progress, created post IDs and failures. Use its ordered createdItemIds when the user refers to numbered posts.",
      inputSchema: z.object({ jobId: z.string().uuid() }),
      execute: async ({ jobId }) => {
        const [job] = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.workspaceId, ctx.workspaceId), eq(jobs.type, "bulk_plan")));
        return job ? { ok: true, status: job.status, progress: job.progress, total: job.total, result: job.result, error: job.error }
          : { ok: false, error: "Bulk plan not found." };
      },
    }),
    get_brand_brain: getBrandBrain,
    research_niche: researchNiche,
    create_content: createContent,
    schedule_content: scheduleContent,
    web_search: makeWebSearchTool({ logStep, workspaceId: ctx.workspaceId, userId: ctx.userId }),
    search_content_library: searchContentLibrary,
    get_analytics: getAnalytics,
    generate_visual: generateVisualTool,
    approve_content: approveContentTool,
    reject_content: rejectContentTool,
    bulk_plan: bulkPlan,
    list_workspace_facts: listWorkspaceFacts,
    update_brand_memory: updateBrandMemory,
  };

  // Tool-core insurance: every tool result is normalized (plain-JSON safe,
  // size-capped) regardless of what the tool returns or which provider the
  // agent runs on.
  for (const name of Object.keys(tools)) {
    const execute = tools[name].execute;
    if (execute) {
      tools[name].execute = async (input, options) => {
        try {
          ctx.abortSignal?.throwIfAborted();
          options.abortSignal?.throwIfAborted();
          const membership = await getMembership(ctx.userId, ctx.workspaceId);
          const readOnly = ["find_posts", "retrieve_agent_memory", "get_brand_brain", "list_workspace_facts", "search_content_library", "get_analytics", "get_content", "get_research", "get_competitors", "get_bulk_status"].includes(name);
          if (!membership || !can(membership.role, readOnly ? "brand:read" : "brand:write")) throw new Error("Permission to use this tool was revoked.");
          const [run] = await db.select({ status: agentRuns.status }).from(agentRuns)
            .where(and(eq(agentRuns.id, ctx.runId), eq(agentRuns.userId, ctx.userId), eq(agentRuns.workspaceId, ctx.workspaceId)));
          if (!run || run.status !== "running") throw new Error("This agent run is no longer active.");
          if (!readOnly && !rateLimit(`agent-tool:${ctx.workspaceId}:${name}`, name === "bulk_plan" ? 3 : 12, 10 * 60_000).allowed) {
            throw new Error("Tool usage limit reached. Please try again later.");
          }
          return await execute(input, options);
        } catch (error) {
          const output = { ok: false, error: formatAgentToolError(error) };
          await logStep(name, input, output);
          return output;
        }
      };
    }
    tools[name] = withNormalizedOutput(tools[name]);
  }
  return tools;
}

