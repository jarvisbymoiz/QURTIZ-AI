"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { platformConnections, settings } from "@/db/schema";
import { can } from "@/lib/permissions";
import { rateLimit } from "@/lib/security/rate-limit";
import { getSessionUser, resolveActionWorkspace, getMembership } from "@/lib/workspace";
import {
  isPublishProvider,
  updateWorkspacePublishProvider,
  type PublishProvider,
} from "@/lib/publish/provider";
import { decryptToken } from "@/lib/crypto/tokens";
import { verifyMetaHealth, type MetaHealthCheckResult } from "@/lib/meta/oauth";

export type ActionResult = { ok: true } | { ok: false; error: string };

const publishingProviderSchema = z
  .string()
  .min(1)
  .max(16)
  .refine((v) => isPublishProvider(v), "Invalid publishing provider.");

export type ClientDiscoveredInstagramAccount = {
  id: string;
  username: string | null;
  name: string | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  linkedPageId: string;
  linkedPageName: string;
  isEligible: boolean;
  unavailableReason: string | null;
  status: "eligible" | "ineligible_personal" | "not_linked" | "permission_missing";
};

export type ClientDiscoveredFacebookPage = {
  id: string;
  name: string;
  category: string | null;
  tasks: string[];
  canPost: boolean;
  unavailableReason: string | null;
  instagramAccount: ClientDiscoveredInstagramAccount | null;
};

export type ClientMetaDiscovery = {
  authorizedUser: { id: string; name: string };
  grantedScopes: string[];
  expiresAt: string | null;
  createdAt: string;
  pages: ClientDiscoveredFacebookPage[];
  diagnostics: {
    totalFacebookPages: number;
    eligibleFacebookPages: number;
    totalInstagramAccounts: number;
    eligibleInstagramAccounts: number;
    warnings: string[];
  };
};

type StoredSecuredDiscovery = {
  authorizedUser: { id: string; name: string };
  grantedScopes: string[];
  expiresAt: string | null;
  createdAt: string;
  diagnostics: {
    totalFacebookPages: number;
    eligibleFacebookPages: number;
    totalInstagramAccounts: number;
    eligibleInstagramAccounts: number;
    warnings: string[];
  };
  pages: Array<{
    id: string;
    name: string;
    category: string | null;
    tasks: string[];
    canPost: boolean;
    unavailableReason: string | null;
    encryptedPageToken: string;
    instagramAccount: ClientDiscoveredInstagramAccount | null;
  }>;
};

/**
 * Retrieves the pending Meta discovery state for account selection.
 * Strips out encrypted tokens before returning to the browser.
 */
export async function getPendingMetaDiscoveryAction(): Promise<
  { ok: true; discovery: ClientMetaDiscovery | null } | { ok: false; error: string }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const workspaceId = await resolveActionWorkspace(user.id);
  if (!workspaceId) return { ok: false, error: "Create or join a workspace first." };
  const membership = await getMembership(user.id, workspaceId);
  if (!membership || !can(membership.role, "workspace:manage")) return { ok: false, error: "Only workspace administrators can manage connections." };

  const db = getDb();
  const [row] = await db
    .select()
    .from(settings)
    .where(and(eq(settings.workspaceId, workspaceId), eq(settings.key, "meta_discovery")));

  if (!row?.value) {
    return { ok: true, discovery: null };
  }

  const stored = row.value as StoredSecuredDiscovery;
  const clientDiscovery: ClientMetaDiscovery = {
    authorizedUser: stored.authorizedUser,
    grantedScopes: stored.grantedScopes ?? [],
    expiresAt: stored.expiresAt ?? null,
    createdAt: stored.createdAt,
    diagnostics: stored.diagnostics ?? {
      totalFacebookPages: 0,
      eligibleFacebookPages: 0,
      totalInstagramAccounts: 0,
      eligibleInstagramAccounts: 0,
      warnings: [],
    },
    pages: (stored.pages ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      tasks: p.tasks ?? [],
      canPost: p.canPost,
      unavailableReason: p.unavailableReason,
      instagramAccount: p.instagramAccount,
    })),
  };

  return { ok: true, discovery: clientDiscovery };
}

