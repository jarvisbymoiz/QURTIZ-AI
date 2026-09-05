import crypto from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BUFFER_AUTHORIZE_URL,
  BUFFER_OAUTH_SCOPES,
  BUFFER_OAUTH_STATE_TTL_SECONDS,
  BUFFER_TOKEN_URL,
  BufferPostTypeFacebook,
  BufferPostTypeInstagram,
  BufferSchedulingType,
  BufferShareMode,
  CREATE_POST_MUTATION,
  applyRefreshedToken,
  buildAuthorizeUrl,
  buildBufferTokenEnvelope,
  createPost,
  createPostForBuffer,
  decodeBufferTokenEnvelope,
  exchangeCode,
  filterSupportedBufferChannels,
  generatePkcePair,
  getOrganizations,
  listChannels,
  pkceChallenge,
  pkceVerifier,
  refreshAccessToken,
  signBufferOAuthState,
  verifyBufferOAuthState,
  type BufferChannel,
  type BufferPostType,
  type BufferTokenEnvelope,
} from "@/lib/buffer/client";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";

// Deterministic, valid 64-hex-char ENCRYPTION_KEY for this test file, so the
// HMAC key derivation matches getEncryptionKey() exactly (no dev fallback).
const ENCRYPTION_KEY = "ab".repeat(32);
const BUFFER_CLIENT_ID = "buffer-client-id-123";
const BUFFER_CLIENT_SECRET = "buffer-client-secret-456";
const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const REDIRECT_URI = "https://qurtiz.example/api/buffer/callback";
// RFC 7636 Appendix B test vector (43-char, url-safe — no "=" or "." so it can
// ride inside the dot-joined OAuth state marker).
const CODE_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";

function hmacHex(payload: string): string {
  return crypto
    .createHmac("sha256", Buffer.from(ENCRYPTION_KEY, "hex"))
    .update(payload, "utf8")
    .digest("hex");
}

beforeAll(() => {
  process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
  process.env.BUFFER_CLIENT_ID = BUFFER_CLIENT_ID;
  process.env.BUFFER_CLIENT_SECRET = BUFFER_CLIENT_SECRET;
});

