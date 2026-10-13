"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import type { contentItems, contentPillars, contentVariants, visualAssets } from "@/db/schema";
import { createContentAction, deleteContentAction } from "@/server/actions/content";
import { bulkApproveReadyAction } from "@/server/actions/schedule";
import { BulkPlanDialog } from "@/components/studio/bulk-plan-dialog";
import { PostWorkspace } from "@/components/studio/post-workspace";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Item = typeof contentItems.$inferSelect;
type Variant = typeof contentVariants.$inferSelect;
type Pillar = typeof contentPillars.$inferSelect;
type Visual = typeof visualAssets.$inferSelect;

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  generating: "bg-sky-500/10 text-sky-500",
  ready_for_review: "bg-primary/10 text-primary",
  approved: "bg-emerald-500/10 text-emerald-500",
  scheduled: "bg-indigo-500/10 text-indigo-400",
  published: "bg-emerald-600/15 text-emerald-400",
  failed: "bg-destructive/10 text-destructive",
  rejected: "bg-destructive/10 text-destructive",
  archived: "bg-muted text-muted-foreground",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={cn("font-medium", STATUS_STYLE[status])}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

function NewPostDialog({ pillars, editable, aiConfigured }: { pillars: Pillar[]; editable: boolean; aiConfigured: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  void pillars;
  const [pending, start] = useTransition();
  const [topic, setTopic] = useState("");
  const [objective, setObjective] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["facebook", "instagram"]);
  const [format, setFormat] = useState<string>("single_image");

  function togglePlatform(p: string) {
    setPlatforms((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || platforms.length === 0) return;
    start(async () => {
      const r = await createContentAction({
        topic,
        objective: objective || undefined,
        platforms: platforms as ("facebook" | "instagram")[],
        preferredFormat: format as "single_image",
      });
      if (r.ok) {
        toast.success("Content created — Ready for Review below");
        setOpen(false);
        setTopic("");
        setObjective("");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button disabled={!editable || !aiConfigured} />}>
        <Plus className="size-4" aria-hidden /> New post
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate a post</DialogTitle>
          <DialogDescription>
            The agent writes copy adapted per platform, checks it against your Brand
            Brain rules, and saves it as Ready for Review. Nothing is published.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="topic">Topic</Label>
            <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. 5 Canva AI features students don't know" required minLength={4} maxLength={500} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="objective">Objective (optional)</Label>
            <Input id="objective" value={objective} onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g. Drive WhatsApp signups" maxLength={300} />
          </div>
          <div className="space-y-2">
            <Label>Platforms</Label>
            <div className="flex gap-2">
              {["facebook", "instagram"].map((p) => (
                <button key={p} type="button" aria-pressed={platforms.includes(p)}
                  onClick={() => togglePlatform(p)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm capitalize transition-colors",
                    platforms.includes(p)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="format">Format</Label>
            <select id="format" value={format} onChange={(e) => setFormat(e.target.value)}
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&>option]:bg-card [&>option]:text-card-foreground [color-scheme:dark]">
              <option value="single_image">Single image</option>
              <option value="carousel">Carousel</option>
              <option value="reel">Reel</option>
              <option value="text_post">Text post</option>
            </select>
          </div>
          <Button type="submit" className="w-full" disabled={pending || platforms.length === 0 || topic.trim().length < 4}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {pending ? "Generating (up to ~30s)…" : "Generate"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ItemCard({
  item,
  variants,
  visuals,
  visualUrls,
  editable,
  aiConfigured,
  timezone,
  selected,
  selectionMode,
  onToggle,
  deleting,
}: {
  selectionMode: boolean;
  selected: boolean;
  onToggle: () => void;
  deleting: boolean;
  item: Item;
  variants: Variant[];
  visuals: Visual[];
  visualUrls: Record<string, string | null>;
  editable: boolean;
  aiConfigured: boolean;
  timezone?: string;
}) {
  const [open, setOpen] = useState(false);
  const scores = (item.aiScores ?? {}) as Record<string, number>;
  // Older providers returned confidence-style scores on a 0–1 scale while
  // current generation stores 0–10. Keep historical cards comparable.
  const displayScore = (value: number) => {
    const normalized = value > 0 && value <= 1 ? value * 10 : value;
    return Number(Math.min(10, Math.max(0, normalized)).toFixed(1));
  };

  return (
    <Card className={cn(selected && "ring-2 ring-primary")} >
      <CardContent className="space-y-3 p-4">
        {editable && selectionMode ? <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" className="size-4 accent-primary" checked={selected} onChange={onToggle}
            disabled={deleting || ["published", "scheduled", "generating"].includes(item.status)} aria-label={`Select ${item.topic}`} />
          {["published", "scheduled", "generating"].includes(item.status) ? "Protected from deletion" : "Select post"}
        </label> : null}
        <div className="flex items-start justify-between gap-3">
          <button type="button" className="w-full text-left" onClick={() => setOpen(true)}>
            <div className="font-medium hover:underline">{item.topic}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {item.objective?.startsWith("Auto Run strategy:") ? (
                <span className="inline-flex items-center gap-1 text-violet-500" title="Generated by Auto Run">
                  <Sparkles className="size-4 shrink-0" aria-hidden />
                  <span className="text-xs">Auto Run</span>
                </span>
              ) : null}
              <StatusBadge status={item.status} />
              <span className="capitalize">{item.format.replaceAll("_", " ")}</span>
              {item.createdAt ? <span>· {new Date(item.createdAt).toLocaleDateString()}</span> : null}
            </div>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {typeof scores.relevance === "number" ? (
            <span className="text-xs text-muted-foreground">
              Relevance <span className="font-medium text-foreground">{displayScore(scores.relevance)}/10</span>
              <span className="ml-1 text-[10px] uppercase tracking-wide">(AI-est.)</span>
            </span>
          ) : null}
          {typeof scores.engagement === "number" ? (
            <span className="text-xs text-muted-foreground">
              Engagement <span className="font-medium text-foreground">{displayScore(scores.engagement)}/10</span>
              <span className="ml-1 text-[10px] uppercase tracking-wide">(AI-est.)</span>
            </span>
          ) : null}
        </div>
        {open ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="flex h-[92dvh] max-h-[calc(100dvh-1rem)] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-2.5 sm:w-[94vw] sm:max-w-[1480px] sm:p-3">
              <PostWorkspace
                item={item}
                variants={variants}
                visuals={visuals}
                visualUrls={visualUrls}
                editable={editable}
                aiConfigured={aiConfigured}
                timezone={timezone}
                onClose={() => setOpen(false)}
              />
            </DialogContent>
          </Dialog>
        ) : null}
      </CardContent>
    </Card>
  );
}

function BulkApproveButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await bulkApproveReadyAction();
          if (r.ok) {
            toast.success("Approved " + (r.count ?? 0) + " posts");
            router.refresh();
          } else toast.error(r.error);
        })
      }
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
      Approve all ready
    </Button>
  );
}

export function StudioClient({
  workspaceId,
  items,
  variants,
  pillars,
  visuals,
  visualUrls,
  aiConfigured,
  editable,
  timezone,
}: {
  workspaceId?: string;
  items: Item[];
  variants: Variant[];
  pillars: Pillar[];
  visuals: Visual[];
  visualUrls: Record<string, string | null>;
  aiConfigured: boolean;
  editable: boolean;
  /** Workspace timezone for date display (scheduling badge). */
  timezone?: string;
}) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => router.refresh();
    const channel = workspaceId && typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("qurtiz-content:" + workspaceId) : null;
    if (channel) channel.onmessage = refresh;
    window.addEventListener("focus", refresh);
    return () => { channel?.close(); window.removeEventListener("focus", refresh); };
  }, [router, workspaceId]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [deleteErrors, setDeleteErrors] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const byItem = useMemo(() => {
    const map = new Map<string, Variant[]>();
    for (const v of variants) {
      const list = map.get(v.contentItemId) ?? [];
      list.push(v);
      map.set(v.contentItemId, list);
    }
    return map;
  }, [variants]);

  const filtered = useMemo(
    () => items.filter(i => !deletedIds.includes(i.id) && (statusFilter === "all" || i.status === statusFilter)),
    [items, statusFilter, deletedIds],
  );
  const readyCount = items.filter((i) => i.status === "ready_for_review").length;
  const eligible = filtered.filter(i => !["published", "scheduled", "generating"].includes(i.status));
  function toggleSelection(id: string) {
    setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  }
  function deleteSelected() {
    const ids = [...selectedIds];
    setDeleteErrors([]);
    startDelete(async () => {
      const failures: string[] = [];
      let removed = 0;
      for (const id of ids) {
        try {
          const result = await deleteContentAction(id);
          if (result.ok) {
            removed++;
            setDeletedIds(current => [...current, id]);
            setSelectedIds(current => current.filter(value => value !== id));
            if (result.warning) failures.push(result.warning);
          } else failures.push((items.find(item => item.id === id)?.topic ?? "Post") + ": " + result.error);
        } catch { failures.push("Deletion was not confirmed. Refresh before retrying."); break; }
      }
      if (removed) toast.success(removed + " post(s) deleted from the database");
      if (failures.length) setDeleteErrors(failures);
      else { setDeleteOpen(false); setSelectionMode(false); }
      router.refresh();
    });
  }


  return (
    <div className="space-y-4">
      {!aiConfigured ? (
        <Alert>
          <Sparkles className="size-4" aria-hidden />
          <AlertTitle>Configuration required</AlertTitle>
          <AlertDescription>
            AI is not configured for this workspace — add your provider + API key in Workspace Settings to enable
            generation. Nothing will be generated or faked until then.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="studio-toolbar">
        <div className="studio-filters" aria-label="Content status filters">
          {["all", "ready_for_review", "approved", "scheduled", "published", "rejected", "draft"].map((s) => (
            <div key={s} className="studio-filter-option">
            <button
              key={s}
              type="button"
              aria-pressed={statusFilter === s}
              onClick={() => { if (!deleting) { setStatusFilter(s); setSelectedIds([]); } }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                statusFilter === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "ready_for_review" ? "Ready for review (" + readyCount + ")" : s.replaceAll("_", " ")}
            </button>
            {s === "draft" && editable ? <Button size="icon" variant="ghost" className="studio-delete-toggle" aria-label={selectionMode ? "Cancel post selection" : "Select posts to delete"} aria-pressed={selectionMode} disabled={deleting} onClick={() => { setSelectionMode(value => !value); setSelectedIds([]); setDeleteErrors([]); }}>
              <Trash2 className="size-4" aria-hidden />
            </Button> : null}
            </div>
          ))}
        </div>
        <div className="studio-actions">
          <BulkPlanDialog editable={editable} aiConfigured={aiConfigured} />
          <NewPostDialog pillars={pillars} editable={editable} aiConfigured={aiConfigured} />
        </div>
      </div>

      {editable && selectionMode ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" className="size-4 accent-primary" disabled={deleting || !eligible.length}
            checked={eligible.length > 0 && eligible.every(item => selectedIds.includes(item.id))}
            onChange={event => setSelectedIds(event.target.checked ? eligible.map(item => item.id) : [])} />
          Select all eligible posts · {selectedIds.length} selected
        </label>
        <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" disabled={deleting} onClick={() => { setSelectionMode(false); setSelectedIds([]); }}>Cancel</Button>
        <Button size="sm" variant="destructive" disabled={deleting || !selectedIds.length} onClick={() => { setDeleteErrors([]); setDeleteOpen(true); }}>
          <Trash2 className="size-3.5" aria-hidden /> Delete selected
        </Button>
        </div>
      </div> : null}
      <Dialog open={deleteOpen} onOpenChange={open => { if (!deleting) setDeleteOpen(open); }}>
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.length} selected post(s)?</DialogTitle>
            <DialogDescription>This permanently removes post records, variants and attached media from Qurtiz. Shared files still used by another post are retained. Scheduled, generating and published posts are protected. This does not delete posts from Facebook or Instagram.</DialogDescription>
          </DialogHeader>
          {deleteErrors.length ? <div role="alert" className="max-h-48 overflow-y-auto scroll-thin space-y-2 text-sm text-destructive">{deleteErrors.map((error, index) => <p key={index}>{error}</p>)}</div> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={deleting} onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting || !selectedIds.length} onClick={deleteSelected}>
              {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
              {deleting ? "Deleting…" : "Delete permanently"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
          <Sparkles className="size-8 text-muted-foreground" aria-hidden />
          <p className="max-w-md text-sm text-muted-foreground">
            No content in this filter. Generate a post, run a bulk plan, or suggest trends to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              selected={selectedIds.includes(item.id)}
              selectionMode={selectionMode}
              onToggle={() => toggleSelection(item.id)}
              deleting={deleting}
              variants={byItem.get(item.id) ?? []}
              visuals={visuals.filter((v) => v.contentItemId === item.id)}
              visualUrls={visualUrls}
              editable={editable}
              aiConfigured={aiConfigured}
              timezone={timezone}
            />
          ))}
        </div>
      )}
      <BulkApproveButton />
      <DeleteHidden />
    </div>
  );
}

function DeleteHidden() {
  return null;
}
