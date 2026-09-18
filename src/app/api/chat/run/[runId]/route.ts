import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { agentRuns, agentSteps, chatMessages, chatThreads } from "@/db/schema";
import { can } from "@/lib/permissions";
import { getMembership, getSessionUser, resolveActionWorkspace } from "@/lib/workspace";
import type { ChatRunStatus } from "@/lib/ai/chat-run";
import { z } from "zod";
import { rateLimit } from "@/lib/security/rate-limit";

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
  if (!z.string().uuid().safeParse(runId).success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  if (!rateLimit(`chat-status:${user.id}`, 120, 60_000).allowed) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
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
    .select({ id: agentRuns.id, status: agentRuns.status, error: agentRuns.error, finishedAt: agentRuns.finishedAt })
    .from(agentRuns)
    .where(and(eq(agentRuns.id, runId), eq(agentRuns.workspaceId, workspaceId), eq(agentRuns.userId, user.id)));
  if (!run) {
    return NextResponse.json({ error: "RUN_NOT_FOUND" }, { status: 404 });
  }
  const [saved] = await db.select({ message: chatMessages.message }).from(chatMessages)
    .innerJoin(chatThreads, eq(chatThreads.id, chatMessages.threadId))
    .where(and(eq(chatThreads.userId, user.id), eq(chatThreads.workspaceId, workspaceId),
      sql`${chatMessages.message} -> 'metadata' ->> 'runId' = ${run.id}`)).limit(1);

  const steps = await db
    .select({
      name: agentSteps.toolName,
      createdAt: agentSteps.createdAt,
      status: agentSteps.status,
    })
    .from(agentSteps)
    .where(and(eq(agentSteps.runId, run.id), eq(agentSteps.workspaceId, workspaceId)))
    .orderBy(asc(agentSteps.idx));

  const savedMessage = saved?.message as Record<string, unknown> | undefined;
  const savedMetadata = savedMessage?.metadata as Record<string, unknown> | undefined;
  // Cancellation may be acknowledged before the stream's partial response
  // flushes. Give that callback a bounded window before caching an empty result.
  const awaitingFlush = run.status !== "running" && savedMetadata?.runStatus === "running"
    && run.finishedAt && Date.now() - run.finishedAt.getTime() < 30_000;
  return NextResponse.json({
    status: run.status as ChatRunStatus,
    error: run.error,
    message: savedMessage && !awaitingFlush ? { ...savedMessage, metadata: {
      ...savedMetadata,
      runId: run.id, runStatus: run.status, ...(run.error ? { runError: run.error } : {}),
    } } : null,
    steps: steps.map((s) => ({
      name: s.name ?? "step",
      createdAt: s.createdAt.toISOString(),
      ok: s.status === "completed",
    })),
  });
}
