import { describe, expect, it } from "vitest";
import { AGENT_CORE_INSTRUCTION, agentCoreForTask } from "@/lib/ai/agent-core";
import { buildSystemPrompt } from "@/lib/ai/agent";
import { buildContentSystemPrompt } from "@/lib/ai/content";

describe("AGENT_CORE.md", () => {
  it("is the single complete permanent creative instruction source", () => {
    expect(AGENT_CORE_INSTRUCTION.length).toBeGreaterThan(3000);
    expect(AGENT_CORE_INSTRUCTION).toContain("social media strategist");
    expect(AGENT_CORE_INSTRUCTION).toContain("creative copywriter");
    expect(AGENT_CORE_INSTRUCTION).toContain("visual creative director");
    expect(AGENT_CORE_INSTRUCTION).toContain("Visual Prompt");
    expect(AGENT_CORE_INSTRUCTION).toContain("carousel");
    expect(AGENT_CORE_INSTRUCTION).toContain("Reel");
    expect(AGENT_CORE_INSTRUCTION).not.toContain("ddd1c899");
  });

  it("is injected into the AI Chat system prompt", () => {
    const system = buildSystemPrompt({ brandSummary: "Test brand", memories: [], workspaceName: "Test" });
    expect(system).toContain("Qurtiz AI Agent Core");
    expect(system).toContain("authenticated user and workspace");
    expect(system.split("# Qurtiz AI Agent Core")).toHaveLength(2);
    expect(agentCoreForTask("Hi")).not.toContain("## Visual creative direction");
    expect(agentCoreForTask("Write a carousel visual prompt")).toContain("## Visual creative direction");
  });

  it("is injected into the content engine system prompt", () => {
    const system = buildContentSystemPrompt({ brandName: "Test", brandSummary: "Brain", memoryLines: "" });
    expect(system).toContain(AGENT_CORE_INSTRUCTION);
    expect(system.split("# Qurtiz AI Agent Core")).toHaveLength(2);
    expect(system).toContain("Output contract");
  });

  it("does not inject a second legacy or database identity", () => {
    const chat = buildSystemPrompt({ brandSummary: "Workspace facts", memories: [], workspaceName: "Test",
      identity: "LEGACY_IDENTITY_SHOULD_NOT_APPEAR", currentTask: "Write a post" });
    const content = buildContentSystemPrompt({ brandName: "Test", brandSummary: "Workspace facts",
      memoryLines: "Saved preference", identity: "LEGACY_IDENTITY_SHOULD_NOT_APPEAR" });
    for (const prompt of [chat, content]) {
      expect(prompt).not.toContain("LEGACY_IDENTITY_SHOULD_NOT_APPEAR");
      expect(prompt.split("# Qurtiz AI Agent Core")).toHaveLength(2);
      expect(prompt).toContain("Workspace facts");
    }
    expect(content).toContain("Saved preference");
  });
});
