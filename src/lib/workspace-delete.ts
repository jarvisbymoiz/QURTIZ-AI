import crypto from "node:crypto";
import { getEncryptionKey } from "@/lib/crypto/tokens";

/**
 * Workspace-delete authorization marker.
 *
 * Deleting a workspace is a destructive, irreversible action, so it needs a
 * stronger gate than the session alone: the owner's email address must be
 * confirmed via a Supabase email OTP FIRST (either the emailed link, handled
 * by /auth/workspace-delete, or the 6-digit code typed into the settings
 * dialog). Only after that verification succeeds is an HMAC-SHA256 signed,
 * expiring (15 min) token minted and stored in the httpOnly `qurtiz_ws_delete`
 * cookie. The final delete server action refuses to run without a valid
 * token bound to (workspaceId, userId).
 *
 * The HMAC key is derived from the same ENCRYPTION_KEY used for token
 * encryption in lib/crypto/tokens (shared accessor — no new env var).
 */
export const WORKSPACE_DELETE_COOKIE = "qurtiz_ws_delete";

/** Tokens die after 15 minutes — the user must finish the flow in time. */
export const WORKSPACE_DELETE_TOKEN_TTL_SECONDS = 15 * 60;

type DeleteScope = { workspaceId: string; userId: string };

/** Builds `workspaceId.userId.exp.hmac` for a freshly OTP-verified owner. */
export function signWorkspaceDeleteToken({ workspaceId, userId }: DeleteScope): string {
  const exp = Math.floor(Date.now() / 1000) + WORKSPACE_DELETE_TOKEN_TTL_SECONDS;
  const payload = `${workspaceId}.${userId}.${exp}`;
  const hmac = crypto.createHmac("sha256", getEncryptionKey()).update(payload, "utf8").digest("hex");
  return `${payload}.${hmac}`;
}

/**
 * Validates shape, expiry, scope (workspace + user) and signature of a
 * workspace-delete token. Comparison is timing-safe; anything malformed or
 * tampered with returns false. Never throws.
 */
export function verifyWorkspaceDeleteToken(
  token: string,
  { workspaceId, userId }: DeleteScope,
): boolean {
  try {
    const [ws, uid, expStr, sig, ...extra] = token.split(".");
    if (extra.length > 0 || !ws || !uid || !expStr || !sig) return false;
    if (ws !== workspaceId || uid !== userId) return false;
    const exp = Number(expStr);
    if (!Number.isSafeInteger(exp) || exp <= Math.floor(Date.now() / 1000)) return false;
    const expected = crypto
      .createHmac("sha256", getEncryptionKey())
      .update(`${ws}.${uid}.${expStr}`, "utf8")
      .digest("hex");
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}
