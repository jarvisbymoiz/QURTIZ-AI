"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { workspaces } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { getActiveContext } from "@/lib/workspace";
import {
  signWorkspaceDeleteToken,
  verifyWorkspaceDeleteToken,
  WORKSPACE_DELETE_COOKIE,
  WORKSPACE_DELETE_TOKEN_TTL_SECONDS,
} from "@/lib/workspace-delete";

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
 * Step 0 of the delete flow: server-side gate before the client sends the
 * owner the Supabase email OTP. No email is sent from here — the client calls
 * supabase.auth.signInWithOtp with the returned (authoritative) address,
 * mirroring the login magic-link flow. Only the workspace owner's address is
 * ever usable, so non-owners get an honest error instead of an email.
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
 * Step 1 of the delete flow: called by the client AFTER the owner's email
 * OTP verified (typed code path), or the token is minted directly by the
 * /auth/workspace-delete callback (email-link path). Signs the short-lived
 * marker into an httpOnly cookie the final delete action requires.
 */
export async function authorizeWorkspaceDeleteAction(): Promise<ActionResult> {
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
 * advance to the type-the-name step without a second email or code.
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
 * row, the owner's OTP-confirmed marker cookie (signed, unexpired, bound to
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
      error: "Email confirmation missing or expired. Restart the deletion flow.",
    };
  }

  const db = getDb();
  await db.delete(workspaces).where(eq(workspaces.id, ctx.workspaceId));

  cookieStore.set(WORKSPACE_DELETE_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  revalidatePath("/", "layout");
  return { ok: true };
}
