/** Browser-only transport. No ChatGPT account credentials or pairing key reach Qurtiz servers. */
const BASE = "http://127.0.0.1:8788";
// Align with Next server-action input validation so oversize results fail locally.
const MAX_BASE64_CHARS = 9_500_000;

function localRequestInit(init: RequestInit): RequestInit {
  // Chromium uses this to request permission for HTTPS-page -> loopback access.
  // Other browsers ignore the nonstandard option and still enforce their own policy.
  return { ...init, targetAddressSpace: "loopback" } as RequestInit;
}

async function requestLocal(path: string, pairingKey: string | null, init: RequestInit, timeoutMs: number) {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, localRequestInit({ ...init, headers: {
      ...(pairingKey ? { "x-qurtiz-pairing": pairingKey } : {}),
      ...(typeof init.body === "string" ? { "Content-Type": "application/json" } : {}),
    }, signal: AbortSignal.timeout(timeoutMs) }));
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") throw new Error("The local companion timed out.");
    throw new Error("Cannot reach the local companion. Start it on this computer and allow browser local-network access.");
  }
  const result = await response.json().catch(() => null) as { error?: { message?: string }; data?: { b64_json?: string; id?: string }[];
    pairingKey?: string; connected?: boolean; email?: string | null; planType?: string | null;
    freeRouteEnabled?: boolean; imageRouteReady?: boolean; lastImageTestOk?: boolean;
    imageStatus?: "available" | "rate_limited" | "unavailable" } | null;
  if (!response.ok) {
    const detail = result?.error?.message?.slice(0, 400) || `HTTP ${response.status}`;
    if (response.status === 401) throw new Error("Local companion session expired. Reconnect ChatGPT.");
    if (response.status === 424) throw new Error("Local gateway account authentication failed. Reconnect in the gateway on this computer.");
    if (response.status === 429) throw new Error(`Local image limit or upstream quota reached: ${detail}`);
    throw new Error(`Local image gateway failed: ${detail}`);
  }
  if (!result) throw new Error("Local companion returned invalid JSON.");
  return result;
}

export async function checkLocalCompanion(pairingKey: string): Promise<void> {
  await requestLocal("/health", pairingKey, { method: "GET" }, 6_000);
}

export type LocalAccountStatus = { connected: boolean; email: string | null; planType: string | null;
  freeRouteEnabled: boolean; imageRouteReady: boolean; lastImageTestOk: boolean;
  imageStatus: "available" | "rate_limited" | "unavailable" };

export function localPairingStorageKey(userId: string, workspaceId: string): string {
  return `qurtiz:local-image-pairing:${userId}:${workspaceId}`;
}

export async function pairLocalCompanion(userId: string, workspaceId: string): Promise<string> {
  const key = localPairingStorageKey(userId, workspaceId);
  const previous = window.sessionStorage.getItem(key);
  if (previous) {
    try { await checkLocalCompanion(previous); return previous; }
    catch { window.sessionStorage.removeItem(key); }
  }
  const result = await requestLocal("/pair", null, { method: "POST",
    body: JSON.stringify({ userId, workspaceId }) }, 6_000);
  if (!result.pairingKey || result.pairingKey.length < 20) throw new Error("Companion pairing failed.");
  window.sessionStorage.setItem(key, result.pairingKey);
  return result.pairingKey;
}

export async function getLocalAccountStatus(pairingKey: string): Promise<LocalAccountStatus> {
  const result = await requestLocal("/status", pairingKey, { method: "GET" }, 12_000);
  return { connected: result.connected === true, email: result.email ?? null, planType: result.planType ?? null,
    freeRouteEnabled: result.freeRouteEnabled === true, imageRouteReady: result.imageRouteReady === true,
    lastImageTestOk: result.lastImageTestOk === true,
    imageStatus: result.imageStatus === "rate_limited" ? "rate_limited"
      : result.imageStatus === "available" ? "available" : "unavailable" };
}

export async function connectLocalChatGPT(pairingKey: string): Promise<LocalAccountStatus> {
  await requestLocal("/connect", pairingKey, { method: "POST" }, 200_000);
  return getLocalAccountStatus(pairingKey);
}

export async function testLocalImage(pairingKey: string): Promise<void> {
  await requestLocal("/test-image", pairingKey, { method: "POST" }, 250_000);
}

export async function disconnectLocalChatGPT(pairingKey: string, userId: string, workspaceId: string): Promise<void> {
  await requestLocal("/disconnect", pairingKey, { method: "POST" }, 8_000);
  window.sessionStorage.removeItem(localPairingStorageKey(userId, workspaceId));
}

export async function listLocalCompanionModels(pairingKey: string): Promise<string[]> {
  const result = await requestLocal("/v1/models", pairingKey, { method: "GET" }, 12_000);
  return (result.data ?? []).map((item) => item.id).filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, 100);
}

export async function generateLocalCompanionImage(args: {
  pairingKey: string;
  modelId?: string | null;
  prompt: string;
  size?: string;
  references?: { mimeType: string; base64: string }[];
}): Promise<string> {
  if (!args.prompt.trim()) throw new Error("An image prompt is required.");
  const selectedModel = args.modelId?.trim() || undefined;
  const reference = args.references?.[0];
  let path = "/v1/images/generations";
  let body: string;
  if (reference) {
    if (!/^image\/(png|jpeg|webp)$/.test(reference.mimeType) || reference.base64.length > 6 * 1024 * 1024) {
      throw new Error("Brand reference is too large or unsupported for the local gateway.");
    }
    body = JSON.stringify({ ...(selectedModel ? { model: selectedModel } : {}), prompt: args.prompt,
      images: [{ image_url: `data:${reference.mimeType};base64,${reference.base64}` }],
      size: args.size ?? "1024x1024", quality: "high", response_format: "b64_json" });
    path = "/v1/images/edits";
  } else {
    body = JSON.stringify({ ...(selectedModel ? { model: selectedModel } : {}), prompt: args.prompt, n: 1,
      size: args.size ?? "1024x1024", quality: "high", response_format: "b64_json" });
  }
  const result = await requestLocal(path, args.pairingKey, { method: "POST", body }, 250_000);
  const image = result.data?.[0]?.b64_json;
  if (typeof image !== "string" || !image || image.length > MAX_BASE64_CHARS || !/^[A-Za-z0-9+/]+={0,2}$/.test(image)) {
    throw new Error("Local companion returned malformed or oversized image data.");
  }
  return image;
}
