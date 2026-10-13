import "server-only";
import { and, asc, eq, inArray, isNotNull, lt, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { agentRuns, companionDevices, companionImageJobs, contentItems, contentVariants, jobs, platformConnections, publishingJobs, settings, workspaceAiConfig, workspaceMembers, workspaces } from "@/db/schema";
import { createServiceClient } from "@/lib/supabase/service";
import { isWorkspaceStorageKey } from "@/lib/security/storage-key";
const TYPE = "workspace_delete";
// Previously issued signed upload URLs live for two hours. Keep the tombstone
// and durable job until they expire, then sweep again before the FK cascade.
export const WORKSPACE_UPLOAD_DRAIN_MS = 2 * 60 * 60_000 + 5 * 60_000;
const LEASE_MS = 10 * 60_000;
const MAX_FAILURES = 8;
type State = { failures?: number; nextAttemptAt?: string; reason?: string };

export async function queueWorkspaceDeletion(actor: { workspaceId: string; userId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(actor.workspaceId).success) return { ok: false, error: "Invalid workspace." };
  return getDb().transaction(async tx => {
    const [workspace] = await tx.select().from(workspaces).where(eq(workspaces.id, actor.workspaceId)).for("update");
    if (!workspace || workspace.createdBy !== actor.userId) return { ok: false as const, error: "Only the workspace owner can delete it." };
    if (workspace.deletedAt) return { ok: true as const };
    const [member] = await tx.select({ role: workspaceMembers.role }).from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, actor.workspaceId), eq(workspaceMembers.userId, actor.userId)));
    if (member?.role !== "owner") return { ok: false as const, error: "Only the workspace owner can delete it." };
    // Same lock order as Companion completion (device then content), and the
    // item locks used by Publish Now. This closes concurrent publish handoffs.
    await tx.select({ id: companionDevices.id }).from(companionDevices).where(eq(companionDevices.workspaceId, actor.workspaceId)).for("update");
    await tx.select({ id: contentItems.id }).from(contentItems).where(eq(contentItems.workspaceId, actor.workspaceId)).for("update");
    // Lock pending publishing rows against the existing claim operation. Do
    // not pretend an already in-flight external publish can be undone.
    const delivery = await tx.select({ id: publishingJobs.id, status: publishingJobs.status }).from(publishingJobs)
      .where(and(eq(publishingJobs.workspaceId, actor.workspaceId), inArray(publishingJobs.status, ["pending", "processing"]))).for("update");
    if (delivery.some(row => row.status === "processing")) return { ok: false as const, error: "A post is currently publishing. Wait for it to finish, then delete this workspace." };
    const now = new Date();
    await tx.update(workspaces).set({ deletedAt: now, updatedAt: now }).where(eq(workspaces.id, actor.workspaceId));
    await tx.update(contentItems).set({ status: "archived", deletedAt: now, updatedAt: now }).where(eq(contentItems.workspaceId, actor.workspaceId));
    await tx.update(contentVariants).set({ status: "archived", updatedAt: now }).where(eq(contentVariants.workspaceId, actor.workspaceId));
    await tx.update(publishingJobs).set({ status: "cancelled", updatedAt: now }).where(and(eq(publishingJobs.workspaceId, actor.workspaceId), eq(publishingJobs.status, "pending")));
    await tx.update(jobs).set({ status: "cancelled", updatedAt: now }).where(and(eq(jobs.workspaceId, actor.workspaceId), inArray(jobs.status, ["queued", "running"]), ne(jobs.type, TYPE)));
    await tx.update(agentRuns).set({ status: "cancelled", finishedAt: now }).where(and(eq(agentRuns.workspaceId, actor.workspaceId), eq(agentRuns.status, "running")));
    await tx.update(companionDevices).set({ revokedAt: now, chatgptConnected: false, updatedAt: now }).where(eq(companionDevices.workspaceId, actor.workspaceId));
    await tx.update(companionImageJobs).set({ status: "failed", claimTokenHash: null, error: "Workspace deleted.", updatedAt: now }).where(and(eq(companionImageJobs.workspaceId, actor.workspaceId), inArray(companionImageJobs.status, ["queued", "waiting_for_companion", "claimed", "generating", "uploading"])));
    await tx.update(platformConnections).set({ status: "not_connected", encryptedToken: null, updatedAt: now }).where(eq(platformConnections.workspaceId, actor.workspaceId));
    await tx.delete(workspaceAiConfig).where(eq(workspaceAiConfig.workspaceId, actor.workspaceId));
    await tx.update(settings).set({ value: sql`${settings.value} || '{"enabled":false}'::jsonb`, updatedAt: now }).where(and(eq(settings.workspaceId, actor.workspaceId), eq(settings.key, "autopilot")));
    // Removing only these memberships immediately closes UI, actions and RLS.
    await tx.delete(workspaceMembers).where(eq(workspaceMembers.workspaceId, actor.workspaceId));
    await tx.insert(jobs).values({ workspaceId: actor.workspaceId, userId: actor.userId, type: TYPE, status: "queued", input: {}, result: { failures: 0 } });
    return { ok: true as const };
  });
}

