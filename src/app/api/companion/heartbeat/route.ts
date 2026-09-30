import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { companionDevices } from "@/db/schema";
import { authenticateCompanion } from "@/lib/companion/device-auth";
import { readSmallJson } from "@/lib/companion/request-body";

export const dynamic = "force-dynamic";
const input = z.object({ chatgptConnected: z.boolean(),
  imageStatus: z.enum(["available", "rate_limited", "unavailable"]) }).strict();

export async function POST(request: Request) {
  const device = await authenticateCompanion(request, { allowRevoked: true });
  if (!device) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (device.revokedAt) return NextResponse.json({ error: "Device revoked" }, { status: 410 });
  const parsed = input.safeParse(await readSmallJson(request, 512));
  if (!parsed.success) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  const now = new Date();
  await getDb().update(companionDevices).set({ lastSeenAt: now, updatedAt: now,
    chatgptConnected: parsed.data.chatgptConnected, imageStatus: parsed.data.imageStatus })
    .where(and(eq(companionDevices.id, device.id), eq(companionDevices.workspaceId, device.workspaceId),
      eq(companionDevices.userId, device.userId), isNull(companionDevices.revokedAt)));
  return NextResponse.json({ online: true }, { headers: { "Cache-Control": "no-store" } });
}
