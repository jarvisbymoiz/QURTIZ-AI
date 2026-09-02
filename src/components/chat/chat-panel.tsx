"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUp,
  Brain,
  CalendarClock,
  CheckCheck,
  ChevronDown,
  Copy,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Pencil,
  PenSquare,
  Search,
  TrendingUp,
  Megaphone,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/chat/markdown";

const MAX_FILE_MB = 9;
// How long the conversation scrollbar stays visible after the last scroll event.
const SCROLL_HIDE_DELAY_MS = 600;

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

function ToolActivity({ type, state }: { type: string; state?: string }) {
  const name = type.replace(/^tool-/, "");
  const done = state === "output-available";
  const icon =
    name === "web_search" ? <Search className="size-3.5" aria-hidden /> :
    name === "schedule_content" ? <CalendarClock className="size-3.5" aria-hidden /> :
    name === "create_content" ? <PenSquare className="size-3.5" aria-hidden /> :
    name === "research_niche" ? <TrendingUp className="size-3.5" aria-hidden /> :
    name === "update_brand_memory" ? <Brain className="size-3.5" aria-hidden /> :
    <Brain className="size-3.5" aria-hidden />;
  return (
    <div className={cn("flex items-center gap-2 text-xs", done ? "text-muted-foreground" : "animate-pulse text-primary")}>
      {done ? <CheckCheck className="size-3.5" aria-hidden /> : icon}
      <span>{toolDisplayName(type)}{done ? "" : "…"}</span>
    </div>
  );
}

function ToolActivitySummary({ types }: { types: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left text-xs text-muted-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <CheckCheck className="size-3.5 text-emerald-500" aria-hidden />
        Completed {types.length} step{types.length === 1 ? "" : "s"}
        <ChevronDown className={cn("ml-auto size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div className="mt-2 space-y-1 border-t pt-2">
          {types.map((t, i) => (
            <ToolActivity key={i} type={t} state="output-available" />
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
  onEdit,
}: {
  message: UIMessage;
  onEdit?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const toolTypes: string[] = [];
  for (const p of message.parts ?? []) if (p.type.startsWith("tool-")) toolTypes.push(p.type);

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
      {toolTypes.length > 1 ? (
        <ToolActivitySummary types={toolTypes} />
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
          if (toolTypes.length > 1) return null; // already collapsed
          const tp = part as unknown as { state?: string };
          return <ToolActivity key={i} type={part.type} state={tp.state} />;
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
  const currentThreadId = useRef<string | null>(threadId);
  const persisting = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [scrolling, setScrolling] = useState(false);
  const [editingText, setEditingText] = useState("");

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

  // Persist new messages after a completed turn.
  useEffect(() => {
    if (status !== "ready" || persisting.current) return;
    const newMessages = messages.slice(persistedCount.current);
    if (newMessages.length === 0) return;

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
          {messages.map((m) => {
            const isUser = m.role === "user";
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
                  <MessageBody message={m} onEdit={isUser && !busy ? () => startEdit(m) : undefined} />
                </div>
              </div>
            );
          })}
          {status === "submitted" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden />
              AI Agent is thinking…
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
        <div className="flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="size-4" aria-hidden />
            {errorText}
          </p>
          <Button size="sm" variant="outline" onClick={() => regenerate()}>Retry</Button>
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
          <Button type="button" size="icon" variant="outline" onClick={() => stop()} aria-label="Stop generating">
            <span className="size-2.5 rounded bg-foreground" aria-hidden />
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
