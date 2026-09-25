import { describe, expect, it, vi } from "vitest";
import dotenv from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { desc, eq } from "drizzle-orm";

dotenv.config({ path: ".env.local", quiet: true, override: true });
vi.mock("server-only", () => ({}));

describe("opt-in image quality comparison", () => {
  it.skipIf(!["true", "inspect"].includes(process.env.RUN_LIVE_IMAGE_COMPARISON ?? ""))("inspects or compares the same saved post and configured model before and after", async () => {
    const { getDb } = await import("@/db");
    const { workspaceAiConfig, contentItems, contentVariants, brands } = await import("@/db/schema");
    const { getWorkspaceImageTarget } = await import("@/lib/ai/config");
    const { generateImage } = await import("@/lib/ai/image");
    const { buildVisualGenerationBrief } = await import("@/lib/ai/visual-brief");
    const { formatSpecFor } = await import("@/lib/ai/master-prompt");
    const db = getDb();
    const [configuration] = await db.select({ workspaceId: workspaceAiConfig.workspaceId }).from(workspaceAiConfig).limit(1);
    expect(configuration).toBeDefined();
    const [item] = await db.select().from(contentItems).where(eq(contentItems.workspaceId, configuration.workspaceId))
      .orderBy(desc(contentItems.createdAt)).limit(1);
    expect(item).toBeDefined();
    const [variant] = await db.select().from(contentVariants).where(eq(contentVariants.contentItemId, item.id)).limit(1);
    expect(variant).toBeDefined();
    const [brand] = await db.select().from(brands).where(eq(brands.workspaceId, configuration.workspaceId)).limit(1);
    const target = await getWorkspaceImageTarget(configuration.workspaceId);
    const spec = formatSpecFor(variant.platform, variant.format);
    const identity = (brand?.visualIdentity ?? {}) as Record<string, string | undefined>;
    const styleNote = [identity.imageStyle ? `Style: ${identity.imageStyle}.` : "",
      identity.primaryColor ? `Brand accent color: ${identity.primaryColor}.` : "",
      "Leave clean space in the lower-left corner; a logo is composited there afterwards. Do not draw a logo yourself."]
      .filter(Boolean).join(" ");
    const oldPrompt = `Create a premium, scroll-stopping social media visual for this post — creative-director quality, not a stock template.\nTopic: ${item.topic}\nCreative direction: ${item.visualConcept ?? item.hook ?? item.topic}\nPlatform format: ${spec.ratio} (${spec.dims}) — ${spec.note} Safe areas: ${spec.safe}\n${styleNote}\nPhotorealistic where appropriate to the stated concept.`;
    const brief = buildVisualGenerationBrief({ brand: brand ?? null, platform: variant.platform,
      contentType: variant.format, title: item.topic, objective: item.objective, hook: item.hook,
      mainCopy: item.mainCopy, caption: variant.caption || item.caption, cta: variant.cta || item.cta,
      firstComment: variant.firstComment || item.firstComment, hashtags: variant.hashtags ?? item.hashtags,
      visualConcept: item.visualConcept, slides: (variant.slides ?? []) as { index: number; headline?: string; visualPrompt?: string }[] });
    const common = { provider: target.provider, modelId: target.modelId, apiKey: target.apiKey, baseUrl: target.baseUrl };
    const capability = target.provider === "cloudflare" && target.baseUrl
      ? await (await import("@/lib/ai/cloudflare-capabilities")).getCloudflareInputSchema(target.baseUrl, target.modelId, target.apiKey)
      : null;
    const output = path.join(process.cwd(), "artifacts", "image-quality");
    await mkdir(output, { recursive: true });
    await Promise.all([
      writeFile(path.join(output, "before-prompt.txt"), oldPrompt),
      writeFile(path.join(output, "after-prompt.txt"), brief.prompt),
      writeFile(path.join(output, "request-summary.json"), JSON.stringify({ provider: target.provider, model: target.modelId,
        postFormat: variant.format, platform: variant.platform, beforePromptCharacters: oldPrompt.length,
        afterPromptCharacters: brief.prompt.length, contextSources: brief.sources,
        requestedOptions: { width: brief.width, height: brief.height, aspectRatio: brief.aspectRatio },
        providerSchemaAvailable: Boolean(capability), promptMaxLength: capability?.properties?.prompt?.maxLength ?? null,
        supportedParameters: capability ? Object.keys(capability.properties ?? {}) : null }, null, 2)),
    ]);
    if (process.env.RUN_LIVE_IMAGE_COMPARISON === "inspect") return;
    const before = await generateImage({ ...common, prompt: oldPrompt });
    expect(before.ok, before.ok ? undefined : before.message).toBe(true);
    const after = await generateImage({ ...common, prompt: brief.prompt,
      options: { width: brief.width, height: brief.height, aspectRatio: brief.aspectRatio, negativePrompt: brief.negativePrompt } });
    expect(after.ok, after.ok ? undefined : after.message).toBe(true);
    if (!before.ok || !after.ok) return;
    await Promise.all([
      writeFile(path.join(output, "before.png"), before.png),
      writeFile(path.join(output, "after.png"), after.png),
    ]);
  }, 180_000);
});
