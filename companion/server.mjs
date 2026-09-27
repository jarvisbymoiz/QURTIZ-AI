import http from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { selectImageRoute } from "./image-capability.mjs";

const DEFAULT_ORIGINS = ["https://qurtiz-ai.vercel.app", "https://localhost:3000", "http://localhost:3000"];
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 24 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 240_000;
const ALLOWED_PATHS = new Set(["/health", "/pair", "/status", "/connect", "/disconnect", "/test-image",
  "/v1/models", "/v1/images/generations", "/v1/images/edits"]);

function asOrigin(value) {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("Companion origins must be plain HTTP(S) origins.");
  }
  return parsed.origin;
}

export function companionConfigFromEnv(env = process.env) {
  const port = Number(env.QURTIZ_COMPANION_PORT ?? "8788");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid companion port.");
  const origins = (env.QURTIZ_COMPANION_ORIGINS?.split(",") ?? DEFAULT_ORIGINS).map((s) => asOrigin(s.trim()));
  if (!origins.length) throw new Error("At least one browser origin is required.");
  const upstream = new URL(env.QURTIZ_IMAGE_UPSTREAM_URL ?? "http://127.0.0.1:8787/v1");
  if (upstream.protocol !== "http:" || upstream.hostname !== "127.0.0.1" || upstream.pathname.replace(/\/$/, "") !== "/v1" ||
      upstream.username || upstream.password || upstream.search || upstream.hash) {
    throw new Error("Image upstream must be a loopback HTTP /v1 endpoint.");
  }
  return {
    port, origins, upstreamUrl: upstream.toString().replace(/\/$/, ""),
    upstreamKey: env.QURTIZ_IMAGE_UPSTREAM_KEY || "local",
    pairingSecret: env.QURTIZ_COMPANION_PAIRING_SECRET || randomBytes(24).toString("base64url"),
    statePath: env.QURTIZ_COMPANION_STATE_PATH || undefined,
  };
}

