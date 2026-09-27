import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** One release-controlled permanent instruction source for all Agent calls. */
export const AGENT_CORE_INSTRUCTION = readFileSync(join(process.cwd(), "AGENT_CORE.md"), "utf8").trim();

if (!AGENT_CORE_INSTRUCTION.startsWith("# Qurtiz AI Agent Core")) {
  throw new Error("AGENT_CORE.md is missing or invalid in the server deployment.");
}

const sections = AGENT_CORE_INSTRUCTION.split(/(?=^## )/m);

/** Read relevant sections from the same canonical file for short chat turns. */
export function agentCoreForTask(task = ""): string {
  // Small edit turns carry the relevant existing item through tools. Keep the
  // permanent core within small providers' request limits; creation workflows
  // receive the detailed craft sections below.
  const editing = /\b(change|remove|update|replace|make this|make the|add a|fix|tighten|edit|reword|polish|improve|revise|usual style)\b/i.test(task);
  const planning = !editing && /post|caption|hook|content|strategy|campaign|bulk|auto run|research|marketing/i.test(task);
  const visual = !editing && /visual|image|design|carousel|reel|slide|graphic|creative brief/i.test(task);
  return sections.filter((section, index) => index < 3 ||
    (section.startsWith("## Strategy and human copy") && planning) ||
    (section.startsWith("## Visual creative direction") && visual)).join("").trim();
}
