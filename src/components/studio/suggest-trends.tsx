"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { suggestTrendsAction } from "@/server/actions/research";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Trends = {
  trendingTopics: { topic: string; why: string }[];
  visualDirections: { direction: string; style: string }[];
  hookIdeas: string[];
};

export function SuggestTrends({ editable, aiConfigured }: { editable: boolean; aiConfigured: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [niche, setNiche] = useState("");
  const [pending, start] = useTransition();
  const [trends, setTrends] = useState<Trends | null>(null);
  const [sourced, setSourced] = useState(false);

  function run() {
    start(async () => {
      const r = await suggestTrendsAction({ niche: niche || undefined });
      if (r.ok) {
        setTrends(r.trends as Trends);
        setSourced(r.sourced);
      } else toast.error(r.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" disabled={!editable || !aiConfigured} />}>
        <Sparkles className="size-4" aria-hidden /> Suggest trends
      </DialogTrigger>
      <DialogContent className="max-h-[88dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Trend suggestions</DialogTitle>
          <DialogDescription>
            Structured ideas for your niche: trending topics, visual directions and hooks.
            {sourced ? " Grounded in live web search." : " AI-knowledge based (live search unavailable on this plan)."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tr-niche">Niche focus (optional)</Label>
            <Input id="tr-niche" value={niche} onChange={(e) => setNiche(e.target.value)} maxLength={300}
              placeholder="e.g. Canva AI for students" />
            <Button size="sm" onClick={run} disabled={pending}>
              {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
              {trends ? "Suggest again" : "Suggest trends"}
            </Button>
          </div>
          {trends ? (
            <div className="space-y-4 text-sm">
              <section>
                <div className="mb-1.5 font-medium">Trending topics</div>
                <ul className="space-y-1.5">
                  {trends.trendingTopics.map((t, i) => (
                    <li key={i} className="rounded-md border p-2">
                      <div className="font-medium">{t.topic}</div>
                      {t.why ? <div className="text-xs text-muted-foreground">{t.why}</div> : null}
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <div className="mb-1.5 font-medium">Visual directions</div>
                <div className="flex flex-wrap gap-1.5">
                  {trends.visualDirections.map((v, i) => (
                    <Badge key={i} variant="secondary">{v.direction}</Badge>
                  ))}
                </div>
              </section>
              <section>
                <div className="mb-1.5 font-medium">Hook ideas</div>
                <ul className="space-y-1">
                  {trends.hookIdeas.map((h, i) => (
                    <li key={i} className="rounded-md border p-2 text-xs">"{h}"</li>
                  ))}
                </ul>
              </section>
              <div className="flex justify-end">
                <Button size="sm" onClick={() => { setOpen(false); router.refresh(); }}>Done</Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
