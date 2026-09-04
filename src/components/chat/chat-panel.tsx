"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUp,
  Ban,
  Brain,
  CalendarClock,
  CheckCheck,
  ChevronDown,
  CircleAlert,
  Copy,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Pencil,
  PenSquare,
  RotateCcw,
  Search,
  Square,
  TrendingUp,
  Megaphone,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/chat/markdown";
import { chatRunMetadataOf, type ChatRunStatusResponse } from "@/lib/ai/chat-run";

const MAX_FILE_MB = 9;
// How long the conversation scrollbar stays visible after the last scroll event.
const SCROLL_HIDE_DELAY_MS = 600;

/**
 * Resolved truth for rendering tool activity on an assistant message.
 * - live:      the run is still streaming (pulsing rows are real)
 * - completed: the run finished (metadata or reconnect fetch) — a tool part
 *              that never reached a terminal state is a display artifact of
 *              the ended stream, NOT an interruption
 * - failed:    the run failed (metadata runStatus/reconnect) — show why
 * - cancelled: the user stopped the run
 */
type ToolTruth = "live" | "completed" | "failed" | "cancelled";

function toolDisplayName(type: string): string {
  const name = type.replace(/^tool-/, "");
  const labels: Record<string, string> = {
    get_brand_brain: "Reading Brand Brain",
    list_workspace_facts: "Checking brand memory",
    update_brand_memory: "Saving to brand memory",
    create_content: "Creating content",
    schedule_content: "Scheduling post",
    research_niche: "Researching niche",
    web_search: "Searching the web",
  };
  return labels[name] ?? name.replaceAll("_", " ");
}

function ToolActivity({
  type,
  state,
  truth,
  errorText,
}: {
  type: string;
  state?: string;
  truth: ToolTruth;
  errorText?: string | null;
}) {
  const name = type.replace(/^tool-/, "");
  const label = toolDisplayName(type);
  const done = state === "output-available";
  // A tool-level error is terminal for THIS tool (the agent keeps going with
  // non-blocking tool failures) — always rendered as the failure it is.
  const errored = state === "output-error";

  if (errored) {
    return (
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden />
        <span>
          {label} — failed
          {errorText ? <span className="block text-destructive/90">{errorText}</span> : null}
        </span>
      </div>
    );
  }
  if (done) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCheck className="size-3.5" aria-hidden />
        <span>{label}</span>
      </div>
    );
  }
  // Non-terminal tool part. Truth decides — never a guessed "interrupted".
  if (truth === "live") {
    const icon =
      name === "web_search" ? <Search className="size-3.5" aria-hidden /> :
      name === "schedule_content" ? <CalendarClock className="size-3.5" aria-hidden /> :
      name === "create_content" ? <PenSquare className="size-3.5" aria-hidden /> :
      name === "research_niche" ? <TrendingUp className="size-3.5" aria-hidden /> :
      name === "update_brand_memory" ? <Brain className="size-3.5" aria-hidden /> :
      <Brain className="size-3.5" aria-hidden />;
    return (
      <div className="flex items-center gap-2 text-xs animate-pulse text-primary">
        {icon}
        <span>{label}…</span>
      </div>
    );
  }
  if (truth === "cancelled") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Ban className="size-3.5" aria-hidden />
        <span>{label} — stopped</span>
      </div>
    );
  }
  if (truth === "failed") {
    return (
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden />
        <span>
          {label} — failed
          {errorText ? <span className="block text-destructive/90">{errorText}</span> : null}
        </span>
      </div>
    );
  }
  // truth === "completed": the run finished successfully; render the dangling
  // part as the muted completed step it counts as.
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <CheckCheck className="size-3.5" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

/** Classify one tool part into its truthful render state. */
function classifyPart(
  state: string | undefined,
  truth: ToolTruth,
): "completed" | "failed" | "stopped" | "live" {
  if (state === "output-available") return "completed";
  if (state === "output-error") return "failed";
  if (truth === "live") return "live";
  if (truth === "cancelled") return "stopped";
  if (truth === "failed") return "failed";
  return "completed";
}

