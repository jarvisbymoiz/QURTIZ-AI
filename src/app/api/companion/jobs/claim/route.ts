import { randomBytes, createHash } from "node:crypto";
import { and, asc, eq, gt, inArray, isNull, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { brandAssets, companionDevices, companionImageJobs } from "@/db/schema";
import { authenticateCompanion } from "@/lib/companion/device-auth";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const device = await authenticateCompanion(request);
  if (!device) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  const now = new Date();
  const claim = await db.transaction(async tx => {
    await tx.update(companionDevices).set({ lastSeenAt: now, updatedAt: now })
      .where(and(eq(companionDevices.id, device.id), isNull(companionDevices.revokedAt)));
    await tx.update(companionImageJobs).set({ status: "failed", error: "Companion wait timed out.", updatedAt: now })
      .where(and(eq(companionImageJobs.deviceId, device.id),
        inArray(companionImageJobs.status, ["queued", "waiting_for_companion"]),
        isNull(companionImageJobs.claimTokenHash),
        // Expires before claim; never retries an uncertain generation.
        // SQL timestamp comparison is deliberately server-side.
        lt(companionImageJobs.expiresAt, now)));
    const [job] = await tx.select().from(companionImageJobs)
      .where(and(eq(companionImageJobs.deviceId, device.id), eq(companionImageJobs.workspaceId, device.workspaceId),
        eq(companionImageJobs.userId, device.userId),
        inArray(companionImageJobs.status, ["queued", "waiting_for_companion"]),
        gt(companionImageJobs.expiresAt, now)))
      .orderBy(asc(companionImageJobs.createdAt)).limit(1).for("update", { skipLocked: true });
    if (!job) return null;
    const secret = randomBytes(32).toString("base64url");
    await tx.update(companionImageJobs).set({ status: "claimed",
      claimTokenHash: createHash("sha256").update(`qurtiz-claim-v1:${secret}`).digest("hex"),
      leaseExpiresAt: new Date(Date.now() + 6 * 60_000), updatedAt: now })
      .where(and(eq(companionImageJobs.id, job.id), eq(companionImageJobs.deviceId, device.id)));
    return { job, claimToken: secret };
  });
  if (!claim) return NextResponse.json({ job: null }, { headers: { "Cache-Control": "no-store" } });

  const references: { mimeType: string; url: string }[] = [];
  const requested = Array.isArray(claim.job.referenceAssets) ? claim.job.referenceAssets.slice(0, 1) : [];
  for (const ref of requested) {
    const id = typeof ref === "object" && ref !== null ? (ref as { id?: unknown }).id : null;
    if (typeof id !== "string") break;
    const [asset] = await db.select({ storagePath: brandAssets.storagePath, mimeType: brandAssets.mimeType })
      .from(brandAssets).where(and(eq(brandAssets.id, id), eq(brandAssets.workspaceId, device.workspaceId),
        eq(brandAssets.cleanupStatus, "permanent"), gt(brandAssets.refCount, 0))).limit(1);
    if (!asset || !asset.storagePath.startsWith(`${device.workspaceId}/`)) break;
    const signed = await createServiceClient().storage.from("brand-assets").createSignedUrl(asset.storagePath, 120);
    if (!signed.data?.signedUrl) break;
    references.push({ mimeType: asset.mimeType, url: signed.data.signedUrl });
  }
  if (requested.length !== references.length) {
    await db.update(companionImageJobs).set({ status: "failed", error: "Brand reference could not be loaded.",
      updatedAt: new Date() }).where(and(eq(companionImageJobs.id, claim.job.id),
        eq(companionImageJobs.deviceId, device.id), eq(companionImageJobs.status, "claimed")));
    return NextResponse.json({ error: "Brand reference could not be loaded." }, { status: 409 });
  }
  return NextResponse.json({ job: { id: claim.job.id, claimToken: claim.claimToken,
    prompt: claim.job.prompt, size: claim.job.size,
    quality: (claim.job.options as { quality?: string })?.quality === "low" ? "low" : "high", references } },
  { headers: { "Cache-Control": "no-store" } });
}
