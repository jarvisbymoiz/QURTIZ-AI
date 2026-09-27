import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const modulePath = "node_modules/ai-zero-token/dist/core/services/image-service.js";

function replaceOne(source, before, after) {
  if (source.includes(after)) return source;
  if (source.split(before).length !== 2) throw new Error("AI-Zero-Token image service changed; review capability patch before packaging.");
  return source.replace(before, after);
}

export function patchImageServiceSource(original) {
  let source = original;
  source = replaceOne(source,
    'import { generateChatGPTWebImage } from "../providers/openai-codex/chatgpt-web-image.js";',
    'import { generateChatGPTWebImage } from "../providers/openai-codex/chatgpt-web-image.js";\nimport { discoverImageRoute, invalidateImageCatalog, isUnsupportedModelError } from "../../../../../companion/image-capability.mjs";');
  source = replaceOne(source, 'const IMAGE_ORCHESTRATOR_MODEL = "gpt-5.4-mini";',
    'const IMAGE_CAPABILITY_RESOLVER = "account-scoped-codex-catalog";');
  source = replaceOne(source, 'const IMAGE_GENERATION_MAX_ATTEMPTS = 3;', 'const IMAGE_GENERATION_MAX_ATTEMPTS = 2;');
  source = replaceOne(source,
    '    const orchestratorModel = IMAGE_ORCHESTRATOR_MODEL;\n    const requestedImageModel = this.resolveRequestedImageModel(request.model);\n    const settings = await this.deps.configService.getSettings();',
    '    const requestedImageModel = this.resolveRequestedImageModel(request.model);\n    const settings = await this.deps.configService.getSettings();\n    let capability = await discoverImageRoute({ profile, modelService: this.deps.modelService, webEnabled: settings.image.freeAccountWebGenerationEnabled });\n    if (capability.route === "unavailable") throw createError(capability.reason, 424);\n    let orchestratorModel = capability.model;\n    let unsupportedRetryUsed = false;');
  const webStart = '    if (isFreePlan(profile) && settings.image.freeAccountWebGenerationEnabled) {';
  const webEnd = '    const tool = {';
  if (!source.includes('const generateWeb = async () => {')) {
    const start = source.indexOf(webStart);
    const end = source.indexOf(webEnd, start);
    if (start < 0 || end < 0) throw new Error("AI-Zero-Token web route changed; review capability patch before packaging.");
    const block = source.slice(start + webStart.length, end);
    const closing = block.lastIndexOf('    }\n');
    if (closing < 0 || block.slice(closing).trim() !== '}') throw new Error("AI-Zero-Token web route closing changed.");
    const body = block.slice(0, closing).replace('for Free profile', 'for account capability');
    source = source.slice(0, start) + '    const generateWeb = async () => {' + body + '    };\n    if (capability.route === "chatgpt-web") return await generateWeb();\n' + source.slice(end);
  }
  source = replaceOne(source,
    '      } catch (error) {\n        const quota = error.quota;\n        await this.deps.authService.recordProfileRequestFailure(profile.profileId, error, quota, "openai-codex");\n        throw error;\n      }',
    '      } catch (error) {\n        if (!unsupportedRetryUsed && isUnsupportedModelError(error)) {\n          unsupportedRetryUsed = true;\n          const rejectedModel = orchestratorModel;\n          invalidateImageCatalog(profile.profileId);\n          capability = await discoverImageRoute({ profile, modelService: this.deps.modelService, webEnabled: settings.image.freeAccountWebGenerationEnabled, forceRefresh: true, excludedModels: [rejectedModel] });\n          if (capability.route === "codex-tool" && capability.model && capability.model !== rejectedModel) {\n            orchestratorModel = capability.model;\n            requestSummary.orchestratorModel = orchestratorModel;\n            continue;\n          }\n          if (capability.route === "chatgpt-web") return await generateWeb();\n        }\n        const quota = error.quota;\n        await this.deps.authService.recordProfileRequestFailure(profile.profileId, error, quota, "openai-codex");\n        throw error;\n      }');
  const retryStart = '        if (upstreamFailure?.transient && attempt < IMAGE_GENERATION_MAX_ATTEMPTS) {';
  if (source.includes(retryStart)) {
    const start = source.indexOf(retryStart);
    const end = source.indexOf('        if (upstreamFailure) {', start);
    if (end < 0) throw new Error("AI-Zero-Token image retry logic changed.");
    source = source.slice(0, start) + source.slice(end);
  }
  return source;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = resolve(process.argv[2] || ".", modulePath);
  const original = readFileSync(file, "utf8");
  const patched = patchImageServiceSource(original);
  if (patched !== original) writeFileSync(file, patched);
  console.log("Applied account-capability image routing patch.");
}
