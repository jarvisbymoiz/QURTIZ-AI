"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, ListChecks, Zap } from "lucide-react";
import type { contentItems, contentVariants, publishingJobs } from "@/db/schema";
import {
  publishNowAction,
  rescheduleContentAction,
  scheduleContentAction,
  unscheduleContentAction,
} from "@/server/actions/schedule";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Item = typeof contentItems.$inferSelect;
type PJob = typeof publishingJobs.$inferSelect;
/** Minimal variant shape the page passes down (id + item + platform + status). */
type Variant = Pick<typeof contentVariants.$inferSelect, "id" | "contentItemId" | "platform" | "status">;

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Day cells must be keyed/labeled in the same timezone the app schedules in
// (the workspace timezone) — otherwise items land on the wrong visual day
// whenever the browser tz differs from the workspace tz. "en-CA" yields
// YYYY-MM-DD, matching the scheduledByDay keys below.
function dayIso(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(d);
}

const STATUS_DOT: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  ready_for_review: "bg-primary",
  approved: "bg-emerald-500",
  scheduled: "bg-indigo-400",
  published: "bg-emerald-600",
  failed: "bg-destructive",
};

/** "HH:MM" of a Date rendered in the workspace timezone (24h). */
function fmtTime(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

export function CalendarClient({
  items,
  pJobs,
  variants,
  timezone,
  editable,
}: {
  items: Item[];
  pJobs: PJob[];
  variants: Variant[];
  timezone: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const [calView, setCalView] = useState<"month" | "week">("month");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState<Item | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  // Pending booking: item + date prefilled from the drop target. `time` is
  // empty for new bookings (the user must pick one — no silent default slot)
  // and prefilled with the current time when rescheduling an existing post.
  const [scheduleDraft, setScheduleDraft] = useState<{ item: Item; dateIso: string; time: string } | null>(null);
  // Variant currently being published via "Publish now" (per-button busy
  // state; all publish buttons disable while one is in flight).
  const [publishingVariantId, setPublishingVariantId] = useState<string | null>(null);

  const monthView = useMemo(() => {
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
  const weekDates = useMemo(() => {
    const s = new Date(today.getFullYear(), today.getMonth(), today.getDate() + weekOffset * 7 - ((today.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => new Date(s.getFullYear(), s.getMonth(), s.getDate() + i));
  }, [weekOffset]);

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

  // Sidebar shows ONLY approved posts from Content Studio — nothing else can
  // be dragged onto the calendar (review items must be approved first).
  const unscheduledQueue = useMemo(
    () => items.filter((i) => !i.scheduledAt && i.status === "approved"),
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

  // Publishable variants per item (approved/scheduled only) — one
  // "Publish now" button per platform variant in the item dialog.
  const publishableVariantsByItem = useMemo(() => {
    const map = new Map<string, Variant[]>();
    for (const v of variants) {
      if (v.status !== "approved" && v.status !== "scheduled") continue;
      const list = map.get(v.contentItemId) ?? [];
      list.push(v);
      map.set(v.contentItemId, list);
    }
    return map;
  }, [variants]);

  /** Open the schedule picker for a drop/click — never books anything itself. */
  function openScheduleDraft(item: Item, dateIso: string) {
    if (!editable) return;
    const time = item.scheduledAt ? fmtTime(new Date(item.scheduledAt), timezone) : "";
    setScheduleDraft({ item, dateIso, time });
  }

  /** Publish ONE approved/scheduled variant immediately. The server action
   *  funnels through the centralized publishing service, so the toast shows
   *  the real outcome: success confirms the provider post id; failure shows
   *  the service's actual error verbatim (reconnect hints included). */
  function handlePublishNow(item: Item, variant: Variant) {
    if (publishingVariantId !== null) return;
    setPublishingVariantId(variant.id);
    void (async () => {
      try {
        const r = await publishNowAction({ itemId: item.id, variantId: variant.id, platform: variant.platform });
        if (r.ok) {
          toast.success(
            `Published to ${variant.platform === "facebook" ? "Facebook" : "Instagram"} — post id ${r.providerPostId}.`,
          );
          setSelected(null);
          router.refresh();
        } else {
          toast.error(r.error);
        }
      } catch {
        toast.error("Publish failed — the request did not complete. Check your connection and try again.");
      } finally {
        setPublishingVariantId(null);
      }
    })();
  }

  function handleDrop(e: React.DragEvent, dateIso: string) {
    e.preventDefault();
    setDragOver(null);
    const itemId = e.dataTransfer.getData("text/qurtiz-item");
    if (!itemId || !editable) return;
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    if (item.status === "published") {
      toast.error("Published posts cannot be scheduled again.");
      return;
    }
    if (item.status !== "approved" && item.status !== "scheduled") {
      toast.error("Only approved posts can be scheduled.");
      return;
    }
    openScheduleDraft(item, dateIso);
  }

  function confirmScheduleDraft() {
    if (!scheduleDraft) return;
    const { item, dateIso, time } = scheduleDraft;
    start(async () => {
      const isReschedule = item.status === "scheduled";
      const r = isReschedule
        ? await rescheduleContentAction({ itemId: item.id, dateIso, timeStr: time })
        : await scheduleContentAction({ itemId: item.id, dateIso, timeStr: time });
      if (r.ok) {
        toast.success((isReschedule ? "Rescheduled" : "Scheduled") + ` for ${dateIso} ${time} (${timezone})`);
        setScheduleDraft(null);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  /** A scheduled/published item chip inside a day cell. */
  function renderDayItem(item: Item) {
    const failed = failedJobsByItem.get(item.id);
    return (
      <div
        key={item.id}
        draggable={editable && (item.status === "approved" || item.status === "scheduled")}
        onDragStart={(e) => e.dataTransfer.setData("text/qurtiz-item", item.id)}
        onClick={() => setSelected(item)}
        className="cursor-pointer rounded border bg-background px-1.5 py-1 text-[11px] leading-tight hover:bg-accent"
        title={item.topic}
      >
        <div className="flex items-center gap-1">
          <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[item.status] ?? "bg-muted-foreground")} />
          <span className="truncate">{item.topic}</span>
          {item.scheduledAt ? (
            <span className="ml-auto shrink-0 tabular-nums text-[10px] text-muted-foreground">
              {fmtTime(new Date(item.scheduledAt), timezone)}
            </span>
          ) : null}
        </div>
        {failed && failed.length > 0 ? (
          <div className="mt-0.5 flex items-center gap-1 text-destructive">
            <AlertTriangle className="size-3" aria-hidden /> publish failed
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="mr-1 flex rounded-lg border p-0.5">
            {(["month", "week"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={calView === v}
                onClick={() => setCalView(v)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs capitalize transition-colors",
                  calView === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <Button size="icon" variant="ghost" aria-label="Previous" onClick={() => calView === "month" ? setMonthOffset((m) => m - 1) : setWeekOffset((w) => w - 1)}>
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <span className="min-w-44 text-center text-sm font-medium">
            {calView === "month"
              ? monthView.label
              : (() => {
                  const s = new Date(today.getFullYear(), today.getMonth(), today.getDate() + weekOffset * 7 - ((today.getDay() + 6) % 7));
                  const e = new Date(s.getTime() + 6 * 86400000);
                  return s.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " – " + e.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                })()}
          </span>
          <Button size="icon" variant="ghost" aria-label="Next" onClick={() => calView === "month" ? setMonthOffset((m) => m + 1) : setWeekOffset((w) => w + 1)}>
            <ChevronRight className="size-4" aria-hidden />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setMonthOffset(0); setWeekOffset(0); }}>Today</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        {calView === "month" ? (
        <Card>
          <CardContent className="p-2">
            <div className="grid grid-cols-7 gap-1 px-1 pb-1 pt-2 text-center text-xs font-medium text-muted-foreground">
              {DOW.map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {(monthView.cells as (Date | null)[]).map((date: Date | null, i: number) => {
                if (!date) return <div key={`e-${i}`} className="min-h-24 rounded-lg bg-muted/30" />;
                const iso = dayIso(date, timezone);
                const dayItems = scheduledByDay.get(iso) ?? [];
                const isToday = iso === dayIso(today, timezone);
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
                      {dayItems.slice(0, 3).map(renderDayItem)}
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
        ) : (
        <Card>
          <CardContent className="p-2">
            <div className="grid grid-cols-7 gap-1 px-1 pb-1 pt-2 text-center text-xs font-medium text-muted-foreground">
              {DOW.map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weekDates.map((date: Date, i: number) => {
                if (!date) return <div key={`e-${i}`} className="min-h-24 rounded-lg bg-muted/30" />;
                const iso = dayIso(date, timezone);
                const dayItems = scheduledByDay.get(iso) ?? [];
                const isToday = iso === dayIso(today, timezone);
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
                      {dayItems.slice(0, 3).map(renderDayItem)}
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
        )}

        {/* Unscheduled queue */}
        <Card className="h-fit">
          <CardContent className="space-y-2 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ListChecks className="size-4" aria-hidden /> Approved to schedule ({unscheduledQueue.length})
            </div>
            <p className="text-xs text-muted-foreground">Drag onto a day, then pick a time.</p>
            {unscheduledQueue.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                No approved posts. Approve content in the Studio, then drag it here onto a day.
              </p>
            ) : (
              <div className="max-h-[60vh] space-y-1.5 overflow-y-auto scrollbar-hide">
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

      {/* Schedule / reschedule picker — every booking goes through this
          dialog (drop, sidebar click, or Edit schedule), so nothing can ever
          be booked silently at a default time. */}
      <Dialog open={scheduleDraft !== null} onOpenChange={(o) => !o && setScheduleDraft(null)}>
        <DialogContent className="max-w-md">
          {scheduleDraft ? (
            <>
              <DialogHeader>
                <DialogTitle>{scheduleDraft.item.status === "scheduled" ? "Reschedule post" : "Schedule post"}</DialogTitle>
                <DialogDescription>
                  {scheduleDraft.item.topic} · {timezone}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cal-schedule-date">Date (workspace time)</Label>
                  <Input
                    id="cal-schedule-date"
                    type="date"
                    value={scheduleDraft.dateIso}
                    onChange={(e) => setScheduleDraft((d) => (d ? { ...d, dateIso: e.target.value } : d))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cal-schedule-time">Time (workspace time)</Label>
                  <Input
                    id="cal-schedule-time"
                    type="time"
                    value={scheduleDraft.time}
                    onChange={(e) => setScheduleDraft((d) => (d ? { ...d, time: e.target.value } : d))}
                  />
                  {scheduleDraft.time === "" ? (
                    <p className="text-xs text-muted-foreground">Pick a time — nothing is booked until you confirm.</p>
                  ) : null}
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setScheduleDraft(null)}>Cancel</Button>
                  <Button size="sm" disabled={pending || scheduleDraft.time === ""} onClick={confirmScheduleDraft}>
                    <CalendarClock className="size-3.5" aria-hidden />
                    {scheduleDraft.item.status === "scheduled" ? "Reschedule" : "Schedule"}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

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
                {editable && (publishableVariantsByItem.get(selected.id) ?? []).length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Publish now</p>
                    {(publishableVariantsByItem.get(selected.id) ?? []).map((v) => (
                      <div key={v.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                        <div className="min-w-0 text-xs">
                          <span className="font-medium capitalize">{v.platform}</span>
                          <span className="text-muted-foreground"> · {v.status.replaceAll("_", " ")}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={publishingVariantId !== null}
                          onClick={() => handlePublishNow(selected, v)}
                        >
                          <Zap className="size-3.5" aria-hidden />
                          {publishingVariantId === v.id ? "Publishing…" : "Publish now"}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {selected.status === "scheduled" && editable ? (
                    <Button size="sm" variant="outline" disabled={pending}
                      onClick={() => {
                        if (selected.scheduledAt) {
                          openScheduleDraft(selected, dayIso(new Date(selected.scheduledAt), timezone));
                          setSelected(null);
                        }
                      }}>
                      <CalendarClock className="size-3.5" aria-hidden /> Edit schedule
                    </Button>
                  ) : null}
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
