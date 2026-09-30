import { NextResponse } from "next/server";
import { authenticateCompanion } from "@/lib/companion/device-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const device = await authenticateCompanion(request, { allowRevoked: true });
  if (!device) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (device.revokedAt) return NextResponse.json({ error: "Device revoked" }, { status: 410 });
  return NextResponse.json({ deviceId: device.id, workspaceId: device.workspaceId,
    userId: device.userId }, { headers: { "Cache-Control": "no-store" } });
}
