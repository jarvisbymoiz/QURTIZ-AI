import { NextRequest, NextResponse } from "next/server";
import { validCronAuthorization } from "@/lib/jobs/cron-auth";
import { publishDueScan } from "@/lib/jobs/workflows";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Hobby's maximum function duration is 300 seconds with Fluid Compute.
// Longer jobs require a persistent worker or a higher-duration Vercel plan.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "Cron is not configured" }, { status: 503 });
  }
  if (!validCronAuthorization(authHeader, cronSecret, "publish")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // A bounded parallel batch lets sibling platform jobs start together,
    // without adding several full media-processing budgets sequentially.
    // Overlapping cron invocations safely lose already-taken row claims.
    const scan = await publishDueScan({ limit: 5, parallel: true, reconcile: false });
    console.info("[cron/publish]", scan);
    return NextResponse.json({ ok: scan.interrupted === 0, ...scan, timestamp: new Date().toISOString() }, { status: scan.interrupted ? 500 : 200 });
  } catch (error) {
    console.error("[cron/publish error]", error);
    return NextResponse.json(
      { ok: false, error: "Cron execution failed; check server logs" },
      { status: 500 },
    );
  }
}
