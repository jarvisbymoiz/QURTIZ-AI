import { NextRequest, NextResponse } from "next/server";
import { publishDueScan, autopilotLoop } from "@/lib/jobs/workflows";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60s for Vercel Pro/Hobby

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "Cron is not configured" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await publishDueScan();
    await autopilotLoop();
    // Hourly media cleanup runs alongside the publishing cron so serverless
    // deployments (no persistent pg-boss) get the same lifecycle guarantees
    // as self-hosted instances. Cheap when nothing is queued; bounded so
    // a 60s cron budget isn't blown.
    try {
      const { mediaCleanupTick } = await import("@/lib/media/cleanup-worker");
      await mediaCleanupTick();
    } catch (error) {
      console.error("[cron/media-cleanup]", error instanceof Error ? error.message : error);
    }
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("[cron/publish error]", error);
    return NextResponse.json(
      { ok: false, error: "Cron execution failed; check server logs" },
      { status: 500 },
    );
  }
}
