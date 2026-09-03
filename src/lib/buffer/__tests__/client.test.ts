import crypto from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BUFFER_AUTHORIZE_URL,
  BUFFER_OAUTH_STATE_TTL_SECONDS,
  BUFFER_TOKEN_URL,
  buildAuthorizeUrl,
  buildBufferTokenEnvelope,
  decodeBufferTokenEnvelope,
  exchangeCode,
  filterSupportedBufferChannels,
  generatePkcePair,
  listChannels,
  pkceChallenge,
  pkceVerifier,
  signBufferOAuthState,
  verifyBufferOAuthState,
  type BufferChannel,
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
    { id: "c2", service: "instagram", username: "acct_b", default: true },
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

describe("listChannels", () => {
  it("parses a top-level array payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              { id: "p1", service: "facebook", formatted_username: "Page A", avatar: "https://example.com/a.png", default: true },
              { id: "p2", service: "twitter", username: "tweets" },
            ]),
            { status: 200 },
          ),
      ),
    );
    const res = await listChannels("tok-1");
    expect(res).toEqual({
      ok: true,
      data: [
        { id: "p1", service: "facebook", username: "Page A", avatar: "https://example.com/a.png", default: true },
        { id: "p2", service: "twitter", username: "tweets" },
      ],
    });
  });

  it("parses a { profiles: [...] } payload with fallback field names", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              profiles: [
                { id: 1234, type: "instagram", username: "acct_b", profile_image: "https://example.com/b.png" },
                { id: "c8", service_type: "facebook", name: "Page C" },
              ],
            }),
            { status: 200 },
          ),
      ),
    );
    const res = await listChannels("tok-1");
    expect(res).toEqual({
      ok: true,
      data: [
        { id: "1234", service: "instagram", username: "acct_b", avatar: "https://example.com/b.png" },
        { id: "c8", service: "facebook", username: "Page C" },
      ],
    });
  });

  it("parses a { data: [...] } payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: [{ id: "c9", service: "instagram", formatted_username: "acct_9", default: false }],
            }),
            { status: 200 },
          ),
      ),
    );
    const res = await listChannels("tok-1");
    expect(res).toEqual({
      ok: true,
      data: [{ id: "c9", service: "instagram", username: "acct_9", default: false }],
    });
  });

  it("drops unparseable entries instead of failing the whole list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([{ id: "ok", service: "facebook", username: "Page" }, { id: null, service: "x" }, 42]),
            { status: 200 },
          ),
      ),
    );
    const res = await listChannels("tok-1");
    expect(res).toEqual({ ok: true, data: [{ id: "ok", service: "facebook", username: "Page" }] });
  });

  it("returns invalid_response for a 2xx payload that is none of the known shapes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ foo: "bar" }), { status: 200 })));
    const res = await listChannels("tok-1");
    expect(res).toEqual({
      ok: false,
      reason: "invalid_response",
      message: "Buffer profiles.json returned an unexpected payload.",
    });
  });

  it("surfaces HTTP failures as typed results", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "token expired" }), { status: 401 })));
    const res = await listChannels("expired-tok");
    expect(res).toEqual({ ok: false, reason: "auth", message: "token expired" });
  });
});

describe("token envelope", () => {
  it("encrypts and decrypts an envelope round-trip via tokens.ts", () => {
    const envelope = { accessToken: "buf-access-token-1", refreshToken: null, expiresAt: null };
    const enc = encryptToken(JSON.stringify(envelope));
    expect(enc).not.toContain("buf-access-token-1");
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

  it("defaults missing refresh_token/expires_in to null", () => {
    const env = buildBufferTokenEnvelope({ access_token: "tok" });
    expect(env).toEqual({ accessToken: "tok", refreshToken: null, expiresAt: null });
  });

  it("returns null for malformed envelopes", () => {
    expect(decodeBufferTokenEnvelope("garbage")).toBeNull();
    expect(decodeBufferTokenEnvelope(JSON.stringify({ refreshToken: "x" }))).toBeNull();
    expect(decodeBufferTokenEnvelope(JSON.stringify({ accessToken: "" }))).toBeNull();
  });
});
