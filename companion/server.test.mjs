import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { companionConfigFromEnv, createCompanionServer, listenCompanion } from "./server.mjs";

const origin = "https://qurtiz-ai.vercel.app";
let upstream;
let companion;
let base;
let received = null;
let profile = null;
let freeEnabled = false;
let loginWithoutQuota = false;
let selectedTextModel = null;
let imageRequestCount = 0;

before(async () => {
  upstream = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    received = { path: req.url, authorization: req.headers.authorization, contentType: req.headers["content-type"], body: Buffer.concat(chunks).toString() };
    if (req.url?.startsWith("/v1/images/")) imageRequestCount++;
    if (req.url === "/_gateway/admin/login") profile = { profileId: "local-profile", email: "person@example.com",
      ...(loginWithoutQuota ? {} : { quota: { planType: "free" } }), accessTokenPreview: "secret-preview" };
    if (req.url === "/_gateway/admin/settings") {
      const settings = JSON.parse(received.body || "{}");
      if (settings.image?.freeAccountWebGenerationEnabled) freeEnabled = true;
      if (settings.defaultModel) selectedTextModel = settings.defaultModel;
    }
    if (req.url === "/_gateway/admin/profiles/sync-quota" && selectedTextModel === "compatible" && profile) {
      profile.quota = { planType: "free" };
    }
    if (req.url === "/_gateway/admin/profiles/remove") profile = null;
    if (req.url === "/v1/models") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ data: [{ id: "unsupported" }, { id: "compatible" }] }));
    }
    if (req.url === "/_gateway/models/refresh") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ data: [{ id: "account-current-model", input: ["text", "image"], source: "codex-network" }] }));
    }
    if (req.url?.startsWith("/_gateway/admin/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ profile, settings: { image: { freeAccountWebGenerationEnabled: freeEnabled } },
        accessTokenPreview: "secret-preview" }));
    }
    if (received.body.includes("trigger_401")) {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: { message: "Account token expired" } }));
    }
    if (received.body.includes("trigger_429")) {
      res.writeHead(429, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: { message: "Quota exhausted for upstream-local-key" } }));
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ created: 1, data: [{ b64_json: "aGVsbG8=" }] }));
  });
  await listenCompanion(upstream, 0);
  companion = createCompanionServer({ port: 0, origins: [origin],
    upstreamUrl: `http://127.0.0.1:${upstream.address().port}/v1`, upstreamKey: "upstream-local-key", pairingSecret: "pairing-only-local" });
  await listenCompanion(companion, 0);
  base = `http://127.0.0.1:${companion.address().port}`;
  const pairing = await fetch(`${base}/pair`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ userId: "00000000-0000-4000-8000-000000000001", workspaceId: "00000000-0000-4000-8000-000000000002" }) });
  assert.equal(pairing.status, 200);
  assert.equal((await pairing.json()).pairingKey, "pairing-only-local");
});

after(async () => {
  await new Promise((resolve) => companion.close(resolve));
  await new Promise((resolve) => upstream.close(resolve));
});

test("configuration rejects non-loopback upstream", () => {
  assert.throws(() => companionConfigFromEnv({ QURTIZ_IMAGE_UPSTREAM_URL: "https://api.example.com/v1" }), /loopback/);
});

test("restart preserves the Qurtiz owner and rejects another workspace", async () => {
  const directory = mkdtempSync(join(tmpdir(), "qurtiz-companion-test-"));
  const statePath = join(directory, "session.json");
  const config = { port: 0, origins: [origin], upstreamUrl: `http://127.0.0.1:${upstream.address().port}/v1`,
    upstreamKey: "upstream-local-key", pairingSecret: "local-pairing-for-restart-test", statePath };
  const first = createCompanionServer(config);
  try {
    await listenCompanion(first, 0);
    const response = await fetch(`http://127.0.0.1:${first.address().port}/pair`, { method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "00000000-0000-0000-0000-000000000001", workspaceId: "00000000-0000-0000-0000-000000000002" }) });
    assert.equal(response.status, 200);
  } finally { await new Promise(resolve => first.close(resolve)); }
  const second = createCompanionServer({ ...config, pairingSecret: "different-secret-after-restart" });
  try {
    await listenCompanion(second, 0);
    const url = `http://127.0.0.1:${second.address().port}/pair`;
    const headers = { Origin: origin, "Content-Type": "application/json" };
    const denied = await fetch(url, { method: "POST", headers, body: JSON.stringify({
      userId: "00000000-0000-0000-0000-000000000003", workspaceId: "00000000-0000-0000-0000-000000000002" }) });
    assert.equal(denied.status, 409);
    const allowed = await fetch(url, { method: "POST", headers, body: JSON.stringify({
      userId: "00000000-0000-0000-0000-000000000001", workspaceId: "00000000-0000-0000-0000-000000000002" }) });
    assert.equal(allowed.status, 200);
    assert.equal((await allowed.json()).pairingKey, "local-pairing-for-restart-test");
  } finally {
    await new Promise(resolve => second.close(resolve));
    if (directory.startsWith(tmpdir())) rmSync(directory, { recursive: true, force: true });
  }
});

