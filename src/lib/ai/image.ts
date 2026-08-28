import "server-only";

/**
 * Gemini image generation via REST (direct fetch for full control over
 * reference images / img2img, which SDK image APIs do not expose).
 * Models are tried in order; the first with quota wins.
 */
const IMAGE_MODEL_CHAIN = [
  "gemini-3.1-flash-image",
  "gemini-2.5-flash-image",
];

export type ImageReference = {
  mimeType: string;
  base64: string;
};

export type ImageGenResult =
  | { ok: true; png: Buffer; model: string }
  | { ok: false; reason: "quota_or_billing" | "api_error"; message: string };

export function isImageGenConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function generateImage(args: {
  prompt: string;
  references?: ImageReference[];
}): Promise<ImageGenResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "api_error", message: "GEMINI_API_KEY is not configured." };
  }

  const parts: Record<string, unknown>[] = [];
  for (const ref of args.references ?? []) {
    parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } });
  }
  parts.push({ text: args.prompt });

  let lastError = "";
  let sawQuota = false;

  for (const model of IMAGE_MODEL_CHAIN) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseModalities: ["IMAGE"] },
          }),
          signal: AbortSignal.timeout(120_000),
        },
      );
      const json = (await res.json().catch(() => null)) as
        | { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] }
        | { error?: { message?: string; status?: string } }
        | null;

      if (!res.ok) {
        const message = (json as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
        if (res.status === 429 || message.includes("quota") || message.includes("Quota")) {
          sawQuota = true;
          lastError = message;
          continue;
        }
        return { ok: false, reason: "api_error", message: `${model}: ${message}` };
      }

      const imgPart = (json as { candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[] })
        ?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!imgPart?.inlineData?.data) {
        lastError = `${model}: response contained no image`;
        continue;
      }
      return { ok: true, png: Buffer.from(imgPart.inlineData.data, "base64"), model };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  if (sawQuota) {
    return {
      ok: false,
      reason: "quota_or_billing",
      message:
        "Image generation requires paid API billing (free tier quota is 0 for image models). Enable billing in Google AI Studio to use AI-photo visuals.",
    };
  }
  return { ok: false, reason: "api_error", message: lastError || "Image generation failed" };
}
