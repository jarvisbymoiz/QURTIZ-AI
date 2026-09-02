import { tool } from "ai";
import { z } from "zod";
import { and, desc, eq, ilike } from "drizzle-orm";
import { getDb } from "@/db";
import { agentSteps, brandMemory, brands, contentItems } from "@/db/schema";
import { summarizeBrandBrain } from "@/lib/ai/brand-summary";
export { summarizeBrandBrain };
import { generateAndPersistContent } from "@/lib/ai/content";
import { scheduleItem, type ScheduleOutcome } from "@/lib/scheduling/engine";
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
      const rows = await db.select().from(brands).where(eq(brands.workspaceId, ctx.workspaceId));
      const summary = summarizeBrandBrain(rows[0] ?? null);
      await logStep("get_brand_brain", {}, { summary });
      return { brandBrain: summary };
    },
  });

  const listWorkspaceFacts = tool({
    description:
      "List the active brand memory entries (preferences, facts, rules) for this workspace.",
    inputSchema: z.object({}),
    execute: async () => {
      const rows = await db
        .select()
        .from(brandMemory)
        .where(and(eq(brandMemory.workspaceId, ctx.workspaceId), eq(brandMemory.active, true)))
        .orderBy(desc(brandMemory.createdAt))
        .limit(50);
      const memories = rows.map((r) => ({ type: r.type, content: r.content }));
      await logStep("list_workspace_facts", {}, { memories });
      return { memories };
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
    },
  });

  const scheduleContent = tool({
    description:
      "Schedule (or reschedule) an APPROVED content item at a specific date and time in the workspace timezone. Use when the user asks to post content at a named date/time. Reschedules the item if it is already scheduled (moves it to the new slot, cancelling the old one). Time defaults to 18:30 workspace time if omitted. Publishing itself still requires a connected platform account.",
    inputSchema: z.object({
      contentItemId: z.string().describe("The content item id (returned by create_content or search_content_library)"),
      date: z.string().describe("Schedule date: YYYY-MM-DD or an ISO date string"),
      time: z.string().regex(/^\d{2}:\d{2}$/).optional().describe("Time HH:MM in the target timezone (default 18:30 workspace time)"),
      timezone: z.string().optional().describe("IANA timezone, e.g. Asia/Karachi. Defaults to the workspace timezone."),
    }),
    execute: async (input) => {
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

      let result: ScheduleOutcome;
      try {
        result = await scheduleItem({
          workspaceId: ctx.workspaceId,
          itemId: item.id,
          dateIso,
          timeStr: input.time,
          timezone: tz,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Scheduling failed";
        return { scheduled: false, message: msg };
      }
      await logStep("schedule_content", input, { ok: result.ok, scheduledAt: result.ok ? result.scheduledAt.toISOString() : undefined });
      if (!result.ok) return { scheduled: false, message: result.message };

      const wallClock = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(result.scheduledAt);
      return {
        scheduled: true,
        scheduledAt: result.scheduledAt.toISOString(),
        variants: result.variants,
        message: `Scheduled "${item.topic}" for ${dateIso} ${wallClock} (${tz}) across ${result.variants} platform variant${result.variants === 1 ? "" : "s"}.`,
      };
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
    },
  });

  const searchContentLibrary = tool({
    description: "Search the workspace's content library (topics and captions) for existing posts. Use before generating new content to avoid repetition.",
    inputSchema: z.object({ query: z.string().min(2).max(200) }),
    execute: async (input) => {
      const rows = await db
        .select({ id: contentItems.id, topic: contentItems.topic, status: contentItems.status, createdAt: contentItems.createdAt })
        .from(contentItems)
        .where(and(eq(contentItems.workspaceId, ctx.workspaceId), ilike(contentItems.topic, "%" + input.query + "%")))
        .limit(10);
      await logStep("search_content_library", input, { count: rows.length });
      return { results: rows.map((r) => ({ id: r.id, topic: r.topic, status: r.status })) };
    },
  });

  const getAnalytics = tool({
    description: "Get the workspace's measured analytics summary (from synced platform data). Returns totals; zero data when nothing is synced yet.",
    inputSchema: z.object({}),
    execute: async () => {
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
    },
  });

  const generateVisualTool = tool({
    description: "Generate a template brand visual for a content item (uses brand colors, logo and the post's copy). Free and instant.",
    inputSchema: z.object({ itemId: z.string().uuid() }),
    execute: async (input) => {
      const result = await generateVisual({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        contentItemId: input.itemId,
        mode: "template",
      });
      await logStep("generate_visual", input, { ok: result.ok });
      if (!result.ok) return { generated: false, message: result.message };
      return { generated: true, message: "Visual generated and attached to the content item." };
    },
  });

  const approveContentTool = tool({
    description: "Approve a content item that is waiting for review. Approved items can then be scheduled.",
    inputSchema: z.object({ itemId: z.string().uuid() }),
    execute: async (input) => {
      const item = await getItem(ctx.workspaceId, input.itemId);
      if (!item) return { ok: false, message: "Content item not found." };
      if (!["ready_for_review", "rejected"].includes(item.status)) {
        return { ok: false, message: "Only content waiting for review can be approved." };
      }
      await approveItem(ctx.workspaceId, input.itemId);
      await logStep("approve_content", input, { ok: true });
      return { ok: true, message: "Approved. You can schedule it from the Calendar." };
    },
  });

  const rejectContentTool = tool({
    description: "Reject a content item waiting for review, optionally with a reason. Rejected items can be regenerated.",
    inputSchema: z.object({ itemId: z.string().uuid(), reason: z.string().max(300).optional() }),
    execute: async (input) => {
      const item = await getItem(ctx.workspaceId, input.itemId);
      if (!item) return { ok: false, message: "Content item not found." };
      if (item.status === "published" || item.status === "scheduled") {
        return { ok: false, message: "Published or scheduled content cannot be rejected." };
      }
      await rejectItem(ctx.workspaceId, input.itemId, input.reason ?? null);
      await logStep("reject_content", input, { ok: true });
      return { ok: true, message: input.reason ? "Rejected with reason: " + input.reason : "Rejected." };
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



