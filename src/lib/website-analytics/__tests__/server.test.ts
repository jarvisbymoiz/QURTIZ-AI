import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { canViewWebsiteAnalytics } from "../access";
import { queryTraffic, getWebsiteTrafficReport } from "../server";
const fetcher = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockReset();
  vi.stubEnv("VERCEL_ANALYTICS_TOKEN", "private-test-token");
  vi.stubEnv("QURTIZ_VERCEL_PROJECT_ID", "prj_test");
  vi.stubEnv("QURTIZ_VERCEL_TEAM_ID", "team_test");
  vi.stubEnv("QURTIZ_WEBSITE_ANALYTICS_ADMIN_IDS", "operator-a, operator-b");
});
describe("operator access and official analytics reporting", () => {
  it("fails closed and does not treat tenant ownership as operator access", () => {
    expect(canViewWebsiteAnalytics("operator-a")).toBe(true);
    expect(canViewWebsiteAnalytics("workspace-owner")).toBe(false);
    vi.stubEnv("QURTIZ_WEBSITE_ANALYTICS_ADMIN_IDS", "");
    expect(canViewWebsiteAnalytics("operator-a")).toBe(false);
  });
  it("queries only the fixed official endpoint with Production scope and server-side auth", async () => {
    fetcher.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ country: "PK", pageviews: 9, visitors: 4 }],
        }),
      ),
    );
    expect(
      await queryTraffic(
        "country",
        new Date("2026-10-01"),
        new Date("2026-10-02"),
      ),
    ).toEqual([{ label: "PK", pageviews: 9, visitors: 4 }]);
    const [url, init] = fetcher.mock.calls[0];
    expect(url.origin).toBe("https://api.vercel.com");
    expect(url.pathname).toBe("/v1/query/web-analytics/visits/aggregate");
    expect(url.searchParams.get("filter")).toBe("environment eq 'production'");
    expect(url.searchParams.get("projectId")).toBe("prj_test");
    expect(init.headers.Authorization).toBe("Bearer private-test-token");
    expect(init.cache).toBe("no-store");
  });
  it("never represents rejected requests or invalid metrics as zero traffic", async () => {
    fetcher.mockResolvedValueOnce(
      new Response("private upstream response", { status: 403 }),
    );
    await expect(
      queryTraffic("environment", new Date(), new Date()),
    ).rejects.toThrow("denied reporting access");
    fetcher.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: [{ pageviews: null, visitors: "unknown" }] }),
      ),
    );
    await expect(
      queryTraffic("environment", new Date(), new Date()),
    ).rejects.toThrow("unexpected analytics response");
  });
  it("reports the real provider enablement rejection without exposing its response", async () => {
    fetcher.mockResolvedValue(new Response(JSON.stringify({ error: {
      code: "web_analytics_not_enabled", message: "private upstream details",
    } }), { status: 400 }));
    await expect(queryTraffic("environment", new Date(), new Date()))
      .rejects.toThrow("reporting API says Web Analytics is not enabled");
  });
  it("takes unique period visitors directly from Vercel and coalesces cached report requests", async () => {
    fetcher.mockImplementation(
      async (url) =>
        new Response(
          JSON.stringify({
            data:
              url.searchParams.get("by") === "environment"
                ? [{ environment: "production", pageviews: 7, visitors: 3 }]
                : [
                    {
                      timestamp: "2026-10-02T00:00:00Z",
                      pageviews: 7,
                      visitors: 6,
                    },
                  ],
          }),
        ),
    );
    const [first, second] = await Promise.all([
      getWebsiteTrafficReport(),
      getWebsiteTrafficReport(),
    ]);
    expect(first.week.visitors).toBe(3);
    expect(first.month.visitors).toBe(3);
    expect(first).toEqual(second);
    expect(fetcher).toHaveBeenCalledTimes(9);
    expect(JSON.stringify(first)).not.toContain("private-test-token");
  });
});
