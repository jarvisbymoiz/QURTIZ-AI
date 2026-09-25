import "server-only";

export type ImageDebugContext = { sources: string[]; workspaceId: string; contentItemId: string };

/** Explicit, local-only inspection. Never log credentials, URLs or image bytes. */
export function inspectImageRequest(input: {
  provider: string; model: string; prompt: string; referenceCount: number;
  parameters: Record<string, unknown>; context?: ImageDebugContext;
}): void {
  if (process.env.NODE_ENV === "production" || process.env.IMAGE_DEBUG !== "true") return;
  console.info("[image-request]", JSON.stringify({
    provider: input.provider, model: input.model, prompt: input.prompt,
    promptCharacters: input.prompt.length, estimatedTokens: Math.ceil(input.prompt.length / 4),
    references: input.referenceCount, parameters: input.parameters,
    contextSources: input.context?.sources ?? [],
  }));
}
