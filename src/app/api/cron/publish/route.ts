import { NextRequest, NextResponse } from "next/server";
import { publishDueScan, autopilotLoop } from "@/lib/jobs/workflows";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60s for Vercel Pro/Hobby

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await publishDueScan();
    await autopilotLoop();
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("[cron/publish error]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Cron execution failed" },
      { status: 500 },
    );
  }
}