/**
 * Saves the selected Facebook Page and/or Instagram account chosen by the user.
 * Immediately executes live health checks against the Meta Graph API to verify credentials.
 */
export async function saveSelectedMetaAccountsAction(input: {
  pageId: string | null;
  igUserId: string | null;
}): Promise<
  | {
      ok: true;
      facebookHealth?: MetaHealthCheckResult;
      instagramHealth?: MetaHealthCheckResult;
    }
  | { ok: false; error: string }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const workspaceId = await resolveActionWorkspace(user.id);
  if (!workspaceId) return { ok: false, error: "Create or join a workspace first." };
  const membership = await getMembership(user.id, workspaceId);
  if (!membership || !can(membership.role, "workspace:manage")) return { ok: false, error: "Only workspace administrators can manage connections." };

  const rl = rateLimit("meta-save-accounts:" + workspaceId, 15, 60_000);
  if (!rl.allowed) {
    return { ok: false, error: "Too many account save attempts. Please wait a moment." };
  }

  if (!input.pageId && !input.igUserId) {
    return { ok: false, error: "Please select at least one Facebook Page or Instagram account to connect." };
  }

  const db = getDb();
  const [row] = await db
    .select()
    .from(settings)
    .where(and(eq(settings.workspaceId, workspaceId), eq(settings.key, "meta_discovery")));

  if (!row?.value) {
    return { ok: false, error: "Meta authorization expired. Please connect Meta again." };
  }

  const stored = row.value as StoredSecuredDiscovery;
  let facebookHealth: MetaHealthCheckResult | undefined;
  let instagramHealth: MetaHealthCheckResult | undefined;

  // 1. Connect selected Facebook Page
  if (input.pageId) {
    const page = stored.pages.find((p) => p.id === input.pageId);
    if (!page) {
      return { ok: false, error: "The selected Facebook Page was not found in authorized accounts." };
    }
    if (!page.canPost) {
      return { ok: false, error: page.unavailableReason ?? "This Facebook Page has restricted posting permissions." };
    }

    const decryptedPageToken = decryptToken(page.encryptedPageToken);
    if (!decryptedPageToken) {
      return { ok: false, error: "Failed to decrypt page token. Please re-authorize." };
    }

    // Verify health live with Meta Graph API
    facebookHealth = await verifyMetaHealth({
      platform: "facebook",
      pageId: page.id,
      pageToken: decryptedPageToken,
    });

    const fbMeta = {
      pageId: page.id,
      pageName: page.name,
      category: page.category ?? "",
      userName: stored.authorizedUser?.name ?? "",
      userId: stored.authorizedUser?.id ?? "",
      scopes: (stored.grantedScopes ?? []).join(","),
      expiresAt: stored.expiresAt ?? "",
      healthStatus: facebookHealth.status,
      healthCheckedAt: facebookHealth.checkedAt,
      healthMessage: facebookHealth.message,
    };

    const [existingFb] = await db
      .select()
      .from(platformConnections)
      .where(
        and(
          eq(platformConnections.workspaceId, workspaceId),
          eq(platformConnections.platform, "facebook"),
          eq(platformConnections.provider, "meta"),
        ),
      );

    const initialStatus = facebookHealth.ok ? "connected" : "error";

    if (existingFb) {
      await db
        .update(platformConnections)
        .set({
          status: initialStatus,
          channelRef: page.id,
          meta: fbMeta,
          encryptedToken: page.encryptedPageToken,
          updatedAt: new Date(),
        })
        .where(eq(platformConnections.id, existingFb.id));
    } else {
      await db.insert(platformConnections).values({
        workspaceId,
        platform: "facebook",
        provider: "meta",
        channelRef: page.id,
        status: initialStatus,
        meta: fbMeta,
        encryptedToken: page.encryptedPageToken,
      });
    }
  }

  // 2. Connect selected Instagram Professional account
  if (input.igUserId) {
    // Find the page that contains this Instagram account
    const pageWithIg = stored.pages.find((p) => p.instagramAccount?.id === input.igUserId);
    if (!pageWithIg || !pageWithIg.instagramAccount) {
      return { ok: false, error: "The selected Instagram account was not found in authorized accounts." };
    }
    const ig = pageWithIg.instagramAccount;
    if (!ig.isEligible) {
      return { ok: false, error: ig.unavailableReason ?? "The selected Instagram account is not eligible for publishing." };
    }

    const decryptedPageToken = decryptToken(pageWithIg.encryptedPageToken);
    if (!decryptedPageToken) {
      return { ok: false, error: "Failed to decrypt page token. Please re-authorize." };
    }

    // Verify health live with Meta Graph API
    instagramHealth = await verifyMetaHealth({
      platform: "instagram",
      igUserId: ig.id,
      pageToken: decryptedPageToken,
    });

    const igMeta = {
      igUserId: ig.id,
      igUsername: ig.username ?? "",
      igName: ig.name ?? "",
      pageId: pageWithIg.id,
      pageName: pageWithIg.name,
      followersCount: String(ig.followersCount ?? ""),
      userName: stored.authorizedUser?.name ?? "",
      userId: stored.authorizedUser?.id ?? "",
      scopes: (stored.grantedScopes ?? []).join(","),
      expiresAt: stored.expiresAt ?? "",
      healthStatus: instagramHealth.status,
      healthCheckedAt: instagramHealth.checkedAt,
      healthMessage: instagramHealth.message,
    };

    const [existingIg] = await db
      .select()
      .from(platformConnections)
      .where(
        and(
          eq(platformConnections.workspaceId, workspaceId),
          eq(platformConnections.platform, "instagram"),
          eq(platformConnections.provider, "meta"),
        ),
      );

    const initialStatus = instagramHealth.ok ? "connected" : "error";

    if (existingIg) {
      await db
        .update(platformConnections)
        .set({
          status: initialStatus,
          channelRef: ig.id,
          meta: igMeta,
          encryptedToken: pageWithIg.encryptedPageToken,
          updatedAt: new Date(),
        })
        .where(eq(platformConnections.id, existingIg.id));
    } else {
      await db.insert(platformConnections).values({
        workspaceId,
        platform: "instagram",
        provider: "meta",
        channelRef: ig.id,
        status: initialStatus,
        meta: igMeta,
        encryptedToken: pageWithIg.encryptedPageToken,
      });
    }
  }

  revalidatePath("/connections");
  revalidatePath("/");

  return {
    ok: true,
    facebookHealth,
    instagramHealth,
  };
}

