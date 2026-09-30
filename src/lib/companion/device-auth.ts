import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { companionDevices } from "@/db/schema";

const TOKEN_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{40,80})$/i;

export function hashCompanionSecret(secret: string): string {
  return createHash("sha256").update(`qurtiz-device-v1:${secret}`).digest("hex");
}

export function hashPairingChallenge(challenge: string): string {
  return createHash("sha256").update(`qurtiz-pair-v1:${challenge}`).digest("hex");
}

export async function authenticateCompanion(request: Request, options?: { allowRevoked?: boolean }) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return null;
  const match = TOKEN_PATTERN.exec(authorization.slice(7));
  if (!match) return null;
  const [device] = await getDb().select().from(companionDevices)
    .where(eq(companionDevices.id, match[1])).limit(1);
  if (!device || (device.revokedAt && !options?.allowRevoked)) return null;
  const actual = Buffer.from(hashCompanionSecret(match[2]), "hex");
  const expected = Buffer.from(device.credentialHash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return device;
}
