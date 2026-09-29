import { NextRequest, NextResponse } from "next/server";
import { autopilotLoop, refreshPendingDeliveryNotifications } from "@/lib/jobs/workflows";
import { reconcileBufferDeliveries } from "@/lib/publishing/service";
import { mediaCleanupTick } from "@/lib/media/cleanup-worker";
import { and, eq, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { jobs } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Cron is not configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const results = await Promise.allSettled([
    reconcileBufferDeliveries().then(() => refreshPendingDeliveryNotifications()), autopilotLoop(), mediaCleanupTick(),
    getDb().update(jobs).set({ status: "failed", error: "Local image request expired before completion.", updatedAt: new Date() })
      .where(and(eq(jobs.type, "local_image"), eq(jobs.status, "queued"),
        lt(jobs.createdAt, new Date(Date.now() - 10 * 60_000)))),
    getDb().update(jobs).set({ status: "failed", error: "Local image save timed out.", updatedAt: new Date() })
      .where(and(eq(jobs.type, "local_image"), eq(jobs.status, "running"),
        lt(jobs.updatedAt, new Date(Date.now() - 30 * 60_000)))),
  ]);
  const failed = results.filter(r => r.status === "rejected");
  if (failed.length) console.error("[cron/maintenance] Failed tasks", failed.length);
  return NextResponse.json({ ok: failed.length === 0 }, { status: failed.length ? 500 : 200 });
}
