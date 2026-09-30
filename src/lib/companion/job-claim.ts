import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { companionImageJobs } from "@/db/schema";
import { authenticateCompanion } from "@/lib/companion/device-auth";

export async function authenticateJobClaim(request: Request, jobId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return null;
  const device = await authenticateCompanion(request);
  if (!device) return null;
  const secret = request.headers.get("x-qurtiz-claim") ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret)) return null;
  const [job] = await getDb().select().from(companionImageJobs)
    .where(and(eq(companionImageJobs.id, jobId), eq(companionImageJobs.workspaceId, device.workspaceId),
      eq(companionImageJobs.userId, device.userId), eq(companionImageJobs.deviceId, device.id),
      gt(companionImageJobs.leaseExpiresAt, new Date()))).limit(1);
  if (!job?.claimTokenHash || !["claimed", "generating", "uploading"].includes(job.status)) return null;
  const actual = Buffer.from(createHash("sha256").update(`qurtiz-claim-v1:${secret}`).digest("hex"), "hex");
  const expected = Buffer.from(job.claimTokenHash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return { device, job };
}
