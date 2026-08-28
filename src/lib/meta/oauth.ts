import "server-only";

export const GRAPH_VERSION = "v26.0";
export const GRAPH_HOST = "https://graph.facebook.com";

export function metaConfigured(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export function metaRedirectUri(origin: string): string {
  return `${origin}/api/meta/callback`;
}

/**
 * Facebook OAuth dialog URL. One flow grants both Facebook Page and
 * Instagram Professional access (via the page's linked IG account).
 */
export function buildOAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    redirect_uri: metaRedirectUri(origin),
    state,
    scope: [
      "pages_show_list",
      "pages_manage_posts",
      "pages_read_engagement",
      "instagram_basic",
      "instagram_content_publish",
    ].join(","),
    response_type: "code",
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

export type MetaPage = {
  pageId: string;
  pageName: string;
  pageToken: string;
  igUserId: string | null;
  igUsername: string | null;
};

/** Exchange the OAuth code for pages + linked IG accounts. */
export async function exchangeForPages(code: string, origin: string): Promise<MetaPage[]> {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    redirect_uri: metaRedirectUri(origin),
    code,
  });
  const tokenRes = await fetch(`${GRAPH_HOST}/${GRAPH_VERSION}/oauth/access_token?${params.toString()}`, {
    signal: AbortSignal.timeout(30_000),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: { message?: string } };
  if (!tokenJson.access_token) {
    throw new Error(tokenJson.error?.message ?? "Token exchange failed");
  }
  const userToken = tokenJson.access_token;

  const pagesRes = await fetch(
    `${GRAPH_HOST}/${GRAPH_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(userToken)}`,
    { signal: AbortSignal.timeout(30_000) },
  );
  const pagesJson = (await pagesRes.json()) as {
    data?: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } }[];
    error?: { message?: string };
  };
  if (!pagesJson.data) {
    throw new Error(pagesJson.error?.message ?? "Could not list pages");
  }

  return pagesJson.data.map((p) => ({
    pageId: p.id,
    pageName: p.name,
    pageToken: p.access_token, // long-lived page token
    igUserId: p.instagram_business_account?.id ?? null,
    igUsername: p.instagram_business_account?.username ?? null,
  }));
}
