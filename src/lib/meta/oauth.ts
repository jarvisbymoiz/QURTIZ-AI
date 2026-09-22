import "server-only";

import "server-only";

export const GRAPH_VERSION = "v22.0";
export const GRAPH_HOST = "https://graph.facebook.com";

/**
 * Strips the query string from a Graph endpoint so a sanitized diagnostic can
 * never contain an access_token. Only the path is retained.
 */
export function sanitizeMetaEndpoint(endpoint: string): string {
  return endpoint.split("?")[0];
}

/**
 * Sanitized Meta Graph diagnostic: step, endpoint PATH, HTTP status and the API
 * error code/message/fbtrace id. Access tokens are NEVER logged - callers pass a
 * path, and any query string is stripped as a second line of defence.
 */
export function logMetaDiagnostic(
  step: string,
  endpoint: string,
  status: number | null,
  error?: MetaGraphErrorPayload,
  /** Extra NON-SECRET context (platform, token type, ids). Never a token. */
  info?: Record<string, unknown>,
): void {
  const payload: Record<string, unknown> = {
    step,
    endpoint: sanitizeMetaEndpoint(endpoint),
    status,
    ...(info ?? {}),
  };
  if (error) {
    payload.errorCode = error.code ?? null;
    payload.errorSubcode = error.error_subcode ?? null;
    payload.errorMessage = (error.message ?? "").slice(0, 240);
    payload.fbtraceId = error.fbtrace_id ?? null;
  }
  console.warn("[meta-oauth]", JSON.stringify(payload));
}

export const META_REQUIRED_SCOPES = [
  "public_profile",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  // Required to CREATE the first comment (a separate Graph API request):
  // Instagram comments need instagram_manage_comments, and commenting on a
  // Facebook Page post as the Page needs pages_manage_engagement.
  "instagram_manage_comments",
  "pages_manage_engagement",
  "read_insights",
  "business_management",
];

export function metaConfigured(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export function metaRedirectUri(origin: string): string {
  return `${origin}/api/meta/callback`;
}

/**
 * Facebook OAuth dialog URL.
 * Requests all required permissions for Facebook Pages and Instagram Professional accounts.
 */
export function buildOAuthUrl(origin: string, state: string, extraScopes?: string[]): string {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    redirect_uri: metaRedirectUri(origin),
    state,
    response_type: "code",
  });

  const configId = process.env.META_LOGIN_CONFIG_ID;
  if (configId) {
    params.set("config_id", configId);
  } else {
    const scopes = Array.from(new Set([...META_REQUIRED_SCOPES, ...(extraScopes ?? [])]));
    params.set("scope", scopes.join(","));
  }

  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

export type DiscoveredInstagramAccount = {
  id: string;
  username: string | null;
  name: string | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  linkedPageId: string;
  linkedPageName: string;
  isEligible: boolean;
  unavailableReason: string | null;
  status: "eligible" | "ineligible_personal" | "not_linked" | "permission_missing";
};

export type DiscoveredFacebookPage = {
  id: string;
  name: string;
  category: string | null;
  tasks: string[];
  canPost: boolean;
  unavailableReason: string | null;
  pageToken: string;
  instagramAccount: DiscoveredInstagramAccount | null;
};

export type MetaDiscoveryDiagnostics = {
  totalFacebookPages: number;
  eligibleFacebookPages: number;
  totalInstagramAccounts: number;
  eligibleInstagramAccounts: number;
  warnings: string[];
};

export type MetaDiscoveryResult = {
  authorizedUser: {
    id: string;
    name: string;
  };
  grantedScopes: string[];
  expiresAt: string | null; // ISO date string
  pages: DiscoveredFacebookPage[];
  diagnostics: MetaDiscoveryDiagnostics;
};

export type MetaPage = {
  pageId: string;
  pageName: string;
  pageToken: string;
  igUserId: string | null;
  igUsername: string | null;
};

export type MetaHealthStatus =
  | "healthy"
  | "token_expired"
  | "permission_missing"
  | "account_unavailable"
  | "reconnect_required"
  | "disconnected";

export type MetaHealthCheckResult = {
  status: MetaHealthStatus;
  ok: boolean;
  message: string;
  checkedAt: string;
  details?: Record<string, unknown>;
};

