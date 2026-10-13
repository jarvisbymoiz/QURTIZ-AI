"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { campaigns, campaignItems } from "@/db/schema";
import {
  manageCampaignAction,
  campaignContentAction,
} from "@/server/actions/campaigns";
import { unscheduleContentAction } from "@/server/actions/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
type Campaign = typeof campaigns.$inferSelect;
export function CampaignControls({
  campaign: c,
  editable,
  canRetry = false,
}: {
  campaign: Campaign;
  editable: boolean;
  canRetry?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.name),
    [goal, setGoal] = useState(c.goal ?? ""),
    [cta, setCta] = useState(c.cta ?? "");
  if (!editable || c.status === "generating") return null;
  return (
    <div className="space-y-2">
      {editing ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await manageCampaignAction(c.id, {
                type: "edit",
                name,
                goal,
                cta,
              });
              if (r.ok) {
                setEditing(false);
                router.refresh();
                toast.success("Campaign saved");
              } else toast.error(r.error);
            });
          }}
        >
          <Input
            aria-label="Edit campaign name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
          />
          <Input
            aria-label="Edit campaign goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            maxLength={300}
          />
          <Input
            aria-label="Edit campaign CTA"
            value={cta}
            onChange={(e) => setCta(e.target.value)}
            maxLength={300}
          />
          <Button disabled={pending} size="sm" type="submit">
            Save campaign
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEditing(false)}
          >
            Cancel edit
          </Button>
        </form>
      ) : (
        <div className="flex gap-2">
          {canRetry ? (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
              const r = await manageCampaignAction(c.id, { type: "retry" });
              if (r.ok) { toast.success("Generation queued; saved posts will be preserved"); router.refresh(); }
              else toast.error(r.error);
            })}>Retry generation</Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit campaign
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (
                !window.confirm(
                  "Delete this campaign? Linked posts and their independent Calendar/publishing jobs will be preserved.",
                )
              )
                return;
              start(async () => {
                const r = await manageCampaignAction(c.id, { type: "delete" });
                if (r.ok) {
                  toast.success("Campaign deleted; posts preserved");
                  router.refresh();
                } else toast.error(r.error);
              });
            }}
          >
            Delete campaign
          </Button>
        </div>
      )}
    </div>
  );
}
export function CampaignDayControls({
  campaign: c,
  day,
  content,
  editable,
}: {
  campaign: Campaign;
  day: typeof campaignItems.$inferSelect;
  content: { id: string; topic: string; status: string }[];
  editable: boolean;
}) {
  const router = useRouter(),
    [pending, start] = useTransition();
  const [selected, setSelected] = useState(day.contentItemId ?? "");
  const [date, setDate] = useState(""),
    [time, setTime] = useState("18:30");
  const disabled =
    !editable || c.status === "generating" || c.status === "cancelled";
  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    message: string,
  ) {
    start(async () => {
      const r = await action();
      if (r.ok) {
        toast.success(message);
        router.refresh();
      } else toast.error(r.error);
    });
  }
  return (
    <div className="w-full space-y-2 border-t pt-2">
      <div className="flex flex-wrap gap-2">
        <select
          aria-label={`Select post for ${c.name} day ${day.dayIndex}`}
          className="min-w-0 flex-1 rounded-md border bg-card p-2 text-xs"
          value={selected}
          disabled={disabled || pending}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">No linked post</option>
          {content.map((p) => (
            <option key={p.id} value={p.id}>
              {p.topic.slice(0, 90)} — {p.status}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || pending}
          onClick={() =>
            run(
              () =>
                manageCampaignAction(c.id, {
                  type: "link",
                  dayId: day.id,
                  itemId: selected || null,
                }),
              "Post link saved",
            )
          }
        >
          Save link
        </Button>
      </div>
      {day.contentItemId ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Link href="/content-studio" className="underline">
              Review in Content Studio
            </Link>
            <Link href="/calendar" className="underline">
              Calendar / publishing
            </Link>
            <Link href="/analytics" className="underline">
              Analytics
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || pending}
              onClick={() =>
                run(
                  () =>
                    campaignContentAction({
                      campaignId: c.id,
                      dayId: day.id,
                      type: "approve",
                    }),
                  "Post approved",
                )
              }
            >
              Approve post
            </Button>
            <Input
              aria-label={`Schedule date day ${day.dayIndex}`}
              className="w-36"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Input
              aria-label={`Schedule time day ${day.dayIndex}`}
              className="w-28"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
            <Button
              size="sm"
              disabled={disabled || pending || !date}
              onClick={() =>
                run(
                  () =>
                    campaignContentAction({
                      campaignId: c.id,
                      dayId: day.id,
                      type: "schedule",
                      dateIso: date,
                      timeStr: time,
                    }),
                  "Scheduled on selected campaign platforms",
                )
              }
            >
              Schedule post
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled || pending}
              onClick={() =>
                run(
                  () => unscheduleContentAction(day.contentItemId!),
                  "Pending deliveries cancelled",
                )
              }
            >
              Unschedule post
            </Button>
          </div>
          <p className="text-muted-foreground">
            Review before approval. Schedule uses workspace timezone; publishing
            runs through the existing Calendar service.
          </p>
        </>
      ) : null}
    </div>
  );
}
