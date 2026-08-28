import crypto from "node:crypto";

/**
 * AES-256-GCM encryption for third-party access tokens.
 * Key source: ENCRYPTION_KEY env (64 hex chars = 32 bytes). A dev fallback
 * derived from DATABASE_URL exists so local setup is frictionless, but
 * production must set a dedicated key.
 */
function getKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey && /^[0-9a-f]{64}$/i.test(envKey)) {
    return Buffer.from(envKey, "hex");
  }
  // Deterministic dev fallback (documented in SECURITY notes).
  return crypto.createHash("sha256").update(`qurtiz-dev::${process.env.DATABASE_URL ?? "no-db"}`).digest();
}

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptToken(payload: string): string | null {
  try {
    const [version, ivB64, tagB64, dataB64] = payload.split(".");
    if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}
