import { tool } from "ai";
import { z } from "zod";
import { and, desc, eq, ilike } from "drizzle-orm";
import { getDb } from "@/db";
import { agentSteps, brandMemory, brands, contentItems } from "@/db/schema";
import { summarizeBrandBrain } from "@/lib/ai/brand-summary";
export { summarizeBrandBrain };
import { AIContentParseError, generateAndPersistContent } from "@/lib/ai/content";
import { AIConfigError } from "@/lib/ai/provider";
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

export type BrandMemoryRow = typeof brandMemory.$inferSelect;

export type AgentToolContext = {
  workspaceId: string;
  userId: string;
  runId: string;
};

/**
 * Human-readable message for a failed tool execution, safe to hand back to
 * the agent as a tool result. AIConfigError carries its own user-facing
 * detail; anything else is the error message, defensively scrubbed of
 * key-like strings and capped at 300 chars. Rate-limit/timeout failures get
 * an actionable hint instead of a dead end.
 */
function formatAgentToolError(error: unknown): string {
  let message =
    error instanceof AIConfigError
      ? error.detail
      : error instanceof Error
        ? error.message
        : "The operation failed.";
  // Defensive scrub: never surface anything resembling a credential.
  message = message.replace(
    /\b(?:sk|rk|pk|ghp|gho)-[A-Za-z0-9_-]{8,}\b|Bearer\s+\S+|api[_-]?key\s*[=:]\s*\S+/gi,
    "[redacted]",
  );
  if (message.length > 300) message = message.slice(0, 300) + "…";
  if (/\b429\b|rate[\s-]?limit|time[\s-]?out|timed out|abort/i.test(message)) {
    message +=
      " (The configured AI model is rate-limited or stalled — try again or switch to a non-free model in AI Configuration.)";
  }
  return message;
}

/**
 * Terminal message for AIContentParseError: after the primary structured
 * call and both fallbacks nothing parsable came back, so retrying within
 * the same turn would only burn tokens on a model that cannot produce valid
 * JSON. Same defensive scrub as formatAgentToolError.
 */
function formatContentParseError(error: AIContentParseError): string {
  let message =
    "The AI model's response could not be parsed into a valid post even after retries " +
    `(details: ${error.diagnostics.issues.slice(0, 120)}). ` +
    "Report this error to the user and STOP — do not retry automatically or invent a caption.";
  message = message.replace(
    /\b(?:sk|rk|pk|ghp|gho)-[A-Za-z0-9_-]{8,}\b|Bearer\s+\S+|api[_-]?key\s*[=:]\s*\S+/gi,
    "[redacted]",
  );
  if (message.length > 300) message = message.slice(0, 300) + "…";
  return message;
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
        status: "completed",
      });
    } catch {
      // Logging must never break the agent turn.
    }
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
        const rows = await db
          .select()
          .from(brandMemory)
          .where(and(eq(brandMemory.workspaceId, ctx.workspaceId), eq(brandMemory.active, true)))
          .orderBy(desc(brandMemory.createdAt))
          .limit(50);
        const memories = rows.map((r) => ({ type: r.type, content: r.content }));
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
    inputSchema: z.object({
      type: z.enum(["preference", "fact", "rule"]).describe("What kind of memory this is."),
      content: z.string().min(3).max(1000).describe("The memory, written as a single clear sentence."),
    }),
    execute: async (input) => {
      try {
        const [row] = await db
          .insert(brandMemory)
          .values({
            workspaceId: ctx.workspaceId,
            type: input.type,
            content: input.content,
            source: "chat",
            createdBy: ctx.userId,
          })
          .returning();
        await logStep("update_brand_memory", input, { id: row.id });
        return {
          saved: true,
          id: row.id,
          message: `Saved ${input.type}: "${input.content}". You can view or remove it in Brand Brain → Memory.`,
        };
      } catch (error) {
        const message = formatAgentToolError(error);
        await logStep("update_brand_memory", input, { saved: false, error: message });
        return { saved: false, error: message };
      }
    },
  });

  const createContent = tool({
    description:
      "Generate one complete social media post (copy + platform-adapted variants + hashtags + CTA) for this workspace. Use when the user asks to create a post or content about a topic. The post goes to Content Studio as Ready for Review — it is NOT published.",
    inputSchema: z.object({
      topic: z.string().min(4).max(500).describe("What the post is about"),
      platforms: z.array(z.enum(["facebook", "instagram"])).min(1).describe("Target platforms"),
      objective: z.string().max(300).optional().describe("e.g. engagement, leads, sales"),
    }),
    execute: async (input) => {
      // A failed generation must surface as a tool result the agent can
      // explain to the user — never as a throw that breaks the agent stream.
      try {
        const { itemId, qa } = await generateAndPersistContent({
          workspaceId: ctx.workspaceId,
          userId: ctx.userId,
          input: {
            topic: input.topic,
            objective: input.objective ?? null,
            platforms: input.platforms,
            preferredFormat: null,
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

        const result = await scheduleItem({
          workspaceId: ctx.workspaceId,
          itemId: item.id,
          dateIso,
          timeStr: input.time,
          timezone: tz,
        });
        await logStep("schedule_content", input, { ok: result.ok, scheduledAt: result.ok ? result.scheduledAt.toISOString() : undefined });
        if (!result.ok) return { scheduled: false, message: result.message };

        const wallClock = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(result.scheduledAt);
        return {
          scheduled: true,
          scheduledAt: result.scheduledAt.toISOString(),
          variants: result.variants,
          message: `Scheduled "${item.topic}" for ${dateIso} ${wallClock} (${tz}) across ${result.variants} platform variant${result.variants === 1 ? "" : "s"}.`,
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
        const rows = await db
          .select({ id: contentItems.id, topic: contentItems.topic, status: contentItems.status, createdAt: contentItems.createdAt })
          .from(contentItems)
          .where(and(eq(contentItems.workspaceId, ctx.workspaceId), ilike(contentItems.topic, "%" + input.query + "%")))
          .limit(10);
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

  return {
    get_brand_brain: getBrandBrain,
    research_niche: researchNiche,
    create_content: createContent,
    schedule_content: scheduleContent,
    web_search: makeWebSearchTool({ logStep, workspaceId: ctx.workspaceId }),
    search_content_library: searchContentLibrary,
    get_analytics: getAnalytics,
    generate_visual: generateVisualTool,
    approve_content: approveContentTool,
    reject_content: rejectContentTool,
    bulk_plan: bulkPlan,
    list_workspace_facts: listWorkspaceFacts,
    update_brand_memory: updateBrandMemory,
  };
}



