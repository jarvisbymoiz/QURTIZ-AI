import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const modulePath = "node_modules/ai-zero-token/dist/core/providers/openai-codex/chatgpt-web-image.js";
const edits = [
  [
    'function updateState(state, payload, event) {',
    'function qurtizImageToolError(content) {\n  if (!isRecord(content) || content.content_type !== "system_error") return "";\n  return content.name === "ChatGPTAgentToolRateLimitException"\n    ? "ChatGPT image tool is rate limited for this account. Try again after its limit resets."\n    : "ChatGPT image tool failed upstream.";\n}\nfunction updateState(state, payload, event) {',
  ],
  [
    'if (author.role === "tool" && metadata.async_task_type === "image_gen") {',
    'if (author.role === "tool") state.terminalError = qurtizImageToolError(message?.content) || state.terminalError;\n    if (author.role === "tool" && (metadata.async_task_type === "image_gen" || message?.content?.parts?.some((part) => isRecord(part) && part.content_type === "image_asset_pointer"))) {',
  ],
  [
    'if (author.role !== "tool" || metadata.async_task_type !== "image_gen" || !Array.isArray(content.parts)) {',
    'if (author.role === "tool") terminalError = qurtizImageToolError(content) || terminalError;\n    if (author.role !== "tool" || !Array.isArray(content.parts) ||\n      (metadata.async_task_type !== "image_gen" && !content.parts.some((part) => isRecord(part) && part.content_type === "image_asset_pointer"))) {',
  ],
  [
    'const sedimentIds = [];\n  for (const node of Object.values(mapping)) {',
    'const sedimentIds = [];\n  let terminalError = "";\n  for (const node of Object.values(mapping)) {',
  ],
  [
    'return { fileIds, sedimentIds };\n}\nasync function pollImageIds',
    'return { fileIds, sedimentIds, terminalError };\n}\nasync function pollImageIds',
  ],
  [
    'if (ids.fileIds.length > 0 || ids.sedimentIds.length > 0) {\n      return ids;\n    }',
    'if (ids.fileIds.length > 0 || ids.sedimentIds.length > 0 || ids.terminalError) {\n      return ids;\n    }',
  ],
  [
    'let sedimentIds = state.sedimentIds;\n  if (fileIds.length === 0 && sedimentIds.length === 0) {',
    'let sedimentIds = state.sedimentIds;\n  if (state.terminalError && fileIds.length === 0 && sedimentIds.length === 0) throw new Error(state.terminalError);\n  if (fileIds.length === 0 && sedimentIds.length === 0) {',
  ],
  [
    'const polled = await pollImageIds(profile, state.conversationId);\n    fileIds = polled.fileIds.filter((id) => id !== "file_upload");',
    'const polled = await pollImageIds(profile, state.conversationId);\n    if (polled.terminalError && polled.fileIds.length === 0 && polled.sedimentIds.length === 0) throw new Error(polled.terminalError);\n    fileIds = polled.fileIds.filter((id) => id !== "file_upload");',
  ],
];

export function patchGatewayImageSource(source) {
  let patched = source;
  for (const [before, after] of edits) {
    if (patched.includes(after)) continue;
    if (patched.split(before).length !== 2) throw new Error("AI-Zero-Token image implementation changed; review the patch before packaging.");
    patched = patched.replace(before, after);
  }
  const hintStart = '  const hints = {\n';
  const hintEnd = '  return `${prompt.trim()}';
  const start = patched.indexOf(hintStart, patched.indexOf('function promptWithSize('));
  const end = patched.indexOf(hintEnd, start);
  if (start < 0 || end < 0 || patched.indexOf(hintStart, start + 1) !== -1) {
    throw new Error("AI-Zero-Token size hints changed; review the prompt patch before packaging.");
  }
  const englishHints = `  const hints = {
    "1:1": "Create a 1:1 square composition suitable for a square social-media canvas.",
    "16:9": "Create a 16:9 landscape composition suitable for a wide social-media canvas.",
    "9:16": "Create a 9:16 portrait composition suitable for a vertical social-media canvas.",
    "4:3": "Create a 4:3 landscape composition with balanced framing.",
    "3:4": "Create a 3:4 portrait composition with balanced framing."
  };
  const normalized = size.trim();
  const hint = hints[normalized] ?? \`Create an image with a \${normalized} aspect ratio.\`;
`;
  patched = patched.slice(0, start) + englishHints + patched.slice(end);
  return patched;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] || ".");
  const file = resolve(root, modulePath);
  const original = readFileSync(file, "utf8");
  const patched = patchGatewayImageSource(original);
  if (patched !== original) writeFileSync(file, patched);
  console.log("Applied reviewed Free image pointer compatibility patch.");
}
