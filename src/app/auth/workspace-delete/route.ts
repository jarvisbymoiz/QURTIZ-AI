import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workspaces } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import {
  signWorkspaceDeleteToken,
  WORKSPACE_DELETE_COOKIE,
  WORKSPACE_DELETE_TOKEN_TTL_SECONDS,
} from "@/lib/workspace-delete";
import { getPublicAppUrl } from "@/lib/app-url";

/**
 * Email-OTP confirmation landing page for workspace deletion.
 *
 * Mirrors src/app/auth/callback/route.ts: Supabase emails the owner a
 * one-time link pointing here (plus a PKCE code). The code is exchanged for
 * a session, then the signed-in user is verified to be the workspace's
 * creator (createdBy) before the short-lived httpOnly marker cookie is set.
 * Non-owners and failed exchanges are redirected to /settings?wsdelete=denied
 * and never receive a marker. Tokens are never logged.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const workspaceId = searchParams.get("workspaceId");
  const publicOrigin = getPublicAppUrl(request);
  const denied = `${publicOrigin}/settings?wsdelete=denied`;

  if (!code || !workspaceId) {
    return NextResponse.redirect(denied);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(denied);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(denied);
  }

  const db = getDb();
  const rows = await db
    .select({ createdBy: workspaces.createdBy })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  const createdBy = rows[0]?.createdBy;
  if (!createdBy || createdBy !== user.id) {
    return NextResponse.redirect(denied);
  }

  const cookieStore = await cookies();
  cookieStore.set(
    WORKSPACE_DELETE_COOKIE,
    signWorkspaceDeleteToken({ workspaceId, userId: user.id }),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: WORKSPACE_DELETE_TOKEN_TTL_SECONDS,
    },
  );

  return NextResponse.redirect(`${publicOrigin}/settings?wsdelete=authorized`);
}
