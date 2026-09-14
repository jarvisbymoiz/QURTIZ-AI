import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { withDbRetry } from "@/db";
import { workspaceMembers, workspaces } from "@/db/schema";
import { can, type Capability, type WorkspaceRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const WORKSPACE_COOKIE = "qurtiz_workspace";

export type SessionUser = {
  id: string;
  email: string;
};

export type WorkspaceRecord = typeof workspaces.$inferSelect;

export type UserWorkspaceMembership = {
  workspace: WorkspaceRecord;
  role: WorkspaceRole;
};

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

/**
 * Fetch all workspaces for a user along with their membership role in a single DB query.
 */
export async function getUserWorkspacesWithRoles(userId: string): Promise<UserWorkspaceMembership[]> {
  return withDbRetry(async (db) => {
    const rows = await db
      .select({
        workspace: workspaces,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, userId));

    return rows.map((r) => ({
      workspace: r.workspace,
      role: (r.role as WorkspaceRole) ?? "viewer",
    }));
  });
}

export async function getUserWorkspaces(userId: string): Promise<WorkspaceRecord[]> {
  const memberships = await getUserWorkspacesWithRoles(userId);
  return memberships.map((m) => m.workspace);
}

/**
 * Resolve the full workspace context for the current request.
 * Redirects to /login or /onboarding as appropriate. The active workspace
 * comes from the cookie; falls back to the user's first workspace.
 * Uses a single joined query for all workspaces + roles.
 */
export async function requireWorkspace(): Promise<WorkspaceContext> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const memberships = await getUserWorkspacesWithRoles(user.id);
  if (memberships.length === 0) redirect("/onboarding");

  const allWorkspaces = memberships.map((m) => m.workspace);
  const cookieStore = await cookies();
  const activeId = cookieStore.get(WORKSPACE_COOKIE)?.value;
  const active = memberships.find((m) => m.workspace.id === activeId) ?? memberships[0];

  return {
    user,
    workspace: active.workspace,
    role: active.role,
    allWorkspaces,
  };
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
  return withDbRetry(async (db) => {
    const rows = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.workspaceId, workspaceId),
        ),
      );
    return rows[0] ? { role: rows[0].role as WorkspaceRole } : null;
  });
}

/**
 * Shared authorization helper for server actions: resolves the session user
 * and the active workspace via resolveActionWorkspace (cookie workspace when
 * the user is a member of it, else the user's first workspace — a stale or
 * foreign cookie can never deny an action on the user's own workspace),
 * checks membership and the required capability, and returns the workspace
 * timezone (with the app-default Asia/Karachi fallback) for date formatting.
 * On any failure an `{ error }` object is returned — callers must check
 * `"error" in ctx` before using `userId`/`workspaceId`.
 *
 * Highly optimized: resolves membership, role, and timezone in a single query.
 */
export type ActiveContext = { error: string } | { userId: string; workspaceId: string; timezone: string };

export async function getActiveContext(capability: Capability): Promise<ActiveContext> {
  const user = await getSessionUser();
  if (!user) return { error: "You must be signed in." };

  const memberships = await getUserWorkspacesWithRoles(user.id);
  if (memberships.length === 0) return { error: "Create or join a workspace first." };

  const cookieStore = await cookies();
  const activeId = cookieStore.get(WORKSPACE_COOKIE)?.value;
  const active = memberships.find((m) => m.workspace.id === activeId) ?? memberships[0];

  if (!can(active.role, capability)) {
    return { error: "You do not have permission for this action." };
  }

  return {
    userId: user.id,
    workspaceId: active.workspace.id,
    timezone: active.workspace.timezone ?? "Asia/Karachi",
  };
}

