import { readFileSync } from "node:fs";

const MAX_IMAGE_BYTES = 7 * 1024 * 1024;
const MAX_REFERENCE_BYTES = 4 * 1024 * 1024;

function imageMime(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  throw new Error("image_unavailable");
}

async function boundedResponse(response, limit) {
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body ?? []) {
    total += chunk.length;
    if (total > limit) throw new Error("image_unavailable");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function safeHttpsUrl(input) {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.username || url.password ||
      !/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname)) {
    throw new Error("upload_failed");
  }
  return url;
}

function loadPairing(statePath) {
  try {
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    if (!state?.cloudPairing?.credential || !state?.cloudPairing?.origin || !state?.pairingSecret) return null;
    return { origin: state.cloudPairing.origin, credential: state.cloudPairing.credential,
      pairingSecret: state.pairingSecret };
  } catch { return null; }
}

export function startCloudWorker({ statePath, port, origins }) {
  let stopped = false;
  let timer;
  const allowed = new Set(origins);
  async function cloud(pairing, path, body, extraHeaders = {}) {
    if (!allowed.has(pairing.origin)) throw new Error("gateway_error");
    const response = await fetch(`${pairing.origin}${path}`, { method: "POST",
      headers: { Authorization: `Bearer ${pairing.credential}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...extraHeaders },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error", signal: AbortSignal.timeout(20_000) });
    const bytes = await boundedResponse(response, 40_000);
    const data = JSON.parse(bytes.toString("utf8"));
    if (!response.ok) throw new Error(response.status === 410 ? "device_revoked"
      : response.status === 401 ? "account_disconnected" : "gateway_error");
    return data;
  }
  async function local(pairing, path, body, timeoutMs = 15_000) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Origin: pairing.origin, "x-qurtiz-pairing": pairing.pairingSecret,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error", signal: AbortSignal.timeout(timeoutMs),
    });
    const bytes = await boundedResponse(response, 12 * 1024 * 1024);
    const data = JSON.parse(bytes.toString("utf8"));
    if (!response.ok) throw new Error(response.status === 429 ? "rate_limited" :
      response.status === 424 || response.status === 401 ? "account_disconnected" : "gateway_error");
    return data;
  }
  async function processJob(pairing, job, accountStatus) {
    const headers = { "x-qurtiz-claim": job.claimToken };
    const heartbeat = setInterval(() => {
      void cloud(pairing, "/api/companion/heartbeat", {
        chatgptConnected: accountStatus.connected === true,
        imageStatus: accountStatus.imageStatus === "rate_limited" ? "rate_limited"
          : accountStatus.imageStatus === "available" ? "available" : "unavailable",
      }).catch(() => undefined);
    }, 20_000);
    try {
      await cloud(pairing, `/api/companion/jobs/${job.id}/state`, undefined, headers);
      let path = "/v1/images/generations";
      const payload = { prompt: job.prompt, n: 1, size: job.size,
        quality: job.quality === "low" ? "low" : "high", response_format: "b64_json" };
      const reference = job.references?.[0];
      if (reference) {
        const url = safeHttpsUrl(reference.url);
        const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(20_000) });
        if (!response.ok) throw new Error("image_unavailable");
        const bytes = await boundedResponse(response, MAX_REFERENCE_BYTES);
        const mimeType = imageMime(bytes);
        payload.images = [{ image_url: `data:${mimeType};base64,${bytes.toString("base64")}` }];
        path = "/v1/images/edits";
      }
      const generated = await local(pairing, path, payload, 250_000);
      const base64 = generated?.data?.[0]?.b64_json;
      if (typeof base64 !== "string" || !base64 || base64.length > 9_500_000 ||
          !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error("image_unavailable");
      const bytes = Buffer.from(base64, "base64");
      if (bytes.length < 100 || bytes.length > MAX_IMAGE_BYTES) throw new Error("image_unavailable");
      const mimeType = imageMime(bytes);
      const ticket = await cloud(pairing, `/api/companion/jobs/${job.id}/upload-ticket`,
        { mimeType, sizeBytes: bytes.length }, headers);
      const uploadUrl = safeHttpsUrl(ticket.uploadUrl);
      const uploaded = await fetch(uploadUrl, { method: "PUT", body: bytes,
        headers: { "Content-Type": mimeType }, redirect: "error", signal: AbortSignal.timeout(90_000) });
      if (!uploaded.ok) throw new Error("upload_failed");
      await cloud(pairing, `/api/companion/jobs/${job.id}/complete`, undefined, headers);
    } catch (error) {
      const category = ["rate_limited", "account_disconnected", "image_unavailable", "upload_failed"]
        .includes(error?.message) ? error.message : "gateway_error";
      await cloud(pairing, `/api/companion/jobs/${job.id}/fail`, { message: category }, headers).catch(() => undefined);
    } finally { clearInterval(heartbeat); }
  }
  async function tick() {
    let delay = 15_000;
    try {
      const pairing = loadPairing(statePath);
      if (pairing && allowed.has(pairing.origin)) {
        const status = await local(pairing, "/status");
        const connected = status.connected === true;
        await cloud(pairing, "/api/companion/heartbeat", {
          chatgptConnected: connected,
          imageStatus: status.imageStatus === "rate_limited" ? "rate_limited"
            : status.imageStatus === "available" ? "available" : "unavailable",
        });
        if (connected && status.imageRouteReady) {
          const claimed = await cloud(pairing, "/api/companion/jobs/claim");
          if (claimed.job) { await processJob(pairing, claimed.job, status); delay = 1_000; }
        }
      }
    } catch (error) {
      if (error?.message === "device_revoked") {
        const pairing = loadPairing(statePath);
        if (pairing) await local(pairing, "/disconnect", {}, 12_000).catch(() => undefined);
      }
      // Network and upstream failures never expose credentials or prompts in logs.
      delay = 30_000;
    } finally {
      if (!stopped) timer = setTimeout(tick, delay);
    }
  }
  timer = setTimeout(tick, 1_000);
  return () => { stopped = true; clearTimeout(timer); };
}
