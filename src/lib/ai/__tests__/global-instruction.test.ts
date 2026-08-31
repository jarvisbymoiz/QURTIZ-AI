import { describe, expect, it } from "vitest";
import { GLOBAL_AI_INSTRUCTION } from "@/lib/ai/global-instruction";
import { buildSystemPrompt } from "@/lib/ai/agent";
import { buildContentSystemPrompt } from "@/lib/ai/content";

describe("GLOBAL_AI_INSTRUCTION", () => {
  it("is centralized and complete", () => {
    expect(GLOBAL_AI_INSTRUCTION.length).toBeGreaterThan(500);
    expect(GLOBAL_AI_INSTRUCTION).toContain("Senior Social Media Marketing Strategist");
    expect(GLOBAL_AI_INSTRUCTION).toContain("Professional Copywriter");
    expect(GLOBAL_AI_INSTRUCTION).toContain("Content Strategist");
    expect(GLOBAL_AI_INSTRUCTION).toContain("Expert Visual/Graphic Designer");
    expect(GLOBAL_AI_INSTRUCTION).toContain("Visual prompts");
    expect(GLOBAL_AI_INSTRUCTION).toContain("Carousel");
    expect(GLOBAL_AI_INSTRUCTION).toContain("Reels");
  });

  it("is injected into the AI Chat system prompt", () => {
    const system = buildSystemPrompt({ brandSummary: "Test brand", memories: [], workspaceName: "Test" });
    expect(system).toContain("Global AI Instruction");
    expect(system).toContain("Senior Social Media Marketing Strategist");
  });

  it("is injected into the content engine system prompt", () => {
    const system = buildContentSystemPrompt({ brandName: "Test", brandSummary: "Brain", memoryLines: "" });
    expect(system).toContain("Global AI Instruction");
    expect(system).toContain("Senior Social Media Marketing Strategist");
    expect(system).toContain("Hard rules");
  });
});
