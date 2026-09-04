import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { agentRuns, agentSteps } from "@/db/schema";
import { can } from "@/lib/permissions";
import { getMembership, getSessionUser, resolveActionWorkspace } from "@/lib/workspace";
import type { ChatRunStatus } from "@/lib/ai/chat-run";

export const dynamic = "force-dynamic";

/**
 * GET /api/chat/run/[runId] — reconnect-to-truth for an agent run.
 *
 * Returns the run's real backend status plus its logged steps, so the UI can
 * render what actually happened (completed / failed / cancelled) after a
 * dropped stream, a stale tab, or a server restart — instead of guessing
 * from the client-side stream state. This is the recovery primitive the
 * job-based executor (Batch 2) builds its resume flow on.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { runId } = await params;
  if (!runId) {
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
  const [run] = await db
    .select({ id: agentRuns.id, status: agentRuns.status, error: agentRuns.error })
    .from(agentRuns)
    .where(and(eq(agentRuns.id, runId), eq(agentRuns.workspaceId, workspaceId), eq(agentRuns.userId, user.id)));
  if (!run) {
    return NextResponse.json({ error: "RUN_NOT_FOUND" }, { status: 404 });
  }

  const steps = await db
    .select({
      name: agentSteps.toolName,
      createdAt: agentSteps.createdAt,
      status: agentSteps.status,
    })
    .from(agentSteps)
    .where(and(eq(agentSteps.runId, run.id), eq(agentSteps.workspaceId, workspaceId)))
    .orderBy(asc(agentSteps.idx));

  return NextResponse.json({
    status: run.status as ChatRunStatus,
    error: run.error,
    steps: steps.map((s) => ({
      name: s.name ?? "step",
      createdAt: s.createdAt.toISOString(),
      ok: s.status === "completed",
    })),
  });
}
