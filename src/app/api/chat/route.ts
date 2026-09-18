import { boundedAgentReference } from "@/lib/ai/memory-policy";
import { retrieveAgentMemory } from "@/lib/ai/persistent-memory";
import { NextResponse, type NextRequest } from "next/server";
import {
  convertToModelMessages,
  consumeStream,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { prepareChatTurn, ChatTurnError } from "@/lib/ai/chat-turn";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { agentRuns, brands, workspaces, chatThreads } from "@/db/schema";
import { buildAgentTools } from "@/lib/ai/tools";
import { describeStreamError, repairWrappedToolCall } from "@/lib/ai/stream-errors";
import { buildSystemPrompt } from "@/lib/ai/agent";
import { getWorkspacePublishProvider } from "@/lib/publish/provider";
import { AIConfigError, estimateCostFromUsage } from "@/lib/ai/provider";
import { getWorkspaceTextModel } from "@/lib/ai/config";
import { can } from "@/lib/permissions";
import { abortRun, isRunRegistered, registerRunController, unregisterRunController } from "@/lib/ai/run-registry";
import { and } from "drizzle-orm";
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

import { createBudgetedChatModel, resolveChatBudget, type ConversationContext } from "@/lib/ai/chat-budget";

import { createLazyChatTools } from "@/lib/ai/chat-tools";

export const dynamic = "force-dynamic";



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
    | { messages?: UIMessage[]; workspaceId?: string; threadId?: string | null; createThread?: boolean }
    | null;
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 500 ||
    !z.string().uuid().safeParse(body.threadId).success ||
    (body.workspaceId !== undefined && !z.string().uuid().safeParse(body.workspaceId).success)) {
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


  // Empty assistant placeholders (parts=[]) from a dead earlier stream must
  // never reach the model context — several providers reject an assistant
  // message with no content, which is exactly how the "second message always
  // fails" loop used to sustain itself.
  const userMessage = z.object({ id: z.string().min(1).max(200), role: z.literal("user"),
    parts: z.array(z.union([
      z.object({ type: z.literal("text"), text: z.string().max(30_000) }),
      z.object({ type: z.literal("file"), mediaType: z.string(), url: z.string().max(12_000_000), filename: z.string().max(300).optional() }),
    ])).min(1).max(12),
  }).safeParse(body.messages.at(-1));
  if (!userMessage.success) return NextResponse.json({ error: "INVALID_MESSAGE" }, { status: 400 });
  const sanitized = filterEmptyAssistantPlaceholders([userMessage.data as UIMessage]);
  if (sanitized.length === 0) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const db = getDb();
  const [brandRow] = await db.select({ businessName: brands.businessName }).from(brands).where(eq(brands.workspaceId, workspaceId));
  const [workspaceRow] = await db
    .select({ timezone: workspaces.timezone })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));
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
        if (typeof fp.url !== "string" || !fp.url.startsWith(`data:${fp.mediaType};base64,`) ||
          !/^[A-Za-z0-9+/]+={0,2}$/.test(fp.url.slice(fp.url.indexOf(",") + 1))) {
          return NextResponse.json({ error: "INVALID_ATTACHMENT", message: "Attach a local file; remote attachment URLs are not supported." }, { status: 400 });
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

  const threadId = body.threadId!;

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

  let prepared;
  try {
    prepared = await prepareChatTurn({ threadId, createThread: body.createThread === true,
      workspaceId, userId: user.id, message: sanitized[sanitized.length - 1], model: textModel.modelId });
  } catch (error) {
    if (error instanceof ChatTurnError) return NextResponse.json({ error: "CHAT_CONFLICT", message: error.message }, { status: error.status });
    console.error("[chat] Could not save turn", error);
    return NextResponse.json({ error: "PERSISTENCE_FAILED", message: "Could not save your message. Please retry." }, { status: 503 });
  }
  const { run } = prepared;
  // Real cancellation: the cancel route aborts this controller, which trips
  // the combined abort signal below (user cancel OR the 600s safety cap).
  const cancelController = new AbortController();
  registerRunController(run.id, cancelController);
  const runSignal = AbortSignal.any([cancelController.signal, AbortSignal.timeout(600_000)]);
  let pollingCancellation = false;
  const cancellationTimer = setInterval(async () => {
    if (pollingCancellation) return;
    pollingCancellation = true;
    try {
      const [current] = await db.select({ status: agentRuns.status }).from(agentRuns).where(eq(agentRuns.id, run.id));
      if (!current || current.status === "cancelled") abortRun(run.id);
    } catch (error) { console.error("[chat] Cancellation check failed", error); }
    finally { pollingCancellation = false; }
  }, 2000);
  runSignal.addEventListener("abort", () => clearInterval(cancellationTimer), { once: true });
  // Distinguishes WHY the combined abort signal tripped — the message
  // metadata and the agent_runs row must always tell the same story.
  let abortOutcome: "user" | "timeout" | null = null;

  try {
    const budget = resolveChatBudget(textModel.provider, textModel.modelId);
    const scope = `${textModel.provider}/${textModel.modelId}`;
    const prior = prepared.context as ConversationContext | null;
    const capacity = Math.min(budget.contextTokens, budget.requestTokens, prior?.scope === scope && prior.learnedLimit ? prior.learnedLimit : Infinity);
    const memoryBytes = Math.max(200, Math.min(3200, Math.floor((capacity - Math.min(budget.outputTokens, capacity / 8)) * budget.threshold * 0.12 * 3)));
    const memoryContext = await retrieveAgentMemory({ userId: user.id, workspaceId }, textOf(sanitized[sanitized.length - 1]));
    const system = buildSystemPrompt({
      identity: memoryContext.identity,
      persistentContext: boundedAgentReference(memoryContext, memoryBytes),
      lazyContext: true, currentTask: textOf(sanitized[sanitized.length - 1]),
      brandSummary: "",
      memories: [],
      workspaceName: brandRow?.businessName ?? workspaceId,
      workspaceTimezone: workspaceRow?.timezone ?? "UTC",
      publishProvider,
    });

    const recent = prepared.messages;

    // M6: AI SDK v5 streamText() returns synchronously — provider errors
    // (429/5xx) arrive later as error parts inside the stream, so a retry
    // wrapper around the call itself can never catch them (the old
    // withRateLimitRetry was dead code here). The SDK retries the request
    // phase internally; stream errors are captured via onError and surfaced
    // as an honest failure below instead of a silent truncated stream.
    let streamError: string | null = null;
    const compressionUsage = { inputTokens: 0, outputTokens: 0 };
    const model = createBudgetedChatModel({ model: textModel.model, scope: `${textModel.provider}/${textModel.modelId}`,
      budget,
      onCompressionDiagnostic: event => {
        if (process.env.NODE_ENV !== "production" || process.env.QURTIZ_CHAT_BUDGET_DEBUG === "1") {
          console.info("[chat:compression]", { runId: run.id, provider: textModel.provider, model: textModel.modelId, ...event });
        }
      },
      onDiagnostic: diagnostic => {
        if (process.env.NODE_ENV !== "production" || process.env.QURTIZ_CHAT_BUDGET_DEBUG === "1") {
          console.info("[chat:budget]", { runId: run.id, provider: textModel.provider, model: textModel.modelId, ...diagnostic });
        }
      },
      onUsage: async usage => {
        compressionUsage.inputTokens += usage.inputTokens ?? 0;
        compressionUsage.outputTokens += usage.outputTokens ?? 0;
        await db.update(agentRuns).set({ ...compressionUsage,
          costUsd: estimateCostFromUsage(textModel.modelId, compressionUsage).toFixed(6) })
          .where(and(eq(agentRuns.id, run.id), eq(agentRuns.status, "running")));
      },
      context: prepared.context as ConversationContext | null,
      save: async context => {
        await db.update(chatThreads).set({ context }).where(and(eq(chatThreads.id, threadId),
          eq(chatThreads.workspaceId, workspaceId), eq(chatThreads.userId, user.id)));
      },
    });

    const lazyTools = createLazyChatTools(buildAgentTools({ workspaceId, userId: user.id, runId: run.id, abortSignal: runSignal, currentTask: textOf(sanitized[sanitized.length - 1]) }), textOf(sanitized[sanitized.length - 1]));
    const result = streamText({
      model,
      system,
      messages: convertToModelMessages(recent),
      tools: lazyTools.tools,
      prepareStep: lazyTools.prepareStep,
      stopWhen: stepCountIs(6),
      // Centralized, provider-agnostic repair for tool calls whose arguments
      // arrive wrapped in a `{"json": {...}}` envelope (some models emit the
      // wrapped shape; the SDK then rejects the OUTER object with "missing
      // properties" + "additionalProperties 'json' not allowed"). The hook
      // unwraps before validation and the SDK re-validates the normalized
      // input against the FULL tool schema, so required fields and enum
      // constraints stay enforced for every tool on every provider (Gemini
      // via @ai-sdk/google, everything else via openai-compatible).
      experimental_repairToolCall: repairWrappedToolCall,
      // Overall safety net for the entire streamed response, combined with
      // the user-cancel signal (AbortSignal.any — Node 22). A dead SSE
      // connection (server restart) or a stalled provider step used to leave
      // the stream open forever — the client pulsed on a non-terminal tool
      // part indefinitely. 10 minutes is generous beyond any legitimate
      // tool-heavy chat (bounded content generation is ~≤9 min pathological),
      // but guarantees the stream can never hang forever.
      abortSignal: runSignal,
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
      // The SDK passes the callback an EVENT ({ error }), not the error
      // itself — destructuring is what turns the real provider failure
      // (HTTP 429 rate limit, mid-stream drop, context error) into an
      // honest, sanitized, actionable message instead of the opaque
      // "Provider stream error" fallback. This string flows into the run
      // row, the finish-part metadata and the persisted assistant message.
      onError: ({ error }) => {
        streamError = describeStreamError(error);
      },
      onFinish: async ({ usage }) => {
        clearInterval(cancellationTimer);
        unregisterRunController(run.id);
        try {
          await db
            .update(agentRuns)
            .set({
              inputTokens: (usage?.inputTokens ?? 0) + compressionUsage.inputTokens,
              outputTokens: (usage?.outputTokens ?? 0) + compressionUsage.outputTokens,
              costUsd: usage
                ? estimateCostFromUsage(textModel.modelId, { inputTokens: (usage.inputTokens ?? 0) + compressionUsage.inputTokens, outputTokens: (usage.outputTokens ?? 0) + compressionUsage.outputTokens }).toFixed(6)
                : null,
            })
            .where(and(eq(agentRuns.id, run.id), eq(agentRuns.status, "running")));
        } catch (error) {
          console.error("[chat] Usage persistence failed", { runId: run.id, error });
        }
      },
    });

    return result.toUIMessageStreamResponse({
      consumeSseStream: ({ stream }) => consumeStream({ stream }),
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
        clearInterval(cancellationTimer);
        const terminal = resolveTerminalRunState({
          isAborted,
          abortOutcome,
          finishReason,
          streamError,
        });

        // prepareChatTurn already saved the thread and placeholder, including
        // the first exchange. Finalize the response and run together.
        if (threadId) {
          try {
            await persistAssistantMessage({
              threadId,
              workspaceId,
              userId: user.id,
              message: { ...responseMessage, id: assistantMessageIdForTurn(recent[recent.length - 1], run.id),
                metadata: { ...(responseMessage.metadata as Record<string, unknown> | undefined), runId: run.id } },
              runStatus: terminal.status,
              runError: terminal.error,
            });
          } catch (error) {
            console.error("[chat] Assistant persistence failed", { runId: run.id, error });
            await db.update(agentRuns).set({ status: "failed", error: "The response could not be saved. Please retry.", finishedAt: new Date() })
              .where(and(eq(agentRuns.id, run.id), eq(agentRuns.status, "running")))
              .catch(error => console.error("[chat] Persistence failure bookkeeping failed", { runId: run.id, error }));
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
    clearInterval(cancellationTimer);
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
