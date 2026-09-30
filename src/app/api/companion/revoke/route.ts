import { and, eq, inArray, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { companionDevices, companionImageJobs } from "@/db/schema";
import { authenticateCompanion } from "@/lib/companion/device-auth";

export const dynamic = "force-dynamic";

/** A companion can revoke only itself. An authenticated user may also revoke it in Settings. */
export async function POST(request: Request) {
  const device = await authenticateCompanion(request);
  if (!device) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await getDb().transaction(async tx => {
    await tx.update(companionDevices).set({ revokedAt: new Date(), chatgptConnected: false, updatedAt: new Date() })
      .where(and(eq(companionDevices.id, device.id), isNull(companionDevices.revokedAt)));
    await tx.update(companionImageJobs).set({ status: "failed", error: "Companion was disconnected.", updatedAt: new Date() })
      .where(and(eq(companionImageJobs.deviceId, device.id), eq(companionImageJobs.workspaceId, device.workspaceId),
        eq(companionImageJobs.userId, device.userId),
        inArray(companionImageJobs.status, ["queued", "waiting_for_companion", "claimed", "generating", "uploading"])));
  });
  return NextResponse.json({ revoked: true }, { headers: { "Cache-Control": "no-store" } });
}
