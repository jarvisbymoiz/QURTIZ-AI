import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workspaceAiConfig } from "@/db/schema";
import { providerRequiresBaseUrl } from "@/lib/ai/provider-catalog";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";
import {
  AIConfigError,
  AI_CONFIGURATION_REQUIRED_MESSAGE,
  getModelId,
  isKnownImageProvider,
  isKnownTextProvider,
  resolveImageTarget,
  resolveTextModel,
  type AiTask,
  type AiTaskOverrides,
  type ImageTarget,
  type ResolvedTextModel,
  type WorkspaceAIConfig,
} from "@/lib/ai/provider";

/**
 * Workspace-scoped AI configuration resolution.
 *
 * Every AI feature resolves its provider/model/API key from THIS module at
 * call time using the workspace id — never from a module-level global and
 * never from a shared env key. Isolation guarantee: worker processes carry
 * the workspace id on every job; the row read below is keyed by it, so one
 * workspace's key can never serve another's request.
 *
 * Reads go through the plain postgres pool (getDb), the same path all
 * workers/actions use — no cookies(), no Supabase anon client, so it is
 * safe in pg-boss workers. RLS on the table protects the row from direct
 * anon-key access; server code connects as the table owner.
 */

/** Parse + decrypt one DB row into a runtime config. Throws on tamper. */
function rowToConfig(row: typeof workspaceAiConfig.$inferSelect): WorkspaceAIConfig {
  const textKey = decryptToken(row.textApiKeyEnc);
  const imageKey = decryptToken(row.imageApiKeyEnc);
  if (!textKey || !imageKey) {
    throw new AIConfigError(
      "CONFIGURATION_REQUIRED",
      "Stored AI API keys could not be decrypted — re-enter your keys in Workspace Settings.",
    );
  }
  return {
    workspaceId: row.workspaceId,
    textProvider: row.textProvider as WorkspaceAIConfig["textProvider"],
    textModel: row.textModel,
    textBaseUrl: row.textBaseUrl,
    textApiKey: textKey,
    imageProvider: row.imageProvider as WorkspaceAIConfig["imageProvider"],
    imageModel: row.imageModel,
    imageBaseUrl: row.imageBaseUrl,
    imageApiKey: imageKey,
    taskOverrides: (row.taskOverrides ?? {}) as AiTaskOverrides,
  };
}

/**
 * DEV-ONLY fallback: when no workspace row exists and GEMINI_API_KEY is
 * set outside production, the existing single-workspace dev flow keeps
 * working. In production this returns null — a workspace without its own
 * config gets an honest AIConfigError, never another tenant's key.
 */
function devFallbackConfig(workspaceId: string): WorkspaceAIConfig | null {
  if (process.env.NODE_ENV === "production") return null;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return {
    workspaceId,
    textProvider: "gemini",
    textModel: getModelId(),
    textBaseUrl: null,
    textApiKey: apiKey,
    imageProvider: "gemini",
    imageModel: "gemini-3.1-flash-image",
    imageBaseUrl: null,
    imageApiKey: apiKey,
    taskOverrides: {},
  };
}

/**
 * Load the decrypted AI config for one workspace. Throws AIConfigError
 * (message "CONFIGURATION_REQUIRED") when the workspace has none — the
 * existing L9 action mapping renders that as an honest human message.
 */
export async function getWorkspaceAIConfig(workspaceId: string): Promise<WorkspaceAIConfig> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(workspaceAiConfig)
    .where(eq(workspaceAiConfig.workspaceId, workspaceId));
  if (!row) {
    const dev = devFallbackConfig(workspaceId);
    if (dev) return dev;
    throw new AIConfigError("CONFIGURATION_REQUIRED", AI_CONFIGURATION_REQUIRED_MESSAGE);
  }
  return rowToConfig(row);
}

/**
 * Resolve the TEXT model (SDK instance + metadata) for a workspace and
 * task. The task override map (workspace_ai_config.task_overrides) lets a
 * workspace pin a cheap model for e.g. chat while using a stronger one for
 * bulk generation.
 */
export async function getWorkspaceTextModel(
  workspaceId: string,
  task?: AiTask,
): Promise<ResolvedTextModel> {
  const config = await getWorkspaceAIConfig(workspaceId);
  return resolveTextModel(config, task);
}

/** Resolve the IMAGE target (REST) for a workspace. */
export async function getWorkspaceImageTarget(workspaceId: string): Promise<ImageTarget> {
  const config = await getWorkspaceAIConfig(workspaceId);
  return resolveImageTarget(config);
}

/**
 * Non-throwing workspace-aware capability check for UI gates. Mirrors the
 * exact resolution path (workspace row first, dev-only env fallback second),
 * so the UI's "configured" state matches what a real AI call would do.
 * Non-AIConfigError failures still propagate — a broken DB must not render
 * as "not configured".
 */
