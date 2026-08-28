"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { toast } from "sonner";
import { AlertTriangle, ArrowUp, Brain, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function MessageParts({ message }: { message: UIMessage }) {
  return (
    <div className="space-y-2">
      {(message.parts ?? []).map((part, i) => {
        if (part.type === "text") {
          return (
            <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed">
              {part.text}
            </p>
          );
        }
        if (part.type === "tool-get_brand_brain") {
          return (
            <p key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Brain className="size-3.5" aria-hidden /> Read Brand Brain
            </p>
          );
        }
        if (part.type === "tool-update_brand_memory") {
          return (
            <p key={i} className="flex items-center gap-2 text-xs text-emerald-500">
              <Brain className="size-3.5" aria-hidden /> Saved a brand memory — view it in
              Brand Brain → Memory
            </p>
          );
        }
        if (part.type === "tool-research_niche") {
          return (
            <p key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Brain className="size-3.5" aria-hidden /> Researched niche — results in Research Lab
            </p>
          );
        }        if (part.type === "tool-list_workspace_facts") {
          return (
            <p key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Brain className="size-3.5" aria-hidden /> Listed brand memory
            </p>
          );
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
  const persistedCount = useRef(initialMessages.length);
  const currentThreadId = useRef<string | null>(threadId);
  const persisting = useRef(false);

  const { messages, sendMessage, status, error, stop } = useChat({
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
        // Allow retry on next status change.
        persistedCount.current = persistedCount.current;
      } finally {
        persisting.current = false;
      }
    })();
  }, [status, messages, workspaceId, router]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || status === "submitted" || status === "streaming") return;
    setInput("");
    await sendMessage({ text });
  }

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
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              GEMINI_API_KEY
            </code>{" "}
            to <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">.env.local</code>{" "}
            and restart the dev server. See SETUP.md — the chat will work the moment the
            key is present. No responses are faked.
          </p>
        </div>
      </Card>
    );
  }

  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col gap-4">
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
            <Brain className="size-6 text-primary" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold">Chat with your {workspaceName} agent</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Ask about your brand, draft captions or strategy ideas, or say{" "}
            &quot;remember: no emojis in business posts&quot; — the agent will save it to
            Brand Brain memory.
          </p>
        </div>
      ) : (
        <div className="flex-1 space-y-6 overflow-y-auto pr-2">
          {messages.map((m) => (
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
                  <User className="size-4 text-muted-foreground" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1 rounded-lg border bg-card p-4">
                <MessageParts message={m} />
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

      <form onSubmit={handleSend} className="flex items-end gap-2">
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
          <Button type="button" variant="outline" size="icon" onClick={() => stop()} aria-label="Stop generating">
            <span className="size-2.5 rounded bg-foreground" aria-hidden />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Send message">
            <ArrowUp className="size-4" aria-hidden />
          </Button>
        )}
      </form>
    </div>
  );
}



