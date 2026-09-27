import test from "node:test";
import assert from "node:assert/strict";
import { discoverImageRoute, invalidateImageCatalog, isUnsupportedModelError,
  modelCandidates, selectImageRoute } from "./image-capability.mjs";

const networkModels = [
  { id: "account-current-model", input: ["text", "image"], source: "codex-network" },
  { id: "account-alternate-model", input: ["text", "image"], source: "codex-network" },
  { id: "static-old-model", input: ["text", "image"], source: "static" },
  { id: "text-only-model", input: ["text"], source: "codex-network" },
];

test("selects account-discovered Codex models, not static or plan-named defaults", () => {
  assert.deepEqual(modelCandidates(networkModels), ["account-current-model", "account-alternate-model"]);
  assert.equal(selectImageRoute({ models: networkModels, quota: { planType: "plus", primaryUsedPercent: 10 }, webEnabled: true }).model,
    "account-current-model");
  assert.equal(selectImageRoute({ models: networkModels, quota: { planType: "free", primaryUsedPercent: 10 }, webEnabled: true }).route,
    "codex-tool");
});

test("uses opted-in web route when Codex quota is exhausted without bypassing web limits", () => {
  assert.equal(selectImageRoute({ models: networkModels, quota: { primaryUsedPercent: 100 }, webEnabled: true }).route,
    "chatgpt-web");
  assert.equal(selectImageRoute({ models: networkModels, quota: { primaryUsedPercent: 100 }, webEnabled: false }).route,
    "unavailable");
});

test("catalog discovery is non-generative, scoped to profile, cached, and refreshable", async () => {
  const calls = [];
  const modelService = { refreshModels: async () => { calls.push("models"); return { models: networkModels }; } };
  const profile = { profileId: "profile-a", quota: { primaryUsedPercent: 0 } };
  invalidateImageCatalog(profile.profileId);
  assert.equal((await discoverImageRoute({ profile, modelService, webEnabled: true })).model, "account-current-model");
  assert.equal((await discoverImageRoute({ profile, modelService, webEnabled: true })).model, "account-current-model");
  assert.equal(calls.length, 1);
  invalidateImageCatalog(profile.profileId);
  assert.equal((await discoverImageRoute({ profile, modelService, webEnabled: true, excludedModels: ["account-current-model"] })).model,
    "account-alternate-model");
  assert.equal(calls.length, 2);
});

test("unsupported-model classification is narrow", () => {
  assert.equal(isUnsupportedModelError(new Error("The 'old' model is not supported when using Codex with a ChatGPT account.")), true);
  assert.equal(isUnsupportedModelError(new Error("image_generation tool is not supported for this model")), true);
  assert.equal(isUnsupportedModelError(new Error("usage_limit_reached")), false);
  assert.equal(isUnsupportedModelError(new Error("image tool timed out")), false);
});
