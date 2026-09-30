import { NextRequest, NextResponse } from "next/server";
import { autopilotLoop, refreshPendingDeliveryNotifications } from "@/lib/jobs/workflows";
import { reconcileBufferDeliveries } from "@/lib/publishing/service";
import { mediaCleanupTick } from "@/lib/media/cleanup-worker";
import { and, eq, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { jobs } from "@/db/schema";
import { cleanupCompanionStaging, expireCompanionImageJobs } from "@/lib/companion/image-jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Cron is not configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const results = await Promise.allSettled([
    reconcileBufferDeliveries().then(() => refreshPendingDeliveryNotifications()),
    expireCompanionImageJobs().then(() => autopilotLoop()), cleanupCompanionStaging(), mediaCleanupTick(),
    getDb().update(jobs).set({ status: "failed", error: "Local image request expired before completion.", updatedAt: new Date() })
      .where(and(eq(jobs.type, "local_image"), eq(jobs.status, "queued"),
        lt(jobs.createdAt, new Date(Date.now() - 10 * 60_000)))),
    getDb().update(jobs).set({ status: "failed", error: "Local image save timed out.", updatedAt: new Date() })
      .where(and(eq(jobs.type, "local_image"), eq(jobs.status, "running"),
        lt(jobs.updatedAt, new Date(Date.now() - 30 * 60_000)))),
  ]);
  const names = ["delivery_recovery", "autopilot_scan", "companion_staging_cleanup", "media_cleanup",
    "legacy_queue_expiry", "legacy_save_expiry"];
  const failedTasks = results.flatMap((result, index) => result.status === "rejected" ? [names[index]] : []);
  if (failedTasks.length) console.error("[cron/maintenance]", { failedTasks });
  return NextResponse.json({ ok: failedTasks.length === 0, failedTasks },
    { status: failedTasks.length ? 500 : 200 });
}
