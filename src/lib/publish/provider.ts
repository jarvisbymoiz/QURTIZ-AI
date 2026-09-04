import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { platformConnections, settings } from "@/db/schema";

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
 *
 * For PER-PLATFORM jobs (one job per (workspaceId, platform) variant), the
 * correct source of truth is the active `platformConnections` row for that
 * platform — that is what the worker actually consumes. `resolvePublishProviderForPlatform`
 * below is the single source of truth: it returns the provider of the
 * connected row (status='connected') for that (workspace, platform), falling
 * back to the workspace toggle, and finally to "meta". Both scheduleItem and
 * the agent's schedule_content tool call it so that the job's snapshotted
 * `provider` matches the connection the worker will actually pick up.
 */

export type PublishProvider = "meta" | "buffer";

/** Platform key for publishing jobs. Mirrors the Drizzle `platformEnum`
 *  (facebook, instagram) — declared as a literal union to avoid the
 *  `pgEnum.enumValues` typing across drizzle-orm minor versions. */
export type ContentPlatform = "facebook" | "instagram";

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

/**
 * Resolve the publish provider to stamp on a NEW publishing job for
 * (workspaceId, platform), in priority order:
 *   1. The active `platformConnections` row for this (workspace, platform)
 *      with status='connected' — its `provider` is what the worker will
 *      consume (`attemptPublish` filters by provider, so the stamp MUST
 *      match the connection). The most-specific signal wins.
 *   2. The workspace's `publishing` setting (toggle) — keeps the existing
 *      "settings key is the workspace-wide override" contract.
 *   3. "meta" — pre-existing default; preserves the legacy behaviour for
 *      workspaces that haven't yet connected a platform and have no setting.
 *
 * One query each, no joins, indexed by (workspaceId, platform, provider) +
 * (workspaceId, key).
 */
export async function resolvePublishProviderForPlatform(
  workspaceId: string,
  platform: ContentPlatform,
): Promise<PublishProvider> {
  const db = getDb();
  const conns = await db
    .select({ provider: platformConnections.provider })
    .from(platformConnections)
    .where(
      and(
        eq(platformConnections.workspaceId, workspaceId),
        eq(platformConnections.platform, platform),
        eq(platformConnections.status, "connected"),
      ),
    );
  // The first connected row wins. Per the (workspaceId, platform, provider)
  // unique index, multiple rows can only differ by `provider` — they all
  // represent valid connections for this (workspace, platform), and any of
  // them is a correct stamp (the worker filters by this exact provider).
  const conn = conns[0];
  if (conn && isPublishProvider(conn.provider)) return conn.provider;
  return getWorkspacePublishProvider(workspaceId);
}

/** Persist the workspace's publishing provider (used by the connections
 *  server action behind the Connections-page toggle). */
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
