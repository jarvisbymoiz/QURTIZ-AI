import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workspaceMembers, workspaces } from "@/db/schema";
import { can, type Capability, type WorkspaceRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const WORKSPACE_COOKIE = "qurtiz_workspace";

export type SessionUser = {
  id: string;
  email: string;
};

export type WorkspaceRecord = typeof workspaces.$inferSelect;

export type WorkspaceContext = {
  user: SessionUser;
  workspace: WorkspaceRecord;
  role: WorkspaceRole;
  allWorkspaces: WorkspaceRecord[];
};

/** Authenticated user or null. Never throws for missing env. */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return { id: user.id, email: user.email ?? "" };
  } catch {
    return null;
  }
}

export async function getUserWorkspaces(userId: string): Promise<WorkspaceRecord[]> {
  const db = getDb();
  const rows = await db
    .select({ workspace: workspaces })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId));
  return rows.map((r) => r.workspace);
}

/**
 * Resolve the full workspace context for the current request.
 * Redirects to /login or /onboarding as appropriate. The active workspace
 * comes from the cookie; falls back to the user's first workspace.
 */
export async function requireWorkspace(): Promise<WorkspaceContext> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const all = await getUserWorkspaces(user.id);
  if (all.length === 0) redirect("/onboarding");

  const cookieStore = await cookies();
  const activeId = cookieStore.get(WORKSPACE_COOKIE)?.value;
  const active = all.find((w) => w.id === activeId) ?? all[0];

  const db = getDb();
  const membershipRows = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, user.id),
        eq(workspaceMembers.workspaceId, active.id),
      ),
    );
  const role: WorkspaceRole = membershipRows[0]?.role ?? "viewer";

  return { user, workspace: active, role, allWorkspaces: all };
}

/**
 * Resolve the workspace id a server action should act on, mirroring
 * requireWorkspace's resolution exactly: the cookie workspace when the user
 * is a member of it, otherwise the user's first workspace; null when the
 * user has no workspaces. Server actions must use this instead of reading
 * the cookie directly — a stale/foreign cookie (left behind by another
 * account in the same browser, or a workspace the user was removed from)
 * must never deny an action on the user's own workspace, or the page
 * (requireWorkspace) and the action would disagree about what is active.
 */
export async function resolveActionWorkspace(userId: string): Promise<string | null> {
  const all = await getUserWorkspaces(userId);
  if (all.length === 0) return null;
  const cookieStore = await cookies();
  const activeId = cookieStore.get(WORKSPACE_COOKIE)?.value;
  return all.find((w) => w.id === activeId)?.id ?? all[0].id;
}

/**
 * Membership for one specific (user, workspace) pair. Server actions must
 * call this before any write to confirm tenancy. Returns null when the user
 * is not a member of the workspace.
 */
export async function getMembership(
  userId: string,
  workspaceId: string,
): Promise<{ role: WorkspaceRole } | null> {
  const db = getDb();
  const rows = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.workspaceId, workspaceId),
      ),
    );
  return rows[0] ? { role: rows[0].role } : null;
}

/**
 * Shared authorization helper for server actions: resolves the session user
 * and the active workspace (from the workspace cookie), checks membership
 * and the required capability, and returns the workspace timezone (with the
 * app-default Asia/Karachi fallback) for date formatting. On any failure an
 * `{ error }` object is returned — callers must check `"error" in ctx`
 * before using `userId`/`workspaceId`.
 */
export type ActiveContext = { error: string } | { userId: string; workspaceId: string; timezone: string };

export async function getActiveContext(capability: Capability): Promise<ActiveContext> {
  const user = await getSessionUser();
  if (!user) return { error: "You must be signed in." };
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get(WORKSPACE_COOKIE)?.value;
  if (!workspaceId) return { error: "No active workspace." };
  const membership = await getMembership(user.id, workspaceId);
  if (!membership) return { error: "You are not a member of this workspace." };
  if (!can(membership.role, capability)) return { error: "You do not have permission for this action." };
  const db = getDb();
  const [ws] = await db.select({ timezone: workspaces.timezone }).from(workspaces).where(eq(workspaces.id, workspaceId));
  return { userId: user.id, workspaceId, timezone: ws?.timezone ?? "Asia/Karachi" };
}