/**
 * Runs an on-demand live health check for a connected Meta platform.
 */
export async function checkMetaConnectionHealthAction(
  platform: "facebook" | "instagram",
): Promise<{ ok: true; health: MetaHealthCheckResult } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const workspaceId = await resolveActionWorkspace(user.id);
  if (!workspaceId) return { ok: false, error: "Create or join a workspace first." };
  const membership = await getMembership(user.id, workspaceId);
  if (!membership || !can(membership.role, "workspace:manage")) return { ok: false, error: "Only workspace administrators can manage connections." };

  const db = getDb();
  const [conn] = await db
    .select()
    .from(platformConnections)
    .where(
      and(
        eq(platformConnections.workspaceId, workspaceId),
        eq(platformConnections.platform, platform),
        eq(platformConnections.provider, "meta"),
      ),
    );

  if (!conn || !conn.encryptedToken) {
    return { ok: false, error: "No active Meta connection found to check." };
  }

  const token = decryptToken(conn.encryptedToken);
  if (!token) {
    return { ok: false, error: "Failed to decrypt token. Please reconnect." };
  }

  const meta = (conn.meta ?? {}) as Record<string, string>;
  const health = await verifyMetaHealth({
    platform,
    pageToken: token,
    pageId: meta.pageId ?? conn.channelRef,
    igUserId: meta.igUserId ?? conn.channelRef,
  });

  const nextStatus = health.ok
    ? "connected"
    : health.status === "token_expired"
      ? "expired"
      : "error";

  const updatedMeta = {
    ...meta,
    healthStatus: health.status,
    healthCheckedAt: health.checkedAt,
    healthMessage: health.message,
  };

  await db
    .update(platformConnections)
    .set({
      status: nextStatus,
      meta: updatedMeta,
      updatedAt: new Date(),
    })
    .where(eq(platformConnections.id, conn.id));

  revalidatePath("/connections");
  return { ok: true, health };
}

