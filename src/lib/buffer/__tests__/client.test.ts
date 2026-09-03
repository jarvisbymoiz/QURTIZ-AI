import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BUFFER_AUTHORIZE_URL,
  BUFFER_OAUTH_STATE_TTL_SECONDS,
  buildAuthorizeUrl,
  buildBufferTokenEnvelope,
  decodeBufferTokenEnvelope,
  filterSupportedBufferChannels,
  signBufferOAuthState,
  verifyBufferOAuthState,
  type BufferChannel,
} from "@/lib/buffer/client";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";

// Deterministic, valid 64-hex-char ENCRYPTION_KEY for this test file, so the
// HMAC key derivation matches getEncryptionKey() exactly (no dev fallback).
const ENCRYPTION_KEY = "ab".repeat(32);
const BUFFER_CLIENT_ID = "buffer-client-id-123";
const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const REDIRECT_URI = "https://qurtiz.example/api/buffer/callback";

function hmacHex(payload: string): string {
  return crypto
    .createHmac("sha256", Buffer.from(ENCRYPTION_KEY, "hex"))
    .update(payload, "utf8")
    .digest("hex");
}

beforeAll(() => {
  process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
  process.env.BUFFER_CLIENT_ID = BUFFER_CLIENT_ID;
});

afterAll(() => {
  delete process.env.ENCRYPTION_KEY;
  delete process.env.BUFFER_CLIENT_ID;
});

describe("buildAuthorizeUrl", () => {
  it("builds the Buffer authorize URL with client_id, redirect_uri, response_type and state", () => {
    const url = buildAuthorizeUrl({ redirectUri: REDIRECT_URI, state: "state-abc" });
    expect(url.startsWith(`${BUFFER_AUTHORIZE_URL}?`)).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get("client_id")).toBe(BUFFER_CLIENT_ID);
    expect(params.get("redirect_uri")).toBe(REDIRECT_URI);
    expect(params.get("response_type")).toBe("code");
    expect(params.get("state")).toBe("state-abc");
  });

  it("throws an honest error when BUFFER_CLIENT_ID is unset", () => {
    const prev = process.env.BUFFER_CLIENT_ID;
    delete process.env.BUFFER_CLIENT_ID;
    try {
      expect(() => buildAuthorizeUrl({ redirectUri: REDIRECT_URI, state: "s" })).toThrow(/BUFFER_CLIENT_ID/);
    } finally {
      process.env.BUFFER_CLIENT_ID = prev;
    }
  });
});

describe("buffer OAuth state marker", () => {
  it("signs a token that verifies back to its workspace + user scope", () => {
    const token = signBufferOAuthState({ workspaceId: WORKSPACE_ID, userId: USER_ID });
    expect(verifyBufferOAuthState(token)).toEqual({ workspaceId: WORKSPACE_ID, userId: USER_ID });
  });

  it("produces workspaceId.userId.exp.hmac with a 10-minute expiry", () => {
    const token = signBufferOAuthState({ workspaceId: WORKSPACE_ID, userId: USER_ID });
    const parts = token.split(".");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe(WORKSPACE_ID);
    expect(parts[1]).toBe(USER_ID);
    const exp = Number(parts[2]);
    const now = Math.floor(Date.now() / 1000);
    expect(Number.isSafeInteger(exp)).toBe(true);
    expect(exp).toBeGreaterThan(now);
    expect(exp).toBeLessThanOrEqual(now + BUFFER_OAUTH_STATE_TTL_SECONDS);
    expect(parts[3]).toBe(hmacHex(parts.slice(0, 3).join(".")));
  });

  it("rejects an expired token", () => {
    const exp = Math.floor(Date.now() / 1000) - 60;
    const payload = `${WORKSPACE_ID}.${USER_ID}.${exp}`;
    expect(verifyBufferOAuthState(`${payload}.${hmacHex(payload)}`)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = signBufferOAuthState({ workspaceId: WORKSPACE_ID, userId: USER_ID });
    const parts = token.split(".");
    parts[3] = "0".repeat(64);
    expect(verifyBufferOAuthState(parts.join("."))).toBeNull();
  });

  it("rejects tampered scope (workspace/user swapped) and malformed tokens without throwing", () => {
    const token = signBufferOAuthState({ workspaceId: WORKSPACE_ID, userId: USER_ID });
    const parts = token.split(".");
    const tampered = [parts[1], parts[0], parts[2], parts[3]].join(".");
    expect(verifyBufferOAuthState(tampered)).toBeNull();
    expect(verifyBufferOAuthState("")).toBeNull();
    expect(verifyBufferOAuthState("garbage")).toBeNull();
    expect(verifyBufferOAuthState(`${WORKSPACE_ID}.${USER_ID}.`)).toBeNull();
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
