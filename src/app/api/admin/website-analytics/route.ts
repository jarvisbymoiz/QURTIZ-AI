import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/workspace";
import { canViewWebsiteAnalytics } from "@/lib/website-analytics/access";
import { getWebsiteTrafficReport } from "@/lib/website-analytics/server";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET() {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json(
      { error: "Sign in to access website analytics." },
      { status: 401, headers },
    );
  if (!canViewWebsiteAnalytics(user.id))
    return NextResponse.json(
      {
        error:
          "Website analytics is restricted to configured Qurtiz operators.",
      },
      { status: 403, headers },
    );
  const limit = rateLimit(`website-analytics:${user.id}`, 6, 60_000);
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Wait before refreshing website analytics." },
      {
        status: 429,
        headers: { ...headers, "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  try {
    const report = await getWebsiteTrafficReport();
    if (
      report.today.error &&
      report.week.error &&
      report.month.error &&
      [
        report.pages,
        report.referrers,
        report.countries,
        report.devices,
        report.browsers,
        report.trend,
      ].every((section) => section.error)
    ) {
      return NextResponse.json(
        { error: report.today.error },
        { status: 503, headers },
      );
    }
    return NextResponse.json(report, { headers });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Vercel reporting is unavailable.",
      },
      { status: 503, headers },
    );
  }
}
