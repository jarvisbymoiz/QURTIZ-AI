import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { settings } from "@/db/schema";

/**
 * Workspace-wide publishing provider routing.
 *
 * The product holds one toggle: every publishing job created for the
 * workspace is stamped with the provider that was active AT CREATION TIME
 * (jobs snapshot the provider — flipping the toggle later never reroutes
 * already-queued jobs). When the settings key is absent the provider is
 * "meta", so existing behavior is unchanged.
 *
 * The settings shape mirrors the autopilot pattern (settings table,
 * workspaceId + key → jsonb value): key "publishing" → { provider }.
 */

export type PublishProvider = "meta" | "buffer";

export const PUBLISHING_SETTINGS_KEY = "publishing";

const VALID_PROVIDERS: readonly PublishProvider[] = ["meta", "buffer"];

export function isPublishProvider(value: unknown): value is PublishProvider {
  return typeof value === "string" && (VALID_PROVIDERS as readonly string[]).includes(value);
}

/** Pure resolution of a raw settings value → provider. Anything absent,
 *  malformed or unknown falls back to "meta" (existing behavior). */
export function resolvePublishProvider(config: unknown): PublishProvider {
  if (typeof config === "object" && config !== null) {
    const provider = (config as Record<string, unknown>).provider;
    if (isPublishProvider(provider)) return provider;
  }
  return "meta";
}

/** Read the workspace's publishing provider (default "meta"). */
export async function getWorkspacePublishProvider(workspaceId: string): Promise<PublishProvider> {
  const db = getDb();
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.workspaceId, workspaceId), eq(settings.key, PUBLISHING_SETTINGS_KEY)));
  return resolvePublishProvider(row?.value);
}

/** Persist the workspace's publishing provider (used by the connections
 *  server action; the toggle UI arrives in a later batch). */
export async function updateWorkspacePublishProvider(
  workspaceId: string,
  provider: PublishProvider,
): Promise<void> {
  const db = getDb();
  const existing = await db
    .select({ workspaceId: settings.workspaceId })
    .from(settings)
    .where(and(eq(settings.workspaceId, workspaceId), eq(settings.key, PUBLISHING_SETTINGS_KEY)));
  if (existing.length > 0) {
    await db
      .update(settings)
      .set({ value: { provider }, updatedAt: new Date() })
      .where(and(eq(settings.workspaceId, workspaceId), eq(settings.key, PUBLISHING_SETTINGS_KEY)));
  } else {
    await db.insert(settings).values({ workspaceId, key: PUBLISHING_SETTINGS_KEY, value: { provider } });
  }
}