afterAll(() => {
  delete process.env.ENCRYPTION_KEY;
  delete process.env.BUFFER_CLIENT_ID;
  delete process.env.BUFFER_CLIENT_SECRET;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// The endpoint constants resolve from process.env at module load, so override
// tests reload a fresh module instance with a controlled env state (never the
// ambient shell env) and restore whatever was there afterwards.
const BUFFER_ENDPOINT_ENV_VARS = [
  "BUFFER_AUTHORIZE_URL",
  "BUFFER_TOKEN_URL",
  "BUFFER_API_BASE",
  "BUFFER_OAUTH_SCOPES",
] as const;

function applyEndpointEnv(values: Partial<Record<(typeof BUFFER_ENDPOINT_ENV_VARS)[number], string>>): () => void {
  const saved = new Map<string, string | undefined>();
  for (const key of BUFFER_ENDPOINT_ENV_VARS) {
    saved.set(key, process.env[key]);
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return () => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

describe("buffer endpoint constants", () => {
  it("default to Buffer's live hosts", async () => {
    const restore = applyEndpointEnv({});
    try {
      vi.resetModules();
      const mod = await import("@/lib/buffer/client");
      expect(mod.BUFFER_AUTHORIZE_URL).toBe("https://auth.buffer.com/auth");
      expect(mod.BUFFER_TOKEN_URL).toBe("https://auth.buffer.com/token");
      expect(mod.BUFFER_API_BASE).toBe("https://api.buffer.com");
      expect(mod.BUFFER_OAUTH_SCOPES).toBe("posts:read posts:write account:read offline_access");
    } finally {
      restore();
      vi.resetModules();
    }
  });

  it("prefer the BUFFER_* endpoint env overrides when set", async () => {
    const restore = applyEndpointEnv({
      BUFFER_AUTHORIZE_URL: "https://override.example/oauth2/authorize",
      BUFFER_TOKEN_URL: "https://override.example/oauth2/token.json",
      BUFFER_API_BASE: "https://override.example/",
      BUFFER_OAUTH_SCOPES: "custom:scope offline_access",
    });
    try {
      vi.resetModules();
      const mod = await import("@/lib/buffer/client");
      expect(mod.BUFFER_AUTHORIZE_URL).toBe("https://override.example/oauth2/authorize");
      expect(mod.BUFFER_TOKEN_URL).toBe("https://override.example/oauth2/token.json");
      expect(mod.BUFFER_API_BASE).toBe("https://override.example/");
      expect(mod.BUFFER_OAUTH_SCOPES).toBe("custom:scope offline_access");
    } finally {
      restore();
      vi.resetModules();
    }
  });

  it("treats an empty-string override as unset", async () => {
    const restore = applyEndpointEnv({ BUFFER_AUTHORIZE_URL: "" });
    try {
      vi.resetModules();
      const mod = await import("@/lib/buffer/client");
      expect(mod.BUFFER_AUTHORIZE_URL).toBe("https://auth.buffer.com/auth");
    } finally {
      restore();
      vi.resetModules();
    }
  });
});

describe("pkce helpers", () => {
  it("generates a 43-char base64url verifier", () => {
    const verifier = pkceVerifier();
    expect(verifier).toHaveLength(43);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifier).not.toContain("=");
  });

  it("generates a fresh verifier on every call", () => {
    expect(pkceVerifier()).not.toBe(pkceVerifier());
  });

  it("derives the RFC 7636 Appendix B challenge vector", () => {
    // sha256(verifier) → unpadded base64url — deterministic known answer.
    expect(pkceChallenge(CODE_VERIFIER)).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("returns an unpadded base64url challenge for a generated pair", () => {
    const { codeVerifier, codeChallenge } = generatePkcePair();
    expect(codeVerifier).toHaveLength(43);
    expect(codeChallenge).toBe(pkceChallenge(codeVerifier));
    expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(codeChallenge).not.toContain("=");
  });
});

describe("buildAuthorizeUrl", () => {
  const CODE_CHALLENGE = pkceChallenge(CODE_VERIFIER);

  it("builds the Buffer authorize URL with client_id, redirect_uri, response_type, state and PKCE params", () => {
    const url = buildAuthorizeUrl({ redirectUri: REDIRECT_URI, state: "state-abc", codeChallenge: CODE_CHALLENGE });
    expect(url.startsWith(`${BUFFER_AUTHORIZE_URL}?`)).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get("client_id")).toBe(BUFFER_CLIENT_ID);
    expect(params.get("redirect_uri")).toBe(REDIRECT_URI);
    expect(params.get("response_type")).toBe("code");
    expect(params.get("scope")).toBe(BUFFER_OAUTH_SCOPES);
    expect(params.get("state")).toBe("state-abc");
    expect(params.get("code_challenge")).toBe(CODE_CHALLENGE);
    expect(params.get("code_challenge_method")).toBe("S256");
  });

  it("throws an honest error when BUFFER_CLIENT_ID is unset", () => {
    const prev = process.env.BUFFER_CLIENT_ID;
    delete process.env.BUFFER_CLIENT_ID;
    try {
      expect(() =>
        buildAuthorizeUrl({ redirectUri: REDIRECT_URI, state: "s", codeChallenge: "ch" }),
      ).toThrow(/BUFFER_CLIENT_ID/);
    } finally {
      process.env.BUFFER_CLIENT_ID = prev;
    }
  });
});

describe("exchangeCode", () => {
  it("posts code, redirect_uri and the PKCE code_verifier to the token URL", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
      void _url;
      void _init;
      return new Response(JSON.stringify({ access_token: "tok-1" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await exchangeCode({ code: "auth-code-1", redirectUri: REDIRECT_URI, codeVerifier: CODE_VERIFIER });
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(BUFFER_TOKEN_URL);
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const body = new URLSearchParams(init.body as URLSearchParams);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("auth-code-1");
    expect(body.get("redirect_uri")).toBe(REDIRECT_URI);
    expect(body.get("client_id")).toBe(BUFFER_CLIENT_ID);
    expect(body.get("client_secret")).toBe(BUFFER_CLIENT_SECRET);
    expect(body.get("code_verifier")).toBe(CODE_VERIFIER);
  });

  it("maps a rejected token exchange to a typed failure without leaking the body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error_description: "invalid_grant" }), { status: 400 })),
    );
    const res = await exchangeCode({ code: "bad", redirectUri: REDIRECT_URI, codeVerifier: CODE_VERIFIER });
    expect(res).toEqual({ ok: false, reason: "rejected", message: "invalid_grant" });
  });
});

describe("refreshAccessToken", () => {
  it("posts grant_type=refresh_token with the client credentials to the token URL", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
      void _url;
      void _init;
      return new Response(JSON.stringify({ access_token: "tok-2", refresh_token: "ref-2", expires_in: 3600 }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await refreshAccessToken({ refreshToken: "ref-1" });
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(BUFFER_TOKEN_URL);
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const body = new URLSearchParams(init.body as URLSearchParams);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("ref-1");
    expect(body.get("client_id")).toBe(BUFFER_CLIENT_ID);
    expect(body.get("client_secret")).toBe(BUFFER_CLIENT_SECRET);
  });

  it("maps a rejected refresh to a typed failure without leaking the body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })),
    );
    const res = await refreshAccessToken({ refreshToken: "rotated-away" });
    expect(res).toEqual({ ok: false, reason: "rejected", message: "invalid_grant" });
  });

  it("returns invalid_response when the refresh response carries no access token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })));
    const res = await refreshAccessToken({ refreshToken: "ref-1" });
    expect(res).toEqual({
      ok: false,
      reason: "invalid_response",
      message: "Buffer token refresh returned no access token.",
    });
  });
});

describe("applyRefreshedToken", () => {
  const current: BufferTokenEnvelope = { accessToken: "tok-1", refreshToken: "ref-1", expiresAt: 1000 };

  it("rotates to the new refresh token (single-use) and recomputes expiresAt from expires_in", () => {
    const before = Date.now();
    const env = applyRefreshedToken(current, { access_token: "tok-2", refresh_token: "ref-2", expires_in: 3600 });
    const after = Date.now();
    expect(env.accessToken).toBe("tok-2");
    expect(env.refreshToken).toBe("ref-2");
    // expiresAt = captured now + 3600s (allow ±1ms clock boundary between reads)
    expect((env.expiresAt as number) - before).toBeGreaterThan(3600_000 - 2000);
    expect((env.expiresAt as number) - after).toBeLessThanOrEqual(3600_000 + 1);
  });

  it("keeps the previous refresh token when the response omits one (defensive)", () => {
    const omitted = applyRefreshedToken(current, { access_token: "tok-2", expires_in: 3600 });
    expect(omitted.refreshToken).toBe("ref-1");
    const nulled = applyRefreshedToken(current, { access_token: "tok-2", refresh_token: null, expires_in: 3600 });
    expect(nulled.refreshToken).toBe("ref-1");
  });

  it("sets expiresAt to null when the response has no expires_in", () => {
    const env = applyRefreshedToken(current, { access_token: "tok-2", refresh_token: "ref-2" });
    expect(env.accessToken).toBe("tok-2");
    expect(env.expiresAt).toBeNull();
  });
});

describe("buffer OAuth state marker", () => {
  it("signs a token that verifies back to its workspace + user + codeVerifier scope", () => {
    const token = signBufferOAuthState({ workspaceId: WORKSPACE_ID, userId: USER_ID, codeVerifier: CODE_VERIFIER });
    expect(verifyBufferOAuthState(token)).toEqual({
      workspaceId: WORKSPACE_ID,
      userId: USER_ID,
      codeVerifier: CODE_VERIFIER,
    });
  });

  it("produces workspaceId.userId.codeVerifier.exp.hmac with a 10-minute expiry", () => {
    const token = signBufferOAuthState({ workspaceId: WORKSPACE_ID, userId: USER_ID, codeVerifier: CODE_VERIFIER });
    const parts = token.split(".");
    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe(WORKSPACE_ID);
    expect(parts[1]).toBe(USER_ID);
    expect(parts[2]).toBe(CODE_VERIFIER);
    const exp = Number(parts[3]);
    const now = Math.floor(Date.now() / 1000);
    expect(Number.isSafeInteger(exp)).toBe(true);
    expect(exp).toBeGreaterThan(now);
    expect(exp).toBeLessThanOrEqual(now + BUFFER_OAUTH_STATE_TTL_SECONDS);
    expect(parts[4]).toBe(hmacHex(parts.slice(0, 4).join(".")));
  });

  it("rejects an expired token", () => {
    const exp = Math.floor(Date.now() / 1000) - 60;
    const payload = `${WORKSPACE_ID}.${USER_ID}.${CODE_VERIFIER}.${exp}`;
    expect(verifyBufferOAuthState(`${payload}.${hmacHex(payload)}`)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = signBufferOAuthState({ workspaceId: WORKSPACE_ID, userId: USER_ID, codeVerifier: CODE_VERIFIER });
    const parts = token.split(".");
    parts[4] = "0".repeat(64);
    expect(verifyBufferOAuthState(parts.join("."))).toBeNull();
  });

  it("rejects tampered scope (workspace/user swapped) and malformed tokens without throwing", () => {
    const token = signBufferOAuthState({ workspaceId: WORKSPACE_ID, userId: USER_ID, codeVerifier: CODE_VERIFIER });
    const parts = token.split(".");
    const tampered = [parts[1], parts[0], parts[2], parts[3], parts[4]].join(".");
    expect(verifyBufferOAuthState(tampered)).toBeNull();
    expect(verifyBufferOAuthState("")).toBeNull();
    expect(verifyBufferOAuthState("garbage")).toBeNull();
    expect(verifyBufferOAuthState(`${WORKSPACE_ID}.${USER_ID}.`)).toBeNull();
    // A tampered verifier segment must fail the signature check too.
    const verifierSwap = [parts[0], parts[1], pkceVerifier(), parts[3], parts[4]].join(".");
    expect(verifyBufferOAuthState(verifierSwap)).toBeNull();
  });
});

describe("channel filtering", () => {
  const channels: BufferChannel[] = [
    { id: "c1", service: "facebook", username: "Page A" },
    { id: "c2", service: "instagram", username: "acct_b" },
    { id: "c3", service: "twitter", username: "tweet" },
    { id: "c4", service: "pinterest", username: "pin" },
    { id: "c5", service: "instagram", username: "acct_c" },
  ];

  it("keeps facebook/instagram only and preserves order", () => {
    const filtered = filterSupportedBufferChannels(channels);
    expect(filtered.map((c) => c.service)).toEqual(["facebook", "instagram", "instagram"]);
    expect(filtered.map((c) => c.id)).toEqual(["c1", "c2", "c5"]);
  });

  it("returns an empty list when nothing is supported", () => {
    expect(filterSupportedBufferChannels([{ id: "t", service: "twitter", username: "x" }])).toEqual([]);
  });
});

describe("getOrganizations", () => {
  it("POSTs the documented query to the api root with a Bearer header and maps organizations", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
      void _url;
      void _init;
      return new Response(
        JSON.stringify({
          data: { account: { organizations: [{ id: "org-1", name: "Acme" }, { id: "org-2", name: "Globex" }] } },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await getOrganizations("tok-1");
    expect(res).toEqual({ ok: true, data: [{ id: "org-1", name: "Acme" }, { id: "org-2", name: "Globex" }] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.buffer.com");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok-1");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    const body = JSON.parse(init.body as string);
    expect(Object.keys(body)).toEqual(["query"]);
    expect(body.query).toContain("query GetOrganizations");
    expect(body.query).toContain("account { organizations { id name } }");
  });

  it("returns ok with an empty list when the account has no organizations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: { account: { organizations: [] } } }), { status: 200 })),
    );
    const res = await getOrganizations("tok-1");
    expect(res).toEqual({ ok: true, data: [] });
  });

  it("strips a trailing slash from the BUFFER_API_BASE override when composing the URL", async () => {
    const restore = applyEndpointEnv({ BUFFER_API_BASE: "https://override.example/" });
    vi.resetModules();
    try {
      const mod = await import("@/lib/buffer/client");
      const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
        void _url;
        void _init;
        return new Response(JSON.stringify({ data: { account: { organizations: [] } } }), { status: 200 });
      });
      vi.stubGlobal("fetch", fetchMock);
      await mod.getOrganizations("tok-1");
      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe("https://override.example");
    } finally {
      restore();
      vi.resetModules();
      vi.unstubAllGlobals();
    }
  });

  it("maps HTTP 401 to an auth failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "token expired" }), { status: 401 })));
    const res = await getOrganizations("expired-tok");
    expect(res).toEqual({ ok: false, reason: "auth", message: "token expired" });
  });
});

describe("listChannels", () => {
  it("scopes the query to the organization and maps {id, name, service} to the product shape", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
      void _url;
      void _init;
      return new Response(
        JSON.stringify({
          data: {
            channels: [
              { id: "c1", name: "Page A", service: "facebook" },
              { id: "c2", name: "acct_b", service: "instagram" },
              { id: "t1", name: "tweets", service: "twitter" },
            ],
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await listChannels("tok-1", "org-1");
    expect(res).toEqual({
      ok: true,
      data: [
        { id: "c1", service: "facebook", username: "Page A" },
        { id: "c2", service: "instagram", username: "acct_b" },
        { id: "t1", service: "twitter", username: "tweets" },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.buffer.com");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok-1");
    const body = JSON.parse(init.body as string);
    expect(Object.keys(body)).toEqual(["query"]);
    expect(body.query).toContain("query GetChannels");
    expect(body.query).toContain("channels(input: { organizationId:");
    expect(body.query).toContain('"org-1"');
    expect(body.query).toContain("id name service");
  });

  it("drops unparseable entries instead of failing the whole list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ data: { channels: [{ id: "ok", name: "Page", service: "facebook" }, { id: null }, 42] } }),
            { status: 200 },
          ),
      ),
    );
    const res = await listChannels("tok-1", "org-1");
    expect(res).toEqual({ ok: true, data: [{ id: "ok", service: "facebook", username: "Page" }] });
  });

  it("returns invalid_response when the 2xx payload has no channels array", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: { foo: "bar" } }), { status: 200 })));
    const res = await listChannels("tok-1", "org-1");
    expect(res).toEqual({
      ok: false,
      reason: "invalid_response",
      message: "Buffer channels query returned an unexpected payload.",
    });
  });

  it("maps a GraphQL errors array (HTTP 200) to a rejected failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ data: null, errors: [{ message: "Unauthorized" }, { message: "check org id" }] }), {
            status: 200,
          }),
      ),
    );
    const res = await listChannels("tok-1", "org-1");
    expect(res).toEqual({ ok: false, reason: "rejected", message: "Unauthorized; check org id" });
  });

  it("maps HTTP 401 to an auth failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "token expired" }), { status: 401 })));
    const res = await listChannels("expired-tok", "org-1");
    expect(res).toEqual({ ok: false, reason: "auth", message: "token expired" });
  });
});