test("rejects foreign origins, invalid Host, and missing pairing", async () => {
  const foreign = await fetch(`${base}/health`, { headers: { Origin: "https://evil.example", "x-qurtiz-pairing": "pairing-only-local" } });
  assert.equal(foreign.status, 403);
  const unpaired = await fetch(`${base}/health`, { headers: { Origin: origin } });
  assert.equal(unpaired.status, 401);
  const badHostStatus = await new Promise((resolve, reject) => {
    const req = http.request(base + "/health", { headers: { Origin: origin, Host: "evil.example", "x-qurtiz-pairing": "pairing-only-local" } },
      (res) => { res.resume(); res.on("end", () => resolve(res.statusCode)); });
    req.on("error", reject);
    req.end();
  });
  assert.equal(badHostStatus, 403);
});

test("permits only the configured origin in CORS preflight", async () => {
  const response = await fetch(`${base}/v1/images/generations`, { method: "OPTIONS", headers: {
    Origin: origin, "Access-Control-Request-Private-Network": "true",
  } });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  assert.equal(response.headers.get("access-control-allow-private-network"), "true");
});

test("forwards image generation only to local OpenAI-compatible endpoint", async () => {
  const response = await fetch(`${base}/v1/images/generations`, { method: "POST", headers: {
    Origin: origin, "x-qurtiz-pairing": "pairing-only-local", "Content-Type": "application/json",
  }, body: JSON.stringify({ model: "user-selected-model", prompt: "A flower" }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  assert.equal((await response.json()).data[0].b64_json, "aGVsbG8=");
  assert.deepEqual(received, { path: "/v1/images/generations", authorization: "Bearer upstream-local-key",
    contentType: "application/json",
    body: JSON.stringify({ model: "user-selected-model", prompt: "A flower" }) });
  const blocked = await fetch(`${base}/admin/profiles`, { headers: { Origin: origin, "x-qurtiz-pairing": "pairing-only-local" } });
  assert.equal(blocked.status, 404);
});

test("forwards JSON reference edits to the image-edit endpoint", async () => {
  const payload = { model: "user-selected-model", prompt: "An edited flower",
    images: [{ image_url: "data:image/png;base64,aGVsbG8=" }] };
  const response = await fetch(`${base}/v1/images/edits`, { method: "POST", headers: {
    Origin: origin, "x-qurtiz-pairing": "pairing-only-local", "Content-Type": "application/json",
  }, body: JSON.stringify(payload) });
  assert.equal(response.status, 200);
  assert.equal(received.path, "/v1/images/edits");
  assert.equal(received.contentType, "application/json");
  assert.deepEqual(JSON.parse(received.body), payload);
});

test("distinguishes upstream login failure from companion pairing failure", async () => {
  const response = await fetch(`${base}/v1/images/generations`, { method: "POST", headers: {
    Origin: origin, "x-qurtiz-pairing": "pairing-only-local", "Content-Type": "application/json",
  }, body: JSON.stringify({ model: "model", prompt: "trigger_401" }) });
  assert.equal(response.status, 424);
  assert.match(await response.text(), /Reconnect in the gateway/);
});

test("preserves quota failure without leaking the upstream key", async () => {
  const response = await fetch(`${base}/v1/images/generations`, { method: "POST", headers: {
    Origin: origin, "x-qurtiz-pairing": "pairing-only-local", "Content-Type": "application/json",
  }, body: JSON.stringify({ model: "user-selected-model", prompt: "trigger_429" }) });
  assert.equal(response.status, 429);
  const body = await response.text();
  assert.match(body, /Quota exhausted/);
  assert.doesNotMatch(body, /upstream-local-key|pairing-only-local/);
});

test("connect delegates local OAuth and returns only safe account status", async () => {
  const response = await fetch(`${base}/connect`, { method: "POST", headers: {
    Origin: origin, "x-qurtiz-pairing": "pairing-only-local",
  } });
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(body, /person@example.com/);
  assert.match(body, /"freeRouteEnabled":true/);
  assert.doesNotMatch(body, /secret-preview|accessToken|refreshToken/);
});

test("login discovers account models without generating an image or probing text models", async () => {
  loginWithoutQuota = true;
  selectedTextModel = null;
  freeEnabled = false;
  const beforeImages = imageRequestCount;
  const response = await fetch(`${base}/connect`, { method: "POST", headers: {
    Origin: origin, "x-qurtiz-pairing": "pairing-only-local",
  } });
  loginWithoutQuota = false;
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(selectedTextModel, null);
  assert.equal(imageRequestCount, beforeImages);
  assert.equal(body.planType, null);
  assert.equal(body.freeRouteEnabled, true);
  assert.equal(body.imageRouteReady, true);
  assert.equal(body.imageStatus, "available");
});

test("test-image verifies a real local response without returning image data", async () => {
  const beforeImages = imageRequestCount;
  const response = await fetch(`${base}/test-image`, { method: "POST", headers: {
    Origin: origin, "x-qurtiz-pairing": "pairing-only-local",
  } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(imageRequestCount, beforeImages + 1);
});

test("disconnect rotates pairing and refuses the old key", async () => {
  const response = await fetch(`${base}/disconnect`, { method: "POST", headers: {
    Origin: origin, "x-qurtiz-pairing": "pairing-only-local",
  } });
  assert.equal(response.status, 200);
  const old = await fetch(`${base}/status`, { headers: { Origin: origin, "x-qurtiz-pairing": "pairing-only-local" } });
  assert.equal(old.status, 401);
});
