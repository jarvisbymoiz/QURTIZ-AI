"use server";

import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { companionDevices, companionPairingChallenges, companionImageJobs } from "@/db/schema";
import { hashPairingChallenge } from "@/lib/companion/device-auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { getActiveContext } from "@/lib/workspace";

/** The challenge is sent to the local companion once; no device credential enters the browser. */
export async function beginCompanionPairingAction() {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false as const, error: ctx.error };
  if (!rateLimit(`companion-pair:${ctx.workspaceId}:${ctx.userId}`, 5, 10 * 60_000).allowed) {
    return { ok: false as const, error: "Too many pairing attempts. Try again later." };
  }
  const challenge = randomBytes(32).toString("base64url");
  await getDb().insert(companionPairingChallenges).values({
    workspaceId: ctx.workspaceId, userId: ctx.userId,
    challengeHash: hashPairingChallenge(challenge),
    expiresAt: new Date(Date.now() + 5 * 60_000),
  });
  return { ok: true as const, challenge, expiresAt: Date.now() + 5 * 60_000 };
}

export async function listCompanionDevicesAction() {
  const ctx = await getActiveContext("brand:read");
  if ("error" in ctx) return { ok: false as const, error: ctx.error };
  const rows = await getDb().select({ id: companionDevices.id, displayName: companionDevices.displayName,
    chatgptConnected: companionDevices.chatgptConnected, imageStatus: companionDevices.imageStatus,
    lastSeenAt: companionDevices.lastSeenAt, createdAt: companionDevices.createdAt })
    .from(companionDevices).where(and(eq(companionDevices.workspaceId, ctx.workspaceId),
      eq(companionDevices.userId, ctx.userId), isNull(companionDevices.revokedAt)))
    .orderBy(sql`CASE WHEN ${companionDevices.lastSeenAt} > now() - interval '60 seconds' THEN 0 ELSE 1 END`,
      desc(companionDevices.lastSeenAt), desc(companionDevices.createdAt)).limit(10);
  return { ok: true as const, devices: rows.map(row => ({ ...row,
    online: !!row.lastSeenAt && Date.now() - row.lastSeenAt.getTime() < 60_000 })) };
}

export async function revokeCompanionDeviceAction(deviceId: string) {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false as const, error: ctx.error };
  if (!z.string().uuid().safeParse(deviceId).success) return { ok: false as const, error: "Invalid companion." };
  const [revoked] = await getDb().update(companionDevices).set({ revokedAt: new Date(),
    chatgptConnected: false, updatedAt: new Date() })
    .where(and(eq(companionDevices.id, deviceId), eq(companionDevices.workspaceId, ctx.workspaceId),
      eq(companionDevices.userId, ctx.userId), isNull(companionDevices.revokedAt)))
    .returning({ id: companionDevices.id });
  if (!revoked) return { ok: false as const, error: "Companion was already removed or belongs to another workspace." };
  await getDb().update(companionImageJobs).set({ status: "failed", error: "Companion was disconnected.", updatedAt: new Date() })
    .where(and(eq(companionImageJobs.deviceId, deviceId), eq(companionImageJobs.workspaceId, ctx.workspaceId),
      eq(companionImageJobs.userId, ctx.userId),
      inArray(companionImageJobs.status, ["queued", "waiting_for_companion", "claimed", "generating", "uploading"])));
  return { ok: true as const };
}
