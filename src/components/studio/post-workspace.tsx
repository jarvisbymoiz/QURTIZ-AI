"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  CheckCheck,
  Copy,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import type { contentItems, contentVariants, visualAssets } from "@/db/schema";
import {
  generateVisualAction,
  buildMasterPromptAction,
  uploadVisualUploadAction,
} from "@/server/actions/visuals";
import { scheduleContentAction } from "@/server/actions/schedule";
import {
  rejectContentAction,
  regenerateContentAction,
  updateVariantCaptionAction,
} from "@/server/actions/content";
import { setContentStatusAction } from "@/server/actions/content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Item = typeof contentItems.$inferSelect;
type Variant = typeof contentVariants.$inferSelect;
type Visual = typeof visualAssets.$inferSelect;

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  ready_for_review: "bg-primary/10 text-primary",
  approved: "bg-emerald-500/10 text-emerald-500",
  scheduled: "bg-indigo-500/10 text-indigo-400",
  published: "bg-emerald-600/15 text-emerald-400",
  failed: "bg-destructive/10 text-destructive",
  rejected: "bg-destructive/10 text-destructive",
  archived: "bg-muted text-muted-foreground",
};

function CopyIcon({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={"Copy " + label}
      title={"Copy " + label}
      className="shrink-0 rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <CheckCheck className="size-3 text-emerald-500" aria-hidden /> : <Copy className="size-3" aria-hidden />}
    </button>
  );
}

function FieldCard({
  label,
  copy,
  actions,
  bodyClassName,
  children,
}: {
  label: string;
  copy?: string;
  actions?: React.ReactNode;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card/40">
      <div className="flex items-center justify-between border-b bg-muted/20 px-2.5 py-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="flex items-center gap-0.5">
          {copy ? <CopyIcon text={copy} label={label} /> : null}
          {actions}
        </div>
      </div>
      <div className={cn("p-2.5 text-sm leading-relaxed", bodyClassName)}>{children}</div>
    </div>
  );
}