export type MetaGraphErrorPayload = {
  is_transient?: boolean;
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

/**
 * Parses a Meta Graph API error into actionable diagnostics.
 */
export function formatMetaGraphError(errorPayload?: MetaGraphErrorPayload): string {
  if (!errorPayload) return "Unknown Meta API error.";
  const { code, error_subcode, message } = errorPayload;

  if (code === 190) {
    if (error_subcode === 463) {
      return "Meta access token expired. Reconnect your account on the Connections page.";
    }
    if (error_subcode === 467) {
      return "Meta access token was invalidated or password was changed. Reconnect your account.";
    }
    return "Meta session expired. Reconnect your account.";
  }

  if (code === 10 || code === 200 || code === 283) {
    return `Meta permission error: ${message ?? "Missing required permissions. Grant all requested permissions during Meta Login."}`;
  }

  if (code === 100 || code === 803) {
    return `Meta resource not found: ${message ?? "The requested Page or Instagram account could not be found."}`;
  }

  if (code === 4 || code === 17 || code === 32 || code === 613) {
    return "Meta API rate limit reached. Please wait a few minutes before trying again.";
  }

  return message ?? `Meta Graph API error (code ${code ?? "unknown"})`;
}

/**
 * Exchanges the OAuth authorization code for a short-lived user access token.
 */
export async function exchangeOAuthCodeForUserToken(code: string, origin: string): Promise<string> {
  const appId = process.env.META_APP_ID ?? "";
  const appSecret = process.env.META_APP_SECRET ?? "";
  if (!appId || !appSecret) {
    throw new Error("Meta app credentials (META_APP_ID / META_APP_SECRET) are missing.");
  }

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: metaRedirectUri(origin),
    code,
  });

  const res = await fetch(`${GRAPH_HOST}/${GRAPH_VERSION}/oauth/access_token?${params.toString()}`, {
    signal: AbortSignal.timeout(30_000),
  });

  const json = (await res.json()) as { access_token?: string; error?: MetaGraphErrorPayload };
  if (!json.access_token) {
    throw new Error(formatMetaGraphError(json.error));
  }
  return json.access_token;
}

/**
 * Exchanges a short-lived user token for a 60-day long-lived user token.
 */
export async function exchangeForLongLivedUserToken(
  shortLivedToken: string,
): Promise<{ accessToken: string; expiresInSeconds: number }> {
  const appId = process.env.META_APP_ID ?? "";
  const appSecret = process.env.META_APP_SECRET ?? "";

  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });

  const res = await fetch(`${GRAPH_HOST}/${GRAPH_VERSION}/oauth/access_token?${params.toString()}`, {
    signal: AbortSignal.timeout(30_000),
  });

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: MetaGraphErrorPayload;
  };

  if (!json.access_token) {
    // If long-lived exchange is rejected, fall back to short-lived token rather than hard crashing
    return { accessToken: shortLivedToken, expiresInSeconds: 7200 };
  }

  return {
    accessToken: json.access_token,
    expiresInSeconds: typeof json.expires_in === "number" ? json.expires_in : 5184000,
  };
}

/**
 * Debugs an access token via /debug_token to get granted scopes, expiry, and validity.
 */
export async function debugToken(
  inputToken: string,
): Promise<{ isValid: boolean; scopes: string[]; userId?: string; expiresAt?: Date; error?: string }> {
  const appId = process.env.META_APP_ID ?? "";
  const appSecret = process.env.META_APP_SECRET ?? "";
  const appToken = `${appId}|${appSecret}`;

  try {
    const res = await fetch(
      `${GRAPH_HOST}/${GRAPH_VERSION}/debug_token?input_token=${encodeURIComponent(inputToken)}&access_token=${encodeURIComponent(appToken)}`,
      { signal: AbortSignal.timeout(20_000) },
    );
    const json = (await res.json()) as {
      data?: {
        is_valid?: boolean;
        scopes?: string[];
        user_id?: string;
        expires_at?: number;
        error?: { message?: string };
      };
      error?: MetaGraphErrorPayload;
    };

    if (json.data) {
      const expiresAt = json.data.expires_at ? new Date(json.data.expires_at * 1000) : undefined;
      return {
        isValid: Boolean(json.data.is_valid),
        scopes: json.data.scopes ?? [],
        userId: json.data.user_id,
        expiresAt,
      };
    }
    return { isValid: false, scopes: [], error: formatMetaGraphError(json.error) };
  } catch (err) {
    return { isValid: false, scopes: [], error: err instanceof Error ? err.message : "debug_token failed" };
  }
}

