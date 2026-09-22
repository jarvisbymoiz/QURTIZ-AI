"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { brandAssets, contentVariants, visualAssets, workspaces } from "@/db/schema";
import { and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rate-limit";
import {
  getActiveContext,
  getUserWorkspaces,
  WORKSPACE_COOKIE,
} from "@/lib/workspace";
import {
  signWorkspaceDeleteToken,
  verifyWorkspaceDeleteToken,
  WORKSPACE_DELETE_COOKIE,
  WORKSPACE_DELETE_TOKEN_TTL_SECONDS,
} from "@/lib/workspace-delete";

/**
 * Collect every storage path the workspace owns. The DB rows are about to
 * cascade-delete, so we snapshot paths first and then call
 * supabase.storage.remove() AFTER the cascade fires. Anything that survives
 * the cascade (which it shouldn't — every reference is in this list) gets
 * purged as well.
 */
async function collectWorkspaceStoragePaths(workspaceId: string): Promise<string[]> {
  const db = getDb();
  const [visualRows, brandRows] = await Promise.all([
    db
      .select({ path: visualAssets.storagePath })
      .from(visualAssets)
      // Includes variants whose parent contentItem has been deleted too —
      // that path still owns Storage objects the workspace must reclaim.
      .leftJoin(contentVariants, and(eq(visualAssets.contentItemId, contentVariants.contentItemId)))
      .where(eq(visualAssets.workspaceId, workspaceId)),
    db
      .select({ path: brandAssets.storagePath })
      .from(brandAssets)
      .where(eq(brandAssets.workspaceId, workspaceId)),
  ]);
  const paths = new Set<string>();
  for (const r of visualRows) paths.add(r.path);
  for (const r of brandRows) paths.add(r.path);
  return [...paths];
}

export type ActionResult = { ok: true } | { ok: false; error: string };

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
} as const;

const deleteWorkspaceSchema = z.object({
  workspaceName: z.string().trim().min(1, "Type the workspace name to confirm.").max(200),
});

/**
 * Stable outcome message for "the email link has not been opened in this
 * browser yet". The settings card mirrors this exact literal
 * (CONFIRMATION_NOT_DETECTED_ERROR) to tell a still-pending probe — stay
 * silent, keep polling — from a real failure — stop and surface the error.
 * "use server" files cannot export values, hence the mirrored constant.
 */
const CONFIRMATION_NOT_DETECTED_ERROR = "Email confirmation not detected yet.";

/** Full workspace row of the active workspace, or an honest error. */
async function getWorkspaceRow(workspaceId: string) {
  const db = getDb();
  const rows = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  return rows[0] ?? null;
}

/**
 * Step 0 of the email-confirmation branch: server-side gate before the client
 * asks Supabase to email the owner the confirmation. No email is sent from
 * here — the client calls supabase.auth.signInWithOtp with the returned
 * (authoritative) address. Supabase's signInWithOtp reuses the sign-in
 * (magic-link) template, so the email arrives as a standard sign-in link: the
 * LINK is the confirmation, no numeric code is sent. Only the workspace
 * owner's address is ever usable, so non-owners get an honest error instead of
 * an email.
 */
