import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { companionDevices, companionPairingChallenges } from "@/db/schema";
import { hashCompanionSecret, hashPairingChallenge } from "@/lib/companion/device-auth";
import { readSmallJson } from "@/lib/companion/request-body";

export const dynamic = "force-dynamic";
const input = z.object({ challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  displayName: z.string().min(1).max(64).regex(/^[^\x00-\x1f\x7f]+$/),
  userId: z.string().uuid(), workspaceId: z.string().uuid() }).strict();

export async function POST(request: Request) {
  const body = await readSmallJson(request);
  const parsed = input.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid pairing request." }, { status: 400 });
  const challengeHash = hashPairingChallenge(parsed.data.challenge);
  const result = await getDb().transaction(async tx => {
    const [challenge] = await tx.select().from(companionPairingChallenges)
      .where(and(eq(companionPairingChallenges.challengeHash, challengeHash),
        isNull(companionPairingChallenges.consumedAt), gt(companionPairingChallenges.expiresAt, new Date())))
      .for("update").limit(1);
    if (!challenge || challenge.userId !== parsed.data.userId || challenge.workspaceId !== parsed.data.workspaceId) return null;
    const id = randomUUID();
    const secret = randomBytes(32).toString("base64url");
    await tx.update(companionPairingChallenges).set({ consumedAt: new Date() })
      .where(eq(companionPairingChallenges.id, challenge.id));
    await tx.insert(companionDevices).values({ id, workspaceId: challenge.workspaceId,
      userId: challenge.userId, displayName: parsed.data.displayName,
      credentialHash: hashCompanionSecret(secret) });
    return { id, credential: `${id}.${secret}` };
  });
  if (!result) return NextResponse.json({ error: "Pairing challenge expired or was already used." }, { status: 410 });
  return NextResponse.json({ deviceId: result.id, credential: result.credential },
    { headers: { "Cache-Control": "no-store" } });
}
