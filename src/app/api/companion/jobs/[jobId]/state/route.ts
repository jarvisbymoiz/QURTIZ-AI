import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { companionImageJobs } from "@/db/schema";
import { authenticateJobClaim } from "@/lib/companion/job-claim";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const claim = await authenticateJobClaim(request, jobId);
  if (!claim) return NextResponse.json({ error: "Unauthorized or expired image claim." }, { status: 401 });
  if (claim.job.status !== "claimed") return NextResponse.json({ error: "Invalid image state." }, { status: 409 });
  const [updated] = await getDb().update(companionImageJobs).set({ status: "generating", updatedAt: new Date() })
    .where(and(eq(companionImageJobs.id, jobId), eq(companionImageJobs.deviceId, claim.device.id),
      eq(companionImageJobs.status, "claimed"))).returning({ id: companionImageJobs.id });
  if (!updated) return NextResponse.json({ error: "Invalid image state." }, { status: 409 });
  return NextResponse.json({ status: "generating" }, { headers: { "Cache-Control": "no-store" } });
}
