import { NextResponse, type NextRequest } from "next/server";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { agentRuns, brandMemory, brands, chatThreads, workspaces } from "@/db/schema";
import { buildAgentTools, summarizeBrandBrain } from "@/lib/ai/tools";
import { buildSystemPrompt } from "@/lib/ai/agent";
import { getWorkspacePublishProvider } from "@/lib/publish/provider";
import { AIConfigError, estimateCostFromUsage } from "@/lib/ai/provider";
import { getWorkspaceTextModel } from "@/lib/ai/config";
import { can } from "@/lib/permissions";
import { isRunRegistered, registerRunController, unregisterRunController } from "@/lib/ai/run-registry";
import { and, desc, isNull } from "drizzle-orm";
import { getMembership, getSessionUser, resolveActionWorkspace } from "@/lib/workspace";
import { rateLimit } from "@/lib/security/rate-limit";
import {
  assistantMessageIdForTurn,
  filterEmptyAssistantPlaceholders,
  maybeAutoTitleThread,
  persistAssistantMessage,
  resolveTerminalRunState,
  textOf,
} from "@/lib/ai/chat-persistence";

export const dynamic = "force-dynamic";

const MAX_RECENT_MESSAGES = 24;

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (user) {
    const rl = rateLimit("chat:" + user.id, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "RATE_LIMITED", message: "Too many messages. Retry in " + rl.retryAfterSeconds + "s." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } });
    }
  }
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { messages?: UIMessage[]; workspaceId?: string; threadId?: string | null }
    | null;
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const workspaceId = body.workspaceId ?? (await resolveActionWorkspace(user.id));
  if (!workspaceId) {
    return NextResponse.json({ error: "NO_ACTIVE_WORKSPACE" }, { status: 400 });
  }

  const membership = await getMembership(user.id, workspaceId);
  if (!membership || !can(membership.role, "chat:use")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // Workspace-isolated model resolution: THIS workspace's own AI config.
  let textModel;
  try {
    textModel = await getWorkspaceTextModel(workspaceId, "chat");
  } catch (error) {
    const detail = error instanceof AIConfigError ? error.detail : "AI is not configured for this workspace.";
    return NextResponse.json({ error: "CONFIGURATION_REQUIRED", message: detail }, { status: 503 });
  }
  const model = textModel.model;

  // Empty assistant placeholders (parts=[]) from a dead earlier stream must
  // never reach the model context — several providers reject an assistant
  // message with no content, which is exactly how the "second message always
  // fails" loop used to sustain itself.
  const sanitized = filterEmptyAssistantPlaceholders(body.messages);
  if (sanitized.length === 0) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const db = getDb();
  const [brandRow] = await db.select().from(brands).where(eq(brands.workspaceId, workspaceId));
  const [workspaceRow] = await db
    .select({ timezone: workspaces.timezone })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  const memories = await db
    .select()
    .from(brandMemory)
    .where(and(eq(brandMemory.workspaceId, workspaceId), eq(brandMemory.active, true)))
    .orderBy(desc(brandMemory.createdAt))
    .limit(60);

  // Publishing-route reality for the system prompt (Meta API ⇄ Buffer API).
  const publishProvider = await getWorkspacePublishProvider(workspaceId);

  // Attachment validation: images + PDF only, sane size caps. Runs BEFORE the
  // agent_run row is created so a rejected request cannot leave an orphaned
  // "running" run behind.
  const ALLOWED_MEDIA = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
  const MAX_PART_CHARS = 12_000_000; // ~9MB binary per part when base64
  let totalChars = 0;
  for (const msg of sanitized) {
    for (const part of msg.parts ?? []) {
      if (part.type === "file") {
        const fp = part as { mediaType?: string; url?: string };
        if (!fp.mediaType || !ALLOWED_MEDIA.has(fp.mediaType)) {
          return NextResponse.json({ error: "UNSUPPORTED_FILE", message: "Only PNG, JPEG, WebP images and PDF files are supported." }, { status: 400 });
        }
        totalChars += (fp.url ?? "").length;
        if ((fp.url ?? "").length > MAX_PART_CHARS) {
          return NextResponse.json({ error: "FILE_TOO_LARGE", message: "Each attachment must be under 9MB." }, { status: 400 });
        }
      }
    }
  }
  if (totalChars > 30_000_000) {
    return NextResponse.json({ error: "TOO_MANY_ATTACHMENTS", message: "Total attachments exceed 22MB." }, { status: 400 });
  }

  // Resolve the thread: when the client passed one, confirm it belongs to
  // this user/workspace. When it didn't (first exchange), thread creation
  // stays with /api/chat/persist exactly as before — server-side assistant
  // persistence simply skips below until the thread exists (the spec guard:
  // no threadId → keep current behavior).
  const threadId = typeof body.threadId === "string" && body.threadId.length > 0 ? body.threadId : null;
  if (threadId) {
    const [existing] = await db
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
    if (!existing) {
      return NextResponse.json({ error: "THREAD_NOT_FOUND" }, { status: 404 });
    }
  }

  // The first user message drives auto-titling. When the request contains
  // exactly one user message this IS the first exchange (or its retry) —
  // the only moment a still-default title may be upgraded.
  const firstUserMessage = sanitized.find((m) => m.role === "user");
  const firstUserText = firstUserMessage ? textOf(firstUserMessage) : "";
  const isFirstExchange = sanitized.filter((m) => m.role === "user").length === 1;

  // Deterministic assistant message id: derived from the request's last
  // message (after the SDK's regenerate() slicing that is the user message
  // being answered). A retry of the same turn therefore upserts the SAME
  // row key instead of appending a second assistant row. Computed at
  // response time (assistantMessageIdForTurn below) when the run id exists.

  const [run] = await db
    .insert(agentRuns)
    .values({ workspaceId, userId: user.id, kind: "chat", model: textModel.modelId })
    .returning();

  // Real cancellation: the cancel route aborts this controller, which trips
  // the combined abort signal below (user cancel OR the 600s safety cap).
  const cancelController = new AbortController();
  registerRunController(run.id, cancelController);
  // Distinguishes WHY the combined abort signal tripped — the message
  // metadata and the agent_runs row must always tell the same story.
  let abortOutcome: "user" | "timeout" | null = null;

  const system = buildSystemPrompt({
    brandSummary: summarizeBrandBrain(brandRow ?? null),
    memories,
    workspaceName: brandRow?.businessName ?? workspaceId,
    workspaceTimezone: workspaceRow?.timezone ?? "UTC",
    publishProvider,
  });

  const recent = sanitized.slice(-MAX_RECENT_MESSAGES);

  try {
    // M6: AI SDK v5 streamText() returns synchronously — provider errors
    // (429/5xx) arrive later as error parts inside the stream, so a retry
    // wrapper around the call itself can never catch them (the old
    // withRateLimitRetry was dead code here). The SDK retries the request
    // phase internally; stream errors are captured via onError and surfaced
    // as an honest failure below instead of a silent truncated stream.
    let streamError: string | null = null;

    const result = streamText({
      model,
      system,
      messages: convertToModelMessages(recent),
      tools: buildAgentTools({ workspaceId, userId: user.id, runId: run.id }),
      stopWhen: stepCountIs(6),
      // Overall safety net for the entire streamed response, combined with
      // the user-cancel signal (AbortSignal.any — Node 22). A dead SSE
      // connection (server restart) or a stalled provider step used to leave
      // the stream open forever — the client pulsed on a non-terminal tool
      // part indefinitely. 10 minutes is generous beyond any legitimate
      // tool-heavy chat (bounded content generation is ~≤9 min pathological),
      // but guarantees the stream can never hang forever.
      abortSignal: AbortSignal.any([cancelController.signal, AbortSignal.timeout(600_000)]),
      // Gemini-only option; other providers (openai-compatible) ignore it.
      ...(textModel.provider === "gemini"
        ? { providerOptions: { google: { thinkingConfig: { includeThoughts: true } } } }
        : {}),
      // On abort the SDK never calls onFinish — this is the only terminal
      // bookkeeping for cancelled/timed-out runs. A user cancel removes the
      // registry entry before aborting; a still-registered run means the
      // 600s safety cap (or another non-user abort) tripped.
      onAbort: () => {
        const userCancelled = !isRunRegistered(run.id);
        unregisterRunController(run.id);
        abortOutcome = userCancelled ? "user" : "timeout";
        void db
          .update(agentRuns)
          .set({
            status: userCancelled ? "cancelled" : "failed",
            error: userCancelled ? "Run cancelled by user" : "Generation timed out (600s safety cap)",
            finishedAt: new Date(),
          })
          .where(and(eq(agentRuns.id, run.id), eq(agentRuns.status, "running")))
          .catch(() => {
            // Never let run bookkeeping break the response.
          });
      },
      onError: (error) => {
        streamError = error instanceof Error ? error.message : "Provider stream error";
      },
      onFinish: async ({ usage, finishReason }) => {
        unregisterRunController(run.id);
        const failed = finishReason === "error" || streamError !== null;
        try {
          await db
            .update(agentRuns)
            .set({
              status: failed ? "failed" : "completed",
              inputTokens: usage?.inputTokens ?? null,
              outputTokens: usage?.outputTokens ?? null,
              costUsd: usage
                ? estimateCostFromUsage(textModel.modelId, usage).toFixed(6)
                : null,
              finishedAt: new Date(),
              error: failed ? streamError ?? "Generation failed (finishReason=error)" : null,
            })
            .where(and(eq(agentRuns.id, run.id), eq(agentRuns.status, "running")));
        } catch {
          // Never let run bookkeeping break the response.
        }
      },
    });

    return result.toUIMessageStreamResponse({
      // Run truth for the client: runId arrives with the stream `start` event
      // (so Stop can target the run immediately), and the terminal status
      // rides the `finish` event — persisted with the message so reloaded
      // threads render tools in their real states instead of guessing.
      // (User cancellation ends the stream with an `abort` part and no
      // finish event; the client resolves that stale "running" metadata
      // against /api/chat/run/[runId].)
      messageMetadata: ({ part }) => {
        if (part.type === "start") {
          return { runId: run.id, runStatus: "running" as const };
        }
        if (part.type === "finish") {
          const failed = part.finishReason === "error" || streamError !== null;
          return {
            runId: run.id,
            runStatus: failed ? ("failed" as const) : ("completed" as const),
            ...(failed ? { runError: streamError ?? "Generation failed (finishReason=error)" } : {}),
          };
        }
        return undefined;
      },
      // Persistence-mode inputs. originalMessages MUST end with the USER
      // message (the SDK reuses/continues the id of a trailing assistant
      // message — with DB rows that would merge this response into the
      // previous turn's row). The sanitized client history ends with the
      // user message by construction, so the generated responseMessage id
      // comes from generateMessageId below. Server-persisted parts remain
      // verbatim; originalMessages only shapes id/continuation logic.
      originalMessages: recent,
      generateMessageId: () => assistantMessageIdForTurn(recent[recent.length - 1], run.id),
      // Terminal persistence — the backend is the source of truth. Fired on
      // the stream flush for BOTH successful and failed streams, and on
      // cancel() (client disconnect) with no finishReason — the
      // interrupted case resolves to "failed" instead of a phantom row.
      onFinish: async ({ responseMessage, isAborted, finishReason }) => {
        const terminal = resolveTerminalRunState({
          isAborted,
          abortOutcome,
          finishReason,
          streamError,
        });

        // Server-side assistant persistence (skip on the very first
        // exchange, where the thread does not exist yet — /api/chat/persist
        // creates it and upserts the same message id there).
        if (threadId) {
          try {
            await persistAssistantMessage({
              threadId,
              workspaceId,
              userId: user.id,
              message: { ...responseMessage, id: assistantMessageIdForTurn(recent[recent.length - 1], run.id) },
              runStatus: terminal.status,
              runError: terminal.error,
            });
          } catch {
            // Persisting the row is best-effort: a failure here never
            // breaks the stream, the client can still save on its own
            // (it will be deduped by the persist route).
          }
          // First successful exchange → auto-title the thread (bounded,
          // fire-and-forget, user renames always win).
          if (terminal.status === "completed" && isFirstExchange && firstUserText) {
            maybeAutoTitleThread({ threadId, workspaceId, firstUserText });
          }
        }
      },
      sendFinish: true,
      sendStart: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown provider error";
    unregisterRunController(run.id);
    try {
      await db
        .update(agentRuns)
        .set({ status: "failed", error: message, finishedAt: new Date() })
        .where(eq(agentRuns.id, run.id));
    } catch {
      // ignore
    }
    return NextResponse.json({ error: "AI_PROVIDER_ERROR", message }, { status: 502 });
  }
}
