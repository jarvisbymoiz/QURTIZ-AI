import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { agentRuns } from "@/db/schema";
import { abortRun } from "@/lib/ai/run-registry";
import { can } from "@/lib/permissions";
import { getMembership, getSessionUser, resolveActionWorkspace } from "@/lib/workspace";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/chat/cancel { runId } — abort an in-flight chat run.
 *
 * Truthful cancellation: aborts the run's registered AbortController (the
 * stream ends with an abort, the server-side agent stops) and marks the run
 * "cancelled". Idempotent — an already-finished run returns its current
 * status and changes nothing (the status update is guarded on "running").
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (user) {
    const rl = rateLimit("chat-cancel:" + user.id, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } });
    }
  }
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { runId?: string } | null;
  if (!body || typeof body.runId !== "string" || body.runId.length === 0) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const workspaceId = await resolveActionWorkspace(user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "NO_ACTIVE_WORKSPACE" }, { status: 400 });
  }

  const membership = await getMembership(user.id, workspaceId);
  if (!membership || !can(membership.role, "chat:use")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const db = getDb();
  // Workspace + owner scoped: a run from another workspace or user is not
  // visible here (IDOR guard), and cancellation is owner-level action.
  const [run] = await db
    .select({ id: agentRuns.id, status: agentRuns.status })
    .from(agentRuns)
    .where(and(eq(agentRuns.id, body.runId), eq(agentRuns.workspaceId, workspaceId), eq(agentRuns.userId, user.id)));
  if (!run) {
    return NextResponse.json({ error: "RUN_NOT_FOUND" }, { status: 404 });
  }

  if (run.status !== "running") {
    // Already finished — idempotent no-op.
    return NextResponse.json({ ok: true, status: run.status });
  }

  abortRun(run.id);

  try {
    await db
      .update(agentRuns)
      .set({ status: "cancelled", error: "Run cancelled by user", finishedAt: new Date() })
      .where(and(eq(agentRuns.id, run.id), eq(agentRuns.status, "running")));
  } catch {
    // The abort itself already stopped the run; bookkeeping must not 500 here.
  }

  return NextResponse.json({ ok: true, status: "cancelled" });
}