function matchesSecret(given, expected) {
  if (typeof given !== "string" || !given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

async function readBounded(stream, maximum) {
  const chunks = [];
  let total = 0;
  for await (const chunk of stream) {
    total += chunk.length;
    if (total > maximum) throw new Error("payload_too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function safeGatewayMessage(data, config, status) {
  let message = `Local gateway rejected the request (HTTP ${status}).`;
  try {
    const parsed = JSON.parse(data.toString("utf8"));
    if (typeof parsed?.error?.message === "string") message = parsed.error.message;
  } catch { /* use status */ }
  if (message.includes("没有解析出生成图片文件")) {
    return "ChatGPT returned no generated image file. The account's image quota or the unofficial route may be unavailable.";
  }
  return message.replaceAll(config.upstreamKey, "[redacted]").replaceAll(config.pairingSecret, "[redacted]").slice(0, 400);
}

export function createCompanionServer(config) {
  if (!config.pairingSecret || typeof config.pairingSecret !== "string" || !config.upstreamKey || typeof config.upstreamKey !== "string") {
    throw new Error("Companion requires local pairing and upstream keys.");
  }
  const origins = new Set(config.origins.map(asOrigin));
  const upstream = new URL(config.upstreamUrl);
  if (upstream.protocol !== "http:" || upstream.hostname !== "127.0.0.1" || upstream.pathname.replace(/\/$/, "") !== "/v1" ||
      upstream.username || upstream.password || upstream.search || upstream.hash) {
    throw new Error("Image upstream must be a loopback HTTP /v1 endpoint.");
  }
  let active = 0;
  let recentGenerations = [];
  let pairingSecret = config.pairingSecret;
  let owner = null;
  let lastImageRateLimited = false;
  if (config.statePath && existsSync(config.statePath)) {
    const saved = JSON.parse(readFileSync(config.statePath, "utf8"));
    if (typeof saved.pairingSecret !== "string" || saved.pairingSecret.length < 20 ||
        (saved.owner !== null && (typeof saved.owner !== "string" || !/^[0-9a-f-]{36}:[0-9a-f-]{36}$/i.test(saved.owner)))) {
      throw new Error("Local companion state is invalid. Restore the local state file before starting.");
    }
    pairingSecret = saved.pairingSecret;
    owner = saved.owner;
    lastImageRateLimited = saved.lastImageRateLimited === true;
  }
  function savePairing() {
    if (!config.statePath) return;
    mkdirSync(dirname(config.statePath), { recursive: true });
    const temporary = `${config.statePath}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify({ pairingSecret, owner, lastImageRateLimited }), { mode: 0o600 });
    renameSync(temporary, config.statePath);
  }
  let connecting = false;
  let lastImageTestOk = false;
  let recentLogins = [];
  let catalogCache = null;

  async function gatewayAdmin(path, method = "GET", body, timeoutMs = 10_000) {
    const response = await fetch(`${config.upstreamUrl.slice(0, -3)}${path}`, {
      method, headers: { Authorization: `Bearer ${config.upstreamKey}`,
        ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "error", signal: AbortSignal.timeout(timeoutMs),
    });
    const bytes = await readBounded(response.body, 1024 * 1024);
    let parsed;
    try { parsed = JSON.parse(bytes.toString("utf8")); } catch { throw new Error("Local gateway returned invalid account status."); }
    if (!response.ok) throw new Error(safeGatewayMessage(bytes, config, response.status));
    return parsed;
  }

  async function accountModels(profileId) {
    if (!profileId) return [];
    if (catalogCache?.profileId === profileId && Date.now() - catalogCache.at < 60_000) return catalogCache.models;
    try {
      // Account-scoped catalog GET via gateway; this does not generate an image.
      const catalog = await gatewayAdmin("/_gateway/models/refresh", "POST", {}, 30_000);
      const models = Array.isArray(catalog?.data) ? catalog.data : [];
      catalogCache = { profileId, at: Date.now(), models };
      return models;
    } catch { return []; }
  }

  async function safeStatus(raw) {
    const profile = raw?.profile && typeof raw.profile === "object" ? raw.profile : null;
    const planType = typeof profile?.quota?.planType === "string" ? profile.quota.planType.slice(0, 32) : null;
    const authState = profile?.authStatus?.state;
    const connected = Boolean(profile && typeof profile.profileId === "string" &&
      authState !== "token_invalidated" && authState !== "auth_error");
    const freeRouteEnabled = raw?.settings?.image?.freeAccountWebGenerationEnabled === true;
    const models = connected ? await accountModels(profile.profileId) : [];
    const capability = connected ? selectImageRoute({ models, quota: profile?.quota, webEnabled: freeRouteEnabled })
      : { route: "unavailable" };
    return { connected, email: typeof profile?.email === "string" ? profile.email.slice(0, 254) : null,
      planType, freeRouteEnabled, imageRouteReady: capability.route !== "unavailable",
      imageStatus: lastImageRateLimited ? "rate_limited" : capability.route === "unavailable" ? "unavailable" : "available",
      imageRoute: capability.route, lastImageTestOk };
  }
  const server = http.createServer(async (req, res) => {
    const port = server.address()?.port ?? config.port;
    if (req.headers.host !== `127.0.0.1:${port}`) return sendJson(res, 403, { error: { message: "Invalid Host." } });
    const origin = req.headers.origin;
    if (!origin || !origins.has(origin)) return sendJson(res, 403, { error: { message: "Origin is not allowed." } });
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Cache-Control", "no-store");
    let path;
    try { path = new URL(req.url ?? "", "http://127.0.0.1").pathname; } catch { return sendJson(res, 400, { error: { message: "Invalid path." } }); }
    if (!ALLOWED_PATHS.has(path) || req.url !== path) return sendJson(res, 404, { error: { message: "Not found." } });
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "content-type, x-qurtiz-pairing");
      if (req.headers["access-control-request-private-network"] === "true") res.setHeader("Access-Control-Allow-Private-Network", "true");
      res.writeHead(204);
      return res.end();
    }
    if (path === "/pair") {
      if (req.method !== "POST") return sendJson(res, 405, { error: { message: "Method not allowed." } });
      try {
        const body = JSON.parse((await readBounded(req, 1024)).toString("utf8"));
        if (typeof body.userId !== "string" || typeof body.workspaceId !== "string" ||
            !/^[0-9a-f-]{36}$/i.test(body.userId) || !/^[0-9a-f-]{36}$/i.test(body.workspaceId)) {
          return sendJson(res, 400, { error: { message: "Invalid Qurtiz account context." } });
        }
        const requestedOwner = `${body.userId}:${body.workspaceId}`;
        if (owner && owner !== requestedOwner) return sendJson(res, 409, { error: { message: "This companion is connected to another Qurtiz account or workspace." } });
        owner = requestedOwner;
        savePairing();
        return sendJson(res, 200, { pairingKey: pairingSecret });
      } catch { return sendJson(res, 400, { error: { message: "Invalid pairing request." } }); }
    }
    if (!matchesSecret(req.headers["x-qurtiz-pairing"], pairingSecret) || !owner) {
      return sendJson(res, 401, { error: { message: "Pairing key is invalid." } });
    }
    if (path === "/health" && req.method === "GET") return sendJson(res, 200, { ok: true, service: "qurtiz-image-companion" });
    if (path === "/status" && req.method === "GET") {
      try { return sendJson(res, 200, await safeStatus(await gatewayAdmin("/_gateway/admin/config"))); }
      catch { return sendJson(res, 503, { error: { message: "Local ChatGPT gateway is unavailable. Start it on this computer." } }); }
    }
    if (path === "/connect" && req.method === "POST") {
      if (connecting) return sendJson(res, 409, { error: { message: "ChatGPT login is already in progress." } });
      recentLogins = recentLogins.filter(time => Date.now() - time < 10 * 60_000);
      if (recentLogins.length >= 3) return sendJson(res, 429, { error: { message: "Too many login attempts. Try again later." } });
      recentLogins.push(Date.now());
      connecting = true;
      try {
        // The local gateway owns PKCE, opens the browser, receives the callback and stores tokens.
        const login = await gatewayAdmin("/_gateway/admin/login", "POST", undefined, 195_000);
        if (login?.login?.status === "manual_required") throw new Error("oauth_manual_required");
        let configView = await gatewayAdmin("/_gateway/admin/config");
        if (configView?.settings?.image?.freeAccountWebGenerationEnabled !== true) {
          configView = await gatewayAdmin("/_gateway/admin/settings", "PUT",
            { image: { freeAccountWebGenerationEnabled: true } });
        }
        lastImageTestOk = false; lastImageRateLimited = false; catalogCache = null; savePairing();
        return sendJson(res, 200, await safeStatus(configView));
      } catch {
        return sendJson(res, 502, { error: { message: "ChatGPT login did not complete locally. Retry or check the local gateway." } });
      } finally { connecting = false; }
    }
    if (path === "/disconnect" && req.method === "POST") {
      // Remove the active local OAuth profile before allowing another Qurtiz owner.
      try {
        const configView = await gatewayAdmin("/_gateway/admin/config");
        const profileId = configView?.profile?.profileId;
        if (typeof profileId === "string") await gatewayAdmin("/_gateway/admin/profiles/remove", "POST", { profileId });
      } catch { return sendJson(res, 503, { error: { message: "Could not remove the local ChatGPT account. Start the gateway and retry Disconnect." } }); }
      pairingSecret = randomBytes(24).toString("base64url");
      owner = null;
      lastImageTestOk = false;
      lastImageRateLimited = false; catalogCache = null; savePairing();
      return sendJson(res, 200, { disconnected: true });
    }
    if (path === "/test-image" && req.method === "POST") {
      if (active >= 1) return sendJson(res, 429, { error: { message: "Image generation is already running." } });
      recentGenerations = recentGenerations.filter(time => Date.now() - time < 10 * 60_000);
      if (recentGenerations.length >= 12) return sendJson(res, 429, { error: { message: "Local image request limit reached." } });
      recentGenerations.push(Date.now());
      lastImageTestOk = false;
      active += 1;
      try {
        const response = await fetch(`${config.upstreamUrl}/images/generations`, {
          method: "POST", headers: { Authorization: `Bearer ${config.upstreamKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: "A simple blue circle on a white background", n: 1,
            size: "1024x1024", quality: "low", response_format: "b64_json" }),
          redirect: "error", signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
        });
        const bytes = await readBounded(response.body, MAX_RESPONSE_BYTES);
        if (!response.ok) {
          const message = safeGatewayMessage(bytes, config, response.status);
          lastImageRateLimited = response.status === 429 || /rate limit|usage limit/i.test(message);
          savePairing();
          return sendJson(res, response.status, { error: { message } });
        }
        const parsed = JSON.parse(bytes.toString("utf8"));
        if (typeof parsed?.data?.[0]?.b64_json !== "string" || !parsed.data[0].b64_json) throw new Error("invalid_image");
        lastImageTestOk = true;
        lastImageRateLimited = false;
        savePairing();
        return sendJson(res, 200, { ok: true });
      } catch { return sendJson(res, 502, { error: { message: "Local test image did not complete." } }); }
      finally { active -= 1; }
    }
    if (path === "/v1/models" && req.method !== "GET") return sendJson(res, 405, { error: { message: "Method not allowed." } });
    if (path.startsWith("/v1/images/") && req.method !== "POST") return sendJson(res, 405, { error: { message: "Method not allowed." } });
    if (active >= 1) return sendJson(res, 429, { error: { message: "Companion is already generating an image." } });
    const contentType = String(req.headers["content-type"] ?? "");
    if (path.startsWith("/v1/images/") && !contentType.startsWith("application/json")) {
      return sendJson(res, 415, { error: { message: "Use application/json for image requests." } });
    }
    if (path.startsWith("/v1/images/")) {
      const now = Date.now();
      recentGenerations = recentGenerations.filter((time) => now - time < 10 * 60_000);
      if (recentGenerations.length >= 12) return sendJson(res, 429, { error: { message: "Local request limit reached. Try again later." } });
      recentGenerations.push(now);
    }
    active += 1;
    try {
      const body = req.method === "POST" ? await readBounded(req, MAX_REQUEST_BYTES) : undefined;
      const response = await fetch(`${config.upstreamUrl}${path.slice(3)}`, {
        method: req.method,
        headers: { Authorization: `Bearer ${config.upstreamKey}`, ...(body ? { "Content-Type": contentType } : {}) },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      });
      const data = await readBounded(response.body, MAX_RESPONSE_BYTES);
      if (!String(response.headers.get("content-type") ?? "").includes("application/json")) {
        return sendJson(res, 502, { error: { message: "Local gateway returned a non-JSON response." } });
      }
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return sendJson(res, 424, { error: { message: "Local gateway account authentication failed. Reconnect in the gateway on this computer." } });
        }
        const message = safeGatewayMessage(data, config, response.status);
        lastImageRateLimited = response.status === 429 || /rate limit|usage limit/i.test(message);
        savePairing();
        return sendJson(res, response.status, { error: { message } });
      }
      if (path.startsWith("/v1/images/")) {
        let parsed;
        try { parsed = JSON.parse(data.toString("utf8")); } catch { /* handled below */ }
        const first = parsed?.data?.[0]?.b64_json;
        if (typeof first !== "string" || !first) {
          return sendJson(res, 502, { error: { message: "Local gateway returned no base64 image." } });
        }
        lastImageRateLimited = false;
        savePairing();
        return sendJson(res, 200, { created: typeof parsed.created === "number" ? parsed.created : undefined,
          data: [{ b64_json: first, ...(typeof parsed.data[0].revised_prompt === "string" ? { revised_prompt: parsed.data[0].revised_prompt } : {}) }] });
      }
      res.writeHead(response.status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Local gateway failed.";
      const status = message === "payload_too_large" ? 413 : error?.name === "TimeoutError" ? 504 : 502;
      sendJson(res, status, { error: { message: status === 413 ? "Image payload is too large." : status === 504 ? "Local gateway timed out." : "Local gateway is unavailable or returned an invalid response." } });
    } finally {
      active -= 1;
    }
  });
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;
  return server;
}

export function listenCompanion(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => { server.off("error", reject); resolve(server); });
  });
}
