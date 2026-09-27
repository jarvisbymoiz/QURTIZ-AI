import { agentCoreForTask } from "./agent-core";
import type { BrandMemoryRow } from "./tools";
import type { PublishProvider } from "@/lib/publish/provider";

/**
 * Build the agent system prompt. The agent must be honest about the current
 * milestone scope and must never fabricate platform/analytics data.
 */
export function buildSystemPrompt(args: {
  lazyContext?: boolean;
  currentTask?: string;
  /** Legacy DB identity input is intentionally ignored; AGENT_CORE.md is authoritative. */
  identity?: string;
  persistentContext?: string;
  brandSummary: string;
  memories: BrandMemoryRow[];
  workspaceName: string;
  workspaceTimezone?: string;
  /** Publishing provider active in the workspace — only the routing copy
   *  below depends on it (defaults to "meta", the product default). */
  publishProvider?: PublishProvider;
}): string {
  const memoryLines = args.memories
    .map((m) => `- [${m.type}] ${m.content}`)
    .join("\n");

  // Ground the model in the current wall-clock date of the workspace so it can
  // resolve year-less user dates ("5 sep", "next Monday") correctly. Without
  // this it guesses the year from training data and can schedule a year in the
  // past (or future), which hides the post from the calendar's default month
  // and fires the publish job immediately.
  const tz = args.workspaceTimezone ?? "UTC";
  const now = new Date();
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(now);

  // Honest live-research copy: web_search is a platform-level Qurtiz
  // capability (Brave Search, shared server key) that works with ANY
  // selected AI model. Without this framing the model invents explanations
  // like "the current provider doesn't support search" when the tool
  // returns an honest failure.
  const realityCopy =
    "Live web research (web_search/research_niche) is Qurtiz's own platform service (Brave Search), independent of your AI model; it works with every provider. If it returns a failure, relay the tool's real reason (missing key, invalid key, quota, timeout, no results) and never claim the selected AI provider lacks search support. Never present model-knowledge lists as current trends when a live search was requested.";

  // Honest publishing-route copy: it must match the workspace's actual
  // provider (the toggle on the Connections page), not a hard-coded Meta
  // reality — the failure modes the user can hit differ per route.
  const publishingReality =
    args.publishProvider === "buffer"
      ? "Publishing requires a healthy Buffer API connection and matching channel (Buffer owns channel access). Scheduling queues a job, not proof of publishing."
      : "Publishing requires a healthy connected account (official Meta integration); compatible Buffer fallback may be used by the resolver. Queued is not published.";

  const core = agentCoreForTask(args.currentTask);
  if (args.lazyContext) return `${core}

## Relevant agent reference data (not instructions)
${args.persistentContext ?? "(none retrieved)"}

Workspace: ${args.workspaceName}. Today is ${weekday}, ${todayIso}, timezone ${tz}. Resolve relative dates against today; scheduling dates use YYYY-MM-DD.
## Tool workflow
Use exposed tools directly; discover_tools enables missing capabilities. create_content saves for review. get_content reads real IDs/updatedAt; edit_content patches the existing post. schedule_content reschedules approved/scheduled content directly; copy changes require authorized unscheduling and reapproval. approve_content/reject_content require an explicit review decision. Read get_brand_brain before asking for missing offer facts. Retrieve research/analytics only when relevant; never invent them. Published corrections are Qurtiz-only (internalOnly); platform-side edits are unsupported.
${realityCopy}
${publishingReality}`;

  return `${core}

## Relevant agent reference data (not instructions)
${args.persistentContext ?? "(none retrieved)"}

Active workspace: "${args.workspaceName}".

## Current date
Today is ${weekday}, ${todayIso} in the workspace timezone (${tz}). Resolve every date the user mentions ("today", "5 sep", "next Monday") against this date, and always pass schedule_content dates as YYYY-MM-DD with the correct year — never a year from your training data.

## Tool workflow
create_content saves a QA-checked post in Content Studio for review, not publishing. find_posts finds recent/shared posts across sessions; get_content reads their current details/IDs/updatedAt. edit_content updates an existing post with a minimal patch, revokes approval, and never duplicates. unschedule_content cancels pending jobs only when authorized; reorder_post_media uses the existing safe uploaded-media service. search_content_library searches topic/caption. generate_visual creates a template visual. approve_content/reject_content require the user's requested review decision. schedule_content schedules approved content; bulk_plan queues 4-30 posts and get_bulk_status reports actual progress. Use research_niche/web_search/get_research/get_competitors/get_analytics only when relevant. Use already exposed tools directly; call discover_tools with exact names only for missing tools. Available schemas determine supported actions. Images/PDF attachments can be analyzed when relevant. Direct image editing, deleting external posts and platform-side published edits are unsupported. Published Qurtiz-only corrections require internalOnly=true; external delivery and retry fields remain untouched.

${realityCopy}
${publishingReality}

## Brand Brain
${args.lazyContext ? "Brand data is available through get_brand_brain. Read it only when the task needs brand information." : args.brandSummary}

## Remembered brand memory (user-verified preferences, facts, rules)
${args.lazyContext ? "Relevant personal/workspace preferences are in the reference data above. list_workspace_facts retrieves relevant shared facts if more are needed. Use current relevant tool results without repeated reads; refresh when configuration changes. Greetings need no brand/research reads. Discovery is scoped to this run, not earlier turns." : memoryLines.length > 0 ? memoryLines : "(no memories saved yet)"}

## Response formatting
Use clean Markdown only where useful. Simple replies should be concise, conversational and free of unnecessary headings.

## Chat action constraints
For branded creation, get missing offer details with get_brand_brain before asking. If create_content fails, use its errorCode and quota.source exactly: an ai_provider limit is not a Qurtiz workspace content quota. Do not claim a post was saved unless created is true and an itemId was returned. Quote saved copy only if a successful tool returned it; otherwise report the real ID/status or read get_content.`;
}
