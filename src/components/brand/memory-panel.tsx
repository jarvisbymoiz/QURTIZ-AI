"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Brain, Trash2 } from "lucide-react";
import type { brandMemory } from "@/db/schema";
import {
  addMemoryAction,
  deleteMemoryAction,
  updateMemoryAction,
} from "@/server/actions/memory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Memory = typeof brandMemory.$inferSelect;

const TYPE_BADGE: Record<string, string> = {
  preference: "bg-primary/10 text-primary",
  fact: "bg-sky-500/10 text-sky-500",
  rule: "bg-amber-500/10 text-amber-500",
};

export function MemoryPanel({ memories, editable }: { memories: Memory[]; editable: boolean }) {
  const [pending, start] = useTransition();
  const [type, setType] = useState<"preference" | "fact" | "rule">("preference");
  const [content, setContent] = useState("");

  function addMemory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!content.trim()) return;
    const fd = new FormData();
    fd.set("type", type);
    fd.set("content", content.trim());
    start(async () => {
      const result = await addMemoryAction(fd);
      if (result.ok) {
        setContent("");
        toast.success("Memory saved");
      } else {
        toast.error(result.error);
      }
    });
  }

  function toggle(m: Memory, active: boolean) {
    start(async () => {
      const result = await updateMemoryAction(m.id, { active });
      if (!result.ok) toast.error(result.error);
    });
  }

  function remove(m: Memory) {
    start(async () => {
      const result = await deleteMemoryAction(m.id);
      if (result.ok) toast.success("Memory deleted");
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Remembered preferences, facts &amp; rules</CardTitle>
          <CardDescription>
            The agent saves these automatically during chat — you stay in control:
            edit, pause, or delete anything.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {memories.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
              <Brain className="size-8 text-muted-foreground" aria-hidden />
              <p className="max-w-sm text-sm text-muted-foreground">
                Nothing remembered yet. Tell the agent in chat — e.g.{" "}
                &quot;remember: no emojis in business posts&quot; — or add one manually below.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {memories.map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3",
                    !m.active && "opacity-50",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={cn("font-medium", TYPE_BADGE[m.type])}>
                        {m.type}
                      </Badge>
                      {m.source === "chat" ? (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          via chat
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 break-words text-sm">{m.content}</p>
                  </div>
                  {editable ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <Switch
                        checked={m.active}
                        onCheckedChange={(v) => toggle(m, v)}
                        disabled={pending}
                        aria-label={`${m.active ? "Pause" : "Activate"} memory`}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(m)}
                        disabled={pending}
                        aria-label="Delete memory"
                      >
                        <Trash2 className="size-4 text-destructive" aria-hidden />
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {editable ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add memory manually</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addMemory} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="memory-type">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                  <SelectTrigger id="memory-type" className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preference">Preference</SelectItem>
                    <SelectItem value="fact">Fact</SelectItem>
                    <SelectItem value="rule">Rule</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="memory-content">Content</Label>
                <Textarea
                  id="memory-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={2}
                  placeholder="e.g. Always use WhatsApp as the primary CTA."
                  maxLength={1000}
                />
              </div>
              <Button type="submit" disabled={pending || content.trim().length < 3}>
                Add memory
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
