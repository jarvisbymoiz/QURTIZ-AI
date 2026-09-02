"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Bot } from "lucide-react";
import { updateAutopilotSettingsAction } from "@/server/actions/intelligence";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function AutopilotCard({
  initial,
  editable,
}: {
  initial: { enabled: boolean; requireApproval: boolean; nicheFocus: string; maxPostsPerRun: number };
  editable?: boolean;
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [requireApproval, setRequireApproval] = useState(initial.requireApproval);
  const [nicheFocus, setNicheFocus] = useState(initial.nicheFocus);
  const [maxPosts, setMaxPosts] = useState(initial.maxPostsPerRun);
  const [pending, start] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await updateAutopilotSettingsAction({ enabled, requireApproval, nicheFocus, maxPostsPerRun: maxPosts });
      if (r.ok) toast.success(enabled ? "Autopilot enabled" : "Autopilot disabled");
      else toast.error(r.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="size-4 text-primary" aria-hidden /> Autopilot
        </CardTitle>
        <CardDescription>
          Daily autonomous loop: research â†’ pick the best opportunity â†’ generate content. With approval required
          (default), posts land in Ready for review; disabled approval auto-schedules them. Guardrails: max 1 post per
          run, weekdays, 18:30 slot, workspace timezone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium">Enable Autopilot</span>
            <Switch checked={enabled} onCheckedChange={setEnabled} disabled={!editable} aria-label="Enable autopilot" />
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

