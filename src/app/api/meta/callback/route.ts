import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { encryptToken } from "@/lib/crypto/tokens";
import { discoverMetaAccounts } from "@/lib/meta/oauth";
import { getMembership, getSessionUser } from "@/lib/workspace";
import { and, eq } from "drizzle-orm";
import { getPublicAppUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = getPublicAppUrl(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthState = searchParams.get("state");

  const cookieStore = await cookies();
  const raw = cookieStore.get("qurtiz_meta_oauth")?.value;
  if (!raw || !code || !oauthState) {
    return NextResponse.redirect(`${origin}/connections?error=oauth_invalid`);
  }

  let stored: { state: string; workspaceId: string; userId: string };
  try {
    stored = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return NextResponse.redirect(`${origin}/connections?error=oauth_invalid`);
  }
  if (stored.state !== oauthState) {
    return NextResponse.redirect(`${origin}/connections?error=oauth_state_mismatch`);
  }

  // Re-verify the session and workspace membership before persisting anything.
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "You must be signed in to connect Meta." }, { status: 401 });
  }
  if (sessionUser.id !== stored.userId) {
    return NextResponse.json(
      { error: "Signed-in user does not match the account that started this connection." },
      { status: 401 },
    );
  }
  const membership = await getMembership(sessionUser.id, stored.workspaceId);
  if (!membership) {
    return NextResponse.json(
      { error: "You are not a member of this workspace." },
      { status: 403 },
    );
  }

  try {
    // Perform full authenticated account discovery with long-lived tokens
    const discovery = await discoverMetaAccounts(code, origin);

    // Encrypt page access tokens before storing in settings
    const securedDiscovery = {
      authorizedUser: discovery.authorizedUser,
      grantedScopes: discovery.grantedScopes,
      expiresAt: discovery.expiresAt,
      diagnostics: discovery.diagnostics,
      createdAt: new Date().toISOString(),
      pages: discovery.pages.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        tasks: p.tasks,
        canPost: p.canPost,
        unavailableReason: p.unavailableReason,
        encryptedPageToken: encryptToken(p.pageToken),
        instagramAccount: p.instagramAccount,
      })),
    };

    const db = getDb();
    const [existingSetting] = await db
      .select()
      .from(settings)
      .where(and(eq(settings.workspaceId, stored.workspaceId), eq(settings.key, "meta_discovery")));

    if (existingSetting) {
      await db
        .update(settings)
        .set({ value: securedDiscovery, updatedAt: new Date() })
        .where(and(eq(settings.workspaceId, stored.workspaceId), eq(settings.key, "meta_discovery")));
    } else {
      await db.insert(settings).values({
        workspaceId: stored.workspaceId,
        key: "meta_discovery",
        value: securedDiscovery,
      });
    }

    const response = NextResponse.redirect(`${origin}/connections?meta_discovered=1`);
    response.cookies.delete("qurtiz_meta_oauth");
    return response;
  } catch (error) {
    const message = error instanceof Error ? encodeURIComponent(error.message) : "oauth_failed";
    const response = NextResponse.redirect(`${origin}/connections?error=${message}`);
    response.cookies.delete("qurtiz_meta_oauth");
    return response;
  }
}
