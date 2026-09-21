import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { clearResearchCaches, searchResearch } from "@/lib/research/service";
import {
  monthlyLiveSearchCount,
  recordResearchUsage,
  workspaceResearchPlan,
} from "@/lib/research/usage";

/**
 * ResearchService tests. The DB layer (@/lib/research/usage) is mocked at
 * the module boundary with argument capture; Brave's HTTP layer is mocked
 * via the global fetch stub. Nothing here ever performs network or DB IO.
 */

vi.mock("@/lib/research/usage", () => ({
  recordResearchUsage: vi.fn(async () => {}),
  monthlyLiveSearchCount: vi.fn(async () => 0),
  workspaceResearchPlan: vi.fn(async () => "free"),
}));

const KEY = "test-shared-brave-key-0123456789abcdef";
const WS_A = "ws-alpha-0000-0000-0000-00000000000a";
const WS_B = "ws-bravo-0000-0000-0000-00000000000b";
const USER_1 = "user-0001";
const USER_2 = "user-0002";

function braveOk(results: { title?: string; url: string; description?: string }[]) {
  return new Response(JSON.stringify({ web: { results } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function fetchMock(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const impl = vi.fn((url: unknown, init?: unknown) => Promise.resolve(handler(String(url), init as RequestInit)));
  vi.stubGlobal("fetch", impl);
  return impl;
}

const usageCalls = () => vi.mocked(recordResearchUsage).mock.calls.map((c) => c[0]);

let wsSeq = 0;
/** Unique workspace per per-minute-limited flow so buckets never leak between tests. */
const freshWs = () => `ws-fresh-${(wsSeq += 1)}-${Math.random().toString(36).slice(2)}`;

beforeEach(() => {
  clearResearchCaches();
  vi.clearAllMocks();
  process.env.BRAVE_SEARCH_API_KEY = KEY;
  process.env.BRAVE_SEARCH_MAX_QPS = "1000";
  process.env.BRAVE_SEARCH_CACHE_TTL_SECONDS = "900";
  vi.mocked(workspaceResearchPlan).mockResolvedValue("enterprise"); // high per-minute cap; rate-limit tests pin "free" explicitly
  vi.mocked(monthlyLiveSearchCount).mockResolvedValue(0);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BRAVE_SEARCH_API_KEY;
  delete process.env.BRAVE_SEARCH_MAX_QPS;
  delete process.env.BRAVE_SEARCH_CACHE_TTL_SECONDS;
  delete process.env.QURTIZ_RESEARCH_LIMITS_JSON;
});

describe("shared project integration", () => {
  it("serves multiple users through the SAME shared key, attributed per user", async () => {
    const impl = fetchMock(() =>
      braveOk([{ title: "Result", url: "https://example.com/a", description: "info" }]),
    );
    const one = await searchResearch({ workspaceId: WS_A, userId: USER_1, query: "instagram algorithm 2026" });
    const two = await searchResearch({ workspaceId: WS_A, userId: USER_2, query: "facebook ads cpm benchmarks" });

    expect(one.ok && two.ok).toBe(true);
    expect(impl).toHaveBeenCalledTimes(2);
    for (const call of impl.mock.calls) {
      const headers = (call[1] as RequestInit).headers as Record<string, string>;
      expect(headers["X-Subscription-Token"]).toBe(KEY); // one shared project key
      expect(String(call[0])).not.toContain(KEY);
    }
    const events = usageCalls();
    expect(events.filter((e) => e.userId === USER_1)).toHaveLength(1);
    expect(events.filter((e) => e.userId === USER_2)).toHaveLength(1);
    expect(events.every((e) => e.workspaceId === WS_A && e.status === "ok")).toBe(true);
  });

  it("serves multiple workspaces with independent attribution", async () => {
    fetchMock(() => braveOk([{ title: "R", url: "https://example.com/x" }]));
    const a = await searchResearch({ workspaceId: WS_A, userId: USER_1, query: "karachi food trends" });
    const b = await searchResearch({ workspaceId: WS_B, userId: USER_2, query: "lahore fashion trends" });
    expect(a.ok && b.ok).toBe(true);
    const events = usageCalls();
    expect(events.some((e) => e.workspaceId === WS_A)).toBe(true);
    expect(events.some((e) => e.workspaceId === WS_B)).toBe(true);
  });

  it("never leaks the shared key into any result, failure or usage event", async () => {
    fetchMock(() => new Response("nope", { status: 401 }));
    const success = await searchResearch({ workspaceId: WS_A, userId: USER_1, query: "solar panel prices" });
    expect(JSON.stringify(success)).not.toContain(KEY);
    expect(JSON.stringify(usageCalls())).not.toContain(KEY);
  });
});

describe("workspace isolation + shared anonymous cache", () => {
  it("caches identical public queries globally — second workspace gets a cache hit with NO extra Brave call", async () => {
    const impl = fetchMock(() => braveOk([{ title: "R", url: "https://example.com/y" }]));
    const first = await searchResearch({ workspaceId: WS_A, userId: USER_1, query: "best coffee beans" });
    const second = await searchResearch({ workspaceId: WS_B, userId: USER_2, query: "best coffee beans" });

    expect(first.ok && !first.fromCache).toBe(true);
    expect(second.ok && second.fromCache).toBe(true);
    expect(impl).toHaveBeenCalledTimes(1);

    const secondEvent = usageCalls().find((e) => e.workspaceId === WS_B);
    expect(secondEvent?.cacheHit).toBe(true); // attribution kept, cost avoided
  });

  it("normalizes whitespace/case so equivalent queries share the cache", async () => {
    const impl = fetchMock(() => braveOk([{ title: "R", url: "https://example.com/z" }]));
    await searchResearch({ workspaceId: WS_A, userId: USER_1, query: "Instagram   Reel Ideas" });
    const dup = await searchResearch({ workspaceId: WS_B, userId: USER_2, query: "instagram reel ideas" });
    expect(dup.ok && dup.fromCache).toBe(true);
    expect(impl).toHaveBeenCalledTimes(1);
  });

  it("cache keys NEVER include tenant identity — region/region and strategy variants stay separate", async () => {
    const impl = fetchMock(() => braveOk([{ title: "R", url: "https://example.com/r" }]));
    await searchResearch({ workspaceId: WS_A, userId: USER_1, query: "ev market" });
    const otherRegion = await searchResearch({ workspaceId: WS_B, userId: USER_2, query: "ev market", region: "GB" });
    const otherStrategy = await searchResearch({ workspaceId: WS_B, userId: USER_2, query: "ev market", strategy: "news" });
    expect(otherRegion.ok && !otherRegion.fromCache).toBe(true);
    expect(otherStrategy.ok && !otherStrategy.fromCache).toBe(true);
    expect(impl).toHaveBeenCalledTimes(3);

    // The cached shape contains only public results — no identity fields.
    const cachedEcho = await searchResearch({ workspaceId: WS_B, userId: USER_2, query: "ev market" });
    expect(cachedEcho.ok && cachedEcho.fromCache).toBe(true);
    expect(cachedEcho).not.toHaveProperty("workspaceId");
    expect(cachedEcho).not.toHaveProperty("userId");
    expect(JSON.stringify(cachedEcho)).not.toContain(WS_A);
    expect(JSON.stringify(cachedEcho)).not.toContain(WS_B);
  });
});

describe("usage control", () => {
  it("rate-limits a workspace that exceeds its per-minute allowance", async () => {
    vi.mocked(workspaceResearchPlan).mockResolvedValue("free");
    const ws = freshWs();
    const impl = fetchMock(() => braveOk([{ title: "R", url: "https://example.com/rl" }]));
    const failures = [];
    for (let i = 1; i <= 7; i += 1) {
      const outcome = await searchResearch({ workspaceId: ws, userId: USER_1, query: `unique query number ${i}` });
      if (!outcome.ok) failures.push(outcome);
    }
    expect(failures).toHaveLength(1); // free plan: 6/min
    expect(failures[0].reason).toBe("rate_limited");
    expect(failures[0].retryAfterSeconds).toBeGreaterThan(0);
    expect(impl).toHaveBeenCalledTimes(6);
    expect(usageCalls().some((e) => e.status === "rate_limited" && e.workspaceId === ws)).toBe(true);
  });

  it("gives higher plans a higher per-minute allowance", async () => {
    vi.mocked(workspaceResearchPlan).mockResolvedValue("pro");
    const ws = freshWs();
    fetchMock(() => braveOk([{ title: "R", url: "https://example.com/pro" }]));
    const outcomes = [];
    for (let i = 1; i <= 8; i += 1) {
      outcomes.push(await searchResearch({ workspaceId: ws, userId: USER_1, query: `pro research ${i}` }));
    }
    expect(outcomes.every((o) => o.ok)).toBe(true); // pro: 20/min
  });

  it("enforces the monthly live allowance per plan (cache hits stay free)", async () => {
    vi.mocked(workspaceResearchPlan).mockResolvedValue("free");
    vi.mocked(monthlyLiveSearchCount).mockResolvedValue(300); // free plan cap
    const ws = freshWs();
    const impl = fetchMock(() => braveOk([{ title: "R", url: "https://example.com/cap" }]));
    const outcome = await searchResearch({ workspaceId: ws, userId: USER_1, query: "over allowance query" });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("plan_limit");
    expect(impl).not.toHaveBeenCalled();
    expect(usageCalls().some((e) => e.status === "plan_limit")).toBe(true);
  });

  it("guards the shared key with a global QPS window", async () => {
    process.env.BRAVE_SEARCH_MAX_QPS = "1";
    await new Promise((resolve) => setTimeout(resolve, 1100)); // fresh 1s window for the shared bucket
    const ws = freshWs();
    const impl = fetchMock(() => braveOk([{ title: "R", url: "https://example.com/qps" }]));
    const first = await searchResearch({ workspaceId: ws, userId: USER_1, query: "first unique qps query" });
    const second = await searchResearch({ workspaceId: ws, userId: USER_1, query: "second unique qps query" });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("rate_limited");
    expect(impl).toHaveBeenCalledTimes(1);
  });
});

describe("concurrent research requests", () => {
  it("deduplicates a burst of identical concurrent requests into ONE Brave call", async () => {
    const ws = freshWs();
    const resolvers: ((r: Response) => void)[] = [];
    const impl = fetchMock(
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const request = { workspaceId: ws, userId: USER_1, query: "breaking ai news today" };
    const pending = Promise.all([
      searchResearch(request),
      searchResearch({ ...request, userId: USER_2 }),
      searchResearch({ ...request, workspaceId: WS_B }),
      searchResearch(request),
      searchResearch(request),
    ]);
    // Let every requester reach the join point, then resolve the single flight.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(impl).toHaveBeenCalledTimes(1);
    expect(resolvers).toHaveLength(1);
    resolvers[0](braveOk([{ title: "R", url: "https://example.com/dd" }]));
    const outcomes = await pending;

    expect(outcomes.every((o) => o.ok)).toBe(true);
    const dedupedCount = outcomes.filter((o) => o.ok && o.deduped).length;
    expect(dedupedCount).toBe(4); // one initiator, four joiners
  });

  it("does not dedupe genuinely different queries", async () => {
    const ws = freshWs();
    const impl = fetchMock(() => braveOk([{ title: "R", url: "https://example.com/diff" }]));
    const outcomes = await Promise.all([
      searchResearch({ workspaceId: ws, userId: USER_1, query: "query alpha" }),
      searchResearch({ workspaceId: ws, userId: USER_1, query: "query beta" }),
      searchResearch({ workspaceId: ws, userId: USER_1, query: "query gamma" }),
    ]);
    expect(outcomes.filter((o) => o.ok)).toHaveLength(3);
    expect(impl.mock.calls.length).toBe(3);
  });
});

describe("missing / invalid key and provider failures (graceful, never crashes)", () => {
  it("missing BRAVE_SEARCH_API_KEY → provider_unavailable, no fetch, usage still tracked", async () => {
    delete process.env.BRAVE_SEARCH_API_KEY;
    const impl = fetchMock(() => braveOk([]));
    const outcome = await searchResearch({ workspaceId: WS_A, userId: USER_1, query: "any research query" });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe("provider_unavailable");
      expect(outcome.message).toMatch(/not configured/i);
    }
    expect(impl).not.toHaveBeenCalled();
    expect(usageCalls().some((e) => e.status === "provider_unavailable")).toBe(true);
  });

  it("rejected shared key (401) → provider_unavailable with a platform-admin message", async () => {
    fetchMock(() => new Response("bad key", { status: 401 }));
    const outcome = await searchResearch({ workspaceId: WS_A, userId: USER_1, query: "rejected key scenario" });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe("provider_unavailable");
      expect(outcome.message).not.toContain(KEY);
    }
  });

  it("Brave 429 with Retry-After → quota failure carrying the retry window", async () => {
    fetchMock(() => new Response("slow down", { status: 429, headers: { "retry-after": "45" } }));
    const outcome = await searchResearch({ workspaceId: WS_A, userId: USER_1, query: "quota exhausted query" });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe("quota");
      expect(outcome.retryAfterSeconds).toBe(45);
      expect(outcome.message).toMatch(/45 seconds/);
    }
    expect(usageCalls().some((e) => e.status === "quota" && e.httpStatus === 429)).toBe(true);
  });

  it("upstream 5xx → typed error after bounded retry (2 fetch calls max)", async () => {
    const impl = fetchMock(() => new Response("oops", { status: 500 }));
    const outcome = await searchResearch({ workspaceId: WS_A, userId: USER_1, query: "upstream failure query" });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("error");
    expect(impl.mock.calls.length).toBe(2);
  });

  it("invalid input fails before any network or quota use", async () => {
    const impl = fetchMock(() => braveOk([]));
    const short = await searchResearch({ workspaceId: WS_A, userId: USER_1, query: "ab" });
    const anon = await searchResearch({ workspaceId: "", userId: USER_1, query: "valid query" });
    expect(short.ok).toBe(false);
    expect(anon.ok).toBe(false);
    if (!short.ok) expect(short.reason).toBe("invalid_request");
    if (!anon.ok) expect(anon.reason).toBe("invalid_request");
    expect(impl).not.toHaveBeenCalled();
  });
});

describe("agent Research tool (web_search) integration", () => {
  it("serves the agent with sourced results and no key material", async () => {
    fetchMock(() =>
      braveOk([
        { title: "Trend report", url: "https://trends.example.com/2026", description: "Big report" },
        { title: "News", url: "https://news.example.com/x" },
      ]),
    );
    const { makeWebSearchTool } = await import("@/lib/ai/search-tool");
    const logs: { input: unknown; output: unknown }[] = [];
    const tool = makeWebSearchTool({
      workspaceId: freshWs(),
      userId: USER_1,
      logStep: async (_name: string, input: unknown, output: unknown) => {
        logs.push({ input, output });
      },
    });
    const result = (await tool.execute!(
      { query: "ai content tools", strategy: "web" },
      { toolCallId: "t1", messages: [] },
    )) as { searched: boolean; summary?: string; sources?: { url: string }[] };
    expect(result.searched).toBe(true);
    expect(result.summary).toContain("https://trends.example.com/2026");
    expect(result.sources).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain(KEY);
  });

  it("returns an honest unavailable result the agent can handle when the key is missing", async () => {
    delete process.env.BRAVE_SEARCH_API_KEY;
    const { makeWebSearchTool } = await import("@/lib/ai/search-tool");
    const tool = makeWebSearchTool({ workspaceId: freshWs(), userId: USER_1, logStep: async () => {} });
    const result = (await tool.execute!({ query: "news today" }, { toolCallId: "t2", messages: [] })) as {
      searched: boolean;
      reason?: string;
      message: string;
    };
    expect(result.searched).toBe(false);
    expect(result.reason).toBe("provider_unavailable");
    expect(result.message).toMatch(/not configured/i);
  });

  it("web_search works without any workspace AI provider config (provider-agnostic service)", async () => {
    // No mock of @/lib/ai/config at all: the Brave path must not resolve
    // workspace AI credentials. If it tried, this test would blow up with
    // CONFIGURATION_REQUIRED instead of returning a clean result.
    fetchMock(() => braveOk([{ title: "R", url: "https://example.com/noai" }]));
    const { makeWebSearchTool } = await import("@/lib/ai/search-tool");
    const tool = makeWebSearchTool({ workspaceId: freshWs(), userId: USER_1, logStep: async () => {} });
    const result = (await tool.execute!({ query: "works for every workspace" }, { toolCallId: "t3", messages: [] })) as {
      searched: boolean;
    };
    expect(result.searched).toBe(true);
  });
});
