export async function readBoundedJson(response: Response, maxBytes = 24 * 1024 * 1024): Promise<unknown> {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > maxBytes) {
    await response.body?.cancel();
    throw new Error("Provider response exceeds the allowed size.");
  }
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error("Provider response exceeds the allowed size.");
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch (error) { if (error instanceof SyntaxError) return null; throw error; }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