/**
 * Current official way to check which permissions a user access token actually
 * has granted: GET /me/permissions returns [{ permission, status }].
 * The deprecated `fields=perms` / `fields=permissions` forms no longer exist in
 * the Graph API. Only entries with status "granted" are returned, and nothing is
 * ever fabricated.
 */
export async function fetchGrantedPermissions(
  userToken: string,
): Promise<{ ok: boolean; granted: string[]; error?: string; status?: number }> {
  try {
    const res = await fetch(
      `${GRAPH_HOST}/${GRAPH_VERSION}/me/permissions?access_token=${encodeURIComponent(userToken)}`,
      { signal: AbortSignal.timeout(20_000) },
    );
    const json = (await res.json()) as {
      data?: Array<{ permission?: string; status?: string }>;
      error?: MetaGraphErrorPayload;
    };
    logMetaDiagnostic("permissions", "/me/permissions", res.status, json.error);

    if (!json.data) {
      return { ok: false, granted: [], status: res.status, error: formatMetaGraphError(json.error) };
    }
    const granted = json.data
      .filter((p) => (p.status ?? "").toLowerCase() === "granted" && typeof p.permission === "string")
      .map((p) => p.permission as string);
    return { ok: true, granted, status: res.status };
  } catch (err) {
    return {
      ok: false,
      granted: [],
      error: err instanceof Error ? err.message : "permissions request failed",
    };
  }
}

/**
 * Deep Instagram account discovery for a Facebook Page.
 * If /me/accounts did not populate instagram_business_account, probe the Page node directly with the Page token.
 */
async function discoverInstagramForPage(
  pageId: string,
  pageToken: string,
  pageName: string,
  prepopulated?: {
    id: string;
    username?: string;
    name?: string;
    profile_picture_url?: string;
    followers_count?: number;
  } | null,
): Promise<DiscoveredInstagramAccount | null> {
  // If we already received a populated instagram_business_account, fetch any extra details if needed
  if (prepopulated?.id) {
    return {
      id: prepopulated.id,
      username: prepopulated.username ?? null,
      name: prepopulated.name ?? null,
      profilePictureUrl: prepopulated.profile_picture_url ?? null,
      followersCount: typeof prepopulated.followers_count === "number" ? prepopulated.followers_count : null,
      linkedPageId: pageId,
      linkedPageName: pageName,
      isEligible: true,
      unavailableReason: null,
      status: "eligible",
    };
  }

  try {
    const fields =
      "instagram_business_account{id,username,name,profile_picture_url,followers_count},connected_instagram_account{id,username,name,profile_picture_url}";
    const res = await fetch(
      `${GRAPH_HOST}/${GRAPH_VERSION}/${pageId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(pageToken)}`,
      { signal: AbortSignal.timeout(20_000) },
    );
    const json = (await res.json()) as {
      instagram_business_account?: {
        id: string;
        username?: string;
        name?: string;
        profile_picture_url?: string;
        followers_count?: number;
      };
      connected_instagram_account?: {
        id: string;
        username?: string;
        name?: string;
        profile_picture_url?: string;
      };
      error?: MetaGraphErrorPayload;
    };

    if (json.instagram_business_account?.id) {
      const ig = json.instagram_business_account;
      return {
        id: ig.id,
        username: ig.username ?? null,
        name: ig.name ?? null,
        profilePictureUrl: ig.profile_picture_url ?? null,
        followersCount: typeof ig.followers_count === "number" ? ig.followers_count : null,
        linkedPageId: pageId,
        linkedPageName: pageName,
        isEligible: true,
        unavailableReason: null,
        status: "eligible",
      };
    }

    if (json.connected_instagram_account?.id) {
      const ig = json.connected_instagram_account;
      return {
        id: ig.id,
        username: ig.username ?? null,
        name: ig.name ?? null,
        profilePictureUrl: ig.profile_picture_url ?? null,
        followersCount: null,
        linkedPageId: pageId,
        linkedPageName: pageName,
        isEligible: false,
        unavailableReason:
          "Connected Instagram profile is a Personal account. Meta requires a Professional (Business or Creator) account for publishing and analytics. Switch to Professional in the Instagram app (Settings → Account type) and reconnect.",
        status: "ineligible_personal",
      };
    }

    return {
      id: `no-ig-${pageId}`,
      username: null,
      name: null,
      profilePictureUrl: null,
      followersCount: null,
      linkedPageId: pageId,
      linkedPageName: pageName,
      isEligible: false,
      unavailableReason:
        `No Instagram account is linked to '${pageName}'. Go to Meta Business Suite (Settings → Linked Accounts) to connect an Instagram Professional account to this Page.`,
      status: "not_linked",
    };
  } catch (err) {
    return {
      id: `err-ig-${pageId}`,
      username: null,
      name: null,
      profilePictureUrl: null,
      followersCount: null,
      linkedPageId: pageId,
      linkedPageName: pageName,
      isEligible: false,
      unavailableReason: err instanceof Error ? err.message : "Failed to query Instagram account for this page.",
      status: "not_linked",
    };
  }
}

