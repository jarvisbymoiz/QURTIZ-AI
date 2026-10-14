import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { brands, workspaces } from "@/db/schema";
vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/jobs/workflows", () => ({ buildAutopilotRunContext: vi.fn(async () => ({ text: "Measured analytics: 9 engagements. Avoid repeated caption." })) }));
vi.mock("@/lib/brand-website/service", () => ({ getBrandWebsiteContext: vi.fn(async () => "Verified brand services from saved website") }));
vi.mock("@/lib/research/service", () => ({ searchResearch: vi.fn() }));
import { getDb } from "@/db";
import { searchResearch } from "@/lib/research/service";
import { contentSearchQuery, prepareContentIntelligence } from "../intelligence";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.mocked(getDb).mockReturnValue({ select: () => ({ from: (table: unknown) => ({ where: async () => table === brands
    ? [{ industry: "Design", website: "https://example.test", contact: "PRIVATE CONTACT", description: "PRIVATE DESCRIPTION" }]
    : table === workspaces ? [{ timezone: "Asia/Karachi" }] : [] }) }) } as never);
});
afterEach(() => vi.useRealTimers());

describe("Studio intelligence preparation", () => {
  it("passes actual snippets/sources and measured strategy onward, without sending private brand fields to search", async () => {
    vi.mocked(searchResearch).mockImplementation(async r => ({ ok: true, provider: "brave", strategy: r.strategy as "web", strategyLabel: "Search", query: r.query,
      results: [{ url: `https://example.test/${r.strategy}`, title: `Source ${r.strategy}`, description: "Actual verified description", age: null }], count: 1, fromCache: false, deduped: false }));
    const pending = prepareContentIntelligence({ workspaceId: "ws", userId: "user", topic: "Canva features", baseContext: "Bulk strategy" });
    await vi.runAllTimersAsync();
    const result = await pending;
    expect(searchResearch).toHaveBeenCalledTimes(3);
    expect(vi.mocked(searchResearch).mock.calls.map(([r]) => r.strategy)).toEqual(["web", "trends", "news"]);
    for (const [request] of vi.mocked(searchResearch).mock.calls) {
      expect(request).toMatchObject({ workspaceId: "ws", userId: "user", query: "Canva features" });
      expect(JSON.stringify(request)).not.toContain("PRIVATE");
    }
    expect(result.researchContext).toContain("Actual verified description");
    expect(result.planningContext).toContain("9 engagements");
    expect(result.planningContext).toContain("Bulk strategy");
    expect(result.planningContext).toContain("Verified brand services");
    expect(result.evidence.sources).toHaveLength(3);
    expect(result.evidence.warnings).toEqual([]);
  });
  it("retains partial failures and prohibits unsupported current claims instead of inventing research", async () => {
    vi.mocked(searchResearch).mockResolvedValue({ ok: false, reason: "provider_unavailable", message: "No key" });
    const pending = prepareContentIntelligence({ workspaceId: "ws", userId: "user", topic: "New AI features" });
    await vi.runAllTimersAsync();
    const result = await pending;
    expect(result.evidence.sources).toEqual([]);
    expect(result.evidence.warnings).toHaveLength(3);
    expect(result.researchContext).toContain("do not claim live research succeeded");
  });
  it("scrubs credentials, bounds public queries and honors cancellation", async () => {
    expect(contentSearchQuery("Canva api_key=secret password:secret sk-secret123 admin@example.test")).toBe("Canva");
    expect(contentSearchQuery("design ".repeat(100)).length).toBeLessThanOrEqual(250);
    const controller = new AbortController(); controller.abort();
    await expect(prepareContentIntelligence({ workspaceId: "ws", userId: "user", topic: "Canva", signal: controller.signal })).rejects.toThrow();
    expect(searchResearch).not.toHaveBeenCalled();
  });
});
