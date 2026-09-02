"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Megaphone, Sparkles } from "lucide-react";
import type { campaignItems, campaigns } from "@/db/schema";
import { startCampaignAction, cancelCampaignAction } from "@/server/actions/campaigns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Campaign = typeof campaigns.$inferSelect;
type CampaignItem = typeof campaignItems.$inferSelect;

const STATUS_STYLE: Record<string, string> = {
  planning: "bg-muted text-muted-foreground",
  generating: "bg-sky-500/10 text-sky-500",
  active: "bg-emerald-500/10 text-emerald-500",
  completed: "bg-emerald-600/15 text-emerald-400",
  cancelled: "bg-muted text-muted-foreground",
};

function CreateCampaignDialog({ editable, aiConfigured }: { editable: boolean; aiConfigured: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [offer, setOffer] = useState("");
  const [audience, setAudience] = useState("");
  const [durationDays, setDurationDays] = useState(7);
  const [platforms, setPlatforms] = useState<string[]>(["facebook", "instagram"]);

  function toggle(p: string) {
    setPlatforms((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || platforms.length === 0) return;
    start(async () => {
      const r = await startCampaignAction({
        name,
        goal: goal || undefined,
        offer: offer || undefined,
        audience: audience || undefined,
        durationDays,
        platforms: platforms as ("facebook" | "instagram")[],
      });
      if (r.ok) {
        // The server returns an honest note when the AI arc generation failed
        // and the standard default arc was used instead.
        toast.success(r.note ?? "Campaign queued — content generates in the background");
        setName(""); setGoal(""); setOffer(""); setAudience("");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button disabled={!editable || !aiConfigured} />}>
        <Sparkles className="size-4" aria-hidden /> New campaign
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a campaign</DialogTitle>
          <DialogDescription>
            The AI builds a day-by-day arc (announcement → problem → benefits → demonstration → social
            proof → urgency → final reminder) and generates every post in the background.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="c-name">Campaign name</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120}
              placeholder="e.g. Eid Special — 20% off" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="c-goal">Goal</Label>
              <Input id="c-goal" value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={300}
                placeholder="e.g. generate leads" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-days">Duration (days)</Label>
              <select id="c-days" value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))}
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-sm outline-none [&>option]:bg-card [&>option]:text-card-foreground [color-scheme:dark]">
                {[3, 5, 7, 10, 14].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-offer">Offer</Label>
            <Input id="c-offer" value={offer} onChange={(e) => setOffer(e.target.value)} maxLength={500}
              placeholder="e.g. 20% discount on the Canva course" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-audience">Audience</Label>
            <Input id="c-audience" value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={500}
              placeholder="e.g. university students in Lahore" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-cta">CTA</Label>
            <Input id="c-cta" value={undefined} onChange={(e) => setGoal(e.target.value)} maxLength={300}
              placeholder="e.g. DM 'EID' on WhatsApp" />
          </div>
          <div className="space-y-2">
            <Label>Platforms</Label>
            <div className="flex gap-2">
              {["facebook", "instagram"].map((p) => (
                <button key={p} type="button" aria-pressed={platforms.includes(p)}
                  onClick={() => toggle(p)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm capitalize transition-colors",
                    platforms.includes(p) ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={pending || platforms.length === 0 || name.trim().length < 2}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {pending ? "Creating…" : "Create campaign"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CampaignsClient({
  campaigns,
  items,
  content,
  jobs,
  aiConfigured,
  editable,
}: {
  campaigns: Campaign[];
  items: CampaignItem[];
  content: { id: string; topic: string; status: string }[];
  jobs: { id: string; status: string; progress: number; total: number; error?: string | null }[];
  aiConfigured: boolean;
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const contentById = new Map(content.map((c) => [c.id, c]));

  return (
    <div className="space-y-4">
      {!aiConfigured ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          AI is not configured for this workspace — add your provider + API key in Workspace Settings to create campaigns.
        </div>
      ) : null}
      <div className="flex justify-end">
        <CreateCampaignDialog editable={editable && aiConfigured} aiConfigured={aiConfigured} />
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
          <Megaphone className="size-8 text-muted-foreground" aria-hidden />
          <p className="max-w-md text-sm text-muted-foreground">
            No campaigns yet. Create one — the AI designs a day-by-day arc and generates every post automatically.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {campaigns.map((c) => {
            const days = items.filter((i) => i.campaignId === c.id).sort((a, b) => a.dayIndex - b.dayIndex);
            const job = c.jobId ? jobs.find((j) => j.id === c.jobId) : undefined;
            return (
              <Card key={c.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{c.name}</CardTitle>
                      <CardDescription>
                        {c.durationDays} days · {c.platforms.join(", ")}{c.goal ? ` · ${c.goal}` : ""}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className={cn("font-medium", STATUS_STYLE[c.status])}>
                      {c.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {job && job.status === "running" ? (
                    <div className="space-y-1 rounded-lg border p-2">
                      <div className="flex items-center gap-2 text-xs">
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        Generating {job.progress}/{job.total}
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary" style={{ width: `${job.total ? (job.progress / job.total) * 100 : 5}%` }} />
                      </div>
                    </div>
                  ) : null}
                  {job?.status === "failed" ? (
                    <p className="text-xs text-destructive">{job.error ?? "Generation failed"}</p>
                  ) : null}
                  <div className="space-y-1.5">
                    {days.map((d) => {
                      const linked = d.contentItemId ? contentById.get(d.contentItemId) : undefined;
                      return (
                        <div key={d.id} className="flex items-center gap-2 rounded-md border p-2 text-xs">
                          <span className="w-10 shrink-0 font-medium text-muted-foreground">Day {d.dayIndex}</span>
                          <span className="min-w-0 flex-1 truncate">{linked?.topic ?? d.theme}</span>
                          {linked ? (
                            <Badge variant="secondary">{linked.status.replaceAll("_", " ")}</Badge>
                          ) : (
                            <Badge variant="secondary">pending</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {c.status === "active" || c.status === "generating" ? (
                    <div className="flex justify-end">
                      <Button size="sm" variant="ghost" disabled={pending || !editable}
                        onClick={() => start(async () => {
                          const r = await cancelCampaignAction(c.id);
                          if (r.ok) { toast.success("Cancelled"); router.refresh(); }
                          else toast.error(r.error);
                        })}>
                        Cancel campaign
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
