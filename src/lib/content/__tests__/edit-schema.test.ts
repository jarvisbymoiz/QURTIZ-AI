import { describe, expect, it } from "vitest";
import { agentEditContentSchema, editContentSchema } from "../edit";

const itemId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", variantId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
describe("bounded existing-post patch schema", () => {
  it("requires a real ID, rejects empty writes and forbids arbitrary media/status fields", () => {
    expect(editContentSchema.safeParse({ itemId }).success).toBe(false);
    expect(editContentSchema.safeParse({ itemId, mediaUrl: "https://example.com/image.png" }).success).toBe(false);
    expect(editContentSchema.safeParse({ itemId, status: "published" }).success).toBe(false);
    expect(editContentSchema.safeParse({ itemId: "last", topic: "Offer" }).success).toBe(false);
  });
  it("keeps omitted fields absent and supports explicit clears", () => {
    const parsed = editContentSchema.parse({ itemId, variants: [{ variantId, hashtags: [], firstComment: "" }] });
    expect(parsed.variants?.[0]).toEqual({ variantId, hashtags: [], firstComment: "" });
    expect(parsed).not.toHaveProperty("visualConcept");
  });
  it("normalizes hashtags without introducing duplicates", () => {
    expect(editContentSchema.parse({ itemId, variants: [{ variantId, hashtags: ["#offer", "offer", "#brand"] }] }).variants?.[0].hashtags).toEqual(["offer", "brand"]);
  });
  it("uses one-based slide ordinals with bounded, nonempty patches", () => {
    expect(editContentSchema.safeParse({ itemId, variants: [{ variantId, slideEdits: [{ slideNumber: 0, headline: "New" }] }] }).success).toBe(false);
    expect(editContentSchema.safeParse({ itemId, variants: [{ variantId, slideEdits: [{ slideNumber: 2 }] }] }).success).toBe(false);
    expect(editContentSchema.parse({ itemId, variants: [{ variantId, slideEdits: [{ slideNumber: 2, visualPrompt: "New visual" }] }] }).variants?.[0].slideEdits?.[0].slideNumber).toBe(2);
  });
  it("requires Agent optimistic concurrency and keeps platform additions out of its primary schema", () => {
    expect(agentEditContentSchema.safeParse({ itemId, topic: "Updated" }).success).toBe(false);
    expect(agentEditContentSchema.safeParse({ itemId, expectedUpdatedAt: "2026-09-18T00:00:00.000Z", topic: "Updated" }).success).toBe(true);
    expect(agentEditContentSchema.safeParse({ itemId, expectedUpdatedAt: "2026-09-18T00:00:00.000Z", addVariants: [{ platform: "instagram", caption: "New" }] }).success).toBe(false);
  });
});