describe("createPost (legacy alias → createPostForBuffer customScheduled)", () => {
  const DUE_AT = new Date("2026-09-04T09:59:00.000Z");

  it("sends the VARIABLES-BASED createPost mutation: every value travels in variables as JSON", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
      void _url;
      void _init;
      return new Response(
        JSON.stringify({
          data: { createPost: { post: { id: "post-1", text: "Hello #tag", dueAt: "2026-09-04T10:00:00.000Z" } } },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await createPost("tok-1", { channelId: "ch-1", text: "Hello #tag", dueAt: DUE_AT });
    expect(res).toEqual({
      ok: true,
      data: { id: "post-1", status: "queued", dueAt: "2026-09-04T10:00:00.000Z" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.buffer.com");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok-1");
    const body = JSON.parse(init.body as string);
    // { query, variables } — never an inline literal-only mutation.
    expect(Object.keys(body)).toEqual(["query", "variables"]);
    expect(body.query).toBe(CREATE_POST_MUTATION);
    // The query string carries NO literal values at all (no ids, no text, no
    // quoted enums — Buffer rejects `Enum "X" cannot represent non-enum value`).
    expect(body.query).not.toContain('"');
    // Full variables JSON (defaults: service facebook, mode customScheduled).
    expect(body.variables).toEqual({
      input: {
        channelId: "ch-1",
        text: "Hello #tag",
        mode: "customScheduled",
        schedulingType: "automatic",
        needsApproval: false,
        assets: [],
        metadata: { facebook: { type: "post" } },
        dueAt: "2026-09-04T09:59:00.000Z",
      },
    });
  });

  it("stamps metadata.instagram.type=post when service=instagram is passed to the legacy alias", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
      void _url;
      void _init;
      return new Response(JSON.stringify({ data: { createPost: { post: { id: "post-ig" } } } }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await createPost("tok-1", { channelId: "ch-ig", text: "IG", dueAt: DUE_AT, service: "instagram" });
    expect(res.ok).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.variables.input.metadata).toEqual({ instagram: { type: "post" } });
    expect(body.query).toBe(CREATE_POST_MUTATION);
  });

  it("maps a MutationError payload (HTTP 200) to a rejected failure with its message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: { createPost: { message: "Channel not found" } } }), { status: 200 })),
    );
    const res = await createPost("tok-1", { channelId: "ch-1", text: "Hello", dueAt: DUE_AT });
    expect(res).toEqual({ ok: false, reason: "rejected", message: "Channel not found" });
  });

  it("falls back to the requested dueAt when the success payload omits it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: { createPost: { post: { id: "post-2", text: "Hi" } } } }), { status: 200 })),
    );
    const res = await createPost("tok-1", { channelId: "ch-1", text: "Hi", dueAt: DUE_AT });
    expect(res).toEqual({ ok: true, data: { id: "post-2", status: "queued", dueAt: "2026-09-04T09:59:00.000Z" } });
  });

  it("maps a rejected creation (HTTP 4xx) to a typed failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ message: "validation failed" }), { status: 400 })),
    );
    const res = await createPost("tok-1", { channelId: "ch-1", text: "Hi", dueAt: DUE_AT });
    expect(res).toEqual({ ok: false, reason: "rejected", message: "validation failed" });
  });
});

