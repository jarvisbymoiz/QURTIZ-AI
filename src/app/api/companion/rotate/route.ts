import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { companionDevices } from "@/db/schema";
import { authenticateCompanion, hashCompanionSecret } from "@/lib/companion/device-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const device = await authenticateCompanion(request);
  if (!device) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const secret = randomBytes(32).toString("base64url");
  const [rotated] = await getDb().update(companionDevices).set({ credentialHash: hashCompanionSecret(secret),
    credentialVersion: device.credentialVersion + 1, updatedAt: new Date() })
    .where(and(eq(companionDevices.id, device.id), eq(companionDevices.credentialHash, device.credentialHash),
      isNull(companionDevices.revokedAt))).returning({ id: companionDevices.id });
  if (!rotated) return NextResponse.json({ error: "Credential changed; pair this PC again." }, { status: 409 });
  return NextResponse.json({ deviceId: device.id, credential: `${device.id}.${secret}` },
    { headers: { "Cache-Control": "no-store" } });
}