type Bucket = ReturnType<ReturnType<typeof createServiceClient>["storage"]["from"]>;
/** Bounded, prefix-only cleanup, including abandoned uploads with no DB row. */
export async function purgeWorkspaceStorageBatch(bucket: Pick<Bucket, "list" | "remove">, workspaceId: string): Promise<{ removed: number; empty: boolean }> {
  if (!z.string().uuid().safeParse(workspaceId).success) throw new Error("invalid_workspace_scope");
  let visited = 0;
  let removed = 0;
  let reserved = 0;
  let complete = true;
  async function visit(prefix: string, depth: number) {
    if (visited >= 25 || reserved >= 100) { complete = false; return; }
    if (depth > 8) throw new Error("storage_depth_limit");
    visited++;
    const { data, error } = await bucket.list(prefix, { limit: 100, sortBy: { column: "name", order: "asc" } });
    if (error || !data) throw new Error("storage_list_failed");
    if (data.length === 100) complete = false;
    const paths: string[] = [];
    for (const entry of data) {
      const path = `${prefix}/${entry.name}`;
      if (!isWorkspaceStorageKey(path, workspaceId) || entry.name.includes("/")) throw new Error("invalid_storage_scope");
      if (!entry.id && !entry.metadata) await visit(path, depth + 1);
      else if (reserved < 100) { paths.push(path); reserved++; }
      else complete = false;
    }
    if (paths.length) {
      const result = await bucket.remove(paths);
      if (result.error) throw new Error("storage_remove_failed");
      removed += paths.length;
    }
  }
  await visit(workspaceId, 0);
  return { removed, empty: complete };
}

/** Durable database claims; shared by Vercel maintenance and the local worker. */
export async function workspaceDeletionTick() {
  const db = getDb();
  const stats = { checked: 0, completed: 0, pending: 0, failed: 0 };
  const candidates = await db.select({ id: jobs.id }).from(jobs)
    .where(and(eq(jobs.type, TYPE), sql`(${jobs.result}->>'nextAttemptAt' IS NULL OR (${jobs.result}->>'nextAttemptAt')::timestamptz <= now())`, or(eq(jobs.status, "queued"), and(eq(jobs.status, "running"), lt(jobs.updatedAt, new Date(Date.now() - LEASE_MS))))))
    .orderBy(asc(jobs.updatedAt)).limit(20);
  for (const candidate of candidates) {
    if (stats.checked >= 5) break;
    const claimed = await db.transaction(async tx => {
      const [job] = await tx.select().from(jobs).where(and(eq(jobs.id, candidate.id), eq(jobs.type, TYPE))).for("update", { skipLocked: true });
      if (!job || !["queued", "running"].includes(job.status)) return null;
      if (job.status === "running" && Date.now() - job.updatedAt.getTime() < LEASE_MS) return null;
      const state = job.result as State;
      if (state.nextAttemptAt && new Date(state.nextAttemptAt).getTime() > Date.now()) return null;
      const [workspace] = await tx.select().from(workspaces).where(and(eq(workspaces.id, job.workspaceId), isNotNull(workspaces.deletedAt)));
      if (!workspace) { await tx.update(jobs).set({ status: "failed", error: "Deletion tombstone missing.", updatedAt: new Date() }).where(eq(jobs.id, job.id)); return null; }
      const lease = new Date();
      await tx.update(jobs).set({ status: "running", updatedAt: lease }).where(eq(jobs.id, job.id));
      return { job, workspace, lease };
    });
    if (!claimed) continue;
    stats.checked++;
    const ownedClaim = and(eq(jobs.id, claimed.job.id), eq(jobs.workspaceId, claimed.workspace.id), eq(jobs.type, TYPE), eq(jobs.status, "running"), eq(jobs.updatedAt, claimed.lease));
    try {
      const service = createServiceClient({ requestTimeoutMs: 20_000 });
      const pass = await purgeWorkspaceStorageBatch(service.storage.from("brand-assets"), claimed.workspace.id);
      const drainUntil = claimed.workspace.deletedAt!.getTime() + WORKSPACE_UPLOAD_DRAIN_MS;
      if (!pass.empty || Date.now() < drainUntil) {
        const next = pass.empty ? drainUntil : Date.now() + 60_000;
        await db.update(jobs).set({ status: "queued", error: null, result: { failures: 0, nextAttemptAt: new Date(next).toISOString() }, updatedAt: new Date() }).where(ownedClaim);
        stats.pending++; continue;
      }
      const removed = await db.transaction(async tx => {
        const [job] = await tx.select({ id: jobs.id }).from(jobs).where(ownedClaim).for("update");
        if (!job) return false;
        // Database cascades remove every workspace-owned record and this job.
        const rows = await tx.delete(workspaces).where(and(eq(workspaces.id, claimed.workspace.id), isNotNull(workspaces.deletedAt))).returning({ id: workspaces.id });
        return rows.length > 0;
      });
      if (removed) stats.completed++;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      const reason = /^(storage_(list|remove)_failed|invalid_(workspace|storage)_scope|storage_depth_limit)$/.test(detail) ? detail : detail.includes("not configured") ? "storage_configuration_missing" : "database_or_transport_error";
      const failures = ((claimed.job.result as State).failures ?? 0) + 1;
      await db.update(jobs).set({ status: failures >= MAX_FAILURES ? "failed" : "queued", error: "Workspace cleanup failed; inspect server configuration or Storage availability.",
        result: { failures, nextAttemptAt: new Date(Date.now() + Math.min(60 * 60_000, 60_000 * 2 ** failures)).toISOString(), reason }, updatedAt: new Date() }).where(ownedClaim);
      console.error("[workspace-cleanup]", { workspaceId: claimed.workspace.id, failures, reason });
      stats.failed++;
    }
  }
  return stats;
}
