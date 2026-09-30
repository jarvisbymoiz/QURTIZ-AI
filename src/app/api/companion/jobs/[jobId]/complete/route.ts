import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { companionImageJobs } from "@/db/schema";
import { authenticateJobClaim } from "@/lib/companion/job-claim";
import { matchesMediaHeader } from "@/lib/security/media-file";
import { createServiceClient } from "@/lib/supabase/service";
import { persistExternalVisual } from "@/lib/visuals/generate";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const claim = await authenticateJobClaim(request, jobId);
  if (!claim) return NextResponse.json({ error: "Unauthorized or expired image claim." }, { status: 401 });
  if (claim.job.status !== "uploading" || !claim.job.uploadPath) {
    return NextResponse.json({ error: "Image upload has not completed." }, { status: 409 });
  }
  if (claim.job.contentType !== "test" && !claim.job.contentItemId) {
    return NextResponse.json({ error: "The post was removed before its image could be saved." }, { status: 409 });
  }
  const expectedPath = `${claim.device.workspaceId}/visuals/${claim.job.contentItemId ?? "tests"}/${claim.job.id}-raw`;
  if (claim.job.uploadPath !== expectedPath) return NextResponse.json({ error: "Invalid image path." }, { status: 409 });
  const options = claim.job.options as { uploadMimeType?: string; uploadSizeBytes?: number };
  const mimeType = options?.uploadMimeType;
  const sizeBytes = options?.uploadSizeBytes;
  if (!mimeType || !["image/png", "image/jpeg", "image/webp"].includes(mimeType) ||
      !Number.isInteger(sizeBytes) || sizeBytes! < 100 || sizeBytes! > 7 * 1024 * 1024) {
    return NextResponse.json({ error: "Invalid upload metadata." }, { status: 409 });
  }
  // Clear the one-use claim before downloading or persisting. A duplicate
  // completion cannot make a second visual or spend another upstream task.
  const [locked] = await getDb().update(companionImageJobs).set({ claimTokenHash: null, updatedAt: new Date() })
    .where(and(eq(companionImageJobs.id, jobId), eq(companionImageJobs.deviceId, claim.device.id),
      eq(companionImageJobs.status, "uploading"), eq(companionImageJobs.claimTokenHash, claim.job.claimTokenHash!)))
    .returning({ id: companionImageJobs.id });
  if (!locked) return NextResponse.json({ error: "Image completion was already submitted." }, { status: 409 });
  const storage = createServiceClient();
  const bucket = storage.storage.from("brand-assets");
  try {
    const info = await bucket.info(expectedPath);
    if (info.error || !info.data || Number(info.data.size) !== sizeBytes || info.data.contentType !== mimeType) {
      throw new Error("Uploaded image does not match the authorized type or size.");
    }
    const downloaded = await bucket.download(expectedPath);
    if (downloaded.error || !downloaded.data) throw new Error("Uploaded image could not be read.");
    const bytes = Buffer.from(await downloaded.data.arrayBuffer());
    if (bytes.length !== sizeBytes || !matchesMediaHeader(bytes.subarray(0, 32), mimeType)) {
      throw new Error("Uploaded image contents are invalid.");
    }
    const visualId = claim.job.contentItemId ? await persistExternalVisual({ workspaceId: claim.device.workspaceId,
      contentItemId: claim.job.contentItemId, slideIndex: claim.job.slideIndex ?? undefined,
      model: "chatgpt-companion", imageBuffer: bytes, storage,
      targetWidth: claim.job.targetWidth ?? undefined, targetHeight: claim.job.targetHeight ?? undefined }) : null;
    await getDb().update(companionImageJobs).set({ status: "completed", visualAssetId: visualId,
      error: null, updatedAt: new Date() }).where(and(eq(companionImageJobs.id, jobId),
        eq(companionImageJobs.deviceId, claim.device.id), eq(companionImageJobs.status, "uploading")));
    await bucket.remove([expectedPath]).catch(() => undefined);
    revalidatePath("/content-studio");
    return NextResponse.json({ status: "completed", visualAssetId: visualId },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save companion image.";
    await bucket.remove([expectedPath]).catch(() => undefined);
    await getDb().update(companionImageJobs).set({ status: "failed", error: message.slice(0, 400),
      updatedAt: new Date() }).where(and(eq(companionImageJobs.id, jobId),
        eq(companionImageJobs.deviceId, claim.device.id), eq(companionImageJobs.status, "uploading")));
    return NextResponse.json({ error: "Could not save generated image." }, { status: 502 });
  }
}
