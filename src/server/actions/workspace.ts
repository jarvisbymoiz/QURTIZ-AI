"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { brands, platformConnections, workspaceMembers, workspaces } from "@/db/schema";
import { can, type WorkspaceRole } from "@/lib/permissions";
import { uniqueSlug } from "@/lib/slug";
import { createWorkspaceSchema, updateWorkspaceSchema } from "@/lib/validation";
import { getSessionUser, getMembership, resolveActionWorkspace, WORKSPACE_COOKIE } from "@/lib/workspace";
import { getAppCookieOptions } from "@/lib/supabase/cookie-options";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createWorkspaceAction(formData: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const parsed = createWorkspaceSchema.safeParse({
    name: formData.get("name"),
    industry: formData.get("industry") ?? "",
    timezone: formData.get("timezone") ?? "Asia/Karachi",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const db = getDb();

  // Slug uniqueness across all workspaces.
  const existing = await db
    .select({ slug: workspaces.slug })
    .from(workspaces)
    .where(ne(workspaces.id, "00000000-0000-0000-0000-000000000000"));
  const slug = uniqueSlug(
    parsed.data.name,
    existing.map((e) => e.slug),
  );

  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: parsed.data.name,
      slug,
      timezone: parsed.data.timezone,
      createdBy: user.id,
    })
    .returning();

  await db
    .insert(workspaceMembers)
    .values({ workspaceId: workspace.id, userId: user.id, role: "owner" });

  await db.insert(brands).values({ workspaceId: workspace.id });

  await db.insert(platformConnections).values([
    { workspaceId: workspace.id, platform: "facebook", status: "not_connected" },
    { workspaceId: workspace.id, platform: "instagram", status: "not_connected" },
  ]);

  const cookieStore = await cookies();
  const cookieOpts = getAppCookieOptions();
  cookieStore.set(WORKSPACE_COOKIE, workspace.id, {
    ...cookieOpts,
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  redirect("/");
}

export async function switchWorkspaceAction(workspaceId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const membership = await getMembership(user.id, workspaceId);
  if (!membership) return { ok: false, error: "You are not a member of that workspace." };

  const cookieStore = await cookies();
  const cookieOpts = getAppCookieOptions();
  cookieStore.set(WORKSPACE_COOKIE, workspaceId, {
    ...cookieOpts,
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateWorkspaceAction(formData: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const workspaceId = await resolveActionWorkspace(user.id);
  if (!workspaceId) return { ok: false, error: "Create or join a workspace first." };

  const membership = await getMembership(user.id, workspaceId);
  if (!membership || !can(membership.role, "workspace:manage")) {
    return { ok: false, error: "You do not have permission to manage this workspace." };
  }

  const parsed = updateWorkspaceSchema.safeParse({
    name: formData.get("name"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const db = getDb();
  await db
    .update(workspaces)
    .set({ name: parsed.data.name, timezone: parsed.data.timezone, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId));

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Used by onboarding check + dashboard. Exported for server components. */
export async function countMembers(workspaceId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));
  return rows.length;
}

/** Guard helper shared by other actions. */
export async function requireRoleForActiveWorkspace(
  capability: Parameters<typeof can>[1],
): Promise<{ userId: string; workspaceId: string; role: WorkspaceRole } | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "You must be signed in." };

  const workspaceId = await resolveActionWorkspace(user.id);
  if (!workspaceId) return { error: "Create or join a workspace first." };

  // resolveActionWorkspace only returns workspaces the user belongs to, so
  // membership is guaranteed; kept as a defensive guard, not a deny path.
  const membership = await getMembership(user.id, workspaceId);
  if (!membership) return { error: "You are not a member of this workspace." };
  if (!can(membership.role, capability)) {
    return { error: "You do not have permission to perform this action." };
  }

  return { userId: user.id, workspaceId, role: membership.role };
}

