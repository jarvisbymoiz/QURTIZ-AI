import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  allowed: vi.fn(),
  report: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("@/lib/workspace", () => ({ getSessionUser: mocks.user }));
vi.mock("@/lib/website-analytics/access", () => ({
  canViewWebsiteAnalytics: mocks.allowed,
}));
vi.mock("@/lib/website-analytics/server", () => ({
  getWebsiteTrafficReport: mocks.report,
}));
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: mocks.rate }));
import { GET } from "@/app/api/admin/website-analytics/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({
    id: "operator",
    email: "private@example.test",
  });
  mocks.allowed.mockReturnValue(true);
  mocks.rate.mockReturnValue({ allowed: true });
});
describe("private traffic endpoint", () => {
  it("denies unauthenticated and non-operator users before accessing Vercel", async () => {
    mocks.user.mockResolvedValueOnce(null);
    expect((await GET()).status).toBe(401);
    mocks.allowed.mockReturnValue(false);
    expect((await GET()).status).toBe(403);
    expect(mocks.report).not.toHaveBeenCalled();
  });
  it("rate limits report retrieval", async () => {
    mocks.rate.mockReturnValue({ allowed: false, retryAfterSeconds: 30 });
    const response = await GET();
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(mocks.report).not.toHaveBeenCalled();
  });
  it("never caches authenticated traffic responses publicly", async () => {
    mocks.report.mockResolvedValue({
      today: { visitors: 2, pageviews: 3 },
      week: {},
      month: {},
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(JSON.stringify(await response.json())).not.toContain(
      "private@example.test",
    );
  });
  it("returns an actionable unavailable state instead of fake zeroes when all reports fail", async () => {
    const error = "Vercel denied reporting access.";
    mocks.report.mockResolvedValue({
      today: { error },
      week: { error },
      month: { error },
      pages: { error },
      referrers: { error },
      countries: { error },
      devices: { error },
      browsers: { error },
      trend: { error },
    });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error });
  });
});
