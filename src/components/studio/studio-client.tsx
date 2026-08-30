"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import type { contentItems, contentPillars, contentVariants, visualAssets } from "@/db/schema";
import { generateVisualAction } from "@/server/actions/visuals";
import {
  createContentAction,
  deleteContentAction,
  setContentStatusAction,
  updateVariantCaptionAction,
} from "@/server/actions/content";
import { bulkApproveReadyAction } from "@/server/actions/schedule";
import { BulkPlanDialog } from "@/components/studio/bulk-plan-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Item = typeof contentItems.$inferSelect;
type Variant = typeof contentVariants.$inferSelect;
type Pillar = typeof contentPillars.$inferSelect;
type Visual = typeof visualAssets.$inferSelect;

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  generating: "bg-sky-500/10 text-sky-500",
  ready_for_review: "bg-primary/10 text-primary",
  approved: "bg-emerald-500/10 text-emerald-500",
  scheduled: "bg-indigo-500/10 text-indigo-400",
  published: "bg-emerald-600/15 text-emerald-400",
  failed: "bg-destructive/10 text-destructive",
  archived: "bg-muted text-muted-foreground",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={cn("font-medium", STATUS_STYLE[status])}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

function ScoreChip({ label, value }: { label: string; value: unknown }) {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n) || n <= 0) return null;
  return (
    <span className="text-xs text-muted-foreground">
      {label} <span className="font-medium text-foreground">{n}/10</span>
      <span className="ml-1 text-[10px] uppercase tracking-wide">(AI-est.)</span>
    </span>
  );
}

function QaPanel({ qa }: { qa: unknown }) {
  const data = qa as { passed?: boolean; score?: number; issues?: { severity: string; check: string; message: string }[] } | null;
  if (!data || typeof data.score !== "number") return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">QA</span>
        <Badge variant={data.passed ? "secondary" : "destructive"} className={cn(!data.passed && "", data.passed && "bg-emerald-500/10 text-emerald-500")}>
          {data.score}/100 {data.passed ? "· passed" : "· needs attention"}
        </Badge>
      </div>
      {(data.issues ?? []).map((i, idx) => (
        <p key={idx} className={cn("text-xs", i.severity === "error" ? "text-destructive" : "text-amber-500")}>
          • {i.message}
        </p>
      ))}
    </div>
  );
}

