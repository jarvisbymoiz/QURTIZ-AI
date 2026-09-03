import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { platformConnections } from "@/db/schema";
import { encryptToken } from "@/lib/crypto/tokens";
import {
  buildBufferTokenEnvelope,
  exchangeCode,
  filterSupportedBufferChannels,
  listChannels,
  verifyBufferOAuthState,
} from "@/lib/buffer/client";
import { can } from "@/lib/permissions";
import { getMembership, getSessionUser } from "@/lib/workspace";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Buffer OAuth callback (provider="buffer"). Verifies the signed state marker
 * (workspace + user + expiry), exchanges the code, then upserts one
 * platform_connections row per supported Buffer channel (facebook/instagram),
 * provider="buffer", with channelRef = Buffer profile id and the access token
 * stored encrypted inside a JSON envelope. Mirrors the Meta callback's
 * conventions: session + membership are re-verified before anything is
 * persisted, and the browser is redirected to /connections with a status flag.
 */
export async function GET(request: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthState = searchParams.get("state");
  const denied = searchParams.get("error"); // Buffer denial (e.g. access_denied)

  if (!code || !oauthState) {
    return NextResponse.redirect(`${origin}/connections?buffer=error&reason=${denied ? "denied" : "oauth_invalid"}`);
  }

  // Stateless signed state: workspaceId + userId + expiry (10 min). Rejects
  // tampered/expired markers.
  const scope = verifyBufferOAuthState(oauthState);
  if (!scope) {
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
  if (!can(membership.role, "publish:manage")) {
    return NextResponse.json(
      { error: "Only editors and above can connect accounts." },
      { status: 403 },
    );
  }

  try {
    const exchanged = await exchangeCode({ code, redirectUri: `${origin}/api/buffer/callback` });
    if (!exchanged.ok) {
      return NextResponse.redirect(`${origin}/connections?buffer=error&reason=token_exchange`);
    }
    const envelope = buildBufferTokenEnvelope(exchanged.data);
    const encrypted = encryptToken(JSON.stringify(envelope));

    const listed = await listChannels(envelope.accessToken);
    if (!listed.ok) {
      return NextResponse.redirect(`${origin}/connections?buffer=error&reason=channels_fetch`);
    }

    // Buffer holds other services too (twitter/linkedin/pinterest) — this
    // product only routes facebook/instagram channels into connections.
    const channels = filterSupportedBufferChannels(listed.data);
    if (channels.length === 0) {
      return NextResponse.redirect(`${origin}/connections?buffer=error&reason=no_supported_channels`);
    }

    const db = getDb();
    // Buffer's default profile first (then id for determinism), so a
    // multi-channel account lands on its designated default per service.
    const ordered = [...channels].sort(
      (a, b) => Number(Boolean(b.default)) - Number(Boolean(a.default)) || a.id.localeCompare(b.id),
    );

    for (const channel of ordered) {
      const platform = channel.service as "facebook" | "instagram";
      const connMeta = { bufferUsername: channel.username, avatar: channel.avatar ?? null };
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
    return NextResponse.redirect(`${origin}/connections?buffer=error&reason=oauth_failed`);
  }
}
