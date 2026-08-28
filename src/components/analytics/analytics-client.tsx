"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plug, RefreshCw, Sparkles } from "lucide-react";
import { runPerformanceAnalysisAction, syncInsightsAction } from "@/server/actions/analytics";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Totals } from "@/lib/analytics/compute";

export function AnalyticsClient({
  totals,
  byPlatform,
  byFormat,
  hours,
  connected,
  insight,
}: {
  totals: Totals;
  byPlatform: { key: string; totals: Totals }[];
  byFormat: { key: string; totals: Totals }[];
  hours: { hour: number; avgEngagement: number; posts: number }[];
  connected: string[];
  insight: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const hasData = totals.posts > 0;

  function sync() {
    start(async () => {
      const r = await syncInsightsAction();
      if (r.ok) {
        toast.success(`Synced ${r.synced ?? 0} posts${r.errors ? ` (${r.errors.length} warnings)` : ""}`);
        if (r.errors) console.warn(r.errors);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function analyze() {
    start(async () => {
      const r = await runPerformanceAnalysisAction();
      if (r.ok) {
        toast.success("Analysis ready");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={sync} disabled={pending || connected.length === 0}>
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
          Sync insights
        </Button>
        <Button size="sm" onClick={analyze} disabled={pending || !hasData}>
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
          AI performance analysis
        </Button>
        <span className="text-xs text-muted-foreground">Sync also runs automatically every 4 hours.</span>
      </div>

      {connected.length === 0 ? (
        <Alert>
          <Plug className="size-4" aria-hidden />
          <AlertTitle>No accounts connected</AlertTitle>
          <AlertDescription>
            Connect Facebook/Instagram on the Connections page. Metrics come exclusively from official platform APIs —
            nothing is simulated here.
          </AlertDescription>
        </Alert>
      ) : null}

      {hasData ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Posts measured", value: totals.posts },
              { label: "Reach", value: totals.reach.toLocaleString() },
              { label: "Engagement", value: totals.engagement.toLocaleString() },
              { label: "Engagement rate", value: `${totals.engagementRate}%` },
            ].map((s) => (
              <Card key={s.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{s.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">By platform</CardTitle>
                <CardDescription>Measured totals per platform</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {byPlatform.map((g) => (
                  <div key={g.key} className="flex items-center justify-between rounded-md border p-2">
                    <span className="capitalize">{g.key}</span>
                    <span className="text-xs text-muted-foreground">
                      {g.totals.posts} posts · reach {g.totals.reach.toLocaleString()} · ER {g.totals.engagementRate}%
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">By content format</CardTitle>
                <CardDescription>What performs best (measured)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {byFormat.map((g) => (
                  <div key={g.key} className="flex items-center justify-between rounded-md border p-2">
                    <span className="capitalize">{g.key.replaceAll("_", " ")}</span>
                    <span className="text-xs text-muted-foreground">
                      {g.totals.posts} posts · ER {g.totals.engagementRate}%
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Best posting hours ({`workspace timezone`})</CardTitle>
                <CardDescription>Average engagement per posting hour — measured, improves with data</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {hours.map((h) => (
                  <div key={h.hour} className="rounded-lg border px-3 py-2 text-center">
                    <div className="text-lg font-semibold">{String(h.hour).padStart(2, "0")}:00</div>
                    <div className="text-xs text-muted-foreground">avg {h.avgEngagement} · {h.posts} posts</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {insight ? (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" aria-hidden /> AI performance analysis
                  </CardTitle>
                  <CardDescription>AI-generated from measured data — verify against your own judgment.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{insight}</div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </>
      ) : connected.length > 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Connected — click <strong>Sync insights</strong> to pull measured performance for your published posts.
        </div>
      ) : null}
    </div>
  );
}