/**
 * Full end-to-end account discovery:
 * 1. Exchanges OAuth code for short-lived user token.
 * 2. Exchanges short-lived token for long-lived user token.
 * 3. Inspects token to discover authorized Facebook user and granted scopes.
 * 4. Discovers all Facebook Pages the user can manage.
 * 5. Discovers linked Instagram accounts for every Page.
 * 6. Returns structured, normalized accounts with diagnostics and eligibility reasons.
 */
export async function discoverMetaAccounts(code: string, origin: string): Promise<MetaDiscoveryResult> {
  const shortLivedToken = await exchangeOAuthCodeForUserToken(code, origin);
  const { accessToken: userToken, expiresInSeconds } = await exchangeForLongLivedUserToken(shortLivedToken);

  // 1. Discover authorized Facebook user
  let authorizedUser = { id: "", name: "" };
  try {
    const meRes = await fetch(
      `${GRAPH_HOST}/${GRAPH_VERSION}/me?fields=id,name&access_token=${encodeURIComponent(userToken)}`,
      { signal: AbortSignal.timeout(20_000) },
    );
    const meJson = (await meRes.json()) as { id?: string; name?: string; error?: MetaGraphErrorPayload };
    if (meJson.id) {
      authorizedUser = { id: meJson.id, name: meJson.name ?? "Facebook User" };
    }
  } catch {
    // Continue with token debug
  }

  // 2. Token debug (authorized with the APP access token) for validity, user id
  //    and expiry.
  const debug = await debugToken(userToken);
  if (!authorizedUser.id && debug.userId) {
    authorizedUser = { id: debug.userId, name: "Facebook User" };
  }

  const expiresAtDate = debug.expiresAt ?? new Date(Date.now() + expiresInSeconds * 1000);
  const expiresAt = expiresAtDate.toISOString();

  // 3. Granted permissions - the current official check is GET /me/permissions
  //    (the legacy `perms` / `fields=permissions` forms no longer exist).
  //    Scopes are NEVER fabricated: the previous fallback reported every
  //    requested scope as granted whenever the token could not be introspected.
  const permissions = await fetchGrantedPermissions(userToken);
  const grantedScopes = Array.from(new Set([...permissions.granted, ...(debug.scopes ?? [])]));
  const missingRequiredScopes = META_REQUIRED_SCOPES.filter((s) => !grantedScopes.includes(s));
  const permissionWarning = !permissions.ok
    ? `Could not read granted permissions from /me/permissions (${permissions.error ?? "unknown error"}). Meta API calls may fail until this is resolved.`
    : missingRequiredScopes.length > 0
      ? `Meta did not grant: ${missingRequiredScopes.join(", ")}. The affected publishing/analytics features will fail until these permissions are granted and the account is reconnected.`
      : null;

  // 4. Fetch all Facebook Pages the user manages
  const pagesFields = [
    "id",
    "name",
    "category",
    "tasks",
    "access_token",
    "instagram_business_account{id,username,name,profile_picture_url,followers_count}",
    "connected_instagram_account{id,username,name,profile_picture_url}",
  ].join(",");

  const pagesRes = await fetch(
    `${GRAPH_HOST}/${GRAPH_VERSION}/me/accounts?fields=${encodeURIComponent(pagesFields)}&limit=100&access_token=${encodeURIComponent(userToken)}`,
    { signal: AbortSignal.timeout(30_000) },
  );

  const pagesJson = (await pagesRes.json()) as {
    data?: Array<{
      id: string;
      name: string;
      category?: string;
      tasks?: string[];
      access_token: string;
      instagram_business_account?: {
        id: string;
        username?: string;
        name?: string;
        profile_picture_url?: string;
        followers_count?: number;
      };
      connected_instagram_account?: {
        id: string;
        username?: string;
        name?: string;
        profile_picture_url?: string;
      };
    }>;
    paging?: { next?: string };
    error?: MetaGraphErrorPayload;
  };

  // Sanitized step log: endpoint path + HTTP status + API error (never a token).
  logMetaDiagnostic("pages", "/me/accounts", pagesRes.status, pagesJson.error);

  if (!pagesJson.data) {
    // Surface the REAL API reason (code, message, HTTP status) instead of
    // implying that the user simply has no Pages.
    throw new Error(
      `Meta Pages discovery failed at /me/accounts (HTTP ${pagesRes.status}): ${formatMetaGraphError(pagesJson.error)}`,
    );
  }

  const rawPages = [...pagesJson.data];
  // Follow paging cursors so an account with many Pages is not silently
  // truncated to the first response.
  let nextAccountsUrl = typeof pagesJson.paging?.next === "string" ? pagesJson.paging.next : null;
  let accountsPageGuard = 0;
  while (nextAccountsUrl && accountsPageGuard < 10) {
    accountsPageGuard++;
    const nextRes = await fetch(nextAccountsUrl, { signal: AbortSignal.timeout(30_000) });
    const nextJson = (await nextRes.json()) as typeof pagesJson;
    logMetaDiagnostic("pages_next", "/me/accounts", nextRes.status, nextJson.error);
    if (!nextJson.data) break;
    rawPages.push(...nextJson.data);
    nextAccountsUrl = typeof nextJson.paging?.next === "string" ? nextJson.paging.next : null;
  }

  const warnings: string[] = [];
  if (permissionWarning) warnings.push(permissionWarning);

  // 5. Process each page and discover linked Instagram account
  const pages: DiscoveredFacebookPage[] = [];

  for (const p of rawPages) {
    // `tasks` is the current, supported Page permission field. The legacy
    // `perms` field no longer exists in the Graph API, so it is never used as a
    // fallback (requesting it makes Meta reject the entire /me/accounts call).
    const tasks = p.tasks ?? [];
    // Can post if tasks include MANAGE, CREATE_CONTENT, or if tasks is empty/not strictly restricted
    const canPost =
      tasks.length === 0 ||
      tasks.some((t) => ["CREATE_CONTENT", "MANAGE", "MODERATE", "EDIT_PAGE"].includes(t.toUpperCase()));

    const unavailableReason = canPost
      ? null
      : `Restricted Page permissions (${tasks.join(", ")}). You need 'Content' creation access in Facebook Page settings to publish.`;

    const igAccount = await discoverInstagramForPage(
      p.id,
      p.access_token,
      p.name,
      p.instagram_business_account ?? null,
    );

    if (igAccount && !igAccount.isEligible && igAccount.unavailableReason) {
      warnings.push(igAccount.unavailableReason);
    }

    pages.push({
      id: p.id,
      name: p.name,
      category: p.category ?? null,
      tasks,
      canPost,
      unavailableReason,
      pageToken: p.access_token,
      instagramAccount: igAccount,
    });
  }

  if (pages.length === 0) {
    warnings.push(
      "Meta returned 0 Facebook Pages for this user token (real empty result - not a parsing failure). Usual causes: the Facebook account manages no Pages; pages_show_list / business_management was not granted; the Pages belong to a Business Manager this user cannot manage; or Page access is restricted.",
    );
  }

  const eligiblePages = pages.filter((p) => p.canPost);
  const eligibleIgs = pages.map((p) => p.instagramAccount).filter((ig): ig is DiscoveredInstagramAccount => Boolean(ig?.isEligible));

  return {
    authorizedUser,
    grantedScopes,
    expiresAt,
    pages,
    diagnostics: {
      totalFacebookPages: pages.length,
      eligibleFacebookPages: eligiblePages.length,
      totalInstagramAccounts: pages.filter((p) => p.instagramAccount && p.instagramAccount.status !== "not_linked").length,
      eligibleInstagramAccounts: eligibleIgs.length,
      warnings,
    },
  };
}

