// Explicit live Storage check. No content rows or social posts are created.
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { randomUUID, createHash } from "node:crypto";
import { mkdtemp, readFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

if (process.env.RUN_LIVE_MEDIA_TEST !== "true") throw new Error("Set RUN_LIVE_MEDIA_TEST=true to authorize the live storage check.");
dotenv.config({ path: ".env.local", quiet: true });
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const uploadClient = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const bucket = service.storage.from("brand-assets");
const directory = await mkdtemp(join(tmpdir(), "qurtiz-media-smoke-"));
const paths = [];
const files = [];
const root = `${randomUUID()}/visuals/${randomUUID()}`;
try {
  const png = await sharp({ create: { width: 128, height: 128, channels: 3, background: "#345678" } }).png().toBuffer();
  const samples = [{ name: "image.png", mime: "image/png", bytes: png }];
  for (const [extension, mime, codec] of [["mp4", "video/mp4", "libx264"], ["mov", "video/quicktime", "libx264"], ["webm", "video/webm", "libvpx-vp9"]]) {
    const file = join(directory, `sample.${extension}`);
    files.push(file);
    execFileSync(process.env.FFMPEG_PATH || "ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=blue:s=128x128:r=10", "-t", "1", "-c:v", codec, "-pix_fmt", "yuv420p", "-y", file], { timeout: 30_000, windowsHide: true });
    samples.push({ name: `video.${extension}`, mime, bytes: await readFile(file) });
  }
  for (const sample of samples) {
    const path = `${root}/${randomUUID()}`;
    paths.push(path);
    const { data: signed, error: signingError } = await bucket.createSignedUploadUrl(path, { upsert: false });
    if (signingError) throw new Error(`Signing failed for ${sample.name}`);
    const { error: uploadError } = await uploadClient.storage.from("brand-assets").uploadToSignedUrl(path, signed.token, sample.bytes, { contentType: sample.mime });
    if (uploadError) throw new Error(`Upload failed for ${sample.name}: ${uploadError.message}`);
    const { data: info, error: infoError } = await bucket.info(path);
    if (infoError || info.contentType !== sample.mime || info.size !== sample.bytes.length) throw new Error(`Stored MIME/size mismatch for ${sample.name}`);
    const { data: preview, error: previewError } = await bucket.createSignedUrl(path, 60);
    if (previewError) throw new Error(`Preview signing failed for ${sample.name}`);
    const response = await fetch(preview.signedUrl, { signal: AbortSignal.timeout(15_000) });
    const bytes = Buffer.from(await response.arrayBuffer());
    const hash = b => createHash("sha256").update(b).digest("hex");
    if (!response.ok || hash(bytes) !== hash(sample.bytes)) throw new Error(`Preview bytes mismatch for ${sample.name}`);
    console.log(JSON.stringify({ ok: true, mime: sample.mime, bytes: bytes.length, upload: "signed", preview: "verified" }));
  }
} finally {
  if (paths.length) {
    const { error } = await bucket.remove(paths);
    if (error) throw new Error("Smoke test storage cleanup failed; inspect only the test objects before retrying.");
  }
  for (const file of files) await unlink(file).catch(error => { if (error.code !== "ENOENT") throw error; });
  await rmdir(directory);
}
