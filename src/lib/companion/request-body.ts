/** A small JSON body reader for device protocol routes. Never buffers arbitrary uploads. */
export async function readSmallJson(request: Request, maxBytes = 1024): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > maxBytes) { await reader.cancel(); return null; }
      chunks.push(part.value);
    }
    const merged = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(merged));
  } catch { return null; }
  finally { reader.releaseLock(); }
}
