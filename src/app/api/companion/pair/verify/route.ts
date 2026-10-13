import { and, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { companionPairingChallenges } from "@/db/schema";
import { hashPairingChallenge } from "@/lib/companion/device-auth";
import { readSmallJson } from "@/lib/companion/request-body";
import { getMembership } from "@/lib/workspace";
import { can } from "@/lib/permissions";
export const dynamic = "force-dynamic";
const input = z.object({ challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/), userId: z.string().uuid(), workspaceId: z.string().uuid() }).strict();
/** Validates a short-lived server-issued proof. Does not return credentials or consume cloud pairing. */
export async function POST(request: Request) {
  const parsed = input.safeParse(await readSmallJson(request));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const [proof] = await getDb().select({ id: companionPairingChallenges.id }).from(companionPairingChallenges)
    .where(and(eq(companionPairingChallenges.challengeHash, hashPairingChallenge(parsed.data.challenge)),
      eq(companionPairingChallenges.userId, parsed.data.userId), eq(companionPairingChallenges.workspaceId, parsed.data.workspaceId),
      isNull(companionPairingChallenges.consumedAt), gt(companionPairingChallenges.expiresAt, new Date()))).limit(1);
  const membership = proof ? await getMembership(parsed.data.userId, parsed.data.workspaceId) : null;
  const ok = !!membership && can(membership.role, "brand:write");
  return NextResponse.json({ ok }, { status: ok ? 200 : 403, headers: { "Cache-Control": "no-store" } });
}
