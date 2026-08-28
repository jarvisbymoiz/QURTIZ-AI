"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUp,
  Brain,
  FileText,
  Image as ImageIcon,
  Paperclip,
  RefreshCw,
  Search,
  CalendarClock,
  PenSquare,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const ALLOWED_FILES = "image/png,image/jpeg,image/webp,application/pdf";
const MAX_FILE_MB = 9;

function toolDisplayName(type: string): string {
  const name = type.replace(/^tool-/, "");
  const labels: Record<string, string> = {
    get_brand_brain: "Read Brand Brain",
    list_workspace_facts: "Listed brand memory",
    update_brand_memory: "Saved a brand memory — view it in Brand Brain → Memory",
    create_content: "Created content in Studio",
    schedule_content: "Scheduled content on the calendar",
    research_niche: "Researched niche — results in Research Lab",
    web_search: "Searched the web",
  };
  return labels[name] ?? name.replaceAll("_", " ");
}

function ToolPart({ type, state }: { type: string; state?: string }) {
  const name = type.replace(/^tool-/, "");
  const icon =
    name === "web_search" ? (
      <Search className="size-3.5" aria-hidden />
    ) : name === "schedule_content" ? (
      <CalendarClock className="size-3.5 text-emerald-500" aria-hidden />
    ) : name === "create_content" ? (
      <PenSquare className="size-3.5 text-emerald-500" aria-hidden />
    ) : name === "update_brand_memory" ? (
      <Brain className="size-3.5 text-emerald-500" aria-hidden />
    ) : (
      <Brain className="size-3.5" aria-hidden />
    );
  const running = state === "input-streaming" || state === "input-available";
  return (
    <p
      className={cn(
        "flex items-center gap-2 text-xs",
        running ? "animate-pulse text-muted-foreground" : "text-muted-foreground",
        name === "update_brand_memory" || name === "create_content" || name === "schedule_content" ? "text-emerald-600 dark:text-emerald-400" : "",
      )}
    >
      {icon} {toolDisplayName(type)}
    </p>
  );
}

function ReasoningBlock({ text }: { text: string }) {
  return (
    <details className="rounded-md border bg-muted/40 px-3 py-2">
      <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground">
        AI thinking
      </summary>
      <p className="mt-1.5 whitespace-pre-wrap text-xs text-muted-foreground">{text}</p>
    </details>
  );
}

function MessageParts({ message }: { message: UIMessage }) {
  return (
    <div className="space-y-2">
      {(message.parts ?? []).map((part, i) => {
        if (part.type === "text") {
          return part.text.trim() ? (
            <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed">
              {part.text}
            </p>
          ) : null;
        }
        if (part.type === "reasoning") {
          const rp = part as unknown as { text?: string };
          return rp.text ? <ReasoningBlock key={i} text={rp.text} /> : null;
        }
        if (part.type === "file") {
          const fp = part as unknown as { mediaType?: string; url?: string; filename?: string };
          const isImage = fp.mediaType?.startsWith("image/");
          return (
            <div key={i} className="flex items-center gap-2 rounded-md border p-2 text-xs text-muted-foreground">
              {isImage && fp.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fp.url} alt={fp.filename ?? "attachment"} className="max-h-40 rounded" />
              ) : (
                <>
                  <FileText className="size-4" aria-hidden />
                  <span>{fp.filename ?? "attachment"} ({fp.mediaType})</span>
                </>
              )}
            </div>
          );
        }
        if (part.type.startsWith("tool-")) {
          const tp = part as unknown as { state?: string };
          return <ToolPart key={i} type={part.type} state={tp.state} />;
        }
        return null;
      })}
    </div>
  );
}

export function ChatPanel({
  workspaceId,
  workspaceName,
  threadId,
  initialMessages,
  aiConfigured,
}: {
  workspaceId: string;
  workspaceName: string;
  threadId: string | null;
  initialMessages: UIMessage[];
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const persistedCount = useRef(initialMessages.length);
  const currentThreadId = useRef<string | null>(threadId);
  const persisting = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { messages, sendMessage, status, error, stop, regenerate } = useChat({
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

  // Auto-scroll: snap to bottom on load, smooth-follow while streaming.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, status]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || status !== "streaming") return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

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
        if (!res.ok) throw new Error(`persist failed (${res.status})`);
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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if ((!text && attachments.length === 0) || status === "submitted" || status === "streaming") return;
    setInput("");
    const files = attachments;
    setAttachments([]);
    await sendMessage({ text: text || "Please analyze the attachment(s).", files: files as unknown as FileList });
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
  const lastAssistantIdx = messages.length > 0 && messages[messages.length - 1].role === "assistant" ? messages.length - 1 : -1;

  if (!aiConfigured) {
    return (
      <Card className="flex flex-col items-center gap-4 p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10">
          <AlertTriangle className="size-6 text-destructive" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Configuration required</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            The AI agent is not configured yet. Add{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">GEMINI_API_KEY</code> to{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">.env.local</code> and restart the dev
            server. See SETUP.md — the chat will work the moment the key is present. No responses are faked.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col gap-4">
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
            <Brain className="size-6 text-primary" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold">Chat with your {workspaceName} agent</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Ask about your brand, draft captions or strategy, attach images or PDFs for analysis, or say
            &quot;remember: no emojis in business posts&quot; — the agent saves it to Brand Brain memory.
          </p>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto pr-2">
          {messages.map((m, idx) => (
            <div key={m.id} className="flex gap-3">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  m.role === "assistant" ? "bg-primary/10" : "bg-muted",
                )}
              >
                {m.role === "assistant" ? (
                  <Brain className="size-4 text-primary" aria-hidden />
                ) : (
                  <Brain className="size-4 text-muted-foreground" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="rounded-lg border bg-card p-4">
                  <MessageParts message={m} />
                </div>
                {idx === lastAssistantIdx && status === "ready" ? (
                  <div className="flex justify-end">
                    <Button size="sm" variant="ghost" onClick={() => regenerate()} aria-label="Regenerate response">
                      <RefreshCw className="size-3.5" aria-hidden /> Regenerate
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {status === "submitted" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden />
              Thinking…
            </div>
          ) : null}
        </div>
      )}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error.message || "The agent could not respond. Try again."}
        </p>
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
              <button
                type="button"
                onClick={() => setAttachments((a) => a.filter((_, j) => j !== i))}
                aria-label={`Remove ${file.name}`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <form onSubmit={handleSend} className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_FILES}
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Attach image or PDF"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="size-4" aria-hidden />
        </Button>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
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