export function PostWorkspace({
  item,
  variants,
  visuals,
  visualUrls,
  editable,
  aiConfigured,
  onClose,
}: {
  item: Item;
  variants: Variant[];
  visuals: Visual[];
  visualUrls: Record<string, string | null>;
  editable: boolean;
  aiConfigured: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [activeVariantId, setActiveVariantId] = useState<string>(variants[0]?.id ?? "");
  const variant = variants.find((v) => v.id === activeVariantId) ?? variants[0] ?? null;

  const [caption, setCaption] = useState(variant?.caption ?? "");
  const [editingCaption, setEditingCaption] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [masterPrompt, setMasterPrompt] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const scores = (item.aiScores ?? {}) as Record<string, number>;
  const qa = (item.qa ?? {}) as { passed?: boolean; score?: number; issues?: { severity: string; check: string; message: string }[] } | null;
  const script = (variant?.script ?? {}) as {
    hook?: string;
    scenes?: { text?: string; voiceover?: string; visualDirection?: string; onScreenText?: string; transition?: string; durationSeconds?: number }[];
    outro?: string;
    totalDuration?: number;
  };
  const slides = (variant?.slides ?? []) as { index: number; headline?: string; visualPrompt?: string }[];
  const isCarousel = variant?.format === "carousel" && slides.length > 0;
  const isReel = variant?.format === "reel";
  const itemVisuals = visuals.filter((v) => v.slideIndex === null || v.slideIndex === undefined);
  const latestVisual = itemVisuals.length > 0 ? itemVisuals[itemVisuals.length - 1] : null;
  const previewUrl = latestVisual ? visualUrls[latestVisual.storagePath] ?? null : null;
  const hashtagsText = (variant?.hashtags?.length ? variant.hashtags : item.hashtags).map((h) => "#" + h).join(" ");



  function generate(mode: "template" | "ai", slideIndex?: number) {
    start(async () => {
      const r = await generateVisualAction(item.id, mode, slideIndex);
      if (r.ok) {
        toast.success(r.model && r.model !== "satori-template" ? "AI visual created (" + r.model + ")" : "Visual created — moved to Ready for Review");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function approve() {
    start(async () => {
      const r = await setContentStatusAction(item.id, "approved");
      if (r.ok) {
        toast.success("Approved");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function reject() {
    start(async () => {
      const r = await rejectContentAction(item.id, rejectReason || undefined);
      if (r.ok) {
        toast.success("Rejected");
        setRejecting(false);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function regenerate() {
    start(async () => {
      const r = await regenerateContentAction(item.id);
      if (r.ok) {
        toast.success("Regenerated — new version created");
        onClose();
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function schedule() {
    start(async () => {
      const r = await scheduleContentAction({ itemId: item.id, dateIso: scheduleDate, timeStr: "18:30" });
      if (r.ok) {
        toast.success("Scheduled for " + scheduleDate + " 18:30");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  async function openMasterPrompt() {
    const r = await buildMasterPromptAction(item.id, variant?.id);
    if (r.ok) setMasterPrompt(r.prompt);
    else toast.error(r.error);
  }

  function uploadFiles(files: FileList | null, slideIndex?: number) {
    if (!files || files.length === 0) return;
    start(async () => {
      const targets: (number | undefined)[] = [];
      if (slideIndex !== undefined) {
        targets.push(slideIndex);
      } else if (isCarousel && slides.length > 0) {
        // assign files to slides in order (cycling if more files than slides)
        for (let i = 0; i < files.length; i++) {
          const s = slides[i % slides.length];
          targets.push(s.index);
        }
      } else {
        targets.push(undefined);
      }
      let i = 0;
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("itemId", item.id);
        const t = targets[i];
        if (t !== undefined) fd.set("slideIndex", String(t));
        fd.set("file", file);
        const r = await uploadVisualUploadAction(fd);
        if (!r.ok) toast.error(r.error);
        i++;
      }
      toast.success("Visual(s) uploaded — moved to Ready for Review");
      router.refresh();
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className={cn("font-medium", STATUS_STYLE[item.status])}>
            {item.status.replaceAll("_", " ")}
          </Badge>
          <span className="text-xs capitalize text-muted-foreground">{variant?.platform ?? ""} · {variant?.format.replaceAll("_", " ") ?? item.format}</span>
          {typeof scores.overall !== "number" && scores.relevance ? (
            <span className="text-xs text-muted-foreground">Relevance {scores.relevance}/10 · Engagement {scores.engagement}/10 (AI-est.)</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={pending} onClick={() => { void openMasterPrompt(); }}>
            <Wand2 className="size-3.5" aria-hidden /> Copy Master AI Prompt
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>

      {/* Body — two equal columns, no inner column scrollbars; one shared scroll only if content exceeds the dialog */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto scroll-thin lg:grid-cols-2">
        {/* LEFT — post content */}
        <div className="space-y-2.5">
          <FieldCard label="Topic" bodyClassName="text-sm font-semibold leading-snug">
            {item.topic}
            {item.hook ? <p className="mt-1 text-xs font-normal text-muted-foreground">Hook: {item.hook}</p> : null}
          </FieldCard>

          {qa && typeof qa.score === "number" ? (
            <div className="flex flex-wrap items-center gap-2 px-0.5 text-xs">
              <span className="font-medium text-muted-foreground">QA</span>
              <Badge variant={qa.passed ? "secondary" : "destructive"} className={cn(qa.passed && "bg-emerald-500/10 text-emerald-500")}>
                {qa.score}/100 {qa.passed ? "· passed" : "· needs attention"}
              </Badge>
              {(qa?.issues ?? []).map((iss, i) => (
                <span key={i} className={cn("text-[11px]", iss.severity === "error" ? "text-destructive" : "text-amber-500")}>• {iss.message}</span>
              ))}
            </div>
          ) : null}

          {variants.length > 1 ? (
            <div className="flex flex-wrap gap-1.5 px-0.5">
              {variants.map((v) => (
                <button key={v.id} type="button" onClick={() => { setActiveVariantId(v.id); setCaption(v.caption); }}
                  className={cn("rounded-full border px-2.5 py-1 text-xs capitalize", v.id === activeVariantId ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}>
                  {v.platform}
                </button>
              ))}
            </div>
          ) : null}

          <FieldCard
            label="Caption"
            copy={caption}
            bodyClassName="max-h-40 scroll-thin overflow-y-auto"
            actions={editable ? (
              editingCaption ? null : (
                <button type="button" aria-label="Edit caption" className="rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground" onClick={() => setEditingCaption(true)}>
                  <Pencil className="size-3" aria-hidden />
                </button>
              )
            ) : null}
          >
            {editingCaption ? (
              <div className="space-y-2">
                <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={5} className="scroll-thin resize-none" disabled={!editable} />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setCaption(variant?.caption ?? ""); setEditingCaption(false); }}>Cancel</Button>
                  <Button size="sm" disabled={pending} onClick={() => { if (variant) { start(async () => { const r = await updateVariantCaptionAction(variant.id, caption); if (r.ok) { toast.success("Caption saved"); router.refresh(); setEditingCaption(false); } else toast.error(r.error); }); } }}>
                    {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null} Save
                  </Button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{caption || "—"}</p>
            )}
          </FieldCard>

          <FieldCard label="Hashtags" copy={hashtagsText}>
            <div className="flex flex-wrap gap-1">
              {(variant?.hashtags?.length ? variant.hashtags : item.hashtags).map((h) => (
                <span key={h} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">#{h}</span>
              ))}
            </div>
          </FieldCard>

          <FieldCard label="CTA" copy={(variant?.cta ?? item.cta) ?? ""} bodyClassName="max-h-24 scroll-thin overflow-y-auto">
            <p className="whitespace-pre-wrap">{variant?.cta ?? item.cta ?? "—"}</p>
          </FieldCard>

          <FieldCard label="First comment" copy={(item.firstComment ?? variant?.firstComment) ?? ""} bodyClassName="max-h-28 scroll-thin overflow-y-auto">
            <p className="whitespace-pre-wrap">{item.firstComment ?? variant?.firstComment ?? "—"}</p>
          </FieldCard>
        </div>

        {/* RIGHT — creative: prompt, media options, preview */}
        <div className="space-y-2.5">
          {isCarousel ? (
            <div className="space-y-2">
              <div className="px-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Carousel slides</div>
              {slides.map((s) => {
                const sv = visuals.filter((v) => v.slideIndex === s.index);
                const url = sv.length > 0 ? visualUrls[sv[sv.length - 1].storagePath] ?? null : null;
                return (
                  <FieldCard key={s.index} label={"Slide " + s.index + (s.headline ? " — " + s.headline : "")} copy={s.visualPrompt ?? ""}
                    actions={editable && aiConfigured ? (
                      <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]" disabled={pending} onClick={() => generate("ai", s.index)}>
                        <Sparkles className="size-3" aria-hidden /> Generate
                      </Button>
                    ) : null}>
                    {s.visualPrompt ? <p className="mb-2 max-h-24 scroll-thin overflow-y-auto whitespace-pre-wrap text-xs text-muted-foreground">{s.visualPrompt}</p> : null}
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={"Slide " + s.index} className="max-h-44 rounded-md border object-contain" />
                    ) : null}
                  </FieldCard>
                );
              })}
            </div>
          ) : isReel ? (
            <FieldCard label={"Reel script" + (script.totalDuration ? " (" + script.totalDuration + "s)" : "")} copy={JSON.stringify(script, null, 2)} bodyClassName="max-h-72 scroll-thin overflow-y-auto">
              {script.hook ? <p className="text-xs"><span className="font-medium">0-5s Hook:</span> {script.hook}</p> : null}
              {(script.scenes ?? []).map((s, i) => {
                const sceneStart = 5 + i * Math.round(((script.totalDuration ?? 30) - 10) / Math.max((script.scenes ?? []).length, 1));
                return (
                  <div key={i} className="mt-1.5 rounded-md bg-muted/40 p-2 text-xs">
                    <div className="font-medium">{sceneStart}s - Scene {i + 1}</div>
                    {s.voiceover || s.text ? <p>VO: {s.voiceover || s.text}</p> : null}
                    {s.visualDirection ? <p className="text-muted-foreground">Visual: {s.visualDirection}</p> : null}
                    {s.onScreenText ? <p className="text-muted-foreground">On-screen: &ldquo;{s.onScreenText}&rdquo;</p> : null}
                    {s.transition ? <p className="text-muted-foreground">Transition: {s.transition}</p> : null}
                  </div>
                );
              })}
              {script.outro ? <p className="mt-1.5 text-xs text-muted-foreground">Outro: {script.outro}</p> : null}
            </FieldCard>
          ) : (
            <FieldCard label="Visual prompt" copy={item.visualConcept ?? ""} bodyClassName="max-h-40 scroll-thin overflow-y-auto">
              <p className="whitespace-pre-wrap text-muted-foreground">{item.visualConcept ?? "—"}</p>
            </FieldCard>
          )}

          {/* Media options */}
          <div className="flex flex-wrap gap-2 px-0.5">
            <Button size="sm" variant="outline" disabled={pending || !editable} onClick={() => generate("template")}>
              {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Wand2 className="size-3.5" aria-hidden />} Template
            </Button>
            <Button size="sm" variant="outline" disabled={pending || !editable || !aiConfigured} onClick={() => generate("ai")}>
              <Sparkles className="size-3.5" aria-hidden /> Generate AI visual
            </Button>
            {editable ? (
              <>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple={isCarousel} className="hidden"
                  onChange={(e) => { uploadFiles(e.target.files); e.target.value = ""; }} />
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => fileRef.current?.click()}>
                  <Upload className="size-3.5" aria-hidden /> Upload image{isCarousel ? "s" : ""}
                </Button>
              </>
            ) : null}
          </div>

          {/* Visual preview */}
          <FieldCard label="Visual preview">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Preview" className="mx-auto max-h-[320px] rounded-lg border object-contain" />
            ) : (
              <div className="flex h-44 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                No visual yet — generate, or upload your own.
              </div>
            )}
            {isCarousel && slides.length > 0 ? (
              <div className="mt-2 flex gap-2 overflow-x-auto scroll-thin">
                {slides.map((s) => {
                  const sv = visuals.filter((v) => v.slideIndex === s.index);
                  const url = sv.length > 0 ? visualUrls[sv[sv.length - 1].storagePath] ?? null : null;
                  return url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={s.index} src={url} alt={"Slide " + s.index} className="h-24 rounded-md border object-contain" />
                  ) : (
                    <div key={s.index} className="flex h-24 w-20 items-center justify-center rounded-md border border-dashed text-[10px] text-muted-foreground">S{s.index}</div>
                  );
                })}
              </div>
            ) : null}
          </FieldCard>
        </div>
      </div>

      {/* Footer — always visible: status panels + action bar */}
      <div className="space-y-2 border-t pt-2">
        {rejecting ? (
          <div className="space-y-2 rounded-lg border border-destructive/40 p-3">
            <Label htmlFor={"rr-" + item.id}>Rejection reason (optional)</Label>
            <Input id={"rr-" + item.id} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={300} placeholder="e.g. too salesy" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
              <Button size="sm" variant="destructive" disabled={pending} onClick={reject}>Reject</Button>
            </div>
          </div>
        ) : null}
        {scheduling ? (
          <div className="space-y-2 rounded-lg border p-3">
            <Label htmlFor={"sd-" + item.id}>Schedule date (18:30, workspace time)</Label>
            <Input id={"sd-" + item.id} type="date" value={scheduleDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setScheduleDate(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setScheduling(false)}>Cancel</Button>
              <Button size="sm" disabled={pending} onClick={schedule}>
                <CalendarClock className="size-3.5" aria-hidden /> Schedule
              </Button>
            </div>
          </div>
        ) : null}
        {item.status === "scheduled" ? (
          <div className="flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-2.5 text-xs text-indigo-300">
            <CalendarClock className="size-3.5" aria-hidden />
            Scheduled{item.scheduledAt ? " for " + new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", dateStyle: "short", timeStyle: "short" }).format(new Date(item.scheduledAt)) : ""} — the background worker publishes automatically.
          </div>
        ) : null}
        {item.status === "failed" ? (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-destructive">
            <AlertTriangle className="size-3.5" aria-hidden /> Generation failed — use Regenerate.
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {item.status === "approved" || item.status === "ready_for_review" || item.status === "rejected" ? (
            <Button size="sm" variant="outline" disabled={pending || !editable} onClick={schedule}>
              <CalendarClock className="size-3.5" aria-hidden /> Schedule
            </Button>
          ) : null}
          {item.status !== "approved" ? (
            <Button size="sm" disabled={pending || !editable} onClick={approve}>
              <CheckCheck className="size-3.5" aria-hidden /> Approve
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled={pending || !editable} onClick={() => start(async () => { const r = await setContentStatusAction(item.id, "ready_for_review"); if (r.ok) { toast.success("Back to review"); router.refresh(); } else toast.error(r.error); })}>
              Revoke approval
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={pending || !editable} onClick={() => { setRejecting(true); setRejectReason(""); }}>
            <ThumbsDown className="size-3.5" aria-hidden /> Reject
          </Button>
          {editable ? (
            <Button size="sm" variant="ghost" disabled={pending} onClick={regenerate}>
              <RefreshCw className="size-3.5" aria-hidden /> Regenerate
            </Button>
          ) : null}
          {editable ? (
            <Button size="icon" variant="ghost" aria-label="Delete post" disabled={pending}
              onClick={() => start(async () => {
                const r = await setContentStatusAction(item.id, "archived");
                if (r.ok) { toast.success("Archived"); onClose(); router.refresh(); } else toast.error(r.error);
              })}>
              <Trash2 className="size-3.5 text-destructive" aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Master prompt dialog */}
      <Dialog open={masterPrompt !== null} onOpenChange={(o) => !o && setMasterPrompt(null)}>
        <DialogContent className="max-h-[85dvh] max-w-3xl overflow-y-auto scroll-thin">
          <DialogHeader>
            <DialogTitle>Master AI prompt (external tools)</DialogTitle>
          </DialogHeader>
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={async () => { if (masterPrompt) { await navigator.clipboard.writeText(masterPrompt); toast.success("Master prompt copied"); } }}>
              Copy prompt
            </Button>
          </div>
          <pre className="scroll-thin max-h-[55dvh] whitespace-pre-wrap overflow-y-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed">{masterPrompt}</pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
