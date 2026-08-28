"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ChevronLeft, ChevronRight, ListChecks, Loader2, Sparkles, Wand2 } from "lucide-react";
import type { contentItems, contentVariants, publishingJobs } from "@/db/schema";
import {
  getJobStatusAction,
  scheduleContentAction,
  startBulkPlanAction,
  unscheduleContentAction,
} from "@/server/actions/schedule";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Item = typeof contentItems.$inferSelect;
type Variant = typeof contentVariants.$inferSelect;
type PJob = typeof publishingJobs.$inferSelect;

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_DOT: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  ready_for_review: "bg-primary",
  approved: "bg-emerald-500",
  scheduled: "bg-indigo-400",
  published: "bg-emerald-600",
  failed: "bg-destructive",
};

export function CalendarClient({
  items,
  variants,
  pJobs,
  timezone,
  editable,
}: {
  items: Item[];
  variants: Variant[];
  pJobs: PJob[];
  timezone: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState<Item | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const view = useMemo(() => {
    const base = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const year = base.getFullYear();
    const month = base.getMonth();
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return { label: base.toLocaleString("en-US", { month: "long", year: "numeric" }), cells, year, month };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthOffset]);

  // Items scheduled: use scheduledAt rendered in the workspace timezone day
  const scheduledByDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      if (item.scheduledAt) {
        const day = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(item.scheduledAt));
        const list = map.get(day) ?? [];
        list.push(item);
        map.set(day, list);
      }
    }
    return map;
  }, [items, timezone]);

  const unscheduledQueue = useMemo(
    () => items.filter((i) => !i.scheduledAt && (i.status === "ready_for_review" || i.status === "approved")),
    [items],
  );

  const failedJobsByItem = useMemo(() => {
    const map = new Map<string, PJob[]>();
    for (const j of pJobs) {
      if (j.status === "failed") {
        const list = map.get(j.contentItemId) ?? [];
        list.push(j);
        map.set(j.contentItemId, list);
      }
    }
    return map;
  }, [pJobs]);

  function scheduleOn(itemId: string, dateIso: string) {
    start(async () => {
      const r = await scheduleContentAction({ itemId, dateIso });
      if (r.ok) {
        toast.success(`Scheduled for ${dateIso} at 18:30 (${timezone})`);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function handleDrop(e: React.DragEvent, dateIso: string) {
    e.preventDefault();
    setDragOver(null);
    const itemId = e.dataTransfer.getData("text/qurtiz-item");
    if (itemId && editable) scheduleOn(itemId, dateIso);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" aria-label="Previous month" onClick={() => setMonthOffset((m) => m - 1)}>
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <span className="min-w-44 text-center text-sm font-medium">{view.label}</span>
          <Button size="icon" variant="ghost" aria-label="Next month" onClick={() => setMonthOffset((m) => m + 1)}>
            <ChevronRight className="size-4" aria-hidden />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMonthOffset(0)}>Today</Button>
        </div>
        {editable ? (
          <BulkPlanDialog />
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <Card>
          <CardContent className="p-2">
            <div className="grid grid-cols-7 gap-1 px-1 pb-1 pt-2 text-center text-xs font-medium text-muted-foreground">
              {DOW.map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {view.cells.map((date, i) => {
                if (!date) return <div key={`e-${i}`} className="min-h-24 rounded-lg bg-muted/30" />;
                const iso = dayIso(date);
                const dayItems = scheduledByDay.get(iso) ?? [];
                const isToday = iso === dayIso(today);
                return (
                  <div
                    key={iso}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(iso); }}
                    onDragLeave={() => setDragOver((d) => (d === iso ? null : d))}
                    onDrop={(e) => handleDrop(e, iso)}
                    className={cn(
                      "min-h-24 rounded-lg border p-1.5 transition-colors",
                      isToday && "border-primary/50",
                      dragOver === iso && "border-primary bg-primary/5",
                      !editable && "opacity-90",
                    )}
                  >
                    <div className={cn("mb-1 text-xs", isToday ? "font-bold text-primary" : "text-muted-foreground")}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayItems.slice(0, 3).map((item) => {
                        const failed = failedJobsByItem.get(item.id);
                        return (
                          <div
                            key={item.id}
                            draggable={editable}
                            onDragStart={(e) => e.dataTransfer.setData("text/qurtiz-item", item.id)}
                            onClick={() => setSelected(item)}
                            className="cursor-pointer rounded border bg-background px-1.5 py-1 text-[11px] leading-tight hover:bg-accent"
                            title={item.topic}
                          >
                            <div className="flex items-center gap-1">
                              <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[item.status] ?? "bg-muted-foreground")} />
                              <span className="truncate">{item.topic}</span>
                            </div>
                            {failed && failed.length > 0 ? (
                              <div className="mt-0.5 flex items-center gap-1 text-destructive">
                                <AlertTriangle className="size-3" aria-hidden /> publish failed
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                      {dayItems.length > 3 ? (
                        <div className="px-1 text-[10px] text-muted-foreground">+{dayItems.length - 3} more</div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Unscheduled queue */}
        <Card className="h-fit">
          <CardContent className="space-y-2 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ListChecks className="size-4" aria-hidden /> Ready to schedule ({unscheduledQueue.length})
            </div>
            <p className="text-xs text-muted-foreground">Drag onto a day to schedule at 18:30.</p>
            {unscheduledQueue.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                Nothing waiting. Approve content in the Studio, then drag it here onto a day.
              </p>
            ) : (
              <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
                {unscheduledQueue.map((item) => (
                  <div
                    key={item.id}
                    draggable={editable}
                    onDragStart={(e) => e.dataTransfer.setData("text/qurtiz-item", item.id)}
                    className="cursor-grab rounded-md border p-2 text-xs hover:bg-accent"
                    title={item.topic}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[item.status])} />
                      <span className="truncate">{item.topic}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Item detail */}
      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.topic}</DialogTitle>
                <DialogDescription>
                  Status: {selected.status.replaceAll("_", " ")}
                  {selected.scheduledAt
                    ? ` · ${new Intl.DateTimeFormat("en-CA", { timeZone: timezone, dateStyle: "short", timeStyle: "short" }).format(new Date(selected.scheduledAt))} (${timezone})`
                    : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {selected.hook ? <p className="text-sm"><span className="font-medium">Hook:</span> {selected.hook}</p> : null}
                {(failedJobsByItem.get(selected.id) ?? []).map((j) => (
                  <div key={j.id} className="rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                    <div className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="size-3.5" aria-hidden />
                      {j.platform} publish failed
                    </div>
                    <p className="mt-1">{j.lastError}</p>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  {selected.status === "scheduled" && editable ? (
                    <Button size="sm" variant="outline" disabled={pending}
                      onClick={() => start(async () => {
                        const r = await unscheduleContentAction(selected.id);
                        if (r.ok) { toast.success("Unscheduled"); setSelected(null); router.refresh(); }
                        else toast.error(r.error);
                      })}>
                      Unschedule
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Close</Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BulkPlanDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [count, setCount] = useState(12);
  const [niche, setNiche] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  function startPlan() {
    start(async () => {
      const r = await startBulkPlanAction({ count, niche: niche || undefined });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (r.jobId) {
        setJobId(r.jobId);
        setProgress({ done: 0, total: count });
        toast.success("Bulk plan queued — generating in the background");
        poll(r.jobId);
      }
    });
  }

  function poll(id: string) {
    const timer = setInterval(async () => {
      const s = await getJobStatusAction(id);
      if (!s.ok) { clearInterval(timer); return; }
      setProgress({ done: s.progress ?? 0, total: s.total ?? 0 });
      if (s.status === "completed") {
        clearInterval(timer);
        toast.success("Bulk plan finished — review it in the Calendar");
        setOpen(false);
        setJobId(null);
        router.refresh();
      }
      if (s.status === "failed") {
        clearInterval(timer);
        toast.error(s.error ?? "Bulk plan failed");
        setJobId(null);
      }
    }, 2500);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Sparkles className="size-4" aria-hidden /> Plan next 2–6 weeks
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk content plan</DialogTitle>
          <DialogDescription>
            Generates posts spread over upcoming weekdays with a format mix, queued as a background job.
            Generation takes a while — you can keep working; a notification lands when it finishes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-count">How many posts</Label>
            <select
              id="bulk-count"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-sm outline-none"
            >
              {[6, 12, 18, 24, 30].map((n) => (
                <option key={n} value={n}>{n} posts ({n === 6 ? "~3 weeks" : `~${Math.ceil(n / 2)} weeks`})</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bulk-niche">Focus / niche (optional)</Label>
            <input
              id="bulk-niche"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              maxLength={300}
              placeholder="e.g. Canva AI for students"
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-sm outline-none"
            />
          </div>
          {jobId ? (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Generating… {progress.done}/{progress.total || count}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 5}%` }} />
              </div>
            </div>
          ) : (
            <Button className="w-full" onClick={startPlan} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Wand2 className="size-4" aria-hidden />}
              Start bulk generation
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

