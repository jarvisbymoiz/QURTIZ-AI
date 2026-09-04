import { NextResponse, type NextRequest } from "next/server";
import type { UIMessage } from "ai";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { chatMessages, chatThreads } from "@/db/schema";
import { can } from "@/lib/permissions";
import { getMembership, getSessionUser, resolveActionWorkspace } from "@/lib/workspace";
import { rateLimit } from "@/lib/security/rate-limit";

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

function textOf(message: UIMessage): string {
  return (message.parts ?? [])
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

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
  const incoming = body.messages;

  let threadId = body.threadId ?? null;

  if (threadId) {
    const [thread] = await db
      .select({ id: chatThreads.id })
      .from(chatThreads)
      .where(
        and(
          eq(chatThreads.id, threadId),
          eq(chatThreads.workspaceId, workspaceId),
          eq(chatThreads.userId, user.id),
        ),
      );
    if (!thread) {
      return NextResponse.json({ error: "THREAD_NOT_FOUND" }, { status: 404 });
    }
  } else {
    const firstUser = incoming.find((m) => m.role === "user");
    const rawTitle = firstUser ? textOf(firstUser).trim() : "New chat";
    const title = (rawTitle.length > 0 ? rawTitle : "New chat").slice(0, 60);
    const [thread] = await db
      .insert(chatThreads)
      .values({ workspaceId, userId: user.id, title })
      .returning();
    threadId = thread.id;
  }

  await db.insert(chatMessages).values(
    incoming.map((m) => ({
      threadId: threadId as string,
      workspaceId,
      role: m.role,
      content: textOf(m),
      message: m as unknown as Record<string, unknown>,
    })),
  );

  await db
    .update(chatThreads)
    .set({ updatedAt: new Date() })
    .where(eq(chatThreads.id, threadId));

  return NextResponse.json({ threadId });
}
