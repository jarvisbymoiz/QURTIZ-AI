"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMembership, getSessionUser, getUserWorkspaces, WORKSPACE_COOKIE } from "@/lib/workspace";
import { getAppCookieOptions } from "@/lib/supabase/cookie-options";
import { verifyAccountPassword } from "@/lib/supabase/verify-password";
import { queueWorkspaceDeletion } from "@/lib/workspace-deletion";
import { rateLimit } from "@/lib/security/rate-limit";
const inputSchema = z.object({ workspaceId: z.string().uuid(), password: z.string().min(1, "Enter your account password.").max(1024) }).strict();
export type ActionResult = { ok: true; nextPath: string; cleanupQueued: true } | { ok: false; error: string };
/** Exact selected workspace, current owner and password are required on every deletion request. */
export async function deleteWorkspaceAction(input: { workspaceId: string; password: string }): Promise<ActionResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid deletion request." };
  const user = await getSessionUser();
  if (!user?.email) return { ok: false, error: "You must be signed in." };
  const membership = await getMembership(user.id, parsed.data.workspaceId);
  if (membership?.role !== "owner") return { ok: false, error: "Only the workspace owner can delete it." };
  if (!rateLimit(`workspace-delete:${user.id}`, 5, 15 * 60_000).allowed) return { ok: false, error: "Too many attempts. Try again in a few minutes." };
  try {
    if (!await verifyAccountPassword(user, parsed.data.password)) return { ok: false, error: "Incorrect account password. Please try again." };
  } catch {
    return { ok: false, error: "Account password verification is unavailable. Please try again." };
  }
  try {
    // Fail before mutation if background Storage cleanup cannot authenticate.
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)) {
      return { ok: false, error: "Workspace cleanup is not configured. Contact your deployment administrator." };
    }
    const queued = await queueWorkspaceDeletion({ workspaceId: parsed.data.workspaceId, userId: user.id });
    if (!queued.ok) return queued;
    let nextPath = "/dashboard";
    try {
      const cookieStore = await cookies();
      const remaining = await getUserWorkspaces(user.id);
      nextPath = remaining.length ? "/dashboard" : "/onboarding";
      if (cookieStore.get(WORKSPACE_COOKIE)?.value === parsed.data.workspaceId) {
        if (remaining[0]) cookieStore.set(WORKSPACE_COOKIE, remaining[0].id, { ...getAppCookieOptions(), maxAge: 365 * 24 * 60 * 60 });
        else cookieStore.delete(WORKSPACE_COOKIE);
      }
      cookieStore.delete("qurtiz_ws_delete");
    } catch {
      // Queue commit already succeeded. requireWorkspace heals stale cookies
      // on navigation; never falsely report that deletion was not accepted.
      console.warn("[workspace-delete]", { reason: "post_commit_navigation_refresh_failed" });
    }
    try { revalidatePath("/", "layout"); } catch { console.warn("[workspace-delete]", { reason: "post_commit_revalidation_failed" }); }
    return { ok: true, nextPath, cleanupQueued: true };
  } catch {
    return { ok: false, error: "Could not queue workspace deletion. Please try again." };
  }
}
