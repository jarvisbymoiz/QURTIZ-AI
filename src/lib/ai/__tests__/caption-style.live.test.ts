import { expect, it } from "vitest";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { brands, workspaceAiConfig } from "@/db/schema";
import { getWorkspaceTextModel } from "../config";
import { buildContentSystemPrompt, generateContentObjectWithFallbacks } from "../content";
import { summarizeBrandBrain } from "../brand-summary";

it.skipIf(process.env.RUN_LIVE_CAPTION !== "true")("creates a scannable social caption and respects an explicit no-emoji override with the configured provider", async () => {
  config({path:".env.local",override:true,quiet:true});
  const db = getDb();
  const [configured] = await db.select().from(workspaceAiConfig).limit(1);
  expect(configured).toBeTruthy();
  const [brand] = await db.select().from(brands).where(eq(brands.workspaceId,configured.workspaceId));
  const resolved = await getWorkspaceTextModel(configured.workspaceId,"content");
  const system = buildContentSystemPrompt({brandName:brand?.businessName??"Brand",brandSummary:summarizeBrandBrain(brand??null),memoryLines:"(none)"});
  for (const formal of [false,true]) {
    const result = await generateContentObjectWithFallbacks({model:resolved.model,system,
      prompt: `Create one single_image Instagram educational post about planning a weekly social content workflow: choose a topic, draft a caption, review, schedule, then learn from results. Do not invent numbers, offers or external news. ${formal ? "Explicit user override: formal English, concise, no emojis." : "Write in natural Roman Urdu + English for creators, with an energetic hook, short readable sections, relevant emojis and a focused engagement question/CTA."}`,
      abortSignal:AbortSignal.timeout(120000)});
    const caption = result.object.variants[0].caption;
    expect(caption.trim().length).toBeGreaterThan(100);
    expect(caption).not.toMatch(/\*\*|^#{1,6}\s|&#x20;|\\n|\\$/m);
    if (formal) expect(caption).not.toMatch(/\p{Extended_Pictographic}/u);
    else { expect(caption).toMatch(/\p{Extended_Pictographic}/u); expect(caption).toMatch(/\n\s*\n/); }
    console.info("[caption:live]",{provider:resolved.provider,formal,captionChars:caption.length,passed:true});
  }
}, 260000);
