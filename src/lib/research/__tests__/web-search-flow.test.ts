import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { clearResearchCaches, searchResearch } from "@/lib/research/service";
import { trendSourceBundle } from "@/lib/research/bundle";
import { workspaceResearchPlan, monthlyLiveSearchCount } from "@/lib/research/usage";

/**
 * End-to-end flow tests for the numbered acceptance cases:
 * Brave Search as a built-in Qurtiz backend capability available to EVERY
 * selected AI model — never a provider-native feature.
 *
 * The workspace AI-config module is mocked to THROW if consulted at all:
 * web research must not need provider config, keys, or native search.
 */

vi.mock("@/lib/research/usage", () => ({
  recordResearchUsage: vi.fn(async () => {}),
  monthlyLiveSearchCount: vi.fn(async () => 0),
  workspaceResearchPlan: vi.fn(async () => "enterprise"),
}));

const getWorkspaceTextModelMock = vi.fn(async () => {
  throw new Error("BUG: web research must not consult workspace AI provider config");
});
vi.mock("@/lib/ai/config", () => ({
  getWorkspaceTextModel: getWorkspaceTextModelMock,
}));

const KEY = "flow-test-shared-brave-key-secret";
const WS = "ws-flow-0000-0000-0000-0000000000f1";
const USER = "flow-user";

let seq = 0;
const freshWs = () => `ws-flow-${(seq += 1)}-${Math.random().toString(36).slice(2)}`;

