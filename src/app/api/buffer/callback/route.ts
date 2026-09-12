import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { platformConnections } from "@/db/schema";
import { encryptToken } from "@/lib/crypto/tokens";
import {
  BUFFER_TOKEN_URL,
  buildBufferTokenEnvelope,
  exchangeCode,
  filterSupportedBufferChannels,
  getOrganizations,
  listChannels,
  logBufferOAuthDiagnostic,
  verifyBufferOAuthState,
  type BufferChannel,
} from "@/lib/buffer/client";
import { getMembership, getSessionUser } from "@/lib/workspace";
import { and, eq } from "drizzle-orm";
import { getPublicAppUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

/** Buffer OAuth callback (provider="buffer"). Verifies the signed state marker
 *  (workspace + user + PKCE codeVerifier + expiry), exchanges the code, then
 *  discovers the account via the GraphQL API (account → organizations →
 *  channels per organization) and upserts one platform_connections row per
 *  supported Buffer channel (facebook/instagram), provider="buffer", with
 *  channelRef = Buffer channel id and the access token stored encrypted inside
 *  a JSON envelope (incl. grantedScopes). Mirrors the Meta callback's
 *  conventions: session + membership are re-verified before anything is
 *  persisted, and the browser is redirected to /connections with a status
 *  flag. Exchange/discovery failures redirect with a sanitized `detail` param
 *  so the Connections toast can pinpoint the failing step. */

/** Failure detail for the /connections toast: supplementary and sanitized —
 *  control chars stripped, collapsed, 120 chars max. Buffer API failure
 *  messages never contain tokens (see messageOf in lib/buffer/client), so the
 *  original message is safe to surface. */
function sanitizeDetail(message: string): string {
  return message.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

/** Safe diagnostic on every failure redirect: stage + sanitized failure only —
 *  never the client secret, tokens, or the PKCE code_verifier. */
function logCallbackFailure(
  origin: string,
  stage: string,
  reason: string,
  message: string | null,
  opts: { hasRefreshTokenInEnvelope?: boolean } = {},
): void {
  const detail = message ? sanitizeDetail(message) : "";
  logBufferOAuthDiagnostic(stage, {
    failureReason: reason,
    failureMessage: detail.length > 0 ? detail : null,
    tokenEndpoint: BUFFER_TOKEN_URL,
    redirectUri: `${origin}/api/buffer/callback`,
    hasRefreshTokenInEnvelope: opts.hasRefreshTokenInEnvelope ?? null,
  });
}

function failureRedirect(origin: string, reason: string, message: string, opts: { hasRefreshTokenInEnvelope?: boolean } = {}): NextResponse {
  logCallbackFailure(origin, reason, reason, message, opts);
  const detail = sanitizeDetail(message);
  const base = `${origin}/connections?buffer=error&reason=${reason}`;
  return NextResponse.redirect(detail ? `${base}&detail=${encodeURIComponent(detail)}` : base);
}
export async function GET(request: NextRequest) {
  const origin = getPublicAppUrl(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthState = searchParams.get("state");
  const denied = searchParams.get("error"); // Buffer denial (e.g. access_denied)

  if (!code || !oauthState) {
    logCallbackFailure(origin, "callback", denied ? "denied" : "oauth_invalid", null);
    return NextResponse.redirect(`${origin}/connections?buffer=error&reason=${denied ? "denied" : "oauth_invalid"}`);
  }

  // Stateless signed state: workspaceId + userId + PKCE codeVerifier + expiry
  // (10 min). Rejects tampered/expired markers.
  const scope = verifyBufferOAuthState(oauthState);
  if (!scope) {
    logCallbackFailure(origin, "callback", "oauth_invalid", null);
    return NextResponse.redirect(`${origin}/connections?buffer=error&reason=oauth_invalid`);
  }

  // Re-verify the session and workspace membership before persisting anything
  // (defense in depth — sessions can expire or change mid-flow).
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "You must be signed in to connect Buffer." }, { status: 401 });
  }
  if (sessionUser.id !== scope.userId) {
    return NextResponse.json(
      { error: "Signed-in user does not match the account that started this connection." },
      { status: 401 },
    );
  }
  const membership = await getMembership(sessionUser.id, scope.workspaceId);
  if (!membership) {
    return NextResponse.json(
      { error: "You are not a member of this workspace." },
      { status: 403 },
    );
  }

  try {
    const exchanged = await exchangeCode({
      code,
      redirectUri: `${origin}/api/buffer/callback`,
      codeVerifier: scope.codeVerifier,
    });
    if (!exchanged.ok) {
      return failureRedirect(origin, "token_exchange", exchanged.message);
    }
    const envelope = buildBufferTokenEnvelope(exchanged.data);
    const encrypted = encryptToken(JSON.stringify(envelope));

    // GraphQL discovery: account → organizations → channels per organization.
    // An account can hold several organizations, so supported facebook/
    // instagram channels are merged across all of them (multi-org safe).
    const orgs = await getOrganizations(envelope.accessToken);
    if (!orgs.ok) {
      return failureRedirect(origin, "channels_fetch", orgs.message, {
        hasRefreshTokenInEnvelope: Boolean(envelope.refreshToken),
      });
    }
    if (orgs.data.length === 0) {
      logCallbackFailure(origin, "channels_fetch", "no_organization", null, {
        hasRefreshTokenInEnvelope: Boolean(envelope.refreshToken),
      });
      return NextResponse.redirect(`${origin}/connections?buffer=error&reason=no_organization`);
    }

    const supported: Array<{
      channel: BufferChannel & { service: "facebook" | "instagram" };
      organizationId: string;
    }> = [];
    for (const org of orgs.data) {
      const listed = await listChannels(envelope.accessToken, org.id);
      if (!listed.ok) {
        return failureRedirect(origin, "channels_fetch", listed.message, {
          hasRefreshTokenInEnvelope: Boolean(envelope.refreshToken),
        });
      }
      // Safe diagnostic per organization: id + supported count only — no
      // channel payloads.
      const orgSupported = filterSupportedBufferChannels(listed.data);
      logBufferOAuthDiagnostic("channels_fetch", { organizationId: org.id, supportedChannels: orgSupported.length });
      for (const channel of orgSupported) {
        supported.push({ channel, organizationId: org.id });
      }
    }

    if (supported.length === 0) {
      logCallbackFailure(origin, "channels_fetch", "no_supported_channels", null, {
        hasRefreshTokenInEnvelope: Boolean(envelope.refreshToken),
      });
      return NextResponse.redirect(`${origin}/connections?buffer=error&reason=no_supported_channels`);
    }

    const db = getDb();
    for (const { channel, organizationId } of supported) {
      const platform = channel.service;
      const connMeta = {
        bufferUsername: channel.username,
        organizationId,
        grantedScopes: envelope.grantedScopes ?? null,
      };
      const [existing] = await db
        .select()
        .from(platformConnections)
        .where(
          and(
            eq(platformConnections.workspaceId, scope.workspaceId),
            eq(platformConnections.platform, platform),
            eq(platformConnections.provider, "buffer"),
          ),
        );
      if (existing) {
        await db
          .update(platformConnections)
          .set({
            status: "connected",
            channelRef: channel.id,
            meta: connMeta,
            encryptedToken: encrypted,
            updatedAt: new Date(),
          })
          .where(eq(platformConnections.id, existing.id));
      } else {
        await db.insert(platformConnections).values({
          workspaceId: scope.workspaceId,
          platform,
          provider: "buffer",
          status: "connected",
          channelRef: channel.id,
          meta: connMeta,
          encryptedToken: encrypted,
        });
      }
    }

    return NextResponse.redirect(`${origin}/connections?buffer=connected`);
  } catch {
    // No error detail is surfaced here (the throw could originate anywhere,
    // incl. provider-echoing code paths) — log the safe markers only.
    logCallbackFailure(origin, "callback", "oauth_failed", null);
    return NextResponse.redirect(`${origin}/connections?buffer=error&reason=oauth_failed`);
  }
}
