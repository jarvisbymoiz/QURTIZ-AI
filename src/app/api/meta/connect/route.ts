import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { buildOAuthUrl, metaConfigured } from "@/lib/meta/oauth";
import { getMembership, getSessionUser, resolveActionWorkspace } from "@/lib/workspace";
import { getPublicAppUrl } from "@/lib/app-url";

import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = getPublicAppUrl(request);

  if (!metaConfigured()) {
    return NextResponse.redirect(`${origin}/connections?error=meta_not_configured`);
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  const workspaceId = await resolveActionWorkspace(user.id);
  if (!workspaceId) return NextResponse.redirect(`${origin}/connections?error=no_workspace`);
  const membership = await getMembership(user.id, workspaceId);
  if (!membership || !can(membership.role, "workspace:manage")) {
    return NextResponse.json({ error: "Only workspace administrators can connect accounts." }, { status: 403 });
  }


  // CSRF state: random nonce + workspace binding, stored in a short-lived cookie.
  const state = crypto.randomBytes(16).toString("hex");
  const stateStore = { state, workspaceId, userId: user.id, nonce: crypto.randomBytes(8).toString("hex") };
  const response = NextResponse.redirect(buildOAuthUrl(origin, state));
  response.cookies.set("qurtiz_meta_oauth", Buffer.from(JSON.stringify(stateStore)).toString("base64url"), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
