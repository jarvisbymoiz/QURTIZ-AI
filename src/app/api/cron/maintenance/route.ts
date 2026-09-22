import { NextRequest, NextResponse } from "next/server";
import { autopilotLoop, refreshPendingDeliveryNotifications } from "@/lib/jobs/workflows";
import { reconcileBufferDeliveries } from "@/lib/publishing/service";
import { mediaCleanupTick } from "@/lib/media/cleanup-worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 800;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Cron is not configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const results = await Promise.allSettled([
    reconcileBufferDeliveries().then(() => refreshPendingDeliveryNotifications()), autopilotLoop(), mediaCleanupTick(),
  ]);
  const failed = results.filter(r => r.status === "rejected");
  if (failed.length) console.error("[cron/maintenance] Failed tasks", failed.length);
  return NextResponse.json({ ok: failed.length === 0 }, { status: failed.length ? 500 : 200 });
}
