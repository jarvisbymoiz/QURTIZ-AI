import { tool, type ToolSet, type PrepareStepFunction } from "ai";
import { z } from "zod";

/** Keep all existing implementations/permission wrappers, expose only the
 * schemas the agent needs for this step. Discovery is metadata-only. */
export function createLazyChatTools(existing: ToolSet, currentRequest = "") {
  // Expose one obvious requested action immediately, avoiding a discovery-only
  // step. This changes schemas, never permissions or automatic execution.
  // Unrecognized/ambiguous requests still use model-directed discovery.
  const editing = /\b(edit|update|change|remove|replace|improve|rewrite|revise|shorten)\b/i.test(currentRequest) || /\bmake (it|this) (more|less)|\buse my usual style/i.test(currentRequest);
  const direct = /\b(schedule|reschedule)\b/i.test(currentRequest) ? "schedule_content"
    : editing ? "edit_content"
    : /\b(create|generate|write|make|turn|convert)\b/i.test(currentRequest) && /\b(post|content|carousel|reel|version)\b/i.test(currentRequest) ? "create_content"
    : null;
  const initial = direct && direct in existing ? [direct, ...(direct === "edit_content" && "find_posts" in existing ? ["find_posts"] : [])] : [];
  const names = Object.keys(existing) as [string, ...string[]];
  const tools: ToolSet = { ...existing, discover_tools: tool({
    description: "Enable tools needed for the next step. Choose up to four exact names: content/library/visual/approval/scheduling, research/web/competitors, analytics, or bulk status/plans. All names are listed in the input enum. Do not enable unrelated tools.",
    inputSchema: z.object({ names: z.array(z.enum(names)).min(1).max(4) }),
    execute: async ({ names }) => ({ enabledTools: [...new Set(names)] }),
  }) };
  // Editing has its own read/patch workflow. Brand and memory writes remain
  // discoverable, avoiding unrelated schema overhead on small-model edits.
  const core = (direct === "edit_content" ? ["discover_tools", "get_content"] : ["discover_tools", "get_brand_brain", "get_content", "list_workspace_facts", "update_brand_memory"]).filter(name => name in tools);
  const prepareStep: PrepareStepFunction<ToolSet> = ({ steps }) => {
    // Only the latest discovery in THIS run controls availability. Old
    // conversations/tool results never reactivate schemas on a new turn.
    for (const step of [...steps].reverse()) {
      const discovery = [...step.toolResults].reverse().find(result => result.toolName === "discover_tools");
      if (discovery) {
        const output = discovery.output as { enabledTools?: string[] };
        return { activeTools: [...new Set([...core, ...(output.enabledTools ?? []).filter(name => name in existing)])] };
      }
    }
    return { activeTools: [...core, ...initial] };
  };
  return { tools, prepareStep };
}
