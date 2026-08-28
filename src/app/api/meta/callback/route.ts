import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { platformConnections } from "@/db/schema";
import { encryptToken } from "@/lib/crypto/tokens";
import { exchangeForPages } from "@/lib/meta/oauth";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
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

  try {
    const pages = await exchangeForPages(code, origin);
    if (pages.length === 0) {
      return NextResponse.redirect(`${origin}/connections?error=no_pages`);
    }

    const db = getDb();
    for (const page of pages) {
      // Facebook Page connection
      const [fb] = await db
        .select()
        .from(platformConnections)
        .where(
          and(
            eq(platformConnections.workspaceId, stored.workspaceId),
            eq(platformConnections.platform, "facebook"),
          ),
        );
      const fbMeta = { pageId: page.pageId, pageName: page.pageName };
      if (fb) {
        await db
          .update(platformConnections)
          .set({ status: "connected", meta: fbMeta, encryptedToken: encryptToken(page.pageToken), updatedAt: new Date() })
          .where(eq(platformConnections.id, fb.id));
      } else {
        await db.insert(platformConnections).values({
          workspaceId: stored.workspaceId,
          platform: "facebook",
          status: "connected",
          meta: fbMeta,
          encryptedToken: encryptToken(page.pageToken),
        });
      }

      // Instagram (linked business account on that page)
      if (page.igUserId) {
        const [ig] = await db
          .select()
          .from(platformConnections)
          .where(
            and(
              eq(platformConnections.workspaceId, stored.workspaceId),
              eq(platformConnections.platform, "instagram"),
            ),
          );
        const igMeta = { igUserId: page.igUserId, igUsername: page.igUsername, pageId: page.pageId };
        if (ig) {
          await db
            .update(platformConnections)
            .set({ status: "connected", meta: igMeta, encryptedToken: encryptToken(page.pageToken), updatedAt: new Date() })
            .where(eq(platformConnections.id, ig.id));
        } else {
          await db.insert(platformConnections).values({
            workspaceId: stored.workspaceId,
            platform: "instagram",
            status: "connected",
            meta: igMeta,
            encryptedToken: encryptToken(page.pageToken),
          });
        }
      }
    }

    const response = NextResponse.redirect(`${origin}/connections?connected=1`);
    response.cookies.delete("qurtiz_meta_oauth");
    return response;
  } catch (error) {
    const message = error instanceof Error ? encodeURIComponent(error.message) : "oauth_failed";
    return NextResponse.redirect(`${origin}/connections?error=${message}`);
  }
}
