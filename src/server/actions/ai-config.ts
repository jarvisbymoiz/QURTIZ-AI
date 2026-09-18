"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workspaceAiConfig } from "@/db/schema";
import { saveAIConfigInputSchema } from "@/lib/ai/ai-config-schema";
import { prepareConfigRow } from "@/lib/ai/config";
import { AIConfigError, maskApiKey, validateAIConfigShape, type AiTaskOverrides } from "@/lib/ai/provider";
import { decryptToken } from "@/lib/crypto/tokens";
import { rateLimit } from "@/lib/security/rate-limit";
import { getActiveContext } from "@/lib/workspace";
import { assertAllowedAiEndpoint } from "@/lib/security/ai-endpoint";
import { resolvedBaseUrl } from "@/lib/ai/provider-catalog";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Read-only view of a workspace's AI config. API keys are decrypted ONLY to
 * produce a display mask (first 3 + last 4 chars) — the raw key never
 * leaves the server and is never part of the response.
 */
export type AIConfigView = {
  textProvider: string;
  textModel: string;
  textBaseUrl: string | null;
  textApiKeyMasked: string | null;
  imageProvider: string;
  imageModel: string;
  imageBaseUrl: string | null;
  imageApiKeyMasked: string | null;
  taskOverrides: AiTaskOverrides;
  updatedAt: string | null;
};

export async function getWorkspaceAIConfigAction(): Promise<
  ActionResult & { config?: AIConfigView | null }
> {
  const ctx = await getActiveContext("brand:read");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const db = getDb();
  const [row] = await db
    .select()
    .from(workspaceAiConfig)
    .where(eq(workspaceAiConfig.workspaceId, ctx.workspaceId));

  if (!row) return { ok: true, config: null };

  // Decrypt only to mask — never returned raw.
  const textKey = decryptToken(row.textApiKeyEnc);
  const imageKey = decryptToken(row.imageApiKeyEnc);

  return {
    ok: true,
    config: {
      textProvider: row.textProvider,
      textModel: row.textModel,
      textBaseUrl: row.textBaseUrl,
      textApiKeyMasked: textKey ? maskApiKey(textKey) : null,
      imageProvider: row.imageProvider,
      imageModel: row.imageModel,
      imageBaseUrl: row.imageBaseUrl,
      imageApiKeyMasked: imageKey ? maskApiKey(imageKey) : null,
      taskOverrides: (row.taskOverrides ?? {}) as AiTaskOverrides,
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    },
  };
}

/**
 * Create or update the workspace's AI config. Permission: workspace:manage
 * (owner/admin). Keys are AES-256-GCM encrypted at rest via
 * lib/crypto/tokens before the row is written — never stored plaintext.
 * Input shape is validated by saveAIConfigInputSchema (lib/ai/ai-config-schema).
 *
 * Blank keys preserve the currently stored key (the settings UI shows a
 * masked hint instead of a prefilled plaintext value); a blank key with no
 * stored value is an error, because a config cannot exist without keys.
 */
export async function saveWorkspaceAIConfigAction(input: {
  textProvider: string;
  textModel: string;
  textBaseUrl?: string | null;
  textApiKey?: string | null;
  imageProvider: string;
  imageModel: string;
  imageBaseUrl?: string | null;
  imageApiKey?: string | null;
  taskOverrides?: AiTaskOverrides | null;
}): Promise<ActionResult> {
  const ctx = await getActiveContext("workspace:manage");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const rl = rateLimit("aiconfig:" + ctx.workspaceId, 10, 10 * 60_000);
  if (!rl.allowed) return { ok: false, error: "Config update limit reached. Try again in a few minutes." };

  const parsed = saveAIConfigInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const shapeError = validateAIConfigShape({
    textProvider: d.textProvider,
    textModel: d.textModel,
    textBaseUrl: d.textBaseUrl ?? null,
    imageProvider: d.imageProvider,
    imageModel: d.imageModel,
    imageBaseUrl: d.imageBaseUrl ?? null,
  });
  if (shapeError) return { ok: false, error: shapeError };
  try {
    for (const [provider, base] of [[d.textProvider, d.textBaseUrl], [d.imageProvider, d.imageBaseUrl]]) {
      const endpoint = resolvedBaseUrl(provider!, base);
      if (endpoint) assertAllowedAiEndpoint(endpoint);
    }
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Invalid AI endpoint." }; }

  const db = getDb();
  const [existing] = await db
    .select({ textApiKeyEnc: workspaceAiConfig.textApiKeyEnc, imageApiKeyEnc: workspaceAiConfig.imageApiKeyEnc })
    .from(workspaceAiConfig)
    .where(eq(workspaceAiConfig.workspaceId, ctx.workspaceId));

  let row: typeof workspaceAiConfig.$inferInsert;
  try {
    row = prepareConfigRow(
      {
        workspaceId: ctx.workspaceId,
        textProvider: d.textProvider,
        textModel: d.textModel,
        textBaseUrl: d.textBaseUrl ?? null,
        textApiKey: d.textApiKey ?? "",
        imageProvider: d.imageProvider,
        imageModel: d.imageModel,
        imageBaseUrl: d.imageBaseUrl ?? null,
        imageApiKey: d.imageApiKey ?? "",
        taskOverrides: d.taskOverrides ?? null,
      },
      existing ?? null,
    );
  } catch (error) {
    return {
      ok: false,
      error: error instanceof AIConfigError ? error.detail : "Invalid AI configuration.",
    };
  }

  await db
    .insert(workspaceAiConfig)
    .values(row)
    .onConflictDoUpdate({
      target: workspaceAiConfig.workspaceId,
      set: {
        textProvider: row.textProvider,
        textModel: row.textModel,
        textBaseUrl: row.textBaseUrl,
        textApiKeyEnc: row.textApiKeyEnc,
        imageProvider: row.imageProvider,
        imageModel: row.imageModel,
        imageBaseUrl: row.imageBaseUrl,
        imageApiKeyEnc: row.imageApiKeyEnc,
        taskOverrides: row.taskOverrides,
        updatedAt: new Date(),
      },
    });

  return { ok: true };
}

/** Remove the workspace's AI config (keys deleted — "disconnect AI"). */
export async function clearWorkspaceAIConfigAction(): Promise<ActionResult> {
  const ctx = await getActiveContext("workspace:manage");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const db = getDb();
  await db.delete(workspaceAiConfig).where(eq(workspaceAiConfig.workspaceId, ctx.workspaceId));
  return { ok: true };
}
