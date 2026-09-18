import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  GRAPH_VERSION,
  discoverMetaAccounts,
  fetchGrantedPermissions,
  sanitizeMetaEndpoint,
} from "@/lib/meta/oauth";

const APP_ID = "app-id-123";
const APP_SECRET = "app-secret-456";
// encodeURIComponent("app-id-123|app-secret-456")
const APP_TOKEN_ENCODED = "app-id-123%7Capp-secret-456";
const ORIGIN = "https://localhost:3000";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const PAGE = {
  id: "page-1",
  name: "Test Page",
  category: "BUSINESS",
  tasks: ["MANAGE", "CREATE_CONTENT"],
  access_token: "page-token-1",
  instagram_business_account: {
    id: "ig-1",
    username: "test_brand",
    name: "Test Brand",
    profile_picture_url: "https://cdn.example/ig.png",
    followers_count: 4242,
  },
};

type Handler = () => Response;

/** Longest-suffix router over the Graph host, so /me/permissions never hits /me. */
function stubGraph(handlers: Record<string, Handler>) {
  const urls: string[] = [];
  const fetchMock = vi.fn(async (url: string | URL) => {
    const u = new URL(String(url));
    urls.push(String(url));
    const key = u.host + u.pathname;
    const match = Object.keys(handlers)
      .filter((h) => key.endsWith(h))
      .sort((a, b) => b.length - a.length)[0];
    if (!match) return json({ error: { message: `unhandled ${key}`, code: 999 } }, 404);
    return handlers[match]();
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, urls };
}

function base(overrides: Record<string, Handler> = {}): Record<string, Handler> {
  return {
    "/oauth/access_token": () => json({ access_token: "user-token-1", expires_in: 3600 }),
    "/debug_token": () => json({ data: { is_valid: true, scopes: [], user_id: "user-1", expires_at: 1900000000 } }),
    "/me/permissions": () =>
      json({
        data: [
          { permission: "pages_show_list", status: "granted" },
          { permission: "instagram_basic", status: "granted" },
          { permission: "pages_manage_posts", status: "declined" },
        ],
      }),
    "/me/accounts": () => json({ data: [PAGE], paging: {} }),
    "/me": () => json({ id: "user-1", name: "Hameed Ansari" }),
    ...overrides,
  };
}

beforeAll(() => {
  process.env.META_APP_ID = APP_ID;
  process.env.META_APP_SECRET = APP_SECRET;
});

afterAll(() => {
  delete process.env.META_APP_ID;
  delete process.env.META_APP_SECRET;
  vi.unstubAllGlobals();
});

describe("discoverMetaAccounts", () => {
  it("uses the current Graph endpoints and never requests the deprecated `perms` Page field", async () => {
    const { urls } = stubGraph(base());
    await discoverMetaAccounts("code-1", ORIGIN);

    // No request may contain the removed `perms` field.
    expect(urls.filter((u) => /[?&,]perms([&=,]|$)|fields=[^&]*perms/.test(u))).toEqual([]);

    const accountsUrl = urls.find((u) => u.includes("/me/accounts"));
    expect(accountsUrl).toBeDefined();
    // The supported Page permission field is `tasks`.
    expect(decodeURIComponent(accountsUrl as string)).toContain("tasks");
    expect(decodeURIComponent(accountsUrl as string)).toContain("access_token");
    expect(decodeURIComponent(accountsUrl as string)).toContain("instagram_business_account");

    // Permission check uses the current official endpoint.
    expect(urls.some((u) => u.includes(`/${GRAPH_VERSION}/me/permissions`))).toBe(true);
  });

  it("discovers manageable Pages, their Page tokens and the linked Instagram account", async () => {
    stubGraph(base());
    const res = await discoverMetaAccounts("code-1", ORIGIN);

    expect(res.authorizedUser).toEqual({ id: "user-1", name: "Hameed Ansari" });
    expect(res.expiresAt).toBe(new Date(1900000000 * 1000).toISOString());

    expect(res.pages).toHaveLength(1);
    expect(res.pages[0]).toMatchObject({
      id: "page-1",
      name: "Test Page",
      category: "BUSINESS",
      tasks: ["MANAGE", "CREATE_CONTENT"],
      canPost: true,
      unavailableReason: null,
      pageToken: "page-token-1",
    });
    expect(res.pages[0].instagramAccount).toMatchObject({
      id: "ig-1",
      username: "test_brand",
      name: "Test Brand",
      followersCount: 4242,
      linkedPageId: "page-1",
      isEligible: true,
      status: "eligible",
    });
    expect(res.diagnostics).toMatchObject({
      totalFacebookPages: 1,
      eligibleFacebookPages: 1,
      totalInstagramAccounts: 1,
      eligibleInstagramAccounts: 1,
    });
  });

  it("surfaces the REAL Meta API reason when the Pages call fails (never a silent 0 of 0)", async () => {
    stubGraph(
      base({
        "/me/accounts": () =>
          json(
            {
              error: {
                message: "Tried accessing nonexisting field (perms) on node type (Page)",
                type: "OAuthException",
                code: 100,
                fbtrace_id: "trace-1",
              },
            },
            400,
          ),
      }),
    );

    await expect(discoverMetaAccounts("code-1", ORIGIN)).rejects.toThrow(
      /Pages discovery failed at \/me\/accounts \(HTTP 400\).*Tried accessing nonexisting field/,
    );
  });

  it("reports a genuinely empty Pages list as a real API result, with causes, instead of assuming none", async () => {
    stubGraph(base({ "/me/accounts": () => json({ data: [], paging: {} }) }));
    const res = await discoverMetaAccounts("code-1", ORIGIN);

    expect(res.pages).toEqual([]);
    expect(res.diagnostics.totalFacebookPages).toBe(0);
    expect(res.diagnostics.warnings.join(" ")).toMatch(/returned 0 Facebook Pages/);
    expect(res.diagnostics.warnings.join(" ")).toMatch(/pages_show_list/);
  });

  it("follows paging.next so a multi-Page account is not truncated", async () => {
    let call = 0;
    const { urls } = stubGraph(
      base({
        "/page-2": () => json({}),
        "/me/accounts": () => {
          call++;
          if (call === 1) {
            return json({
              data: [PAGE],
              paging: {
                next: `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?access_token=user-token-1&after=cursor-1`,
              },
            });
          }
          return json({
            data: [{ id: "page-2", name: "Second Page", category: "BUSINESS", tasks: ["MANAGE"], access_token: "page-token-2" }],
            paging: {},
          });
        },
      }),
    );

    const res = await discoverMetaAccounts("code-1", ORIGIN);
    expect(res.pages.map((p) => p.id)).toEqual(["page-1", "page-2"]);
    expect(urls.filter((u) => u.includes("/me/accounts")).length).toBe(2);
    expect(res.pages[1].instagramAccount?.status).toBe("not_linked");
  });

  it("authorizes /debug_token with the APP access token, never the user token", async () => {
    const { urls } = stubGraph(base());
    await discoverMetaAccounts("code-1", ORIGIN);

    const debugUrl = urls.find((u) => u.includes("/debug_token"));
    expect(debugUrl).toBeDefined();
    expect(debugUrl as string).toContain(`access_token=${APP_TOKEN_ENCODED}`);
    expect(debugUrl as string).not.toContain("access_token=user-token-1");
  });

  it("takes granted permissions from /me/permissions (declined excluded) and warns about missing scopes", async () => {
    stubGraph(base());
    const res = await discoverMetaAccounts("code-1", ORIGIN);

    expect(res.grantedScopes).toContain("pages_show_list");
    expect(res.grantedScopes).toContain("instagram_basic");
    expect(res.grantedScopes).not.toContain("pages_manage_posts");
    // The removed fallback reported EVERY requested scope as granted.
    expect(res.grantedScopes).not.toContain("business_management");
    expect(res.diagnostics.warnings.join(" ")).toMatch(/Meta did not grant/);
    expect(res.diagnostics.warnings.join(" ")).toMatch(/pages_manage_posts/);
  });

  it("never fabricates scopes when the permission check itself fails", async () => {
    stubGraph(base({ "/me/permissions": () => json({ error: { message: "nope", code: 190 } }, 400) }));
    const res = await discoverMetaAccounts("code-1", ORIGIN);

    expect(res.grantedScopes).toEqual([]);
    expect(res.diagnostics.warnings.join(" ")).toMatch(/Could not read granted permissions/);
  });
});

describe("fetchGrantedPermissions", () => {
  it("returns only granted permission names", async () => {
    stubGraph(base());
    const res = await fetchGrantedPermissions("user-token-1");
    expect(res.ok).toBe(true);
    expect(res.granted).toEqual(["pages_show_list", "instagram_basic"]);
  });

  it("reports an API failure as ok:false with an actionable error", async () => {
    stubGraph(base({ "/me/permissions": () => json({ error: { message: "Invalid OAuth token", code: 190 } }, 400) }));
    const res = await fetchGrantedPermissions("user-token-1");
    expect(res.ok).toBe(false);
    expect(res.granted).toEqual([]);
    expect(res.error).toMatch(/reconnect|expired/i);
  });
});

describe("sanitizeMetaEndpoint", () => {
  it("drops the query string so a sanitized diagnostic can never leak a token", () => {
    expect(sanitizeMetaEndpoint("https://graph.facebook.com/v22.0/me/accounts?access_token=SECRET&limit=100")).toBe(
      "https://graph.facebook.com/v22.0/me/accounts",
    );
  });
});