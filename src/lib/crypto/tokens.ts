import crypto from "node:crypto";

/**
 * AES-256-GCM encryption for third-party access tokens.
 * Key source: ENCRYPTION_KEY env (64 hex chars = 32 bytes). A missing/invalid
 * key is fatal in EVERY environment — we never silently degrade to weak
 * crypto. Ciphertext written under the old deterministic dev fallback is
 * re-encrypted at boot by lib/crypto/key-migration (legacy decrypt only).
 */

/**
 * Shared key accessor for everything derived from ENCRYPTION_KEY (AES-GCM
 * here, HMAC signing in lib/workspace-delete). Same rules everywhere:
 * throws on a missing/invalid key in every environment — set a 64-char hex
 * ENCRYPTION_KEY.
 */
export function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey && /^[0-9a-f]{64}$/i.test(envKey)) {
    return Buffer.from(envKey, "hex");
  }
  throw new Error(
    "ENCRYPTION_KEY is missing or invalid (expected 64 hex chars = 32 bytes). " +
      "Set a 64-char hex ENCRYPTION_KEY in .env.local (dev) or the deployment environment.",
  );
}

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

/**
 * Internal: GCM-decrypt a v1 payload with an explicit key. Shared by
 * decryptToken (current env key) and the legacy migration path in
 * lib/crypto/key-migration — not for general use. Returns null for any
 * undecryptable/tampered payload; never throws.
 */
export function decryptWithKey(payload: string, key: Buffer): string | null {
  try {
    const [version, ivB64, tagB64, dataB64] = payload.split(".");
    if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Decrypts with the current ENCRYPTION_KEY. Returns null for undecryptable
 * payloads; throws only when the key itself is missing/invalid (fail-fast).
 */
export function decryptToken(payload: string): string | null {
  return decryptWithKey(payload, getEncryptionKey());
}
