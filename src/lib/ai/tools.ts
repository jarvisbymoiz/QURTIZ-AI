import { tool } from "ai";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { agentSteps, brandMemory, brands } from "@/db/schema";

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

  return {
    get_brand_brain: getBrandBrain,
    list_workspace_facts: listWorkspaceFacts,
    update_brand_memory: updateBrandMemory,
  };
}

