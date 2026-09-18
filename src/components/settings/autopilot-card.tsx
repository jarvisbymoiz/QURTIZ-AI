"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bot, Clock, Loader2, Plus, X } from "lucide-react";
import { updateAutopilotSettingsAction } from "@/server/actions/intelligence";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_RUN_TIMES, MAX_RUN_TIMES, sanitizeRunTimes } from "@/lib/autopilot/logic";
import type { AutopilotSettings } from "@/lib/autopilot/schema";

const TIME_CLASS = "[color-scheme:dark]";

export function AutopilotCard({
  initial,
  timezone,
  editable,
  lastRun,
}: {
  initial: AutopilotSettings;
  /** Workspace timezone (e.g. "Asia/Karachi") — run times are local to it. */
  timezone?: string;
  editable?: boolean;
  lastRun?: { status: string; progress: number; total: number; error: string | null; stage: string; occurrence: string; warnings: string[] };
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [requireApproval, setRequireApproval] = useState(initial.requireApproval);
  const [nicheFocus, setNicheFocus] = useState(initial.nicheFocus ?? "");
  const [maxPosts, setMaxPosts] = useState(initial.maxPostsPerRun);
  const [runTimes, setRunTimes] = useState<string[]>(initial.runTimes);
  const [pending, start] = useTransition();
  const [options, setOptions] = useState({ platforms: initial.platforms, formats: initial.formats, autoSchedule: initial.autoSchedule, generateImages: initial.generateImages,
    runDays: initial.runDays, minGapMinutes: initial.minGapMinutes, maxPostsPerDay: initial.maxPostsPerDay });
  const [fallbackTimes, setFallbackTimes] = useState(initial.fallbackTimes.join(", "));

  function toggleEnabled(next: boolean) {
    setEnabled(next);
    // Pre-fill one default slot when enabling with none configured, so the
    // save can never be blocked by an empty schedule.
    if (next && runTimes.length === 0) setRunTimes([...DEFAULT_RUN_TIMES]);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const times = sanitizeRunTimes(runTimes).sort();
    if (enabled && times.length === 0) {
      toast.error("Add at least one run time before enabling Autopilot.");
      return;
    }
    start(async () => {
      try {
      const r = await updateAutopilotSettingsAction({ enabled, requireApproval, nicheFocus, maxPostsPerRun: maxPosts, runTimes: times,
        ...options, fallbackTimes: fallbackTimes.split(",").map(t => t.trim()).filter(Boolean) });
      if (r.ok) {
        toast.success(enabled ? "Autopilot enabled" : "Autopilot disabled");
        setRunTimes(times);
        router.refresh();
      } else toast.error(r.error);
      } catch {
        toast.error("Auto Run settings could not be saved. Check your connection and try again.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="size-4 text-primary" aria-hidden /> Autopilot
        </CardTitle>
        <CardDescription>
          Autonomous loop: at each run time it checks your analytics and competitors, researches the best opportunity,
          creates the requested number of QA-passed posts, and distributes them across conflict-free Calendar slots
          or sends them to review. Measured posting performance informs timing; fallback slots are configurable.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {lastRun ? <div role="status" className="mb-4 space-y-1 rounded-lg border p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">Last Auto Run: {lastRun.status} · {lastRun.progress} / {lastRun.total} valid posts</span><Button type="button" size="sm" variant="ghost" onClick={() => router.refresh()}>Refresh status</Button></div>
          <p className="text-muted-foreground">{lastRun.occurrence.replace("T"," ")} ({timezone ?? "workspace timezone"}) · {lastRun.stage}</p>
          {lastRun.error ? <p className="text-destructive">{lastRun.error === "AUTO_RUN_DISABLED" ? "Stopped because Auto Run was disabled. Saved drafts are kept." : lastRun.error}</p> : null}
          {lastRun.warnings.length ? <p className="text-muted-foreground">{lastRun.warnings.join("; ")}</p> : null}
        </div> : null}
        <form onSubmit={save} className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Enable Autopilot</div>
              <p className="text-xs text-muted-foreground">
                Runs on selected days at your set times ({timezone ?? "workspace timezone"}); each run creates the requested number of posts and follows your approval and scheduling rules.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={toggleEnabled} disabled={!editable || pending} aria-label="Enable autopilot" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="size-3.5 text-muted-foreground" aria-hidden />
              <Label>Run times (daily, {timezone ?? "workspace timezone"})</Label>
            </div>
            <div className="space-y-2">
              {runTimes.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="time"
                    aria-label={"Run time " + (i + 1)}
                    value={t}
                    onChange={(e) => {
                      const next = [...runTimes];
                      next[i] = e.target.value;
                      setRunTimes(next);
                    }}
                    disabled={!editable || pending}
                    className={TIME_CLASS}
                  />
                  <Button type="button" size="icon" variant="ghost" aria-label={"Remove run time " + (i + 1)}
                    disabled={!editable || pending || runTimes.length <= 1}
                    onClick={() => setRunTimes(runTimes.filter((_, j) => j !== i))}>
                    <X className="size-4" aria-hidden />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" size="sm" variant="outline" disabled={!editable || pending || runTimes.length >= MAX_RUN_TIMES}
              onClick={() => setRunTimes([...runTimes, Array.from({length: 24}, (_, i) => String(i).padStart(2,"0") + ":00").find(t => !runTimes.includes(t)) ?? "09:00"])}>
              <Plus className="size-3.5" aria-hidden /> Add run time
            </Button>
            <p className="text-xs text-muted-foreground">
              Up to {MAX_RUN_TIMES} per day. Each occurrence is persisted and resumes saved progress after a worker restart.
            </p>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Run days</legend>
            <div className="flex flex-wrap gap-3">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day, index) => <label key={day} className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" disabled={!editable || pending} checked={options.runDays.includes(index)} onChange={e => setOptions({...options, runDays: e.target.checked ? [...options.runDays, index] : options.runDays.filter(d => d !== index)})} />{day}
            </label>)}</div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Platforms</legend>
            <div className="flex gap-3">{(["facebook","instagram"] as const).map(platform => <label key={platform} className="flex items-center gap-1.5 text-sm capitalize">
              <input type="checkbox" disabled={!editable || pending} checked={options.platforms.includes(platform)} onChange={e => setOptions({...options, platforms: e.target.checked ? [...options.platforms,platform] : options.platforms.filter(p => p !== platform)})} />{platform}
            </label>)}</div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Content formats</legend>
            <div className="flex flex-wrap gap-3">{(["single_image","carousel","reel","story","text_post"] as const).map(format => <label key={format} className="flex items-center gap-1.5 text-xs capitalize">
              <input type="checkbox" disabled={!editable || pending} checked={options.formats.includes(format)} onChange={e => setOptions({...options, formats: e.target.checked ? [...options.formats,format] : options.formats.filter(f => f !== format)})} />{format.replaceAll("_"," ")}
            </label>)}</div>
            <p className="text-xs text-muted-foreground">Reels need an uploaded video. Missing media, failed QA and approval-required posts remain in Content Studio for review.</p>
          </fieldset>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!editable || pending} checked={options.generateImages} onChange={e => setOptions({...options, generateImages:e.target.checked})} />Generate AI images</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!editable || pending} checked={options.autoSchedule} onChange={e => setOptions({...options, autoSchedule:e.target.checked})} />Auto-schedule when approval and media requirements are satisfied</label>
          <div className="space-y-2">
            <Label htmlFor="ap-fallback">Fallback posting slots ({timezone ?? "workspace timezone"})</Label>
            <Input id="ap-fallback" disabled={!editable || pending} value={fallbackTimes} onChange={e => setFallbackTimes(e.target.value)} placeholder="09:00, 12:00, 17:00" />
            <p className="text-xs text-muted-foreground">Used when measured timing data is insufficient. Comma-separated HH:MM, up to 6 slots. These are preferences, not measured audience activity.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="ap-gap">Minimum posting gap (minutes)</Label><Input id="ap-gap" type="number" min={30} max={1440} disabled={!editable || pending} value={options.minGapMinutes} onChange={e => setOptions({...options,minGapMinutes:Number(e.target.value)})} /></div>
            <div className="space-y-2"><Label htmlFor="ap-day-max">Posts per platform per day</Label><Input id="ap-day-max" type="number" min={1} max={6} disabled={!editable || pending} value={options.maxPostsPerDay} onChange={e => setOptions({...options,maxPostsPerDay:Number(e.target.value)})} /></div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Require approval before scheduling</div>
              <p className="text-xs text-muted-foreground">Recommended. Off permits auto-approval. Auto-scheduling also requires its setting, passed QA and publishable media.</p>
            </div>
            <Switch checked={requireApproval} onCheckedChange={setRequireApproval} disabled={!editable || pending} aria-label="Require approval" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ap-niche">Focus / niche (optional)</Label>
            <Input id="ap-niche" value={nicheFocus} onChange={(e) => setNicheFocus(e.target.value)} maxLength={300}
              placeholder="e.g. budget smartphones for students" disabled={!editable || pending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ap-max">Posts per run</Label>
            <select id="ap-max" value={maxPosts} onChange={(e) => setMaxPosts(Number(e.target.value))} disabled={!editable || pending}
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-sm outline-none [&>option]:bg-card [&>option]:text-card-foreground [color-scheme:dark]">
              {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending || !editable}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Save autopilot settings
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
