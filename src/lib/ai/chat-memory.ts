/** Faithful selected excerpts when a provider cannot produce a summary.
 * This is reference compression, not invented AI output. Omitted source stays
 * in the original conversation. Explicitly label omissions and provenance. */
export function extractiveConversationMemory(previous: string, source: string, tokenCap: number): string {
  const header = "Selected verbatim reference excerpts; not exhaustive. Original conversation retains omitted details.";
  const estimate = (text: string) => Math.ceil(Buffer.byteLength(JSON.stringify(text), "utf8") / 3) + 32;
  const normalize = (value: string): string => {
    try {
      const parsed: unknown = JSON.parse(value);
      const lines: string[] = [];
      const walk = (entry: unknown, field = "") => {
        if (typeof entry === "string") { if (entry.trim()) lines.push((field ? field + ": " : "") + entry); }
        else if (Array.isArray(entry)) entry.forEach(item => walk(item, field));
        else if (entry && typeof entry === "object") {
          const message = entry as { role?: string; content?: unknown[] };
          if (typeof message.role === "string" && Array.isArray(message.content)) { walk(message.content, message.role); return; }
          Object.entries(entry).forEach(([key, val]) => {
            if (!["type", "role", "providerOptions"].includes(key)) walk(val, field ? field + "." + key : key);
          });
        }
        else if (entry !== null && entry !== undefined) lines.push(field + ": " + String(entry));
      };
      walk(parsed); return lines.join("\n");
    } catch { return value; } // chunk fragments remain literal source excerpts
  };
  const candidates = [...normalize(previous).split(/\n|(?<=[.!?;])\s+/).map(text => ({ text, prior: true })),
    ...normalize(source).split(/\n|(?<=[.!?;])\s+/).map(text => ({ text, prior: false }))]
    .map((entry, index) => ({ ...entry, index, priority: (entry.prior ? 20 : 0) + (/instead|correction|changed|replace|no longer|actually/i.test(entry.text) ? 60 : 0) + (/must|never|always|prefer|decision|require|pending|unresolved|constraint|approved|id[:"\s]/i.test(entry.text) ? 30 : 0) }))
    .filter(entry => entry.text.trim() && entry.text.trim() !== header && !/^(Selected verbatim reference excerpts|not exhaustive|Original conversation retains omitted details)/i.test(entry.text.trim()))
    .sort((a, b) => b.priority - a.priority || b.index - a.index);
  let memory = header;
  const seen = new Set<string>();
  for (const entry of candidates) {
    const text = entry.text.trim(); if (seen.has(text)) continue; seen.add(text);
    if (estimate(memory + "\n" + text) <= tokenCap) { memory += "\n" + text; continue; }
    // A single long paragraph/JSON fragment may not have sentence boundaries.
    // Keep an explicitly partial, word-boundary excerpt rather than fabricate.
    const remaining = Math.max(0, Math.floor((tokenCap - estimate(memory) - 20) * 2));
    if (remaining < 48) continue;
    let excerpt = text.slice(0, remaining); excerpt = excerpt.slice(0, excerpt.lastIndexOf(" ") > 0 ? excerpt.lastIndexOf(" ") : excerpt.length);
    while (excerpt.length && estimate(memory + "\n[excerpt] " + excerpt) > tokenCap) excerpt = excerpt.slice(0, -8);
    if (excerpt) memory += "\n[excerpt] " + excerpt;
  }
  return memory;
}
