import { NextRequest, NextResponse } from "next/server";
import { validCronAuthorization } from "@/lib/jobs/cron-auth";
import { syncDueInsights } from "@/lib/analytics/sync";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Cron is not configured" }, { status: 503 });
  if (!validCronAuthorization(req.headers.get("authorization"), secret, "insights")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const results = await syncDueInsights();
    console.info("[cron/insights]", results.map(({ errors: _errors, ...summary }) => summary));
    return NextResponse.json({ ok: true, results });
  } catch { console.error("[cron/insights] database_or_configuration_error"); return NextResponse.json({ ok: false, error: "Analytics sync failed; check server diagnostics." }, { status: 500 }); }
}
