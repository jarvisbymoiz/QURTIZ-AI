import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startCloudWorker } from "./cloud-worker.mjs";

const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });

test("outbound worker claims once, uploads binary, and completes without cloud image JSON", async () => {
  const root = mkdtempSync(join(tmpdir(), "qurtiz-cloud-worker-"));
  const statePath = join(root, "session.json");
  const origin = "https://qurtiz-ai.vercel.app";
  writeFileSync(statePath, JSON.stringify({ pairingSecret: "local-test-key",
    cloudPairing: { origin, deviceId: "device-1", credential: "device-1.private-test-token" } }));
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(128)]);
  const seen = [];
  let claims = 0;
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    seen.push({ url, method: options.method, body: options.body });
    if (url.endsWith("/status")) return Response.json({ connected: true, imageRouteReady: true, imageStatus: "available" });
    if (url.endsWith("/api/companion/heartbeat")) return Response.json({ online: true });
    if (url.endsWith("/api/companion/jobs/claim")) {
      claims += 1;
      return Response.json({ job: claims === 1 ? { id: "job-1", claimToken: "claim-token", prompt: "A blue circle",
        size: "1024x1024", quality: "low", references: [] } : null });
    }
    if (url.endsWith("/api/companion/jobs/job-1/state")) return Response.json({ status: "generating" });
    if (url.endsWith("/v1/images/generations")) return Response.json({ data: [{ b64_json: png.toString("base64") }] });
    if (url.endsWith("/api/companion/jobs/job-1/upload-ticket")) {
      return Response.json({ path: "workspace/visuals/job-1-raw", uploadUrl: "https://example.supabase.co/upload" });
    }
    if (url === "https://example.supabase.co/upload") return new Response("", { status: 200 });
    if (url.endsWith("/api/companion/jobs/job-1/complete")) return Response.json({ status: "completed" });
    throw new Error(`Unexpected request: ${url}`);
  };
  const stop = startCloudWorker({ statePath, port: 8788, origins: [origin] });
  try {
    await new Promise(resolve => setTimeout(resolve, 1500));
    assert.equal(seen.filter(row => row.url.endsWith("/v1/images/generations")).length, 1);
    assert.equal(seen.filter(row => row.url.endsWith("/api/companion/jobs/job-1/complete")).length, 1);
    const upload = seen.find(row => row.url === "https://example.supabase.co/upload");
    assert.equal(upload.method, "PUT");
    assert.ok(Buffer.isBuffer(upload.body));
    assert.equal(upload.body.length, png.length);
    assert.equal(seen.filter(row => row.url.startsWith(origin)).some(row =>
      typeof row.body === "string" && row.body.includes(png.toString("base64"))), false);
  } finally { stop(); globalThis.fetch = originalFetch; rmSync(root, { recursive: true, force: true }); }
});

test("revoked cloud device triggers local ChatGPT disconnect without generating", async () => {
  const root = mkdtempSync(join(tmpdir(), "qurtiz-cloud-revoke-"));
  const statePath = join(root, "session.json");
  const origin = "https://qurtiz-ai.vercel.app";
  writeFileSync(statePath, JSON.stringify({ pairingSecret: "local-test-key",
    cloudPairing: { origin, deviceId: "device-1", credential: "device-1.private-test-token" } }));
  const seen = [];
  globalThis.fetch = async (input) => {
    const url = String(input); seen.push(url);
    if (url.endsWith("/status")) return Response.json({ connected: true, imageRouteReady: true, imageStatus: "available" });
    if (url.endsWith("/api/companion/heartbeat")) return Response.json({ error: "Device revoked" }, { status: 410 });
    if (url.endsWith("/disconnect")) return Response.json({ disconnected: true });
    throw new Error(`Unexpected request: ${url}`);
  };
  const stop = startCloudWorker({ statePath, port: 8788, origins: [origin] });
  try {
    await new Promise(resolve => setTimeout(resolve, 1500));
    assert.ok(seen.some(url => url.endsWith("/disconnect")));
    assert.equal(seen.some(url => url.endsWith("/api/companion/jobs/claim")), false);
  } finally { stop(); globalThis.fetch = originalFetch; rmSync(root, { recursive: true, force: true }); }
});
