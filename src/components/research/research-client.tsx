"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, PenSquare, Search, Sparkles, TrendingUp, X } from "lucide-react";
import type { researchItems } from "@/db/schema";
import {
  createContentFromResearchAction,
  runResearchAction,
  setResearchStatusAction,
} from "@/server/actions/research";
import { runGrowthSynthesisAction } from "@/server/actions/intelligence";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { safeHttpUrl } from "@/lib/validation";

type Item = typeof researchItems.$inferSelect;

const STATUS_STYLE: Record<string, string> = {
  new: "bg-primary/10 text-primary",
  saved: "bg-sky-500/10 text-sky-500",
  converted: "bg-emerald-500/10 text-emerald-500",
  dismissed: "bg-muted text-muted-foreground",
};

function ScoreBar({ label, value }: { label: string; value: unknown }) {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return null;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/70" style={{ width: `${(n / 10) * 100}%` }} />
      </div>
      <span className="w-7 text-right font-medium">{n}</span>
    </div>
  );
}

function ResearchCard({
  item,
  editable,
}: {
  item: Item;
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const scores = (item.scores ?? {}) as Record<string, number>;
  const overall = scores.overall;
  // SSRF/URL-scheme guard: only http(s) links get rendered as links; anything
  // else (AI research output) degrades to plain text.
  const safeUrl = safeHttpUrl(item.sourceUrl);

  function act(fn: () => Promise<{ ok: boolean; error?: string; contentItemId?: string }>, msg: string) {
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(msg);
        router.refresh();
      } else toast.error(r.error ?? "Action failed");
    });
  }

  return (
    <Card className={cn(item.status === "dismissed" && "opacity-50")}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium leading-snug">{item.topic}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className={cn("font-medium", STATUS_STYLE[item.status] ?? "")}>
                {item.status}
              </Badge>
              <span className="capitalize">{item.category}</span>
              <span>· {item.sourceName ?? "unknown source"}</span>
            </div>
          </div>
          {typeof overall === "number" ? (
            <div className="shrink-0 text-center">
              <div className="text-xl font-semibold text-primary">{overall}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">AI-est.</div>
            </div>
          ) : null}
        </div>

        {item.summary ? (
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{item.summary}</p>
        ) : null}

        <div className="space-y-1">
          <ScoreBar label="Trend" value={scores.trend} />
          <ScoreBar label="Audience" value={scores.audience} />
          <ScoreBar label="Search" value={scores.search} />
          <ScoreBar label="Competition" value={scores.competition} />
          <ScoreBar label="Business" value={scores.business} />
          <ScoreBar label="Viral" value={scores.viral} />
          <ScoreBar label="Conversion" value={scores.conversion} />
        </div>

        {item.sourceUrl ? (
          safeUrl ? (
            <a
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary underline-offset-4 hover:underline"
            >
              <ExternalLink className="size-3" aria-hidden /> Source: {item.sourceName}
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              Source: {item.sourceName}
            </span>
          )
        ) : null}

        {editable ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" disabled={pending} onClick={() => act(() => createContentFromResearchAction(item.id), "Content created in Studio")}>
              {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <PenSquare className="size-3.5" aria-hidden />}
              Create content
            </Button>
            {item.status !== "saved" ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => setResearchStatusAction(item.id, "saved"), "Saved")}>
                Save
              </Button>
            ) : null}
            {item.status !== "dismissed" ? (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => setResearchStatusAction(item.id, "dismissed"), "Dismissed")}>
                <X className="size-3.5" aria-hidden /> Dismiss
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ResearchClient({
  items,
  aiConfigured,
  editable,
  growthPlan,
}: {
  items: Item[];
  aiConfigured: boolean;
  editable: boolean;
  growthPlan: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [niche, setNiche] = useState("");
  const [notes, setNotes] = useState("");
  const [banner, setBanner] = useState<string | null>(null);

  function run(e: React.FormEvent) {
    e.preventDefault();
    if (pending || niche.trim().length < 4) return;
    start(async () => {
      const r = await runResearchAction({ niche, notes: notes || undefined });
      if (r.ok) {
        setBanner(r.note ?? null);
        toast.success(`${r.count} opportunities found${r.sourced ? " (live web sources)" : " (AI estimates — no live sources)"}`);
        setNiche("");
        setNotes("");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  const active = items.filter((i) => i.status !== "dismissed");
  const dismissed = items.filter((i) => i.status === "dismissed");

  return (
    <div className="space-y-6">
      {!aiConfigured ? (
        <Alert>
          <Sparkles className="size-4" aria-hidden />
          <AlertTitle>Configuration required</AlertTitle>
          <AlertDescription>
            AI is not configured for this workspace — add your provider + API key in Workspace Settings to enable research. Nothing is generated or faked until then.
          </AlertDescription>
        </Alert>
      ) : null}
      {banner ? (
        <Alert>
          <Sparkles className="size-4" aria-hidden />
          <AlertTitle>Research without live sources</AlertTitle>
          <AlertDescription>{banner}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4 text-primary" aria-hidden /> Growth plan
              </CardTitle>
              <CardDescription>
                Synthesizes your research + competitor analyses + measured patterns into prioritized actions (AI-generated).
              </CardDescription>
            </div>
            {editable && aiConfigured ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => {
                start(async () => {
                  const r = await runGrowthSynthesisAction();
                  if (r.ok) { toast.success("Growth plan updated"); setBanner(null); router.refresh(); }
                  else toast.error(r.error);
                });
              }}>
                {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                Synthesize
              </Button>
            ) : null}
          </div>
        </CardHeader>
        {growthPlan ? (
          <CardContent>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{growthPlan}</div>
          </CardContent>
        ) : (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Run research and add competitors first — then synthesize a prioritized growth plan here.
            </p>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={run} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="niche">Niche, topic, or business area</Label>
              <div className="flex gap-2">
                <Input
                  id="niche"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="e.g. Canva AI tools for Pakistani students"
                  required
                  minLength={4}
                  maxLength={300}
                />
                <Button type="submit" disabled={pending || !editable || !aiConfigured}>
                  {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
                  {pending ? "Researching (~30s)…" : "Research"}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Optional focus</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="e.g. focus on budget laptops, exam season, WhatsApp study groups"
              />
            </div>
          </form>
        </CardContent>
      </Card>

      {active.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
          <Search className="size-8 text-muted-foreground" aria-hidden />
          <p className="max-w-md text-sm text-muted-foreground">
            No research yet. Enter your niche above — the agent finds topics, scores
            opportunities (clearly labeled AI estimates), and one click turns any
            topic into content in the Studio.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {active.map((item) => (
            <ResearchCard key={item.id} item={item} editable={editable} />
          ))}
        </div>
      )}

      {dismissed.length > 0 && editable ? (
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer select-none">Dismissed ({dismissed.length})</summary>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {dismissed.map((item) => (
              <ResearchCard key={item.id} item={item} editable={editable} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
