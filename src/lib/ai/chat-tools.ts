import { tool, type ToolSet, type PrepareStepFunction } from "ai";
import { z } from "zod";

/** Keep all existing implementations/permission wrappers, expose only the
 * schemas the agent needs for this step. Discovery is metadata-only. */
export function createLazyChatTools(existing: ToolSet, currentRequest = "", system?: string, onRegistry?: (names: string[]) => void) {
  // Expose one obvious requested action immediately, avoiding a discovery-only
  // step. This changes schemas, never permissions or automatic execution.
  // Unrecognized/ambiguous requests still use model-directed discovery.
  //
  // The editing-detection regex is intentionally permissive: any natural
  // cue that the user is modifying an existing post (rather than creating
  // a new one) must pre-load `edit_content` + `find_posts`. The previous
  // narrow list missed common phrasings like "make this post better",
  // "add a CTA", "fix the typo", "the last post needs a caption",
  // "use my usual style" — and on those turns the model would emit an
  // `edit_content` tool-call that the SDK then rejected with
  // "attempted to call tool 'edit_content' which was not in request.tools"
  // (code: tool_use_failed). The system prompt explicitly tells the model
  // to use `edit_content` for modifications; the schema list has to agree
  // with that guidance or the very first step is a hard validation failure.
  // Editing verbs (broadly inclusive so natural phrasings like
  // "make the caption friendlier" or "replace the headline" still pre-load
  // the edit_content schema rather than triggering a tool-call validation
  // failure when the model decides to call edit_content directly).
  const editingVerb =
    /\b(edit|update|change|modify|alter|fix|polish|tweak|refine|adjust|amend|rework|reword|rewrite|revise|shorten|trim|expand|correct|revamp|rephrase|restyle|spruce|punch\s*up|clean\s*up|buff|touch\s*up|fix\s*up|paraphrase|improve|replace|swap|swap\s+out|drop|strip|delete|remove|rename|move|combine|merge|split|duplicate|copy|switch|tone\s+down|tone\s+up|tighten|loosen)\b/i;
  const editingImperative =
    /\bmake\s+(it|this|that|the\s+\w+|my)\s+(better|worse|nicer|cleaner|stronger|friendlier|engaging|more\s+(engaging|clickable|playful|formal|warm|bold|friendly|casual|serious|curious|confident|punchy|concise)|less\s+(formal|casual))\b/i;
  const editingReference =
    /\b(this\s+(post|one|caption|reel|carousel|script)|my\s+(last|recent|previous|saved|draft)|the\s+(last|recent|previous|saved|draft|existing)\s+(post|one)?|existing\s+(post|one))\b/i;
  const editingAdditions =
    /\b(add|insert|drop|remove|delete|strip|tweak)\s+(a|an|the|my)?\s*(cta|hashtag|hashtags|link|hook|emoji|emojis|tags?)\b/i;
  const editingStyle =
    /\b(use\s+my\s+(usual|favorite|saved|preferred)\s+style)\b/i;
  const editing =
    editingVerb.test(currentRequest) ||
    editingImperative.test(currentRequest) ||
    editingReference.test(currentRequest) ||
    editingAdditions.test(currentRequest) ||
    editingStyle.test(currentRequest);
  const direct = /\b(schedule|reschedule)\b/i.test(currentRequest) ? "schedule_content"
    : editing ? "edit_content"
    : /\b(create|generate|write|make|turn|convert)\b/i.test(currentRequest) && /\b(post|content|carousel|reel|version)\b/i.test(currentRequest) ? "create_content"
    : null;
  const research = /\b(search|research|latest|current|today|news|trends?|look\s*up|find\s+out)\b/i.test(currentRequest);
  const initial = direct && direct in existing ? [direct, ...(direct === "edit_content" && "find_posts" in existing ? ["find_posts"] : [])] : [];
  if (research && "web_search" in existing) initial.push("web_search");
  const names = Object.keys(existing) as [string, ...string[]];
  const tools: ToolSet = { ...existing, discover_tools: tool({
    description: "Enable tools needed for the next step. Choose up to four exact names: content/library/visual/approval/scheduling, research/web/competitors, analytics, or bulk status/plans. All names are listed in the input enum. Do not enable unrelated tools.",
    inputSchema: z.object({ names: z.array(z.enum(names)).min(1).max(4) }),
    execute: async ({ names }) => ({ enabledTools: [...new Set(names)] }),
  }) };
  // Editing has its own read/patch workflow. Brand and memory writes remain
  // discoverable, avoiding unrelated schema overhead on small-model edits.
  const core = (direct ? ["discover_tools", "get_content", ...(direct === "create_content" ? ["get_brand_brain"] : [])] : ["discover_tools", "get_brand_brain", "get_content", "list_workspace_facts", "update_brand_memory"]).filter(name => name in tools);
  const stepConfig = (names: string[]) => {
    // Search is a read-only backend capability: never gate it on intent heuristics.
    const activeTools = [...new Set([...names, ...("web_search" in tools ? ["web_search"] : [])])].filter(name => name in tools);
    onRegistry?.(activeTools);
    return { activeTools, ...(system === undefined ? {} : { system: `${system}

## Current request tool registry (authoritative)
Attached callable tools for this step: ${activeTools.join(", ")}. Only call these exact names. Other workflow references describe possible capabilities, not attached tools. For an absent capability, call discover_tools first and wait for its result; never invoke a model-native search tool. Research uses the attached Qurtiz web_search implementation. Prior conversation tool availability does not apply to this request.` }) };
  };
  const prepareStep: PrepareStepFunction<ToolSet> = ({ steps }) => {
    // Only the latest discovery in THIS run controls availability. Old
    // conversations/tool results never reactivate schemas on a new turn.
    for (const step of [...steps].reverse()) {
      const discovery = [...step.toolResults].reverse().find(result => result.toolName === "discover_tools");
      if (discovery) {
        const output = discovery.output as { enabledTools?: string[] };
        return stepConfig(["discover_tools", ...("web_search" in tools ? ["web_search"] : []), ...("get_content" in tools ? ["get_content"] : []), ...(output.enabledTools ?? []).filter(name => name in existing)]);
      }
    }
    return stepConfig([...core, ...initial, ...("web_search" in tools ? ["web_search"] : [])]);
  };
  return { tools, prepareStep };
}
