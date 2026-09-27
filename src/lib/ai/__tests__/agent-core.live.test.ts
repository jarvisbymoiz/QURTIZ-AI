import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { contentItems, contentVariants } from "@/db/schema";
import { generateAndPersistContent } from "@/lib/ai/content";

const enabled = process.env.RUN_LIVE_AGENT_CORE === "1";
const workspaceId = process.env.QURTIZ_LIVE_WORKSPACE_ID;
const userId = process.env.QURTIZ_LIVE_USER_ID;

describe.skipIf(!enabled)("real Agent Core content quality", () => {
  it("generates and saves distinct, brand-grounded posts", async () => {
    if (!workspaceId || !userId) throw new Error("Live workspace and user IDs are required.");
    const topics = [
      "How clearer visual hierarchy improves a small business social post",
      "Three signs a business social graphic needs a stronger call to action",
      "A simple before-and-after design lesson: making a local service post easier to read",
      "How to turn a dense service flyer into one clear mobile-first social graphic",
      "A practical design tip for highlighting one service benefit without crowding a social post",
    ];
    for (const topic of topics.slice(Number(process.env.QURTIZ_LIVE_TOPIC_START ?? 0))) {
      const result = await generateAndPersistContent({ workspaceId, userId, input: {
        topic, platforms: ["facebook", "instagram"], preferredFormat: "single_image",
        objective: "Educational value for small business owners; avoid invented prices or discounts",
      } });
      const [item] = await getDb().select().from(contentItems).where(and(eq(contentItems.id, result.itemId), eq(contentItems.workspaceId, workspaceId)));
      const variants = await getDb().select().from(contentVariants)
        .where(and(eq(contentVariants.contentItemId, result.itemId), eq(contentVariants.workspaceId, workspaceId)));
      expect(item).toBeTruthy();
      expect(variants.length).toBeGreaterThanOrEqual(2);
      expect(item.visualConcept?.length ?? 0).toBeGreaterThan(180);
      console.info("[agent-core-live]", JSON.stringify({ itemId: result.itemId, topic,
        hook: item.hook, visualConcept: item.visualConcept, variants: variants.map(v => ({ platform: v.platform, caption: v.caption })) }));
    }
  }, 420_000);
});
