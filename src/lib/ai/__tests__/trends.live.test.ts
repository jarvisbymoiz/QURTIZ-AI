import { describe, expect, it } from "vitest";
import { config } from "dotenv";
import { suggestTrends } from "@/lib/ai/trends";

config({ path: ".env.local" });

describe("suggestTrends (live)", () => {
  it("returns structured trends for a real workspace", { timeout: 120_000 }, async () => {
    const { Client } = await import("pg");
    const c = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
    await c.connect();
    const r = await c.query("SELECT id FROM workspaces LIMIT 1");
    await c.end();
    if (r.rows.length === 0) throw new Error("no workspace");

    const result = await suggestTrends({ workspaceId: r.rows[0].id, niche: "Canva AI for students" });
    console.log("RESULT:", JSON.stringify(result).slice(0, 1200));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.trends.trendingTopics)).toBe(true);
      expect(result.trends.trendingTopics.length).toBeGreaterThan(0);
      expect(result.trends.hookIdeas.length).toBeGreaterThan(0);
    }
  });
});
