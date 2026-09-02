import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  signWorkspaceDeleteToken,
  verifyWorkspaceDeleteToken,
  WORKSPACE_DELETE_TOKEN_TTL_SECONDS,
} from "@/lib/workspace-delete";

// Deterministic, valid 64-hex-char ENCRYPTION_KEY for this test file, so the
// HMAC key derivation matches getEncryptionKey() exactly (no dev fallback).
const ENCRYPTION_KEY = "ab".repeat(32);
const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ID = "33333333-3333-4333-8333-333333333333";

function hmacHex(payload: string): string {
  return crypto
    .createHmac("sha256", Buffer.from(ENCRYPTION_KEY, "hex"))
    .update(payload, "utf8")
    .digest("hex");
}

beforeAll(() => {
  process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
});

afterAll(() => {
  delete process.env.ENCRYPTION_KEY;
});

describe("workspace delete token", () => {
  it("signs a token that verifies for the same workspace + user", () => {
    const token = signWorkspaceDeleteToken({ workspaceId: WORKSPACE_ID, userId: USER_ID });
    expect(verifyWorkspaceDeleteToken(token, { workspaceId: WORKSPACE_ID, userId: USER_ID })).toBe(true);
  });

  it("produces workspaceId.userId.exp.hmac", () => {
    const token = signWorkspaceDeleteToken({ workspaceId: WORKSPACE_ID, userId: USER_ID });
    const parts = token.split(".");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe(WORKSPACE_ID);
    expect(parts[1]).toBe(USER_ID);
    const exp = Number(parts[2]);
    expect(Number.isSafeInteger(exp)).toBe(true);
    const now = Math.floor(Date.now() / 1000);
    expect(exp).toBeGreaterThan(now);
    expect(exp).toBeLessThanOrEqual(now + WORKSPACE_DELETE_TOKEN_TTL_SECONDS);
    expect(parts[3]).toBe(hmacHex(parts.slice(0, 3).join(".")));
  });

  it("rejects a token minted for a different workspace", () => {
    const token = signWorkspaceDeleteToken({ workspaceId: WORKSPACE_ID, userId: USER_ID });
    expect(verifyWorkspaceDeleteToken(token, { workspaceId: OTHER_ID, userId: USER_ID })).toBe(false);
  });

  it("rejects a token minted for a different user", () => {
    const token = signWorkspaceDeleteToken({ workspaceId: WORKSPACE_ID, userId: USER_ID });
    expect(verifyWorkspaceDeleteToken(token, { workspaceId: WORKSPACE_ID, userId: OTHER_ID })).toBe(false);
  });

  it("rejects an expired token", () => {
    const exp = Math.floor(Date.now() / 1000) - 60;
    const payload = `${WORKSPACE_ID}.${USER_ID}.${exp}`;
    const token = `${payload}.${hmacHex(payload)}`;
    expect(verifyWorkspaceDeleteToken(token, { workspaceId: WORKSPACE_ID, userId: USER_ID })).toBe(false);
  });

  it("rejects a tampered signature", () => {
    const token = signWorkspaceDeleteToken({ workspaceId: WORKSPACE_ID, userId: USER_ID });
    const parts = token.split(".");
    parts[3] = "0".repeat(64);
    expect(verifyWorkspaceDeleteToken(parts.join("."), { workspaceId: WORKSPACE_ID, userId: USER_ID })).toBe(false);
  });

  it("rejects malformed tokens without throwing", () => {
    expect(verifyWorkspaceDeleteToken("", { workspaceId: WORKSPACE_ID, userId: USER_ID })).toBe(false);
    expect(verifyWorkspaceDeleteToken("garbage", { workspaceId: WORKSPACE_ID, userId: USER_ID })).toBe(false);
    expect(
      verifyWorkspaceDeleteToken(`${WORKSPACE_ID}.${USER_ID}.`, { workspaceId: WORKSPACE_ID, userId: USER_ID }),
    ).toBe(false);
    expect(
      verifyWorkspaceDeleteToken(
        `${WORKSPACE_ID}.${USER_ID}.not-a-number.${hmacHex(`${WORKSPACE_ID}.${USER_ID}.not-a-number`)}`,
        { workspaceId: WORKSPACE_ID, userId: USER_ID },
      ),
    ).toBe(false);
  });

  it("rejects an empty-signature token", () => {
    const token = signWorkspaceDeleteToken({ workspaceId: WORKSPACE_ID, userId: USER_ID });
    const parts = token.split(".");
    parts[3] = "";
    expect(verifyWorkspaceDeleteToken(parts.join("."), { workspaceId: WORKSPACE_ID, userId: USER_ID })).toBe(false);
  });
});