export async function sendWorkspaceDeleteOtpAction(): Promise<ActionResult & { email?: string }> {
  const ctx = await getActiveContext("workspace:manage");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const rl = rateLimit("ws-delete:" + ctx.workspaceId, 5, 15 * 60_000);
  if (!rl.allowed) return { ok: false, error: "Too many attempts. Try again in a few minutes." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const row = await getWorkspaceRow(ctx.workspaceId);
  if (!row) return { ok: false, error: "Workspace not found." };
  if (row.createdBy !== user.id) {
    return { ok: false, error: "Only the workspace owner can delete it." };
  }
  return { ok: true, email: user.email ?? "" };
}

/**
 * Step 1 of the delete flow: called by the client AFTER ownership is proven —
 * the account password verified via supabase.auth.signInWithPassword (primary
 * path), or the emailed sign-in link opened in this browser (secondary path;
 * there the token is minted directly by the /auth/workspace-delete callback).
 * Signs the short-lived marker into an httpOnly cookie the final delete action
 * requires.
 */
export async function authorizeWorkspaceDeleteAction(password: string): Promise<ActionResult> {
  const ctx = await getActiveContext("workspace:manage");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const rl = rateLimit("ws-delete:" + ctx.workspaceId, 5, 15 * 60_000);
  if (!rl.allowed) return { ok: false, error: "Too many attempts. Try again in a few minutes." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const row = await getWorkspaceRow(ctx.workspaceId);
  if (!row) return { ok: false, error: "Workspace not found." };
  if (row.createdBy !== user.id) {
    return { ok: false, error: "Only the workspace owner can delete it." };
  }

  if (typeof password !== "string" || !password || password.length > 1024 || !user.email) {
    return { ok: false, error: "Enter your account password." };
  }
  const verified = await supabase.auth.signInWithPassword({ email: user.email, password });
  if (verified.error || verified.data.user?.id !== user.id) {
    return { ok: false, error: "Password verification failed." };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    WORKSPACE_DELETE_COOKIE,
    signWorkspaceDeleteToken({ workspaceId: ctx.workspaceId, userId: user.id }),
    { ...COOKIE_OPTIONS, maxAge: WORKSPACE_DELETE_TOKEN_TTL_SECONDS },
  );
  return { ok: true };
}

/**
 * Read-only probe for the moment the delete dialog is sitting on step 1.
 * When the owner opens the emailed confirmation link — even in another tab —
 * the /auth/workspace-delete route mints the httpOnly marker cookie in this
 * browser. This action answers "is the marker here and still valid for the
 * active workspace + signed-in user right now?" so the original tab can
 * advance to the type-the-name step without a second email.
 *
 * It never mints or clears anything, so repeated probing is harmless. A valid
 * token is only ever minted for the verified owner of this exact workspace,
 * so the scope + signature check is the whole gate — no extra owner query per
 * poll tick. It uses its own rate-limit bucket ("ws-delete-check:") so the
 * dialog polling can never drain the shared 5/15 min budget used by the
 * send/authorize/delete actions.
 */
export async function workspaceDeleteAuthorizedAction(): Promise<ActionResult> {
  const ctx = await getActiveContext("workspace:manage");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const rl = rateLimit("ws-delete-check:" + ctx.workspaceId, 30, 60_000);
  if (!rl.allowed) return { ok: false, error: "Too many attempts. Try again in a few minutes." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const cookieStore = await cookies();
  const marker = cookieStore.get(WORKSPACE_DELETE_COOKIE)?.value;
  if (
    !marker ||
    !verifyWorkspaceDeleteToken(marker, { workspaceId: ctx.workspaceId, userId: user.id })
  ) {
    return { ok: false, error: CONFIRMATION_NOT_DETECTED_ERROR };
  }
  return { ok: true };
}

/**
 * Step 2 (final): permanently deletes the workspace. Requires every gate:
 * session membership + workspace:manage, typed name matching the workspace
 * row, the owner's confirmed marker cookie — password or email-link
 * confirmation both mint the same token — (signed, unexpired, bound to
 * this workspace + user) and the shared rate limit.
 *
 * All child tables reference workspaces.id with ON DELETE CASCADE and there
 * is no (NOT NULL + ON DELETE SET NULL) mismatch in db/schema.ts, so the
 * single row delete removes memberships, content, visuals, jobs, campaigns,
 * chat, research, analytics, brand data and settings in one statement.
 */
export async function deleteWorkspaceAction(input: { workspaceName: string }): Promise<ActionResult> {
  const ctx = await getActiveContext("workspace:manage");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = deleteWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const rl = rateLimit("ws-delete:" + ctx.workspaceId, 5, 15 * 60_000);
  if (!rl.allowed) return { ok: false, error: "Too many attempts. Try again in a few minutes." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const row = await getWorkspaceRow(ctx.workspaceId);
  if (!row) return { ok: false, error: "Workspace not found." };
  if (row.createdBy !== user.id) {
    return { ok: false, error: "Only the workspace owner can delete it." };
  }
  if (parsed.data.workspaceName !== row.name) {
    return { ok: false, error: "The typed name does not match this workspace." };
  }

  const cookieStore = await cookies();
  const marker = cookieStore.get(WORKSPACE_DELETE_COOKIE)?.value;
  if (
    !marker ||
    !verifyWorkspaceDeleteToken(marker, { workspaceId: ctx.workspaceId, userId: user.id })
  ) {
    return {
      ok: false,
      error: "Confirmation missing or expired. Restart the deletion flow.",
    };
  }

  const db = getDb();
  // Collect every storage path the workspace owns BEFORE the workspace row
  // is deleted — once the FK cascade fires, visual_assets and brand_assets
  // rows (which hold the storage paths) are gone. Supabase Storage is
  // external to Postgres and is NOT cascade-deleted, so we must do it
  // here. The cleanup queue rows are also cascade-deleted with the
  // workspace, which is the correct outcome — there is no point in
  // queueing cleanup for a workspace that no longer exists, but we
  // still want to delete the underlying Storage objects.
  const storagePaths = await collectWorkspaceStoragePaths(ctx.workspaceId);
  await db.delete(workspaces).where(eq(workspaces.id, ctx.workspaceId));

  // Best-effort Storage cleanup. The workspace is gone from Postgres but
  // the user can recreate it later; we don't want stale files waiting for
  // them. A failure here is logged but never blocks the delete — the DB
  // state is the source of truth.
  if (storagePaths.length > 0) {
    try {
      const { createServiceClient } = await import("@/lib/supabase/service");
      const service = createServiceClient();
      if (service) {
        const { error } = await service.storage.from("brand-assets").remove(storagePaths);
        if (error) {
          console.error("[workspace-delete] storage cleanup failed", ctx.workspaceId, error.message);
        }
      }
    } catch (error) {
      console.error("[workspace-delete] storage cleanup error", ctx.workspaceId, error);
    }
  }

  // Stale-cookie healing: when the deleted workspace was this browser's
  // active workspace, the cookie now points at a workspace that no longer
  // exists. Re-point it at the user's first remaining workspace —
  // getUserWorkspaces reflects the post-delete membership list (this
  // workspace's membership row is gone) — using switchWorkspaceAction's
  // cookie options. When nothing remains, clear the cookie so onboarding
  // starts clean.
  if (cookieStore.get(WORKSPACE_COOKIE)?.value === ctx.workspaceId) {
    const remaining = await getUserWorkspaces(user.id);
    if (remaining.length > 0) {
      cookieStore.set(WORKSPACE_COOKIE, remaining[0].id, {
        ...COOKIE_OPTIONS,
        maxAge: 60 * 60 * 24 * 365,
      });
    } else {
      cookieStore.delete(WORKSPACE_COOKIE);
    }
  }

  cookieStore.set(WORKSPACE_DELETE_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  revalidatePath("/", "layout");
  return { ok: true };
}