function NewPostDialog({ pillars, editable }: { pillars: Pillar[]; editable: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [topic, setTopic] = useState("");
  const [objective, setObjective] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["facebook", "instagram"]);
  const [format, setFormat] = useState<string>("single_image");
  const [pillarId, setPillarId] = useState<string>(pillars[0]?.id ?? "");

  function togglePlatform(p: string) {
    setPlatforms((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || platforms.length === 0) return;
    start(async () => {
      const result = await createContentAction({
        topic,
        objective: objective || undefined,
        platforms: platforms as ("facebook" | "instagram")[],
        preferredFormat: format as "single_image",
      });
      if (result.ok) {
        toast.success(`Content created — QA ${result.qaScore}/100`);
        setOpen(false);
        setTopic("");
        setObjective("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button disabled={!editable} />}>
        <Plus className="size-4" aria-hidden /> New post
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate a post</DialogTitle>
          <DialogDescription>
            The agent writes copy adapted per platform, checks it against your Brand
            Brain rules, and saves it as Ready for Review. Nothing is published.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="topic">Topic</Label>
            <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. 5 Canva AI features students don't know" required minLength={4} maxLength={500} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="objective">Objective (optional)</Label>
            <Input id="objective" value={objective} onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g. Drive WhatsApp signups" maxLength={300} />
          </div>
          <div className="space-y-2">
            <Label>Platforms</Label>
            <div className="flex gap-2">
              {["facebook", "instagram"].map((p) => (
                <button key={p} type="button" aria-pressed={platforms.includes(p)}
                  onClick={() => togglePlatform(p)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm capitalize transition-colors",
                    platforms.includes(p)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="format">Format</Label>
              <select id="format" value={format} onChange={(e) => setFormat(e.target.value)}
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <option value="single_image">Single image</option>
                <option value="carousel">Carousel</option>
                <option value="reel">Reel</option>
                <option value="text_post">Text post</option>
              </select>
            </div>
            {pillars.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="pillar">Pillar (informational)</Label>
                <select id="pillar" value={pillarId} onChange={(e) => setPillarId(e.target.value)}
                  className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  <option value="">—</option>
                  {pillars.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={pending || platforms.length === 0 || topic.trim().length < 4}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Wand2 className="size-4" aria-hidden />}
            {pending ? "Generating (up to ~30s)…" : "Generate"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ItemCard({
  item,
  variants,
  visuals,
  visualUrls,
  editable,
  aiConfigured,
}: {
  item: Item;
  variants: Variant[];
  visuals: Visual[];
  visualUrls: Record<string, string | null>;
  editable: boolean;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const scores = item.aiScores as { relevance?: number; engagement?: number } | null;

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, successMsg: string) {
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(successMsg);
        router.refresh();
      } else {
        toast.error(r.error ?? "Action failed");
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <button type="button" className="text-left" onClick={() => setOpen(true)}>
            <div className="font-medium hover:underline">{item.topic}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <StatusBadge status={item.status} />
              <span className="capitalize">{item.format.replaceAll("_", " ")}</span>
              {item.createdAt ? <span>· {new Date(item.createdAt).toLocaleDateString()}</span> : null}
            </div>
          </button>
          {editable ? (
            <Button size="icon" variant="ghost" aria-label="Delete content"
              onClick={() => act(() => deleteContentAction(item.id), "Deleted")} disabled={pending}>
              <Trash2 className="size-4 text-destructive" aria-hidden />
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ScoreChip label="Relevance" value={scores?.relevance} />
          <ScoreChip label="Engagement" value={scores?.engagement} />
        </div>
        <QaPanel qa={item.qa} />
        {open ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-h-[88dvh] w-full max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{item.topic}</DialogTitle>
                <DialogDescription>
                  Hook: {item.hook} · CTA: {item.cta}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <QaPanel qa={item.qa} />
                <Tabs defaultValue={variants[0]?.id ?? "none"}>
                  <TabsList>
                    {variants.map((v) => (
                      <TabsTrigger key={v.id} value={v.id}>
                        {v.platform} · {v.format.replaceAll("_", " ")}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {variants.map((v) => (
                    <TabsContent key={v.id} value={v.id} className="space-y-3">
                      <VariantEditor variant={v} editable={editable} />
                    </TabsContent>
                  ))}
                  {variants.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No variants stored.</p>
                  ) : null}
                </Tabs>
                <VisualSection itemId={item.id} visuals={visuals} visualUrls={visualUrls} editable={editable} aiConfigured={aiConfigured} />
                <div className="flex flex-wrap justify-end gap-2">
                  {item.status !== "approved" ? (
                    <Button variant="outline" disabled={pending || !editable}
                      onClick={() => act(() => setContentStatusAction(item.id, "approved"), "Approved")}>
                      Approve
                    </Button>
                  ) : (
                    <Button variant="outline" disabled={pending || !editable}
                      onClick={() => act(() => setContentStatusAction(item.id, "ready_for_review"), "Back to review")}>
                      Revoke approval
                    </Button>
                  )}
                  <Button variant="ghost" disabled={pending || !editable}
                    onClick={() => act(() => setContentStatusAction(item.id, "archived"), "Archived")}>
                    Archive
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </CardContent>
    </Card>
  );
}

function VariantEditor({ variant, editable }: { variant: Variant; editable: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [caption, setCaption] = useState(variant.caption);
  const script = variant.script as {
    hook?: string;
    scenes?: { text: string; onScreenText?: string; durationSeconds?: number }[];
    outro?: string;
  } | null;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`cap-${variant.id}`}>Caption ({variant.platform})</Label>
        <Textarea id={`cap-${variant.id}`} value={caption} onChange={(e) => setCaption(e.target.value)}
          rows={6} disabled={!editable} />
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {variant.hashtags.map((h) => (
              <span key={h} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">#{h}</span>
            ))}
          </div>
          <Button size="sm" variant="outline" disabled={pending || !editable || caption === variant.caption}
            onClick={() =>
              start(async () => {
                const r = await updateVariantCaptionAction(variant.id, caption);
                if (r.ok) { toast.success("Caption saved"); router.refresh(); }
                else toast.error(r.error);
              })
            }>
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            Save caption
          </Button>
        </div>
      </div>
      {variant.cta ? <p className="text-sm"><span className="font-medium">CTA:</span> {variant.cta}</p> : null}
      {script && (script.scenes?.length || script.hook) ? (
        <div className="space-y-1.5 rounded-lg border p-3">
          <p className="text-sm font-medium">Reel script</p>
          {script.hook ? <p className="text-xs text-muted-foreground">Hook: {script.hook}</p> : null}
          {(script.scenes ?? []).map((s, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              {i + 1}. {s.text} {s.onScreenText ? `· on-screen: "${s.onScreenText}"` : ""}
            </p>
          ))}
          {script.outro ? <p className="text-xs text-muted-foreground">Outro: {script.outro}</p> : null}
        </div>
      ) : null}
      <QaPanel qa={variant.qa} />
    </div>
  );
}

export function StudioClient({
  items,
  variants,
  pillars,
  visuals,
  visualUrls,
  aiConfigured,
  editable,
}: {
  items: Item[];
  variants: Variant[];
  pillars: Pillar[];
  visuals: Visual[];
  visualUrls: Record<string, string | null>;
  aiConfigured: boolean;
  editable: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const filtered = useMemo(
    () => (statusFilter === "all" ? items : items.filter((i) => i.status === statusFilter)),
    [items, statusFilter],
  );
  const readyCount = items.filter((i) => i.status === "ready_for_review").length;

  const byItem = useMemo(() => {
    const map = new Map<string, Variant[]>();
    for (const v of variants) {
      const list = map.get(v.contentItemId) ?? [];
      list.push(v);
      map.set(v.contentItemId, list);
    }
    return map;
  }, [variants]);

  return (
    <div className="space-y-4">
      {!aiConfigured ? (
        <Alert>
          <Sparkles className="size-4" aria-hidden />
          <AlertTitle>Configuration required</AlertTitle>
          <AlertDescription>
            Add GEMINI_API_KEY to .env.local to enable generation. Nothing will be
            generated or faked until the key is present.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {["all", "ready_for_review", "approved", "scheduled", "published", "draft"].map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                statusFilter === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "ready_for_review" ? `Ready for review (${readyCount})` : s.replaceAll("_", " ")}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {readyCount > 0 && editable ? (
            <BulkApproveButton />
          ) : null}
          <BulkPlanDialog editable={editable} aiConfigured={aiConfigured} />
          <NewPostDialog pillars={pillars} editable={editable && aiConfigured} />
        </div>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
          <Sparkles className="size-8 text-muted-foreground" aria-hidden />
          <p className="max-w-md text-sm text-muted-foreground">
            No content yet. Generate your first post — the agent writes, adapts per
            platform, and QA-checks it against your Brand Brain.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              variants={byItem.get(item.id) ?? []}
              visuals={visuals.filter((v) => v.contentItemId === item.id)}
              visualUrls={visualUrls}
              editable={editable}
              aiConfigured={aiConfigured}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VisualSection({
  itemId,
  visuals,
  visualUrls,
  editable,
  aiConfigured,
}: {
  itemId: string;
  visuals: Visual[];
  visualUrls: Record<string, string | null>;
  editable: boolean;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function generate(mode: "template" | "ai") {
    start(async () => {
      const r = await generateVisualAction(itemId, mode);
      if (r.ok) {
        toast.success(r.model && r.model !== "satori-template" ? `AI visual created (${r.model})` : "Template visual created");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Visual</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={pending || !editable}
            onClick={() => generate("template")}>
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Wand2 className="size-3.5" aria-hidden />}
            Template
          </Button>
          <Button size="sm" variant="ghost" disabled={pending || !editable || !aiConfigured}
            onClick={() => generate("ai")}>
            AI photo
          </Button>
        </div>
      </div>
      {visuals.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {visuals.map((v) => {
            const url = visualUrls[v.storagePath];
            return url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={v.id} src={url} alt={v.kind} className="max-h-64 rounded-lg border object-contain" />
            ) : (
              <div key={v.id} className="h-32 w-32 rounded-lg border bg-muted" />
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No visual yet. Template = free, brand-safe graphic with your logo. AI photo = photographic image
          with your avatar/style references (requires paid AI billing).
        </p>
      )}
    </div>
  );
}

function BulkApproveButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await bulkApproveReadyAction();
          if (r.ok) {
            toast.success(`Approved ${r.count ?? 0} posts`);
            router.refresh();
          } else toast.error(r.error);
        })
      }
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
      Approve all ready
    </Button>
  );
}