/**
 * Backward-compatible helper for code expecting MetaPage[]
 */
export async function exchangeForPages(code: string, origin: string): Promise<MetaPage[]> {
  const discovery = await discoverMetaAccounts(code, origin);
  return discovery.pages.map((p) => ({
    pageId: p.id,
    pageName: p.name,
    pageToken: p.pageToken,
    igUserId: p.instagramAccount?.isEligible ? p.instagramAccount.id : null,
    igUsername: p.instagramAccount?.isEligible ? p.instagramAccount.username : null,
  }));
}

/**
 * Performs a live API health check on a connected Meta Page or Instagram account.
 */
export async function verifyMetaHealth(params: {
  platform: "facebook" | "instagram";
  pageToken: string;
  pageId?: string | null;
  igUserId?: string | null;
}): Promise<MetaHealthCheckResult> {
  const now = new Date().toISOString();
  if (!params.pageToken) {
    return {
      status: "disconnected",
      ok: false,
      message: "No access token found for this connection.",
      checkedAt: now,
    };
  }

  try {
    if (params.platform === "facebook") {
      const pageId = params.pageId;
      if (!pageId) {
        return {
          status: "account_unavailable",
          ok: false,
          message: "Facebook connection is missing pageId metadata.",
          checkedAt: now,
        };
      }

      const res = await fetch(
        `${GRAPH_HOST}/${GRAPH_VERSION}/${pageId}?fields=id,name&access_token=${encodeURIComponent(params.pageToken)}`,
        { signal: AbortSignal.timeout(20_000) },
      );
      const json = (await res.json()) as { id?: string; name?: string; error?: MetaGraphErrorPayload };

      if (json.id) {
        return {
          status: "healthy",
          ok: true,
          message: `Connected to Facebook Page '${json.name ?? pageId}' and verified.`,
          checkedAt: now,
          details: { pageId: json.id, pageName: json.name },
        };
      }

      const err = json.error;
      const formatted = formatMetaGraphError(err);
      if (err?.code === 190) {
        return { status: "token_expired", ok: false, message: formatted, checkedAt: now };
      }
      if (err?.code === 10 || err?.code === 200 || err?.code === 283) {
        return { status: "permission_missing", ok: false, message: formatted, checkedAt: now };
      }
      if (err?.code === 100 || err?.code === 803) {
        return { status: "account_unavailable", ok: false, message: formatted, checkedAt: now };
      }
      return { status: "reconnect_required", ok: false, message: formatted, checkedAt: now };
    }

    // Instagram verification
    const igUserId = params.igUserId;
    if (!igUserId) {
      return {
        status: "account_unavailable",
        ok: false,
        message: "Instagram connection is missing igUserId metadata.",
        checkedAt: now,
      };
    }

    const res = await fetch(
      `${GRAPH_HOST}/${GRAPH_VERSION}/${igUserId}?fields=id,username,name&access_token=${encodeURIComponent(params.pageToken)}`,
      { signal: AbortSignal.timeout(20_000) },
    );
    const json = (await res.json()) as { id?: string; username?: string; name?: string; error?: MetaGraphErrorPayload };

    if (json.id) {
      return {
        status: "healthy",
        ok: true,
        message: `Connected to Instagram Professional account '@${json.username ?? igUserId}' and verified.`,
        checkedAt: now,
        details: { igUserId: json.id, igUsername: json.username },
      };
    }

    const err = json.error;
    const formatted = formatMetaGraphError(err);
    if (err?.code === 190) {
      return { status: "token_expired", ok: false, message: formatted, checkedAt: now };
    }
    if (err?.code === 10 || err?.code === 200 || err?.code === 283) {
      return { status: "permission_missing", ok: false, message: formatted, checkedAt: now };
    }
    if (err?.code === 100 || err?.code === 803) {
      return { status: "account_unavailable", ok: false, message: formatted, checkedAt: now };
    }
    return { status: "reconnect_required", ok: false, message: formatted, checkedAt: now };
  } catch (error) {
    return {
      status: "reconnect_required",
      ok: false,
      message: error instanceof Error ? error.message : "Meta API health check request failed.",
      checkedAt: now,
    };
  }
}
