import { createHash } from "node:crypto";
import { z } from "zod";

export const memoryInputSchema = z.object({
  scope: z.enum(["user", "workspace"]).default("user"),
  type: z.enum(["preference", "fact", "rule"]),
  key: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/).optional(),
  category: z.enum(["general", "copy", "visual", "strategy", "workflow", "research", "analytics", "scheduling"]).default("general"),
  content: z.string().trim().min(3).max(1000),
}).superRefine((input, ctx) => {
  if (/^(core|security|system|identity)\./.test(input.key ?? "")) ctx.addIssue({ code: "custom", message: "Protected instructions cannot be learned as memory." });
  if (/\b(?:sk-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}|(?:password|api[_ ]?key|access[_ ]?token|secret)\s*[:=]\s*\S+)/i.test(input.content)) ctx.addIssue({ code: "custom", message: "Do not store credentials in agent memory." });
});
export type MemoryInput = z.infer<typeof memoryInputSchema>;

export function memoryKey(content: string, supplied?: string) {
  // Explicit non-preference keys belong to the structured subject chosen by
  // the agent/editor. A business fact mentioning "professional" is not a tone.
  if (supplied && !supplied.startsWith("note.") && !/(?:^|\.)(?:captions?|copy|response)\.(?:language|emojis?|tone)$/.test(supplied)) return supplied;
  const platform = /\bfacebook\b/i.test(content) ? "facebook." : /\binstagram\b/i.test(content) ? "instagram." : "";
  // Canonical common slots resolve conflicts even when the model varies a key.
  if (/\b(reply|respond|responses?|answers?)\b/i.test(content) && /\b(english|urdu|arabic|spanish|language)\b/i.test(content)) return "response.language";
  if (/\b(captions?|copy|content|write|generate)\b/i.test(content) && /\b(english|urdu|arabic|spanish|language)\b/i.test(content)) return platform + "caption.language";
  if (/\bemojis?\b/i.test(content)) return platform + "copy.emojis";
  if (/\btone\b/i.test(content) || /\b(use|prefer|write|sound|keep|be)\b.{0,40}\b(professional|casual)\b/i.test(content)) return platform + "copy.tone";
  return supplied ?? "note." + createHash("sha256").update(content.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim()).digest("hex").slice(0, 24);
}

type Candidate = { content: string; category: string; memoryKey: string | null; updatedAt: Date; type?: string };
export function selectRelevantMemories<T extends Candidate>(rows: T[], task: string, maxChars = 2400, scope: "user" | "workspace" = "user"): T[] {
  const words = new Set(task.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
  const copy = /caption|post|content|write|create|generate|rewrite|tone|style/i.test(task);
  const work = /brand|post|content|caption|strategy|research|analytic|schedul|publish|visual|reel|carousel/i.test(task);
  const category = /schedul|calendar|publish/i.test(task) ? "scheduling" : /analytic|performance|engagement/i.test(task) ? "analytics" : /research|trend|competitor/i.test(task) ? "research" : copy ? "copy" : "general";
  let used = 0;
  const platform = /facebook/i.test(task) && !/instagram/i.test(task) ? "facebook" : /instagram/i.test(task) && !/facebook/i.test(task) ? "instagram" : null;
  return rows.filter(row => !platform || !/^(facebook|instagram)\./.test(row.memoryKey ?? "") || row.memoryKey?.startsWith(platform + "."))
    .map(row => ({ row, score: (row.category === category && category !== "general" ? 3 : 0)
    + (/^response\./.test(row.memoryKey ?? "") || ["copy.emojis", "copy.tone"].includes(row.memoryKey ?? "") ? 3 : 0)
    + (row.category === "workflow" && /creat|post|schedul|publish|approv|workflow/i.test(task) ? 2 : 0)
    + (row.category === "strategy" && /creat|post|content|strategy|research/i.test(task) ? 2 : 0)
    + (row.type === "rule" && work ? 3 : 0)
    + (work && /^brand\./.test(row.memoryKey ?? "") ? 3 : 0)
    + (scope === "workspace" && work && row.type === "fact" && row.category === "general" ? 2 : 0)
    + (copy && /avoid|never|do not|don't|must not/i.test(row.content) ? 2 : 0)
    + (copy && /caption\.|copy\./.test(row.memoryKey ?? "") ? 4 : 0)
    + ((row.content + " " + (row.memoryKey ?? "")).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter(word => words.has(word)).length }))
    .filter(hit => hit.score > 0).sort((a, b) => b.score - a.score || b.row.updatedAt.getTime() - a.row.updatedAt.getTime())
    .filter(({ row }) => { if (used + row.content.length > maxChars) return false; used += row.content.length; return true; })
    .slice(0, 8).map(hit => hit.row);
}

/** Allocate reference context within the selected model's request budget.
 * Omitted values stay in the database and can be retrieved through tools. */
export function boundedAgentReference(context: { personal: { key: string | null; content: string }[]; workspace: { key: string | null; content: string }[]; profile: Record<string, string> | null }, maxBytes = 3200) {
  const selected: typeof context & { omitted?: boolean } = { personal: [], workspace: [], profile: null, omitted: false };
  const fits = () => Buffer.byteLength(JSON.stringify(selected), "utf8") <= maxBytes;
  for (const scope of ["personal", "workspace"] as const) {
    for (const row of context[scope]) {
      selected[scope].push(row);
      if (!fits()) { selected[scope].pop(); selected.omitted = true; }
    }
  }
  if (context.profile) {
    selected.profile = {};
    for (const [key, value] of Object.entries(context.profile)) {
      if (!value) continue;
      selected.profile[key] = value;
      if (!fits()) { delete selected.profile[key]; selected.omitted = true; }
    }
  }
  return JSON.stringify(selected);
}
