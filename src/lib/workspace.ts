import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workspaceMembers, workspaces } from "@/db/schema";
import type { WorkspaceRole } from "@/lib/permissions";
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
