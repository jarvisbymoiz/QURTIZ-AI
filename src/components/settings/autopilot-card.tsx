"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Bot, Clock, Loader2, Plus, X } from "lucide-react";
import { updateAutopilotSettingsAction } from "@/server/actions/intelligence";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_RUN_TIMES, MAX_RUN_TIMES, sanitizeRunTimes } from "@/lib/autopilot/logic";

const TIME_CLASS = "[color-scheme:dark]";

export function AutopilotCard({
  initial,
  timezone,
  editable,
}: {
  initial: { enabled: boolean; requireApproval: boolean; nicheFocus: string; maxPostsPerRun: number; runTimes: string[] };
  /** Workspace timezone (e.g. "Asia/Karachi") — run times are local to it. */
  timezone?: string;
  editable?: boolean;
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [requireApproval, setRequireApproval] = useState(initial.requireApproval);
  const [nicheFocus, setNicheFocus] = useState(initial.nicheFocus);
  const [maxPosts, setMaxPosts] = useState(initial.maxPostsPerRun);
  const [runTimes, setRunTimes] = useState<string[]>(initial.runTimes);
  const [pending, start] = useTransition();

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
      const r = await updateAutopilotSettingsAction({ enabled, requireApproval, nicheFocus, maxPostsPerRun: maxPosts, runTimes: times });
      if (r.ok) {
        toast.success(enabled ? "Autopilot enabled" : "Autopilot disabled");
        setRunTimes(times);
      } else toast.error(r.error);
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
          creates a post with an AI image, and schedules it at a high-engagement hour (auto-approve) or sends it to
          review. Guardrails: max 3 posts per run, future scheduling only, workspace timezone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Enable Autopilot</div>
              <p className="text-xs text-muted-foreground">
                Runs daily at your set times ({timezone ?? "workspace timezone"}); each run researches, creates a post
                with an AI image, and schedules it at a high-engagement hour.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={toggleEnabled} disabled={!editable} aria-label="Enable autopilot" />
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
                    disabled={!editable}
                    className={TIME_CLASS}
                  />
                  <Button type="button" size="icon" variant="ghost" aria-label={"Remove run time " + (i + 1)}
                    disabled={!editable || runTimes.length <= 1}
                    onClick={() => setRunTimes(runTimes.filter((_, j) => j !== i))}>
                    <X className="size-4" aria-hidden />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" size="sm" variant="outline" disabled={!editable || runTimes.length >= MAX_RUN_TIMES}
              onClick={() => setRunTimes([...runTimes, "18:30"])}>
              <Plus className="size-3.5" aria-hidden /> Add run time
            </Button>
            <p className="text-xs text-muted-foreground">
              Up to {MAX_RUN_TIMES} per day. Each run researches a fresh topic, creates a post with an AI image, and
              schedules it at a high-engagement hour.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Require approval before scheduling</div>
              <p className="text-xs text-muted-foreground">Recommended. Off = posts auto-approve and auto-schedule.</p>
            </div>
            <Switch checked={requireApproval} onCheckedChange={setRequireApproval} disabled={!editable} aria-label="Require approval" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ap-niche">Focus / niche (optional)</Label>
            <Input id="ap-niche" value={nicheFocus} onChange={(e) => setNicheFocus(e.target.value)} maxLength={300}
              placeholder="e.g. budget smartphones for students" disabled={!editable} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ap-max">Posts per run</Label>
            <select id="ap-max" value={maxPosts} onChange={(e) => setMaxPosts(Number(e.target.value))} disabled={!editable}
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
