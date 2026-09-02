"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Loader2, Sparkles } from "lucide-react";
import {
  cancelBulkJobAction,
  getJobStatusAction,
  startBulkPlanAction,
} from "@/server/actions/schedule";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Bulk content plan: queue a background job that runs the staged pipeline
 * (Brand Brain → library → analytics → research → strategy → generation →
 * verification → visuals). Posts land in the Content Studio as Ready for
 * Review — nothing is scheduled or published automatically.
 */
export function BulkPlanDialog({ editable, aiConfigured }: { editable: boolean; aiConfigured: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [count, setCount] = useState(12);
  const [niche, setNiche] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [stage, setStage] = useState("Preparing");
  const [jobFailed, setJobFailed] = useState<string | null>(null);
  // Polling timer must be cleared on unmount AND when the job reaches a
  // terminal state — otherwise the interval leaks and keeps calling the API.
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, []);

  function stopPolling() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }

  function startPlan() {
    stopPolling();
    setJobFailed(null);
    start(async () => {
      const r = await startBulkPlanAction({ count, niche: niche || undefined });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (r.jobId) {
        setJobId(r.jobId);
        setProgress({ done: 0, total: count });
        setStage("Preparing");
        toast.success("Bulk plan queued — posts will appear here as Ready for Review");
        poll(r.jobId);
      }
    });
  }

  function poll(id: string) {
    stopPolling();
    pollTimer.current = setInterval(async () => {
      const s = await getJobStatusAction(id);
      if (!s.ok) {
        stopPolling();
        return;
      }
      setProgress({ done: s.progress ?? 0, total: s.total ?? 0 });
      if (s.stage) setStage(s.stage);
      if (s.status === "completed") {
        stopPolling();
        toast.success("Bulk plan finished — new posts are Ready for Review below");
        setOpen(false);
        setJobId(null);
        router.refresh();
      }
      if (s.status === "cancelled") {
        stopPolling();
        toast.success("Bulk plan cancelled — completed posts were kept");
        setJobId(null);
        router.refresh();
      }
      if (s.status === "failed") {
        stopPolling();
        setJobFailed(s.error ?? "Bulk plan failed");
        setJobId(null);
      }
    }, 2500);
  }

  function cancel() {
    if (!jobId) return;
    start(async () => {
      const r = await cancelBulkJobAction(jobId);
      if (r.ok) toast.success("Cancelling — completed posts were kept");
      else toast.error(r.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" disabled={!editable || !aiConfigured} />}>
        <CalendarPlus className="size-4" aria-hidden />
        Bulk content plan
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk content plan</DialogTitle>
          <DialogDescription>
            Runs the full pipeline: Brand Brain → existing content → analytics → research → AI strategy →
            generation → verification. Every post lands here as <strong>Ready for Review</strong> — you approve
            or reject each one before anything is scheduled or published.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {jobId ? (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                <span>{stage}{progress.total ? ` — ${progress.done}/${progress.total}` : ""}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 5}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">You can keep working — new posts appear below as they finish.</p>
              <Button size="sm" variant="outline" onClick={cancel} disabled={pending}>
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="bulk-count">How many posts</Label>
                <select
                  id="bulk-count"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-sm outline-none [&>option]:bg-card [&>option]:text-card-foreground"
                >
                  {[6, 12, 18, 24, 30].map((n) => (
                    <option key={n} value={n}>
                      {n} posts ({n === 6 ? "~3 weeks" : `~${Math.ceil(n / 2)} weeks`})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-niche">Focus / niche (optional)</Label>
                <Input
                  id="bulk-niche"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  maxLength={300}
                  placeholder="e.g. Canva AI for students"
                />
              </div>
              {jobFailed ? (
                <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <p className="text-sm text-destructive">{jobFailed}</p>
                  <Button size="sm" variant="outline" onClick={startPlan} disabled={pending}>
                    Retry failed posts
                  </Button>
                </div>
              ) : null}
              <Button className="w-full" onClick={startPlan} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
                Start bulk generation
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
