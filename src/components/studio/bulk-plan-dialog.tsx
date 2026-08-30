"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Loader2, Sparkles } from "lucide-react";
import { getJobStatusAction, startBulkPlanAction } from "@/server/actions/schedule";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Bulk content plan: queue a background job that generates posts spread over
 * upcoming weekdays. Posts land in the Content Studio as Ready for Review —
 * nothing is scheduled or published automatically.
 */
export function BulkPlanDialog({ editable, aiConfigured }: { editable: boolean; aiConfigured: boolean }) {
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
        toast.success("Bulk plan queued — posts will appear here as Ready for Review");
        poll(r.jobId);
      }
    });
  }

  function poll(id: string) {
    const timer = setInterval(async () => {
      const s = await getJobStatusAction(id);
      if (!s.ok) {
        clearInterval(timer);
        return;
      }
      setProgress({ done: s.progress ?? 0, total: s.total ?? 0 });
      if (s.status === "completed") {
        clearInterval(timer);
        toast.success("Bulk plan finished — new posts are Ready for Review below");
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
      <DialogTrigger render={<Button variant="outline" disabled={!editable || !aiConfigured} />}>
        <CalendarPlus className="size-4" aria-hidden />
        Bulk content plan
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk content plan</DialogTitle>
          <DialogDescription>
            Generates posts spread over upcoming weekdays with a format mix, as a background job.
            Every post lands here as <strong>Ready for Review</strong> — you approve or reject each
            one before anything gets scheduled or published.
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
          {jobId ? (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Generating… {progress.done}/{progress.total || count}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 5}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                You can keep working — new posts appear in the Studio below as they finish.
              </p>
            </div>
          ) : (
            <Button className="w-full" onClick={startPlan} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
              Start bulk generation
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
