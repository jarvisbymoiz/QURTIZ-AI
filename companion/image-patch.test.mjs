import test from "node:test";
import assert from "node:assert/strict";
import { patchGatewayImageSource } from "../scripts/patch-companion-image.mjs";

const oldSource = `
function promptWithSize(prompt, size) {
  const hints = {
    "1:1": "old hint"
  };
  const normalized = size.trim();
  const hint = hints[normalized] ?? "old fallback";
  return \`\${prompt.trim()}\n\n\${hint}\`;
}
function updateState(state, payload, event) {
if (author.role === "tool" && metadata.async_task_type === "image_gen") {
  addUnique(state.fileIds, ids.fileIds);
}
}
const sedimentIds = [];
  for (const node of Object.values(mapping)) {
if (author.role !== "tool" || metadata.async_task_type !== "image_gen" || !Array.isArray(content.parts)) {
  continue;
}
return { fileIds, sedimentIds };
}
async function pollImageIds
if (ids.fileIds.length > 0 || ids.sedimentIds.length > 0) {
      return ids;
    }
let sedimentIds = state.sedimentIds;
  if (fileIds.length === 0 && sedimentIds.length === 0) {
const polled = await pollImageIds(profile, state.conversationId);
    fileIds = polled.fileIds.filter((id) => id !== "file_upload");
`;

test("gateway patch supports typed image pointers and retains legacy image_gen metadata", () => {
  const patched = patchGatewayImageSource(oldSource);
  assert.match(patched, /part\.content_type === "image_asset_pointer"/);
  assert.match(patched, /metadata\.async_task_type === "image_gen" \|\|/);
  assert.match(patched, /metadata\.async_task_type !== "image_gen" &&/);
  assert.match(patched, /ChatGPTAgentToolRateLimitException/);
  assert.match(patched, /Create a 1:1 square composition/);
  assert.doesNotMatch(patched, /old hint/);
  assert.match(patched, /if \(ids\.fileIds\.length > 0 \|\| ids\.sedimentIds\.length > 0 \|\| ids\.terminalError\)/);
  assert.equal(patchGatewayImageSource(patched), patched);
});

test("gateway packaging stops when upstream extraction guards change", () => {
  assert.throws(() => patchGatewayImageSource("different upstream implementation"), /review the patch/);
});
