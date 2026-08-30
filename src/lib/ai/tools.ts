import { tool } from "ai";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { agentSteps, brandMemory, brands, contentItems } from "@/db/schema";
import { summarizeBrandBrain, type BrandBrainRow } from "@/lib/ai/brand-summary";
export { summarizeBrandBrain };
import { generateAndPersistContent } from "@/lib/ai/content";
import { getModelId } from "@/lib/ai/provider";
import { scheduleItem } from "@/lib/scheduling/engine";
import { startBulkPlanCore } from "@/lib/jobs/bulk";
import { makeWebSearchTool } from "@/lib/ai/search-tool";
import { workspaces } from "@/db/schema";
import { researchTopics } from "@/lib/ai/research";

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
      "Schedule an existing content item for publishing on a specific date (and optional time, default 18:30 workspace time). Use after create_content when the user names a date/time. Publishing requires connected accounts; scheduling itself always works.",
    inputSchema: z.object({
      itemId: z.string().uuid().optional().describe("The content item id (returned by create_content). If omitted, the most recent Ready-for-Review item is used."),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Schedule date, YYYY-MM-DD"),
      time: z.string().regex(/^\d{2}:\d{2}$/).optional().describe("Optional time HH:mm in workspace timezone"),
    }),
    execute: async (input) => {
      const db = getDb();
      let itemId: string | null = input.itemId ?? null;
      if (!itemId) {
          const latest = await db
          .select({ id: contentItems.id, status: contentItems.status, createdAt: contentItems.createdAt })
          .from(contentItems)
          .where(and(eq(contentItems.workspaceId, ctx.workspaceId), eq(contentItems.status, "ready_for_review")))
          .orderBy(desc(contentItems.createdAt))
          .limit(1);
        if (latest.length === 0) {
          await logStep("schedule_content", input, { ok: false });
          return { scheduled: false, message: "No Ready-for-Review content found. Create content first." };
        }
        itemId = latest[0].id ?? null;
      }
      const [ws] = await db.select({ timezone: workspaces.timezone }).from(workspaces).where(eq(workspaces.id, ctx.workspaceId));
      const result = await scheduleItem({
        workspaceId: ctx.workspaceId,
        itemId,
        dateIso: input.date,
        timeStr: input.time,
        timezone: ws?.timezone ?? "Asia/Karachi",
      });
      await logStep("schedule_content", input, { ok: result.ok });
      if (!result.ok) return { scheduled: false, message: result.message };
      return {
        scheduled: true,
        scheduledAt: result.scheduledAt.toISOString(),
        variants: result.variants,
        message: `Scheduled for ${input.date} ${input.time ?? "18:30"} (workspace time) across ${result.variants} platform variants. It will publish automatically if the platform is connected.`,
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

  return {
    get_brand_brain: getBrandBrain,
    research_niche: researchNiche,
    create_content: createContent,
    schedule_content: scheduleContent,
    web_search: makeWebSearchTool({ logStep, modelId: getModelId() }),
    bulk_plan: bulkPlan,
    list_workspace_facts: listWorkspaceFacts,
    update_brand_memory: updateBrandMemory,
  };
}