export async function hasWorkspaceAIConfig(workspaceId: string): Promise<boolean> {
  try {
    await getWorkspaceAIConfig(workspaceId);
    return true;
  } catch (error) {
    if (error instanceof AIConfigError) return false;
    throw error;
  }
}

/**
 * Display label for the dashboard: the workspace's configured text model,
 * or the legacy env default when the workspace has no config (Phase 1
 * kept getModelId() for display-only paths).
 */
export async function getWorkspaceAIModelLabel(workspaceId: string): Promise<string> {
  try {
    const config = await getWorkspaceAIConfig(workspaceId);
    return config.textModel;
  } catch (error) {
    if (error instanceof AIConfigError) return getModelId();
    throw error;
  }
}

/**
 * Validate + prepare a user-supplied config for persistence: known
 * providers, non-empty models, encrypted keys. Returns the encrypted row
 * values or throws AIConfigError with a human reason.
 *
 * Blank keys mean "keep the currently stored key": when `existing` carries
 * the encrypted values, they are reused as-is (no re-encryption churn); a
 * blank key with no existing value is an error — a fresh config cannot be
 * created without keys.
 */
export function prepareConfigRow(
  input: {
    workspaceId: string;
    textProvider: string;
    textModel: string;
    textBaseUrl?: string | null;
    textApiKey?: string | null;
    imageProvider: string;
    imageModel: string;
    imageBaseUrl?: string | null;
    imageApiKey?: string | null;
    taskOverrides?: AiTaskOverrides | null;
  },
  existing?: { textApiKeyEnc: string | null; imageApiKeyEnc: string | null } | null,
): typeof workspaceAiConfig.$inferInsert {
  if (!isKnownTextProvider(input.textProvider)) {
    throw new AIConfigError("INVALID_CONFIG", `Unknown text provider "${input.textProvider}".`);
  }
  if (!isKnownImageProvider(input.imageProvider)) {
    throw new AIConfigError("INVALID_CONFIG", `Unknown image provider "${input.imageProvider}".`);
  }
  const textKey = input.textApiKey?.trim() ?? "";
  const imageKey = input.imageApiKey?.trim() ?? "";
  if (!textKey && !existing?.textApiKeyEnc) {
    throw new AIConfigError("INVALID_CONFIG", "A text API key is required.");
  }
  if (!imageKey && !existing?.imageApiKeyEnc) {
    throw new AIConfigError("INVALID_CONFIG", "An image API key is required.");
  }
  if (!input.textModel?.trim() || !input.imageModel?.trim()) {
    throw new AIConfigError("INVALID_CONFIG", "Both text and image models are required.");
  }
  // Base URL rules follow the catalog: presets ship a default (empty stored
  // URL is fine — resolution fills it), `custom` (and any future entry
  // without a default) must carry its own endpoint.
  if (providerRequiresBaseUrl(input.textProvider) && !input.textBaseUrl?.trim()) {
    const name = input.textProvider === "custom" ? "Custom OpenAI-compatible" : input.textProvider;
    throw new AIConfigError(
      "INVALID_CONFIG",
      `${name} requires a Base URL (e.g. https://gateway.example.com/v1) before it can be saved.`,
    );
  }
  if (providerRequiresBaseUrl(input.imageProvider) && !input.imageBaseUrl?.trim()) {
    const name = input.imageProvider === "custom" ? "Custom OpenAI-compatible" : input.imageProvider;
    throw new AIConfigError(
      "INVALID_CONFIG",
      `${name} requires a Base URL (e.g. https://gateway.example.com/v1) before it can be saved.`,
    );
  }
  return {
    workspaceId: input.workspaceId,
    textProvider: input.textProvider,
    textModel: input.textModel.trim(),
    textBaseUrl: input.textBaseUrl?.trim() || null,
    textApiKeyEnc: textKey ? encryptKey(textKey) : (existing?.textApiKeyEnc as string),
    imageProvider: input.imageProvider,
    imageModel: input.imageModel.trim(),
    imageBaseUrl: input.imageBaseUrl?.trim() || null,
    imageApiKeyEnc: imageKey ? encryptKey(imageKey) : (existing?.imageApiKeyEnc as string),
    taskOverrides: input.taskOverrides && Object.keys(input.taskOverrides).length > 0 ? input.taskOverrides : null,
  };
}

function encryptKey(plaintext: string): string {
  const enc = encryptToken(plaintext);
  if (!enc.startsWith("v1.")) {
    throw new AIConfigError("ENCRYPTION_FAILED", "API key encryption failed — check ENCRYPTION_KEY configuration.");
  }
  return enc;
}