describe("createPostForBuffer (variables-based createPost contract)", () => {
  const DUE_AT = new Date("2026-09-04T09:59:00.000Z");

  function stubSuccess(id: string): ReturnType<typeof vi.fn> {
    return vi.fn(async (_url: string, _init?: RequestInit) => {
      void _url;
      void _init;
      return new Response(JSON.stringify({ data: { createPost: { post: { id, text: "Hi" } } } }), { status: 200 });
    });
  }

  it("facebook shareNow post — exact variables JSON (no dueAt key at all)", async () => {
    const fetchMock = stubSuccess("post-now");
    vi.stubGlobal("fetch", fetchMock);
    const res = await createPostForBuffer("tok-1", {
      channelId: "ch-1",
      text: "Hi",
      mode: "shareNow",
      contentKind: "post",
      service: "facebook",
    });
    expect(res).toEqual({ ok: true, data: { id: "post-now", status: "sent", dueAt: null } });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.query).toBe(CREATE_POST_MUTATION);
    expect(body.variables.input).toEqual({
      channelId: "ch-1",
      text: "Hi",
      mode: "shareNow",
      schedulingType: "automatic",
      needsApproval: false,
      assets: [],
      metadata: { facebook: { type: "post" } },
    });
    // dueAt must NOT appear — not even as null — for shareNow.
    expect("dueAt" in body.variables.input).toBe(false);
  });

  it("facebook customScheduled reel — dueAt present in variables, type reel", async () => {
    const fetchMock = stubSuccess("post-reel");
    vi.stubGlobal("fetch", fetchMock);
    const res = await createPostForBuffer("tok-1", {
      channelId: "ch-1",
      text: "Reel",
      mode: "customScheduled",
      contentKind: "reel",
      service: "facebook",
      dueAt: DUE_AT,
    });
    // The mocked payload omits dueAt → the requested dueAt ISO is echoed back.
    expect(res).toEqual({ ok: true, data: { id: "post-reel", status: "queued", dueAt: "2026-09-04T09:59:00.000Z" } });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.variables.input.mode).toBe("customScheduled");
    expect(body.variables.input.dueAt).toBe("2026-09-04T09:59:00.000Z");
    expect(body.variables.input.metadata).toEqual({ facebook: { type: "reel" } });
    expect(body.variables.input.needsApproval).toBe(false);
    expect(body.variables.input.schedulingType).toBe("automatic");
    expect(body.variables.input.assets).toEqual([]);
  });

  it("instagram customScheduled post — per-channel metadata.instagram, dueAt ISO string", async () => {
    const fetchMock = stubSuccess("post-ig");
    vi.stubGlobal("fetch", fetchMock);
    await createPostForBuffer("tok-1", {
      channelId: "ch-ig",
      text: "IG",
      mode: "customScheduled",
      contentKind: "post",
      service: "instagram",
      dueAt: DUE_AT,
    });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.variables.input.metadata).toEqual({ instagram: { type: "post" } });
    expect(body.variables.input.dueAt).toBe("2026-09-04T09:59:00.000Z");
    expect(body.variables.input.mode).toBe("customScheduled");
  });

  it("stamps metadata.facebook.type=story for story variants", async () => {
    const fetchMock = stubSuccess("post-story");
    vi.stubGlobal("fetch", fetchMock);
    await createPostForBuffer("tok-1", {
      channelId: "ch-1",
      text: "Story",
      mode: "shareNow",
      contentKind: "story",
      service: "facebook",
    });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.variables.input.metadata).toEqual({ facebook: { type: "story" } });
  });

  it("attaches exactly ONE oneOf-compliant image asset when mediaUrl is set; [] when text-only", async () => {
    const fetchMock = stubSuccess("post-media");
    vi.stubGlobal("fetch", fetchMock);
    await createPostForBuffer("tok-1", {
      channelId: "ch-1",
      text: "With media",
      mode: "shareNow",
      contentKind: "post",
      service: "facebook",
      mediaUrl: "https://cdn.example/visual.png",
    });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.variables.input.assets).toEqual([{ image: { url: "https://cdn.example/visual.png" } }]);
    // No second key on the asset (oneOf: exactly one of image/video/...).
    expect(Object.keys(body.variables.input.assets[0])).toEqual(["image"]);

    await createPostForBuffer("tok-1", {
      channelId: "ch-1",
      text: "Text only",
      mode: "shareNow",
      contentKind: "post",
      service: "facebook",
    });
    const body2 = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(body2.variables.input.assets).toEqual([]);
  });

  it("plumbs firstComment into the per-channel metadata and omits it when empty", async () => {
    const fetchMock = stubSuccess("post-comment");
    vi.stubGlobal("fetch", fetchMock);
    await createPostForBuffer("tok-1", {
      channelId: "ch-1",
      text: "Hi",
      mode: "shareNow",
      contentKind: "post",
      service: "facebook",
      firstComment: "First! 👋",
    });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.variables.input.metadata).toEqual({ facebook: { type: "post", firstComment: "First! 👋" } });

    await createPostForBuffer("tok-1", {
      channelId: "ch-1",
      text: "Hi",
      mode: "shareNow",
      contentKind: "post",
      service: "facebook",
      firstComment: null,
    });
    const body2 = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(body2.variables.input.metadata).toEqual({ facebook: { type: "post" } });
    expect("firstComment" in body2.variables.input.metadata.facebook).toBe(false);
  });

  it("throws BEFORE the wire when contentKind is not exactly post/reel/story", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createPostForBuffer("tok-1", {
        channelId: "ch-1",
        text: "Hi",
        mode: "shareNow",
        contentKind: "carousel" as unknown as BufferPostType,
        service: "instagram",
      }),
    ).rejects.toThrow(/Invalid Buffer contentKind .* "post", "reel" or "story"/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when customScheduled is requested without dueAt (and never hits the wire)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createPostForBuffer("tok-1", {
        channelId: "ch-1",
        text: "Hi",
        mode: "customScheduled",
        contentKind: "post",
        service: "facebook",
      }),
    ).rejects.toThrow(/customScheduled requires dueAt/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns rejected when the 2xx payload carries a MutationError message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: { createPost: { message: "Channel paused" } } }), { status: 200 })),
    );
    const res = await createPostForBuffer("tok-1", {
      channelId: "ch-1",
      text: "Hi",
      mode: "shareNow",
      contentKind: "post",
      service: "facebook",
    });
    expect(res).toEqual({ ok: false, reason: "rejected", message: "Channel paused" });
  });

  it("returns rejected when the success payload carries no post id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: { createPost: {} } }), { status: 200 })),
    );
    const res = await createPostForBuffer("tok-1", {
      channelId: "ch-1",
      text: "Hi",
      mode: "shareNow",
      contentKind: "post",
      service: "facebook",
    });
    expect(res).toEqual({ ok: false, reason: "rejected", message: "Buffer createPost returned no post." });
  });
});