function ToolActivitySummary({
  parts,
  truth,
  runError,
}: {
  parts: { type: string; state?: string }[];
  truth: ToolTruth;
  runError?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const classified = parts.map((p) => classifyPart(p.state, truth));
  const doneCount = classified.filter((c) => c === "completed").length;
  const failedCount = classified.filter((c) => c === "failed").length;
  const stoppedCount = classified.filter((c) => c === "stopped").length;
  const liveCount = classified.filter((c) => c === "live").length;
  const allDone = doneCount === parts.length;
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left text-xs text-muted-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        {allDone ? (
          <CheckCheck className="size-3.5 text-emerald-500" aria-hidden />
        ) : failedCount > 0 ? (
          <CircleAlert className="size-3.5 text-destructive" aria-hidden />
        ) : stoppedCount > 0 ? (
          <Ban className="size-3.5" aria-hidden />
        ) : (
          <CircleAlert className="size-3.5" aria-hidden />
        )}
        {allDone ? (
          <span>
            Completed {parts.length} step{parts.length === 1 ? "" : "s"}
          </span>
        ) : failedCount > 0 ? (
          <span>
            Completed {doneCount} of {parts.length} steps — {failedCount} failed
          </span>
        ) : stoppedCount > 0 ? (
          <span>
            Stopped after {doneCount} of {parts.length} steps
          </span>
        ) : liveCount > 0 ? (
          <span>
            Working — {doneCount} of {parts.length} steps done
          </span>
        ) : (
          <span>
            Completed {doneCount} of {parts.length} steps
          </span>
        )}
        <ChevronDown className={cn("ml-auto size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div className="mt-2 space-y-1 border-t pt-2">
          {parts.map((p, i) => (
            <ToolActivity key={i} type={p.type} state={p.state} truth={truth} errorText={classified[i] === "failed" ? runError : null} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReasoningBlock({ text }: { text: string }) {
  return (
    <details className="rounded-md border bg-muted/40 px-3 py-2">
      <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground">AI thinking</summary>
      <p className="mt-1.5 whitespace-pre-wrap text-xs text-muted-foreground">{text}</p>
    </details>
  );
}

function FileChip({ part }: { part: { mediaType?: string; url?: string; filename?: string } }) {
  const isImage = part.mediaType?.startsWith("image/");
  if (isImage && part.url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={part.url} alt={part.filename ?? "attachment"} className="max-h-44 rounded-lg border" />;
  }
  return (
    <div className="flex items-center gap-2 rounded-md border p-2 text-xs text-muted-foreground">
      <FileText className="size-4" aria-hidden />
      <span>{part.filename ?? "attachment"} ({part.mediaType})</span>
    </div>
  );
}

function MessageBody({
  message,
  truth,
  runError,
  onEdit,
}: {
  message: UIMessage;
  truth: ToolTruth;
  runError?: string | null;
  onEdit?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const toolParts: { type: string; state?: string }[] = [];
  for (const p of message.parts ?? [])
    if (p.type.startsWith("tool-")) toolParts.push({ type: p.type, state: (p as unknown as { state?: string }).state });

  async function copyText() {
    const text = (message.parts ?? [])
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-2">
      {toolParts.length > 1 ? (
        <ToolActivitySummary parts={toolParts} truth={truth} runError={runError} />
      ) : null}
      {(message.parts ?? []).map((part, i) => {
        if (part.type === "text") {
          return part.text.trim() ? (
            <div key={i} className="group/msg relative">
              {message.role === "assistant" ? (
                <Markdown content={part.text} />
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{part.text}</p>
              )}
              <div className="mt-1 flex gap-1 opacity-0 transition-opacity group-hover/msg:opacity-100">
                <Button size="icon" variant="ghost" className="size-6" aria-label="Copy message"
                  onClick={() => { void copyText(); }}>
                  <Copy className={cn("size-3.5", copied && "text-emerald-500")} aria-hidden />
                </Button>
                {message.role === "user" && onEdit ? (
                  <Button size="icon" variant="ghost" className="size-6" aria-label="Edit and resend" onClick={onEdit}>
                    <Pencil className="size-3.5" aria-hidden />
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null;
        }
        if (part.type === "reasoning") {
          const rp = part as unknown as { text?: string };
          return rp.text ? <ReasoningBlock key={i} text={rp.text} /> : null;
        }
        if (part.type === "file") {
          const fp = part as unknown as { mediaType?: string; url?: string; filename?: string };
          return <FileChip key={i} part={fp} />;
        }
        if (part.type.startsWith("tool-")) {
          if (toolParts.length > 1) return null; // already collapsed
          const tp = part as unknown as { state?: string; errorText?: string };
          return (
            <ToolActivity
              key={i}
              type={part.type}
              state={tp.state}
              truth={truth}
              // Tool-level error text wins; the run error explains run-level failures.
              errorText={tp.errorText ?? (tp.state === "output-error" || truth === "failed" ? runError : null)}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

const SUGGESTIONS = [
  { icon: TrendingUp, label: "Research trends in my niche", prompt: "Research what is trending in my niche right now" },
  { icon: PenSquare, label: "Create content", prompt: "Create a post about my best-performing topic" },
  { icon: Search, label: "Analyze competitors", prompt: "What content gaps do my competitors have?" },
  { icon: Megaphone, label: "Build a campaign", prompt: "Create a 7-day campaign for my current offer" },
];

export function ChatPanel({
  workspaceId,
  workspaceName,
  threadId,
  initialMessages,
  targetMessageId,
  aiConfigured,
}: {
  workspaceId: string;
  workspaceName: string;
  threadId: string | null;
  initialMessages: UIMessage[];
  targetMessageId?: string | null;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const persistedCount = useRef(initialMessages.length);
  // Persist generation: bumped when the tail is replaced (retry) so an
  // in-flight persist of the replaced turn cannot clobber the rollback.
  const persistGen = useRef(0);
  const currentThreadId = useRef<string | null>(threadId);
  const persisting = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [scrolling, setScrolling] = useState(false);
  const [editingText, setEditingText] = useState("");
  const [stopping, setStopping] = useState(false);
  // Reconnect-to-truth: backend status fetched once per runId (via
  // /api/chat/run/[runId]) for messages whose stream ended without terminal
  // metadata — cancelled runs, dropped streams, legacy rows.
  const fetchedRuns = useRef<Set<string>>(new Set());
  const fetchingRuns = useRef<Set<string>>(new Set());
  const [runTruths, setRunTruths] = useState<Record<string, ChatRunStatusResponse>>({});

  const { messages, sendMessage, status, error, stop, regenerate, setMessages } = useChat({
    id: currentThreadId.current ?? "new-chat",
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        workspaceId,
        threadId: currentThreadId.current,
      }),
    }),
  });

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Snap to bottom on load / new message count / deep-link target
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (targetMessageId) {
      const el2 = el.querySelector(`[data-uid="${targetMessageId}"]`);
      if (el2) {
        el2.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    el.scrollTop = el.scrollHeight;
  }, [messages.length, targetMessageId]);

  // Follow stream
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || status !== "streaming") return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    // Keep the scrollbar visible while scrolling, then auto-hide it after a pause.
    setScrolling(true);
    if (scrollHideTimer.current) clearTimeout(scrollHideTimer.current);
    scrollHideTimer.current = setTimeout(() => setScrolling(false), SCROLL_HIDE_DELAY_MS);
  }

  // Clear the auto-hide timer when the panel unmounts.
  useEffect(() => {
    return () => {
      if (scrollHideTimer.current) clearTimeout(scrollHideTimer.current);
    };
  }, []);

  // Persist new messages after a terminal turn — success ("ready") AND
  // failure ("error"): the complete UIMessage (all parts incl. tool
  // inputs/outputs and the runId/runStatus metadata) is sent as-is, so
  // reloaded threads re-render tools in their real states.
  useEffect(() => {
    if ((status !== "ready" && status !== "error") || persisting.current) return;
    const newMessages = messages.slice(persistedCount.current);
    if (newMessages.length === 0) return;

    const gen = persistGen.current;
    persisting.current = true;
    (async () => {
      try {
        const res = await fetch("/api/chat/persist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId: currentThreadId.current,
            workspaceId,
            messages: newMessages,
          }),
        });
        if (!res.ok) throw new Error("persist failed");
        const data = (await res.json()) as { threadId: string };
        if (gen !== persistGen.current) return; // tail replaced while posting
        persistedCount.current = messages.length;
        if (!currentThreadId.current && data.threadId) {
          currentThreadId.current = data.threadId;
          router.replace(`/chat/${data.threadId}`);
        }
      } catch {
        toast.error("Could not save this conversation turn.");
      } finally {
        persisting.current = false;
      }
    })();
  }, [status, messages, workspaceId, router]);

  // Reconnect-to-truth: whenever the panel is idle (stream ended, errored,
  // or a reloaded thread), resolve any message whose run metadata is still
  // "running" against the backend. This is what renders the real outcome for
  // cancelled runs and dropped streams — the foundation Batch 2 resume
  // builds on.
  useEffect(() => {
    if (status === "submitted" || status === "streaming") return;
    for (const m of messages) {
      const meta = chatRunMetadataOf(m);
      if (!meta || meta.runStatus !== "running") continue;
      if (fetchedRuns.current.has(meta.runId) || fetchingRuns.current.has(meta.runId)) continue;
      fetchingRuns.current.add(meta.runId);
      fetch(`/api/chat/run/${meta.runId}`)
        .then(async (res) => {
          if (!res.ok) throw new Error("run status unavailable");
          const data = (await res.json()) as ChatRunStatusResponse;
          fetchedRuns.current.add(meta.runId);
          setRunTruths((prev) => ({ ...prev, [meta.runId]: data }));
        })
        .catch(() => {
          // One attempt per runId; the tool rows keep the muted completed
          // default rather than guessing a failure.
          fetchedRuns.current.add(meta.runId);
        })
        .finally(() => {
          fetchingRuns.current.delete(meta.runId);
        });
    }
  }, [status, messages]);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if ((!text && attachments.length === 0) || status === "submitted" || status === "streaming") return;
    setInput("");
    const files = attachments;
    setAttachments([]);
    setEditing(null);
    await sendMessage({ text: text || "Please analyze the attachment(s).", files: files as unknown as FileList });
  }

  function startEdit(message: UIMessage) {
    const text = (message.parts ?? [])
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
    const idx = messages.findIndex((m) => m.id === message.id);
    setEditing({ id: message.id, text });
    setEditingText(text);
    setMessages(messages.slice(0, idx));
    persistedCount.current = idx;
  }

  function sendEdit() {
    const text = editingText.trim();
    if (!text || status !== "ready") return;
    setEditing(null);
    setEditingText("");
    void sendMessage({ text });
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...attachments];
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds ${MAX_FILE_MB}MB.`);
        continue;
      }
      next.push(file);
    }
    setAttachments(next);
  }

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!busy) setStopping(false);
  }, [busy]);

  // The live run id arrives with the stream's start event (message metadata),
  // so Stop can target the backend run immediately.
  const liveRunId = busy
    ? chatRunMetadataOf(messages[messages.length - 1])?.runId ?? null
    : null;

  // Real cancellation: abort the server-side run (tools stop, run marked
  // cancelled), then stop the local stream. The stale "running" metadata on
  // the message is resolved against /api/chat/run/[runId] right after.
  async function handleStop() {
    if (!busy || stopping) return;
    setStopping(true);
    try {
      if (liveRunId) {
        await fetch("/api/chat/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId: liveRunId }),
        });
      }
    } catch {
      // Cancel endpoint unavailable — still stop the local stream.
    }
    stop();
  }

  // Retry a failed run: re-submits the original user text via regenerate.
  // The tail is replaced, so roll the persisted cursor back to the retried
  // message and bump the generation so an in-flight persist of the failed
  // turn cannot clobber the rollback. Failed runs insert no content_items,
  // so re-running cannot duplicate anything.
  function retryLast() {
    if (busy) return;
    const last = messages[messages.length - 1];
    if (!last) return;
    persistGen.current += 1;
    if (last.role === "assistant") {
      // The failed assistant message is replaced by the retry's response.
      persistedCount.current = messages.length - 1;
      void regenerate({ messageId: last.id });
    } else {
      // Error before any assistant response — the (already persisted) user
      // message stays; the retry's response becomes the new tail.
      persistedCount.current = messages.length;
      void regenerate();
    }
  }

  // Truthful run outcome for an assistant message (drives tool rendering).
  function resolveRunTruth(m: UIMessage, isLive: boolean): { truth: ToolTruth; error: string | null } {
    if (isLive) return { truth: "live", error: null };
    const meta = chatRunMetadataOf(m);
    if (meta) {
      if (meta.runStatus === "failed") return { truth: "failed", error: meta.runError ?? null };
      if (meta.runStatus === "cancelled") return { truth: "cancelled", error: meta.runError ?? null };
      if (meta.runStatus === "completed") return { truth: "completed", error: null };
      // Stale "running": the stream ended before terminal metadata arrived.
      const fetched = runTruths[meta.runId];
      if (fetched) {
        if (fetched.status === "failed") return { truth: "failed", error: fetched.error };
        if (fetched.status === "cancelled") return { truth: "cancelled", error: fetched.error };
        // Still running server-side (e.g. the tab dropped mid-run) — the
        // pulsing rows are real; Batch 2 resume picks this up.
        return { truth: fetched.status === "running" ? "live" : "completed", error: null };
      }
    }
    // No run metadata (legacy rows) or fetch still in flight: default to the
    // completed rendering — never a guessed failure.
    return { truth: "completed", error: null };
  }

  // Backend truth for the errored live run (reconnect banner).
  const errorRunTruth = (() => {
    if (status !== "error") return null;
    const last = messages[messages.length - 1];
    const meta = chatRunMetadataOf(last);
    return meta ? runTruths[meta.runId] ?? null : null;
  })();

  // The AI SDK surfaces the chat route's JSON error body as the raw message
  // text; parse it so the human `message` field (e.g. "AI is not configured
  // for this workspace — add your provider + API key in Workspace
  // Settings.") is shown instead of raw JSON.
  const errorText = (() => {
    if (!error) return null;
    if (error.message === "CONFIGURATION_REQUIRED") {
      return "AI is not configured for this workspace — add your provider + API key in Workspace Settings.";
    }
    try {
      const parsed = JSON.parse(error.message) as { error?: string; message?: string };
      if (parsed?.error === "CONFIGURATION_REQUIRED") {
        return "AI is not configured for this workspace — add your provider + API key in Workspace Settings.";
      }
      if (typeof parsed?.message === "string" && parsed.message) return parsed.message;
    } catch {
      // plain (non-JSON) error text — fall through
    }
    return error.message || "The agent could not respond.";
  })();

  if (!aiConfigured) {
    return (
      <Card className="flex flex-col items-center gap-4 p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10">
          <AlertTriangle className="size-6 text-destructive" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Configuration required</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            No AI provider is configured for this workspace. Add your provider + API key in{" "}
            <span className="font-medium text-foreground">Workspace Settings</span> — the chat works the
            moment it&apos;s saved. No responses are faked.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="relative flex h-[calc(100vh-10rem)] flex-col gap-4">
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg">
            <Brain className="size-7" aria-hidden />
          </div>
          <div>
            <h2 className="text-xl font-semibold">AI Social Media Agent</h2>
            <p className="mt-1 text-sm text-muted-foreground">What would you like to accomplish for {workspaceName}?</p>
          </div>
          <div className="flex max-w-lg flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setInput(s.prompt)}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                <s.icon className="size-3.5" aria-hidden />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div ref={scrollRef} onScroll={handleScroll}
          className={cn("relative flex-1 space-y-5 overflow-y-auto pr-2 scroll-thin scroll-autohide", scrolling && "scroll-active")}>
          {messages.map((m, i) => {
            const isUser = m.role === "user";
            const isLiveMessage = !isUser && busy && i === messages.length - 1;
            const { truth, error: runError } = resolveRunTruth(m, isLiveMessage);
            const canRetry =
              !isUser && !busy && truth === "failed" && i === messages.length - 1;
            return (
              <div key={m.id} data-uid={m.id} className={cn("flex gap-3", isUser && "justify-end")}>
                {!isUser ? (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Brain className="size-4 text-primary" aria-hidden />
                  </div>
                ) : null}
                <div
                  className={cn(
                    "min-w-0 rounded-xl border p-4",
                    isUser ? "max-w-[80%] border-primary/30 bg-primary/5" : "flex-1 bg-card",
                  )}
                >
                  {!isUser ? (
                    <div className="mb-1.5 text-xs font-semibold text-primary">AI Agent</div>
                  ) : null}
                  <MessageBody
                    message={m}
                    truth={truth}
                    runError={runError}
                    onEdit={isUser && !busy ? () => startEdit(m) : undefined}
                  />
                  {canRetry ? (
                    <div className="mt-2">
                      <Button size="sm" variant="outline" onClick={retryLast}>
                        <RotateCcw className="size-3.5" aria-hidden />
                        Retry
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          {status === "submitted" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden />
              {stopping ? "Stopping…" : "AI Agent is thinking…"}
            </div>
          ) : null}
        </div>
      )}

      {!atBottom && messages.length > 0 ? (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          aria-label="Scroll to latest"
          className="absolute bottom-32 right-6 z-10 flex size-9 items-center justify-center rounded-full border bg-background shadow-md hover:bg-accent"
        >
          <ChevronDown className="size-4" aria-hidden />
        </button>
      ) : null}

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <p className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {errorRunTruth ? (
              errorRunTruth.status === "completed" ? (
                <span>
                  The connection dropped, but the run completed on the server — any created content is saved.
                  {errorRunTruth.steps.length > 0 ? (
                    <span className="block text-xs text-muted-foreground">
                      Steps: {errorRunTruth.steps.map((s) => s.name).join(", ")}
                    </span>
                  ) : null}
                </span>
              ) : errorRunTruth.status === "cancelled" ? (
                <span>The run was cancelled.</span>
              ) : (
                <span>
                  Run failed
                  {errorRunTruth.steps.length > 0
                    ? ` at ${errorRunTruth.steps[errorRunTruth.steps.length - 1].name}`
                    : ""}
                  {errorRunTruth.error ? `: ${errorRunTruth.error}` : "."}
                </span>
              )
            ) : (
              errorText
            )}
          </p>
          <Button size="sm" variant="outline" className="shrink-0" onClick={retryLast}>Retry</Button>
        </div>
      ) : null}

      {editing ? (
        <div className="rounded-lg border border-primary/40 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Pencil className="size-3.5" aria-hidden /> Editing message — sending replaces the rest of this turn
            </span>
            <button type="button" onClick={() => { setEditing(null); setMessages(initialMessages.slice(0, persistedCount.current)); setEditingText(""); }}>
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
          <Textarea
            autoFocus
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendEdit();
              }
            }}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setMessages(initialMessages.slice(0, persistedCount.current)); }}>
              Cancel
            </Button>
            <Button size="sm" disabled={editingText.trim().length === 0 || busy} onClick={sendEdit}>
              Resend
            </Button>
          </div>
        </div>
      ) : null}

      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {attachments.map((file, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
              {file.type.startsWith("image/") ? (
                <ImageIcon className="size-3.5" aria-hidden />
              ) : (
                <FileText className="size-3.5" aria-hidden />
              )}
              <span className="max-w-40 truncate">{file.name}</span>
              <button type="button" onClick={() => setAttachments((a) => a.filter((_, j) => j !== i))} aria-label={`Remove ${file.name}`}>
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <form onSubmit={handleSend} className="sticky bottom-0 flex items-end gap-2 bg-background pb-1 pt-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button type="button" size="icon" variant="outline" aria-label="Attach image or PDF" disabled={busy} onClick={() => fileInputRef.current?.click()}>
          <Paperclip className="size-4" aria-hidden />
        </Button>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Message your agent… (Enter to send, Shift+Enter for a new line)"
          rows={2}
          className="max-h-40 min-h-[3rem] flex-1 resize-none"
          disabled={busy}
          aria-label="Message"
        />
        {busy ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => { void handleStop(); }}
            disabled={stopping}
            aria-label={stopping ? "Stopping…" : "Stop generating"}
          >
            <Square className="size-3 fill-current" aria-hidden />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!input.trim() && attachments.length === 0} aria-label="Send message">
            <ArrowUp className="size-4" aria-hidden />
          </Button>
        )}
      </form>
    </div>
  );
}
