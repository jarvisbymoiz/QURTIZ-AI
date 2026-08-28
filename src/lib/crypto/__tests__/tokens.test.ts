import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";

describe("token encryption", () => {
  it("round-trips a token", () => {
    const secret = "EAAB-super-long-page-token-value";
    const enc = encryptToken(secret);
    expect(enc.startsWith("v1.")).toBe(true);
    expect(enc).not.toContain(secret);
    expect(decryptToken(enc)).toBe(secret);
  });

  it("produces different ciphertexts each time (random IV)", () => {
    expect(encryptToken("same")).not.toBe(encryptToken("same"));
  });

  it("returns null on tampering", () => {
    const enc = encryptToken("secret");
    const parts = enc.split(".");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(decryptToken(parts.join("."))).toBeNull();
  });

  it("returns null for malformed payloads", () => {
    expect(decryptToken("garbage")).toBeNull();
  });
});
