import { NextResponse, type NextRequest } from "next/server";
import {
  BUFFER_AUTHORIZE_URL,
  BUFFER_OAUTH_SCOPES,
  buildAuthorizeUrl,
  bufferConfigured,
  bufferRedirectUri,
  generatePkcePair,
  logBufferOAuthDiagnostic,
  signBufferOAuthState,
} from "@/lib/buffer/client";
import { getSessionUser, resolveActionWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * Start the Buffer OAuth flow (provider="buffer"). Mirrors the Meta connect
 * route: only a signed-in member of the active workspace may start it, and
 * the OAuth `state` is a stateless HMAC-signed marker binding the callback to
 * (workspaceId, userId, PKCE codeVerifier) with a 10-minute expiry — no state
 * cookie needed. The code_challenge derived from that verifier is sent to
 * Buffer's authorize dialog (OAuth2 Authorization Code + PKCE).
 */
export async function GET(request: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  if (!bufferConfigured()) {
    return NextResponse.redirect(`${origin}/connections?buffer=error&reason=not_configured`);
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  const workspaceId = await resolveActionWorkspace(user.id);
  if (!workspaceId) return NextResponse.redirect(`${origin}/connections?buffer=error&reason=no_workspace`);

  const { codeVerifier, codeChallenge } = generatePkcePair();
  const state = signBufferOAuthState({ workspaceId, userId: user.id, codeVerifier });
  const redirectUri = bufferRedirectUri(origin);
  // Safe diagnostic before redirecting to Buffer: lengths + id prefixes only —
  // never the client secret, tokens, or the PKCE code_verifier.
  const clientId = process.env.BUFFER_CLIENT_ID ?? "";
  logBufferOAuthDiagnostic("authorize", {
    clientIdLength: clientId.length,
    clientIdPrefix: clientId.slice(0, 4),
    clientIdSuffix: clientId.slice(-4),
    authorizeEndpoint: BUFFER_AUTHORIZE_URL,
    redirectUri,
    scopes: BUFFER_OAUTH_SCOPES,
    pkce: true,
    stateSigned: true,
  });
  return NextResponse.redirect(buildAuthorizeUrl({ redirectUri, state, codeChallenge }));
}
