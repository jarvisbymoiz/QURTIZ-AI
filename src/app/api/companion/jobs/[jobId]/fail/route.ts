import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { companionImageJobs } from "@/db/schema";
import { authenticateJobClaim } from "@/lib/companion/job-claim";
import { readSmallJson } from "@/lib/companion/request-body";

export const dynamic = "force-dynamic";
const input = z.object({ message: z.string().min(1).max(400) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const claim = await authenticateJobClaim(request, jobId);
  if (!claim) return NextResponse.json({ error: "Unauthorized or expired image claim." }, { status: 401 });
  const parsed = input.safeParse(await readSmallJson(request, 512));
  if (!parsed.success) return NextResponse.json({ error: "Invalid failure report." }, { status: 400 });
  // The companion sends a short category, never raw upstream payloads or secrets.
  const allowed = new Set(["rate_limited", "account_disconnected", "image_unavailable", "gateway_error", "upload_failed"]);
  const error = allowed.has(parsed.data.message) ? parsed.data.message : "gateway_error";
  await getDb().update(companionImageJobs).set({ status: "failed", error, updatedAt: new Date() })
    .where(and(eq(companionImageJobs.id, jobId), eq(companionImageJobs.deviceId, claim.device.id),
      inArray(companionImageJobs.status, ["claimed", "generating", "uploading"])));
  return NextResponse.json({ status: "failed" }, { headers: { "Cache-Control": "no-store" } });
}
