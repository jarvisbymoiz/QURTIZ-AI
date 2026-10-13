import { describe, expect, it } from "vitest";
import { isWorkspaceStorageKey } from "../storage-key";
import { readBoundedJson } from "../bounded-response";
import { permitsAgentApproval } from "../agent-intent";
const id = "00000000-0000-4000-8000-000000000001";
describe("storage object isolation", () => {
  it("preserves normal nested object keys", () => expect(isWorkspaceStorageKey("tenant/visuals/post/image.png", "tenant")).toBe(true));
  it.each(["foreign/logo/a.png", "tenant/../foreign/a.png", "tenant/%2e%2e/a.png", "tenant/a\\..\\foreign/a.png", "tenant//a", "tenant/./a", "tenant/a?x", "tenant/a#x"])("rejects ambiguous or foreign object key %s", path => expect(isWorkspaceStorageKey(path, "tenant")).toBe(false));
});
describe("provider response memory boundary", () => {
  it("accepts bounded JSON", async () => expect(await readBoundedJson(Response.json({ ok: true }), 64)).toEqual({ ok: true }));
  it("rejects an oversized declared response before reading", async () => {
    await expect(readBoundedJson(new Response("{}", { headers: { "content-length": "100" } }), 10)).rejects.toThrow("allowed size");
  });
  it("rejects chunked overflow with no content-length", async () => {
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("{\"payload\":\"" + "a".repeat(100) + "\"}")); controller.close(); } });
    await expect(readBoundedJson(new Response(stream), 16)).rejects.toThrow("allowed size");
  });
});
describe("agent approval authority", () => {
  it("accepts the requested resource", () => expect(permitsAgentApproval(`Approve ${id}`, id)).toBe(true));
  it("rejects an injected alternative resource", () => expect(permitsAgentApproval(`Approve ${id}`, "00000000-0000-4000-8000-000000000002")).toBe(false));
  it.each([undefined, "Research a post", "What is approval?", `Do not approve ${id}`, `Never approve ${id}`])("requires explicit human authorization %s", request => expect(permitsAgentApproval(request, id)).toBe(false));
});