function braveOk(results: { title?: string; url: string; description?: string; age?: string }[]) {
  return new Response(JSON.stringify({ web: { results } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function fetchRouter(handler: (url: URL) => Response | Promise<Response>) {
  const impl = vi.fn((url: unknown) => Promise.resolve(handler(new URL(String(url)))));
  vi.stubGlobal("fetch", impl);
  return impl;
}

beforeEach(() => {
  clearResearchCaches();
  vi.clearAllMocks();
  process.env.BRAVE_SEARCH_API_KEY = KEY;
  process.env.BRAVE_SEARCH_MAX_QPS = "1000";
  process.env.BRAVE_SEARCH_CACHE_TTL_SECONDS = "900";
  vi.mocked(workspaceResearchPlan).mockResolvedValue("enterprise");
  vi.mocked(monthlyLiveSearchCount).mockResolvedValue(0);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BRAVE_SEARCH_API_KEY;
  delete process.env.BRAVE_SEARCH_MAX_QPS;
  delete process.env.BRAVE_SEARCH_CACHE_TTL_SECONDS;
});

type WebSearchInput = {
  query: string;
  strategy?: "web" | "trends" | "official" | "news" | "announcements" | "community" | "creators";
  region?: string;
  freshness?: "pd" | "pw" | "pm" | "py";
};

async function runWebSearchTool(input: WebSearchInput, workspaceId = WS): Promise<Record<string, unknown>> {
  const { makeWebSearchTool } = await import("@/lib/ai/search-tool");
  const tool = makeWebSearchTool({ workspaceId, userId: USER, logStep: async () => {} });
  const out = await tool.execute!(input, { toolCallId: `tc-${Math.random()}`, messages: [] });
  return out as unknown as Record<string, unknown>;
}

describe("1+2+10. provider independence — no native AI-provider search required", () => {
  it.each(["gemini", "openai", "openrouter", "claude", "custom-openai-compatible"])(
    "Brave web search works when the selected model is '%s' (provider config never consulted)",
    async (selectedProviderLabel) => {
      fetchRouter(() => braveOk([{ title: `Result for ${selectedProviderLabel}`, url: "https://example.com/independent" }]));
      const out = await runWebSearchTool({ query: `${selectedProviderLabel} independence check` }, freshWs());
      expect(out.searched).toBe(true);
      expect(out.found).toBe(true);
      expect(getWorkspaceTextModelMock).not.toHaveBeenCalled(); // Brave path needs no provider config
      expect(JSON.stringify(out)).not.toContain(KEY);
    },
  );
});

describe("3. trend research returns real current sourced results", () => {
  it("bundles trends + news + community sources, dedupes by URL, and marks partial failures honestly", async () => {
    const OVERLAP = "https://shared.example.com/trend";
    const impl = fetchRouter((url) => {
      const q = url.searchParams.get("q") ?? "";
      if (q.includes("reddit.com")) {
        return braveOk([{ title: "Reddit thread", url: "https://reddit.com/r/niche/comments/abc" }]);
      }
      if (q.includes("latest news")) {
        expect(url.searchParams.get("freshness")).toBe("pw"); // news = past week
        return braveOk([
          { title: "News piece", url: "https://news.example.com/now" },
          { title: "Overlap", url: OVERLAP },
        ]);
      }
      if (/Google Trends/i.test(q)) {
        expect(url.searchParams.get("freshness")).toBe("pm"); // trends = past month
        return braveOk([
          { title: "Trends page", url: "https://trends.google.com/trends/explore?q=niche" },
          { title: "Overlap", url: OVERLAP },
        ]);
      }
      return braveOk([]);
    });

    const bundle = await trendSourceBundle({ workspaceId: freshWs(), userId: USER }, "chai cafe trends");
    expect(bundle.ok).toBe(true);
    expect(bundle.succeeded).toEqual(expect.arrayContaining(["trends", "news", "community"]));
    const urls = bundle.sources.map((s) => s.url);
    expect(urls).toContain("https://trends.google.com/trends/explore?q=niche");
    expect(urls.filter((u) => u === OVERLAP)).toHaveLength(1); // deduped across strategies
    expect(bundle.failures).toHaveLength(0);
    expect(impl).toHaveBeenCalledTimes(3); // three focused searches, one shared key
  });

  it("a single failed source class does not sink the bundle (partial success)", async () => {
    fetchRouter((url) => {
      const q = String(url.searchParams.get("q") ?? "");
      if (q.includes("reddit.com")) return new Response("boom", { status: 500 });
      if (q.includes("latest news")) return braveOk([{ title: "News", url: "https://news.example.com/x" }]);
      return braveOk([{ title: "Trend", url: "https://trends.google.com/trends/explore?q=y" }]);
    });
    const bundle = await trendSourceBundle({ workspaceId: freshWs(), userId: USER }, "fashion micro trends");
    expect(bundle.ok).toBe(true);
    expect(bundle.sources.length).toBeGreaterThanOrEqual(2);
    expect(bundle.failures.map((f) => f.strategy)).toContain("community");
  });
});

describe("4+5. latest-news queries + country/freshness filters reach Brave", () => {
  it("news strategy searches the past week", async () => {
    const impl = fetchRouter(() => braveOk([{ title: "Breaking", url: "https://news.example.com/today", age: "3 hours ago" }]));
    const out = await searchResearch({ workspaceId: freshWs(), userId: USER, query: "ai video generator", strategy: "news" });
    expect(out.ok).toBe(true);
    const url = new URL(String(impl.mock.calls[0][0]));
    expect(url.searchParams.get("freshness")).toBe("pw");
    expect(url.searchParams.get("q")).toContain("latest news");
  });

  it("passes country + freshness filters straight to the Brave request", async () => {
    const impl = fetchRouter(() => braveOk([{ title: "GB result", url: "https://example.co.uk/r" }]));
    const out = await searchResearch({
      workspaceId: freshWs(),
      userId: USER,
      query: "property tax changes",
      region: "GB",
      freshness: "pd",
    });
    expect(out.ok).toBe(true);
    const url = new URL(String(impl.mock.calls[0][0]));
    expect(url.searchParams.get("country")).toBe("GB");
    expect(url.searchParams.get("freshness")).toBe("pd");
  });
});

describe("6+7+8. graceful, DISTINCT errors the agent can explain", () => {
  it("missing key → provider_unavailable 'not configured' (and no fetch)", async () => {
    delete process.env.BRAVE_SEARCH_API_KEY;
    const impl = fetchRouter(() => braveOk([]));
    const out = await searchResearch({ workspaceId: freshWs(), userId: USER, query: "anything current now" });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("provider_unavailable");
      expect(out.message).toMatch(/not configured/i);
    }
    expect(impl).not.toHaveBeenCalled();
  });

  it("invalid key (401 at Brave) → provider_unavailable with a clearly different cause", async () => {
    fetchRouter(() => new Response("forbidden", { status: 401 }));
    const out = await searchResearch({ workspaceId: freshWs(), userId: USER, query: "invalid key check" });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("provider_unavailable");
      expect(out.message).toMatch(/key was rejected|admin/i);
    }
  });

  it("Brave 429 → quota with the provider retry window surfaced", async () => {
    fetchRouter(() => new Response("rate limited", { status: 429, headers: { "retry-after": "30" } }));
    const out = await searchResearch({ workspaceId: freshWs(), userId: USER, query: "quota check" });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("quota");
      expect(out.retryAfterSeconds).toBe(30);
    }
  });

  it("zero search results are distinguished from a failed search", async () => {
    fetchRouter(() => braveOk([]));
    const out = await runWebSearchTool({ query: "obscure string nothing matches zxq" }, freshWs());
    expect(out.searched).toBe(true);
    expect(out.found).toBe(false);
    expect(String(out.message)).toMatch(/zero results/i);
  });
});

describe("9. results are handed back for model analysis", () => {
  it("web_search returns every Brave result as summary + sources (the model analyzes, Brave supplies facts)", async () => {
    fetchRouter(() =>
      braveOk([
        { title: "Trend report", url: "https://trends.example.com/r1", description: "Live description A", age: "1 day ago" },
        { title: "Niche news", url: "https://news.example.com/r2", description: "Live description B" },
      ]),
    );
    const out = await runWebSearchTool({ query: "niche trends right now" }, freshWs());
    expect(out.searched).toBe(true);
    expect(String(out.summary)).toContain("https://trends.example.com/r1");
    expect(String(out.summary)).toContain("Live description A");
    const sources = out.sources as { title: string; url: string }[];
    expect(sources.map((s) => s.url)).toEqual(["https://trends.example.com/r1", "https://news.example.com/r2"]);
    expect(JSON.stringify(out)).not.toContain(KEY);
  });

  it("agent-facing failures carry anti-hallucination framing (never blame the AI provider)", async () => {
    fetchRouter(() => new Response("nope", { status: 401 }));
    const out = await runWebSearchTool({ query: "failure framing check" }, freshWs());
    expect(out.searched).toBe(false);
    expect(String(out.message)).toMatch(/independent of the selected AI model/i);
    expect(String(out.message)).toMatch(/model-knowledge/i);
  });
});
