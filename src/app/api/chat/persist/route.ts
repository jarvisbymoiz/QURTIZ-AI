import { NextResponse, type NextRequest } from "next/server";
import type { UIMessage } from "ai";
import { z } from "zod";
import { and, eq, isNull, param, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { chatMessages, chatThreads } from "@/db/schema";
import { can } from "@/lib/permissions";
import { getMembership, getSessionUser, resolveActionWorkspace } from "@/lib/workspace";
import { rateLimit } from "@/lib/security/rate-limit";
import {
  filterEmptyAssistantPlaceholders,
  maybeAutoTitleThread,
  resolveStaleAssistantMetadata,
  textOf,
} from "@/lib/ai/chat-persistence";

export const dynamic = "force-dynamic";

// Validate the envelope while keeping every part INTACT: tool inputs/outputs,
// reasoning, file parts, and message metadata (runId/runStatus run truth) all
// pass through untouched — reloaded threads must re-render tools in their
// real terminal states. Unknown fields are preserved (passthrough), only the
// structural minimum is enforced.
const persistedMessageSchema = z
  .object({
    id: z.string().min(1),
    role: z.enum(["system", "user", "assistant"]),
    parts: z.array(z.unknown()),
  })
  .passthrough();

const persistBodySchema = z.object({
  threadId: z.string().uuid().nullable().optional(),
  workspaceId: z.string().uuid().optional(),
  messages: z.array(persistedMessageSchema).min(1).max(100),
});

// body size guard: attachments inflate message payloads
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (user) {
    const rl = rateLimit("persist:" + user.id, 60, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } });
    }
  }
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const parsed = persistBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  // Envelope validated above; parts are intentionally kept opaque (passthrough)
  // so tool outputs and run metadata survive persistence untouched.
  const body = parsed.data as unknown as {
    threadId?: string | null;
    workspaceId?: string;
    messages: UIMessage[];
  };

  const workspaceId = body.workspaceId ?? (await resolveActionWorkspace(user.id));
  if (!workspaceId) {
    return NextResponse.json({ error: "NO_ACTIVE_WORKSPACE" }, { status: 400 });
  }

  const membership = await getMembership(user.id, workspaceId);
  if (!membership || !can(membership.role, "chat:use")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const db = getDb();
  const incoming = filterEmptyAssistantPlaceholders(body.messages);

  let threadId = body.threadId ?? null;
  let createdThread = false;

  if (incoming.length === 0) {
    // Nothing but empty assistant placeholders (a dead stream's leftovers) —
    // never persist them, and never create a thread for them.
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  if (threadId) {
    const [thread] = await db
      .select({ id: chatThreads.id })
      .from(chatThreads)
      .where(
        and(
          eq(chatThreads.id, threadId),
          eq(chatThreads.workspaceId, workspaceId),
          eq(chatThreads.userId, user.id),
          isNull(chatThreads.deletedAt),
        ),
      );
    if (!thread) {
      return NextResponse.json({ error: "THREAD_NOT_FOUND" }, { status: 404 });
    }
  } else {
    // First-exchange path: the chat route skips server-side persistence when
    // no threadId exists, so THIS route owns thread creation for the first
    // message (truncated first-message title; the auto-title pass upgrades
    // it after the first successful exchange).
    const firstUser = incoming.find((m) => m.role === "user");
    const rawTitle = firstUser ? textOf(firstUser).trim() : "New chat";
    const title = (rawTitle.length > 0 ? rawTitle : "New chat").slice(0, 60);
    const [thread] = await db
      .insert(chatThreads)
      .values({ workspaceId, userId: user.id, title })
      .returning();
    threadId = thread.id;
    createdThread = true;
  }

  // Upsert per-message by (thread_id, message->>'id'). The chat route also
  // persists assistant rows server-side (backend = source of truth); a client
  // persist that re-posts such a row overwrites the same key cleanly — never
  // a duplicate. Empty assistant placeholders were already dropped above so a
  // client that lost its stream mid-flight cannot reintroduce them.
  for (const m of incoming) {
    await db
      .delete(chatMessages)
      .where(
        and(
          eq(chatMessages.threadId, threadId),
          // param(): plain strings in sql`` are interpolated as RAW SQL — the
          // message id is client-supplied and must be a bound parameter.
          sql`${chatMessages.message} ->> 'id' = ${param(m.id)}`,
        ),
      );
    await db.insert(chatMessages).values({
      threadId,
      workspaceId,
      role: m.role,
      content: textOf(m),
      message: m as unknown as Record<string, unknown>,
    });
  }

  await db
    .update(chatThreads)
    .set({ updatedAt: new Date() })
    .where(eq(chatThreads.id, threadId));

  // Resolve any assistant metadata that still claims "running" against the
  // real agent_runs state. Cheap, idempotent (only selects rows whose jsonb
  // metadata says "running") — a re-loaded tab posting its messages surfaces
  // the terminal truth immediately.
  await resolveStaleAssistantMetadata(threadId);

  // First successful exchange on a thread created here → auto-title it.
  // Bounded, fire-and-forget, silent on failure; user renames always win.
  if (createdThread) {
    const completedAssistant = incoming.find(
      (m) =>
        m.role === "assistant" &&
        (m.parts ?? []).length > 0 &&
        (m.metadata as { runStatus?: string } | undefined)?.runStatus === "completed",
    );
    const firstUser = incoming.find((m) => m.role === "user");
    const firstUserText = firstUser ? textOf(firstUser) : "";
    if (completedAssistant && firstUserText) {
      maybeAutoTitleThread({ threadId, workspaceId, firstUserText });
    }
  }

  return NextResponse.json({ threadId });
}
