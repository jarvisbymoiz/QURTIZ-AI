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
import { cloudflareAccountIdFromBaseUrl, cloudflareBaseUrl, isCloudflareModel } from "@/lib/ai/cloudflare";

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
  textAccountId?: string | null;
  textApiKey?: string | null;
  imageProvider: string;
  imageModel: string;
  imageBaseUrl?: string | null;
  imageAccountId?: string | null;
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
  // Do not persist or trust a caller-supplied Cloudflare URL. The account ID
  // is validated by the schema and the server constructs the only allowed URL.
  const textBaseUrl = d.textProvider === "cloudflare" ? cloudflareBaseUrl(d.textAccountId!, "text") : d.textBaseUrl ?? null;
  const imageBaseUrl = d.imageProvider === "cloudflare" ? cloudflareBaseUrl(d.imageAccountId!, "image") : d.imageBaseUrl ?? null;

  const shapeError = validateAIConfigShape({
    textProvider: d.textProvider,
    textModel: d.textModel,
    textBaseUrl,
    imageProvider: d.imageProvider,
    imageModel: d.imageModel,
    imageBaseUrl,
  });
  if (shapeError) return { ok: false, error: shapeError };
  try {
    for (const [provider, base] of [[d.textProvider, textBaseUrl], [d.imageProvider, imageBaseUrl]]) {
      const endpoint = resolvedBaseUrl(provider!, base);
      if (endpoint) assertAllowedAiEndpoint(endpoint);
    }
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Invalid AI endpoint." }; }

  const db = getDb();
  const [existing] = await db
    .select({ textProvider: workspaceAiConfig.textProvider, imageProvider: workspaceAiConfig.imageProvider,
      textApiKeyEnc: workspaceAiConfig.textApiKeyEnc, imageApiKeyEnc: workspaceAiConfig.imageApiKeyEnc })
    .from(workspaceAiConfig)
    .where(eq(workspaceAiConfig.workspaceId, ctx.workspaceId));

  if (existing && d.textProvider !== existing.textProvider && !d.textApiKey?.trim()) {
    return { ok: false, error: "Enter an API key for the new text provider." };
  }
  if (existing && d.imageProvider !== existing.imageProvider && !d.imageApiKey?.trim()) {
    return { ok: false, error: "Enter an API key for the new image provider." };
  }

  let row: typeof workspaceAiConfig.$inferInsert;
  try {
    row = prepareConfigRow(
      {
        workspaceId: ctx.workspaceId,
        textProvider: d.textProvider,
        textModel: d.textModel,
        textBaseUrl,
        textApiKey: d.textApiKey ?? "",
        imageProvider: d.imageProvider,
        imageModel: d.imageModel,
        imageBaseUrl,
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

/** Check the saved model and credentials without running a billable inference. */
export async function testCloudflareModelAction(side: "text" | "image"): Promise<ActionResult> {
  const ctx = await getActiveContext("workspace:manage");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (side !== "text" && side !== "image") return { ok: false, error: "Invalid model type." };
  if (!rateLimit(`cloudflare-test:${ctx.workspaceId}`, 10, 10 * 60_000).allowed) {
    return { ok: false, error: "Model test limit reached. Try again in a few minutes." };
  }
  const [row] = await getDb().select().from(workspaceAiConfig).where(eq(workspaceAiConfig.workspaceId, ctx.workspaceId));
  if (!row) return { ok: false, error: "Save the AI configuration first." };
  const provider = side === "text" ? row.textProvider : row.imageProvider;
  const model = side === "text" ? row.textModel : row.imageModel;
  const base = side === "text" ? row.textBaseUrl : row.imageBaseUrl;
  const token = decryptToken(side === "text" ? row.textApiKeyEnc : row.imageApiKeyEnc);
  if (provider !== "cloudflare" || !base || !token || !isCloudflareModel(model)) {
    return { ok: false, error: "Save a valid Cloudflare Workers AI model and token first." };
  }
  const accountId = cloudflareAccountIdFromBaseUrl(base, side);
  if (!accountId) return { ok: false, error: "Invalid Cloudflare account endpoint. Re-save AI Settings." };
  const canonicalBase = cloudflareBaseUrl(accountId, "image");
  assertAllowedAiEndpoint(canonicalBase);
  try {
    const response = await fetch(`${canonicalBase}/models/schema?model=${encodeURIComponent(model)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    const raw = (await response.text()).slice(0, 16_384);
    let result: { success?: boolean; result?: unknown; errors?: { message?: string }[] } | null = null;
    try { result = JSON.parse(raw); } catch { /* The status still supplies a useful failure. */ }
    if (!response.ok || result?.success === false) {
      const detail = result?.errors?.[0]?.message?.replaceAll(token, "[redacted]").slice(0, 240);
      return { ok: false, error: `Cloudflare rejected the saved model (HTTP ${response.status}): ${detail || "Check the account, token permissions and model ID."}` };
    }
    if (!result || !result.result) return { ok: false, error: "Cloudflare returned an invalid model-schema response." };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Cloudflare model check failed: ${error instanceof Error ? error.message.replaceAll(token, "[redacted]") : "Network error."}` };
  }
}
