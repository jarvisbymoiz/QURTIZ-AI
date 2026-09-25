import "server-only";

import { z } from "zod";
import { AI_TASKS } from "@/lib/ai/provider";
import { isCloudflareAccountId, isCloudflareModel, isSupportedCloudflareImageModel } from "@/lib/ai/cloudflare";
import {
  CATALOG_PROVIDER_IDS,
  catalogEntry,
  isCatalogProviderId,
  providerRequiresBaseUrl,
} from "@/lib/ai/provider-catalog";

/**
 * Zod input schema for saveWorkspaceAIConfigAction.
 *
 * Lives OUTSIDE the "use server" action file (Next.js requires those files
 * to export only async functions) but in a server-only module: the client
 * never needs it, and it stays unit-testable without a server round-trip.
 *
 * Providers must be CATALOG ids — the legacy stored id "openai-compatible"
 * is accepted on read only and cannot be saved (catalogEntry resolves it to
 * `custom` for old rows). Base URLs are optional for presets (their catalog
 * default is filled at resolution) and required for providers without one
 * (`custom`).
 */
function baseUrlRequirementMessage(providerId: string, side: "text" | "image"): string {
  const label = catalogEntry(providerId)?.label ?? providerId;
  return `${label} ${side} providers require a Base URL (e.g. https://gateway.example.com/v1).`;
}

export const saveAIConfigInputSchema = z
  .object({
    textProvider: z.string(),
    textModel: z.string().trim().min(1, "A text model is required."),
    textBaseUrl: z.string().trim().nullable().optional(),
    textAccountId: z.string().trim().nullable().optional(),
    textApiKey: z.string().trim().optional().nullable(),
    imageProvider: z.string(),
    imageModel: z.string().trim().min(1, "An image model is required."),
    imageBaseUrl: z.string().trim().nullable().optional(),
    imageAccountId: z.string().trim().nullable().optional(),
    imageApiKey: z.string().trim().optional().nullable(),
    taskOverrides: z.record(z.enum(AI_TASKS), z.string().trim().min(1)).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (!isCatalogProviderId(v.textProvider)) {
      ctx.addIssue({
        code: "custom",
        path: ["textProvider"],
        message: `Unknown text provider "${v.textProvider}". Pick one of: ${CATALOG_PROVIDER_IDS.join(", ")}.`,
      });
    } else if (providerRequiresBaseUrl(v.textProvider) && !v.textBaseUrl?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["textBaseUrl"],
        message: baseUrlRequirementMessage(v.textProvider, "text"),
      });
    }
    if (v.textProvider === "cloudflare") {
      if (!isCloudflareAccountId(v.textAccountId ?? "")) ctx.addIssue({ code: "custom", path: ["textAccountId"], message: "Cloudflare text Account ID must be 32 hexadecimal characters." });
      if (!isCloudflareModel(v.textModel)) ctx.addIssue({ code: "custom", path: ["textModel"], message: "Use a Workers AI text model such as @cf/meta/llama-3.1-8b-instruct." });
    }
    if (!isCatalogProviderId(v.imageProvider)) {
      ctx.addIssue({
        code: "custom",
        path: ["imageProvider"],
        message: `Unknown image provider "${v.imageProvider}". Pick one of: ${CATALOG_PROVIDER_IDS.join(", ")}.`,
      });
    } else if (providerRequiresBaseUrl(v.imageProvider) && !v.imageBaseUrl?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["imageBaseUrl"],
        message: baseUrlRequirementMessage(v.imageProvider, "image"),
      });
    }
    if (v.imageProvider === "cloudflare") {
      if (!isCloudflareAccountId(v.imageAccountId ?? "")) ctx.addIssue({ code: "custom", path: ["imageAccountId"], message: "Cloudflare image Account ID must be 32 hexadecimal characters." });
      if (!isSupportedCloudflareImageModel(v.imageModel)) ctx.addIssue({ code: "custom", path: ["imageModel"], message: "Choose a supported Workers AI image model (FLUX.1 schnell or Stable Diffusion XL)." });
    }
  });

export type SaveAIConfigInput = z.infer<typeof saveAIConfigInputSchema>;
