import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/lib/ai/agent";

describe("buildSystemPrompt publishing-route copy", () => {
  const base = { brandSummary: "Test brand", memories: [], workspaceName: "Test" };

  it("describes the official Meta integration when no provider is given (defaults to meta)", () => {
    const system = buildSystemPrompt(base);
    expect(system).toContain("(official Meta integration)");
    expect(system).not.toContain("Buffer API connection");
  });

  it("describes the Buffer route when publishing is set to Buffer", () => {
    const system = buildSystemPrompt({ ...base, publishProvider: "buffer" });
    expect(system).toContain("Buffer API connection");
    expect(system).toContain("Buffer owns channel access");
    expect(system).not.toContain("(official Meta integration)");
  });
});
