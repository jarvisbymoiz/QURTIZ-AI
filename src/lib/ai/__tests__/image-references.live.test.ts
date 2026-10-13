import { it, expect, vi } from "vitest";
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { desc, eq } from "drizzle-orm";

dotenv.config({ path: ".env.local", quiet: true });
vi.mock("server-only", () => ({}));

it.skipIf(process.env.RUN_LIVE_REFERENCE_ACCOUNT !== "true")("loads real saved references and generates through the connected ChatGPT account without changing posts", async () => {
  const { getDb } = await import("@/db");
  const { contentItems, workspaceMembers } = await import("@/db/schema");
  const { createServiceClient } = await import("@/lib/supabase/service");
  const { prepareExternalVisual } = await import("@/lib/visuals/generate");
  const { generateLocalCompanionImage } = await import("@/lib/ai/local-companion");
  const { referenceCounts } = await import("@/lib/ai/image-references");
  const db = getDb();
  const [item] = await db.select().from(contentItems).orderBy(desc(contentItems.createdAt)).limit(1);
  const [member] = await db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, item.workspaceId)).limit(1);
  const prepared = await prepareExternalVisual({ workspaceId: item.workspaceId, userId: member.userId,
    contentItemId: item.id, storage: createServiceClient() });
  expect(prepared.references.length).toBeGreaterThan(0);
  const pairing = JSON.parse(readFileSync(join(process.env.LOCALAPPDATA!, "QurtizCompanion", "session.json"), "utf8"));
  const originalFetch = globalThis.fetch;
  let actualReferences = 0;
  vi.stubGlobal("fetch", async (url: string, options: RequestInit) => {
    if (String(url).startsWith("http://127.0.0.1:8788")) {
      actualReferences = JSON.parse(String(options.body)).images?.length ?? 0;
      return originalFetch(url, { ...options, headers: { ...options.headers, Origin: "http://localhost:3000" } });
    }
    return originalFetch(url, options);
  });
  try {
    const image = await generateLocalCompanionImage({ pairingKey: pairing.pairingSecret, prompt: prepared.brief.prompt,
      size: "1024x1024", references: prepared.references });
    expect(actualReferences).toBe(prepared.references.length);
    const output = join(process.cwd(), ".public-qa", "reference-account");
    await mkdir(output, { recursive: true });
    await writeFile(join(output, "generated.png"), Buffer.from(image, "base64"));
    await writeFile(join(output, "result.json"), JSON.stringify({ mode: "chatgpt-account", ...referenceCounts(prepared.references),
      sent: actualReferences, imageBytes: Buffer.from(image, "base64").length }, null, 2));
    console.info("[live-reference-result]", { mode: "chatgpt-account", ...referenceCounts(prepared.references), sent: actualReferences });
  } finally { vi.unstubAllGlobals(); }
}, 300_000);