describe("429 rate-limit retry (bounded)", () => {
  /** Replace setTimeout with an immediate-execute stub that RECORDS the
   *  requested delay — the retry delays are asserted without real waits. */
  function stubImmediateTimers(): number[] {
    const delays: number[] = [];
    const immediate = ((fn: () => void, ms?: number) => {
      delays.push(ms ?? 0);
      fn();
      return 0 as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout;
    vi.stubGlobal("setTimeout", immediate);
    return delays;
  }

  it("retries a 429 up to twice (Retry-After first, then the fixed 5s) and succeeds", async () => {
    const delays = stubImmediateTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429, headers: { "retry-after": "1" } }))
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { createPost: { post: { id: "post-429" } } } }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const res = await createPostForBuffer("tok-1", {
      channelId: "ch-1",
      text: "Hi",
      mode: "shareNow",
      contentKind: "post",
      service: "facebook",
    });
    expect(res).toEqual({ ok: true, data: { id: "post-429", status: "sent", dueAt: null } });
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
    expect(delays).toEqual([1_000, 5_000]); // Retry-After won the first, fixed schedule the second
  });

  it("returns rate_limited after exhausting the 2 retries when every attempt 429s", async () => {
    const delays = stubImmediateTimers();
    const fetchMock = vi.fn(async () => new Response("{}", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await createPostForBuffer("tok-1", {
      channelId: "ch-1",
      text: "Hi",
      mode: "shareNow",
      contentKind: "post",
      service: "facebook",
    });
    expect(res).toEqual({ ok: false, reason: "rate_limited", message: "Buffer API error (HTTP 429)." });
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 + RATE_LIMIT_MAX_RETRIES
    expect(delays).toEqual([2_000, 5_000]); // fixed backoff schedule
  });

  it("caps a large Retry-After header at 10 seconds", async () => {
    const delays = stubImmediateTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429, headers: { "retry-after": "60" } }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { createPost: { post: { id: "post-capped" } } } }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const res = await createPostForBuffer("tok-1", {
      channelId: "ch-1",
      text: "Hi",
      mode: "shareNow",
      contentKind: "post",
      service: "facebook",
    });
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([10_000]); // min(60s, cap)
  });

  it("does NOT retry non-429 failures (single call)", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: "nope" }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await createPostForBuffer("tok-1", {
      channelId: "ch-1",
      text: "Hi",
      mode: "shareNow",
      contentKind: "post",
      service: "facebook",
    });
    expect(res.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("Buffer enums (GraphQL schema constants)", () => {
  it("PostTypeFacebook matches Buffer's documented enum", () => {
    expect(BufferPostTypeFacebook).toEqual({ post: "post", reel: "reel", story: "story" });
  });
  it("PostTypeInstagram exposes the subset this product publishes", () => {
    expect(BufferPostTypeInstagram.post).toBe("post");
    expect(BufferPostTypeInstagram.reel).toBe("reel");
    expect(BufferPostTypeInstagram.story).toBe("story");
    expect(BufferPostTypeInstagram.carousel).toBe("carousel");
    expect(BufferPostTypeInstagram.short).toBe("short");
  });
  it("ShareMode includes shareNow and customScheduled (the two modes this product sends)", () => {
    expect(BufferShareMode.shareNow).toBe("shareNow");
    expect(BufferShareMode.customScheduled).toBe("customScheduled");
    expect(BufferShareMode.addToQueue).toBe("addToQueue");
    expect(BufferShareMode.shareNext).toBe("shareNext");
  });
  it("SchedulingType includes automatic and notification", () => {
    expect(BufferSchedulingType.automatic).toBe("automatic");
    expect(BufferSchedulingType.notification).toBe("notification");
  });
});

describe("token envelope", () => {
  it("encrypts and decrypts an envelope round-trip via tokens.ts (refresh_token survives)", () => {
    const envelope: BufferTokenEnvelope = {
      accessToken: "buf-access-token-1",
      refreshToken: "buf-refresh-token-1",
      expiresAt: 4102444800000,
      grantedScopes: null,
    };
    const enc = encryptToken(JSON.stringify(envelope));
    expect(enc).not.toContain("buf-access-token-1");
    expect(enc).not.toContain("buf-refresh-token-1");
    const dec = decryptToken(enc);
    expect(dec).not.toBeNull();
    expect(decodeBufferTokenEnvelope(dec as string)).toEqual(envelope);
  });

  it("round-trips grantedScopes through encrypt/decrypt", () => {
    const envelope: BufferTokenEnvelope = {
      accessToken: "buf-access-token-2",
      refreshToken: "buf-refresh-token-2",
      expiresAt: 4102444800000,
      grantedScopes: "posts:read posts:write account:read offline_access",
    };
    const enc = encryptToken(JSON.stringify(envelope));
    const dec = decryptToken(enc);
    expect(dec).not.toBeNull();
    expect(decodeBufferTokenEnvelope(dec as string)).toEqual(envelope);
  });

  it("keeps refreshToken and derives expiresAt from expires_in", () => {
    const before = Date.now();
    const env = buildBufferTokenEnvelope({
      access_token: "tok",
      refresh_token: "ref",
      expires_in: 3600,
    });
    const after = Date.now();
    expect(env.accessToken).toBe("tok");
    expect(env.refreshToken).toBe("ref");
    expect(env.expiresAt).not.toBeNull();
    // expiresAt = captured now + 3600s (allow ±1ms clock boundary between reads)
    expect((env.expiresAt as number) - before).toBeGreaterThan(3600_000 - 2000);
    expect((env.expiresAt as number) - after).toBeLessThanOrEqual(3600_000 + 1);
  });

  it("copies the token scope into grantedScopes", () => {
    const env = buildBufferTokenEnvelope({ access_token: "tok", scope: "posts:read posts:write" });
    expect(env.grantedScopes).toBe("posts:read posts:write");
  });

  it("defaults missing refresh_token/expires_in/scope to null", () => {
    const env = buildBufferTokenEnvelope({ access_token: "tok" });
    expect(env).toEqual({ accessToken: "tok", refreshToken: null, expiresAt: null, grantedScopes: null });
  });

  it("returns null for malformed envelopes", () => {
    expect(decodeBufferTokenEnvelope("garbage")).toBeNull();
    expect(decodeBufferTokenEnvelope(JSON.stringify({ refreshToken: "x" }))).toBeNull();
    expect(decodeBufferTokenEnvelope(JSON.stringify({ accessToken: "" }))).toBeNull();
  });
});
