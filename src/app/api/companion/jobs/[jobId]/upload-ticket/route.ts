import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { companionImageJobs } from "@/db/schema";
import { authenticateJobClaim } from "@/lib/companion/job-claim";
import { createServiceClient } from "@/lib/supabase/service";
import { readSmallJson } from "@/lib/companion/request-body";

export const dynamic = "force-dynamic";
const input = z.object({ mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  sizeBytes: z.number().int().min(100).max(7 * 1024 * 1024) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const claim = await authenticateJobClaim(request, jobId);
  if (!claim) return NextResponse.json({ error: "Unauthorized or expired image claim." }, { status: 401 });
  const parsed = input.safeParse(await readSmallJson(request, 512));
  if (!parsed.success) return NextResponse.json({ error: "Invalid image upload." }, { status: 400 });
  if (!["claimed", "generating"].includes(claim.job.status)) {
    return NextResponse.json({ error: "Image upload is already underway." }, { status: 409 });
  }
  const path = `${claim.device.workspaceId}/visuals/${claim.job.contentItemId ?? "tests"}/${claim.job.id}-raw`;
  const signed = await createServiceClient().storage.from("brand-assets").createSignedUploadUrl(path, { upsert: false });
  if (!signed.data?.signedUrl) return NextResponse.json({ error: "Could not authorize image upload." }, { status: 502 });
  const [updated] = await getDb().update(companionImageJobs).set({ status: "uploading", uploadPath: path,
    options: { ...(claim.job.options as Record<string, unknown>), uploadMimeType: parsed.data.mimeType,
      uploadSizeBytes: parsed.data.sizeBytes },
    leaseExpiresAt: new Date(Date.now() + 3 * 60_000), updatedAt: new Date() })
    .where(and(eq(companionImageJobs.id, claim.job.id), eq(companionImageJobs.deviceId, claim.device.id),
      inArray(companionImageJobs.status, ["claimed", "generating"])))
    .returning({ id: companionImageJobs.id });
  if (!updated) return NextResponse.json({ error: "Image job was claimed elsewhere." }, { status: 409 });
  return NextResponse.json({ path, uploadUrl: signed.data.signedUrl },
    { headers: { "Cache-Control": "no-store" } });
}
