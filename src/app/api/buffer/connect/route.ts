import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  buildAuthorizeUrl,
  bufferConfigured,
  bufferRedirectUri,
  signBufferOAuthState,
} from "@/lib/buffer/client";
import { getSessionUser, getMembership } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * Start the Buffer OAuth flow (provider="buffer"). Mirrors the Meta connect
 * route: only a signed-in member of the active workspace may start it, and
 * the OAuth `state` is a stateless HMAC-signed marker binding the callback to
 * (workspaceId, userId) with a 10-minute expiry — no state cookie needed.
 */
export async function GET(request: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  if (!bufferConfigured()) {
    return NextResponse.redirect(`${origin}/connections?buffer=error&reason=not_configured`);
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("qurtiz_workspace")?.value;
  if (!workspaceId) return NextResponse.redirect(`${origin}/connections?buffer=error&reason=no_workspace`);
  const membership = await getMembership(user.id, workspaceId);
  if (!membership) return NextResponse.redirect(`${origin}/connections?buffer=error&reason=forbidden`);

  const state = signBufferOAuthState({ workspaceId, userId: user.id });
  return NextResponse.redirect(
    buildAuthorizeUrl({ redirectUri: bufferRedirectUri(origin), state }),
  );
}
