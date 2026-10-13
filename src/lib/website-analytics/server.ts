import "server-only";
import { z } from "zod";
import type {
  TrafficRow,
  TrafficSection,
  TrafficTotal,
  WebsiteTrafficReport,
} from "./types";

const rowSchema = z
  .object({
    pageviews: z.number().nonnegative(),
    visitors: z.number().nonnegative(),
  })
  .passthrough();
const responseSchema = z.object({ data: z.array(rowSchema) });
type Group =
  | "environment"
  | "requestPath"
  | "referrerHostname"
  | "country"
  | "deviceType"
  | "browserName"
  | "day";
const messages: Record<number, string> = {
  401: "Vercel rejected the access token. Replace VERCEL_ANALYTICS_TOKEN server-side.",
  403: "Vercel denied reporting access. Check token scope, project/team and plan permissions.",
  404: "The Vercel project or analytics resource was not found. Check project/team configuration and enable Web Analytics.",
  429: "Vercel's reporting rate limit was reached. Wait before refreshing.",
};

function configuration() {
  const token = process.env.VERCEL_ANALYTICS_TOKEN;
  const projectId =
    process.env.QURTIZ_VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_ID;
  const teamId =
    process.env.QURTIZ_VERCEL_TEAM_ID || process.env.VERCEL_TEAM_ID;
  if (!token || !projectId)
    throw new Error(
      "Configure VERCEL_ANALYTICS_TOKEN and QURTIZ_VERCEL_PROJECT_ID in server-side deployment environment variables.",
    );
  return { token, projectId, teamId };
}

/** Fixed official endpoint; callers cannot supply a URL, filter or project credential. */
export async function queryTraffic(
  group: Group,
  since: Date,
  until: Date,
): Promise<TrafficRow[]> {
  const { token, projectId, teamId } = configuration();
  const url = new URL(
    "https://api.vercel.com/v1/query/web-analytics/visits/aggregate",
  );
  url.searchParams.set("projectId", projectId);
  if (teamId) url.searchParams.set("teamId", teamId);
  url.searchParams.set("since", since.toISOString());
  url.searchParams.set("until", until.toISOString());
  url.searchParams.set("by", group);
  url.searchParams.set("filter", "environment eq 'production'");
  url.searchParams.set("limit", group === "day" ? "100" : "10");
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new Error(
      "The Vercel reporting request timed out or could not connect. Retry later.",
    );
  }
  if (!response.ok) {
    if (response.status === 400) {
      const body = await response.json().catch(() => null);
      if (body?.error?.code === "web_analytics_not_enabled")
        throw new Error(
          "Vercel's reporting API says Web Analytics is not enabled for this project. Check qurtizai's Web Analytics settings in Vercel; collected traffic cannot be reported yet.",
        );
    }
    throw new Error(
      messages[response.status] ||
        `Vercel reporting is unavailable (HTTP ${response.status}). Retry later.`,
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("Vercel returned an invalid analytics response.");
  }
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success)
    throw new Error(
      "Vercel returned an unexpected analytics response; counts are unavailable.",
    );
  return parsed.data.data.map((row) => ({
    label: String(
      row[group === "day" ? "timestamp" : group] ?? "Unknown / direct",
    ),
    pageviews: row.pageviews,
    visitors: row.visitors,
  }));
}

let cached:
  | { key: string; until: number; result: Promise<WebsiteTrafficReport> }
  | undefined;
export async function getWebsiteTrafficReport(): Promise<WebsiteTrafficReport> {
  const { projectId, teamId } = configuration();
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const week = new Date(today.getTime() - 6 * 86_400_000);
  const month = new Date(today.getTime() - 29 * 86_400_000);
  const key = `${projectId}:${teamId ?? "personal"}:${today.toISOString()}`;
  if (cached?.key === key && cached.until > Date.now()) return cached.result;
  const total = async (since: Date): Promise<TrafficTotal> => {
    try {
      const rows = await queryTraffic("environment", since, now);
      // One production group means unique visitors come from Vercel, never from summing daily rows.
      if (rows.length > 1)
        throw new Error(
          "Vercel returned more than one environment; totals are unavailable.",
        );
      return {
        pageviews: rows[0]?.pageviews ?? 0,
        visitors: rows[0]?.visitors ?? 0,
      };
    } catch (error) {
      return {
        pageviews: null,
        visitors: null,
        error:
          error instanceof Error
            ? error.message
            : "Traffic totals are unavailable.",
      };
    }
  };
  const section = async (group: Group): Promise<TrafficSection> => {
    try {
      return { rows: await queryTraffic(group, month, now) };
    } catch (error) {
      return {
        rows: [],
        error:
          error instanceof Error
            ? error.message
            : "Traffic breakdown is unavailable.",
      };
    }
  };
  const result = Promise.all([
    total(today),
    total(week),
    total(month),
    section("requestPath"),
    section("referrerHostname"),
    section("country"),
    section("deviceType"),
    section("browserName"),
    section("day"),
  ] as const).then(
    ([
      todayTotal,
      weekTotal,
      monthTotal,
      pages,
      referrers,
      countries,
      devices,
      browsers,
      trend,
    ]) => ({
      projectId,
      environment: "production" as const,
      refreshedAt: now.toISOString(),
      timezone: "UTC" as const,
      today: todayTotal,
      week: weekTotal,
      month: monthTotal,
      pages,
      referrers,
      countries,
      devices,
      browsers,
      trend,
    }),
  );
  cached = { key, until: Date.now() + 60_000, result };
  return result;
}