/**
 * Dismisses pending Meta discovery state in workspace settings.
 */
export async function dismissMetaDiscoveryAction(): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const workspaceId = await resolveActionWorkspace(user.id);
  if (!workspaceId) return { ok: false, error: "Create or join a workspace first." };
  const membership = await getMembership(user.id, workspaceId);
  if (!membership || !can(membership.role, "workspace:manage")) return { ok: false, error: "Only workspace administrators can manage connections." };

  const db = getDb();
  await db
    .delete(settings)
    .where(and(eq(settings.workspaceId, workspaceId), eq(settings.key, "meta_discovery")));

  revalidatePath("/connections");
  return { ok: true };
}


/** Disconnect one platform connection row for a publishing provider
 *  ("meta" | "buffer"). Provider-scoped: a workspace can hold one row per
 *  provider per platform, and the Connections UI shows both. */
export async function disconnectPlatformAction(
  platform: "facebook" | "instagram",
  provider: string = "meta",
): Promise<ActionResult> {
  if (!isPublishProvider(provider)) return { ok: false, error: "Invalid connection provider." };
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const workspaceId = await resolveActionWorkspace(user.id);
  if (!workspaceId) return { ok: false, error: "Create or join a workspace first." };
  const membership = await getMembership(user.id, workspaceId);
  if (!membership || !can(membership.role, "workspace:manage")) return { ok: false, error: "Only workspace administrators can manage connections." };

  const db = getDb();
  await db
    .update(platformConnections)
    .set({ status: "not_connected", encryptedToken: null, meta: {}, channelRef: null, updatedAt: new Date() })
    .where(
      and(
        eq(platformConnections.workspaceId, workspaceId),
        eq(platformConnections.platform, platform),
        eq(platformConnections.provider, provider),
      ),
    );

  revalidatePath("/connections");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Set the workspace-wide publishing provider ("meta" | "buffer"). Persisted to
 * the settings row key "publishing" → { provider }; jobs scheduled afterwards
 * snapshot it (existing queued jobs keep their original provider). Defaults to
 * "meta" when the key is absent.
 */
export async function updatePublishingProviderAction(provider: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const workspaceId = await resolveActionWorkspace(user.id);
  if (!workspaceId) return { ok: false, error: "Create or join a workspace first." };
  const membership = await getMembership(user.id, workspaceId);
  if (!membership || !can(membership.role, "workspace:manage")) return { ok: false, error: "Only workspace administrators can manage connections." };

  const rl = rateLimit("publishing-provider:" + workspaceId, 10, 10 * 60_000);
  if (!rl.allowed) {
    return { ok: false, error: "Publishing provider update limit reached. Try again in a few minutes." };
  }

  const parsed = publishingProviderSchema.safeParse(provider);
  if (!parsed.success) return { ok: false, error: "Invalid publishing provider." };

  await updateWorkspacePublishProvider(workspaceId, parsed.data as PublishProvider);

  revalidatePath("/connections");
  revalidatePath("/");
  return { ok: true };
}
