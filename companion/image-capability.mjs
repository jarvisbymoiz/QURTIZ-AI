const CATALOG_TTL_MS = 60_000;
const catalogByProfile = new Map();

export function codexQuotaLimited(quota) {
  return Number(quota?.primaryUsedPercent) >= 100 &&
    quota?.creditsHasCredits !== true && quota?.creditsUnlimited !== true;
}

export function modelCandidates(models, excluded = []) {
  const excludedSet = new Set(excluded);
  return [...new Set((Array.isArray(models) ? models : [])
    .filter(model => model?.source === "codex-network" &&
      Array.isArray(model.input) && model.input.includes("text") && model.input.includes("image") &&
      typeof model.id === "string" && model.id.length > 0 && model.id.length < 100)
    .map(model => model.id))].filter(id => !excludedSet.has(id));
}

export function selectImageRoute({ models, quota, webEnabled, excludedModels = [] }) {
  const candidates = modelCandidates(models, excludedModels);
  if (!codexQuotaLimited(quota) && candidates.length) {
    return { route: "codex-tool", model: candidates[0], candidates, source: "codex-network" };
  }
  if (webEnabled) {
    return { route: "chatgpt-web", model: null, candidates, source: "experimental-web" };
  }
  return { route: "unavailable", model: null, candidates,
    reason: codexQuotaLimited(quota) ? "Codex account usage limit reached." : "No account-compatible Codex image route was discovered." };
}

export function isUnsupportedModelError(error) {
  const message = String(error instanceof Error ? error.message : error ?? "");
  return /model.{0,80}(not supported|unsupported|not available|does not exist)|(not supported|unsupported).{0,80}model|model_not_found|image[_ -]?generation.{0,60}(not supported|unsupported)|image[_ -]?generation tool.{0,60}(unavailable|not available)/i
    .test(message.replace(/\s+/g, " "));
}

export function invalidateImageCatalog(profileId) {
  catalogByProfile.delete(profileId);
}

export async function discoverImageRoute({ profile, modelService, webEnabled, forceRefresh = false, excludedModels = [] }) {
  const profileId = profile?.profileId;
  if (!profileId) return { route: "unavailable", model: null, candidates: [], reason: "No authenticated ChatGPT account." };
  let cache = catalogByProfile.get(profileId);
  if (forceRefresh || !cache || Date.now() - cache.at > CATALOG_TTL_MS) {
    try {
      const result = await modelService.refreshModels("openai-codex");
      cache = { at: Date.now(), models: result.models };
      catalogByProfile.set(profileId, cache);
    } catch {
      // Never substitute the gateway's static fallback list for an account-scoped catalog.
      cache = cache && Date.now() - cache.at <= CATALOG_TTL_MS ? cache : { at: Date.now(), models: [] };
    }
  }
  return selectImageRoute({ models: cache.models, quota: profile.quota, webEnabled, excludedModels });
}
