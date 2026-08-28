import { tool } from "ai";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { agentSteps, brandMemory, brands } from "@/db/schema";
import { generateAndPersistContent } from "@/lib/ai/content";
import { researchTopics } from "@/lib/ai/research";

export type BrandBrainRow = typeof brands.$inferSelect;

export type BrandMemoryRow = typeof brandMemory.$inferSelect;

export type AgentToolContext = {
  workspaceId: string;
  userId: string;
  runId: string;
};

/** Human-readable summary of the Brand Brain row for prompts/tools. */
export function summarizeBrandBrain(brand: BrandBrainRow | null): string {
  if (!brand) return "No brand information configured yet.";
  const parts: string[] = [];
  const add = (label: string, v: string | null | undefined) => {
    if (v && v.trim().length > 0) parts.push(`${label}: ${v.trim()}`);
  };
  add("Business", brand.businessName);
  add("Description", brand.description);
  add("Industry", brand.industry);
  add("Products", brand.products);
  add("Services", brand.services);
  add("Pricing", brand.pricing);
  add("Offers", brand.offers);
  add("Locations", brand.locations);
  add("Website", brand.website);
  add("Contact", brand.contact);
  add("Primary CTA", brand.cta);
  add("Target market", brand.targetMarket);
  const a = (brand.audience ?? {}) as Record<string, unknown>;
  add("Audience demographics", String(a.demographics ?? ""));
  add("Audience interests", String(a.interests ?? ""));
  add("Audience problems", String(a.problems ?? ""));
  add("Audience goals", String(a.goals ?? ""));
  add("Audience objections", String(a.objections ?? ""));
  add("Audience preferred language", String(a.preferredLanguage ?? ""));
  if (brand.voicePresets.length > 0) parts.push(`Brand voice: ${brand.voicePresets.join(", ")}`);
  add("Voice instructions", brand.voiceCustom);
  const v = (brand.visualIdentity ?? {}) as Record<string, unknown>;
  add("Visual identity", JSON.stringify(v));
  const r = (brand.contentRules ?? {}) as Record<string, unknown>;
  add("Content rules", JSON.stringify(r));
  return parts.length > 0 ? parts.join("\n") : "Brand Brain is empty — ask the user to fill it in.";
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

  return {
    get_brand_brain: getBrandBrain,
    research_niche: researchNiche,
    create_content: createContent,
    list_workspace_facts: listWorkspaceFacts,
    update_brand_memory: updateBrandMemory,
  };
}



