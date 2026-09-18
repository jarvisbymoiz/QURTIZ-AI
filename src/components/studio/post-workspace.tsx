"use client";
import { uploadStudioMedia } from "@/lib/media/client-upload";
import { selectSingleReviewVisual } from "@/lib/media/review";
import { orderVisuals } from "@/lib/publishing/media";

import { useEffect, useRef, useState, useTransition } from "react";
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

} from "@/server/actions/visuals";
import { scheduleContentAction } from "@/server/actions/schedule";
import {
  rejectContentAction,
  regenerateContentAction,
  setContentStatusAction,
  updateVariantCaptionAction,
  updateReviewFieldAction,
} from "@/server/actions/content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Item = typeof contentItems.$inferSelect;
type Variant = typeof contentVariants.$inferSelect;
import { MediaUploader, type UploadedMedia } from "@/components/studio/media-uploader";

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
  embedded = false,
  inline = false,
  children,
}: {
  label: string;
  copy?: string;
  actions?: React.ReactNode;
  bodyClassName?: string;
  embedded?: boolean;
  inline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0 overflow-hidden rounded-lg", !embedded && "border bg-card/40", inline && "sm:grid sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start")}>
      <div className={cn("flex items-center justify-between gap-2 px-2 py-0.5", !embedded && !inline && "border-b bg-muted/20", inline && "sm:pt-2")}>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="flex items-center gap-0.5">
          {copy ? <CopyIcon text={copy} label={label} /> : null}
          {actions}
        </div>
      </div>
      <div className={cn("min-w-0 px-2 py-1.5 text-[13px] leading-5 [overflow-wrap:anywhere]", bodyClassName)}>{children}</div>
    </div>
  );
}

function EditableReviewField({ label, value, editable, save, embedded }: {
  label: string;
  value: string;
  editable: boolean;
  save: (value: string) => Promise<{ ok: boolean; error?: string }>;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, start] = useTransition();
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  return <FieldCard label={label} copy={draft} embedded={embedded} actions={editable && !editing ? (
    <button type="button" aria-label={"Edit " + label.toLowerCase()} className="rounded p-1 text-muted-foreground hover:bg-accent" onClick={() => setEditing(true)}>
      <Pencil className="size-3" aria-hidden />
    </button>
  ) : null}>
    {editing ? <div className="space-y-2">
      <Textarea aria-label={label} value={draft} onChange={event => setDraft(event.target.value)} rows={4} disabled={pending} />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => { setDraft(value); setEditing(false); }}>Cancel</Button>
        <Button size="sm" disabled={pending} onClick={() => start(async () => {
          const result = await save(draft);
          if (!result.ok) { toast.error(result.error ?? "Could not save."); return; }
          toast.success(label + " saved"); setEditing(false); router.refresh();
        })}>{pending ? "Saving…" : "Save"}</Button>
      </div>
    </div> : <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-muted-foreground">{draft || "—"}</p>}
  </FieldCard>;
}

export function PostWorkspace({
  item,
  variants,
  visuals,
  visualUrls,
  editable,
  aiConfigured,
  timezone,
  onClose,
}: {
  item: Item;
  variants: Variant[];
  visuals: Visual[];
  visualUrls: Record<string, string | null>;
  editable: boolean;
  aiConfigured: boolean;
  /** Workspace timezone (e.g. "Asia/Karachi"); falls back to the browser's. */
  timezone?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const displayTimezone = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [pending, start] = useTransition();
  // Legacy posts can mix formats by platform. Open the format advertised by
  // the content card instead of an arbitrary database row's single-image view.
  const [activeVariantId, setActiveVariantId] = useState<string>(variants.find(v => v.format === item.format)?.id ?? variants[0]?.id ?? "");
  const variant = variants.find((v) => v.id === activeVariantId) ?? variants.find(v => v.format === item.format) ?? variants[0] ?? null;
  const canEditReview = editable && !["scheduled", "published"].includes(item.status) && !["scheduled", "published"].includes(variant?.status ?? "");
  const canEditMedia = canEditReview && ["draft", "ready_for_review", "rejected", "failed"].includes(item.status);

  const [caption, setCaption] = useState(variant?.caption ?? "");
  const [editingCaption, setEditingCaption] = useState(false);
  useEffect(() => { if (!editingCaption) setCaption(variant?.caption ?? ""); }, [variant?.caption, variant?.id, editingCaption]);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [scheduling, setScheduling] = useState(false);
  // True once the user has picked a date/time in the scheduling panel — only
  // then may the footer Schedule button book directly instead of opening the
  // panel (which would silently book tomorrow 18:30 defaults otherwise).
  const [scheduleTimeChosen, setScheduleTimeChosen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [scheduleTime, setScheduleTime] = useState("18:30");
  const [masterPrompt, setMasterPrompt] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [mediaUploading, setMediaUploading] = useState(false);

  const scores = (item.aiScores ?? {}) as Record<string, number>;
  const displayScore = (value: number) => {
    const normalized = value > 0 && value <= 1 ? value * 10 : value;
    return Number(Math.min(10, Math.max(0, normalized)).toFixed(1));
  };
  const qa = (item.qa ?? {}) as { passed?: boolean; score?: number; issues?: { severity: string; check: string; message: string }[] } | null;
  // Mirrors the server-side QA gate: a draft whose QA did not pass is NOT
  // promoted to Ready for Review when a visual is attached.
  const willPromoteOnVisual = item.status === "draft" && qa?.passed === true;
  const script = (variant?.script ?? {}) as {
    hook?: string;
    scenes?: { text?: string; voiceover?: string; visualDirection?: string; onScreenText?: string; transition?: string; durationSeconds?: number }[];
    outro?: string;
    totalDuration?: number;
  };
  const slides = (variant?.slides ?? []) as { index: number; headline?: string; visualPrompt?: string }[];
  const mediaFormat = variant?.format ?? item.format;
  const isCarousel = mediaFormat === "carousel";
  const isReel = mediaFormat === "reel";
  const latestVisual = selectSingleReviewVisual(visuals.filter(v => v.mimeType.startsWith("image/")));
  const previewUrl = latestVisual ? visualUrls[latestVisual.storagePath] ?? null : null;
  useEffect(() => { setPreviewFailed(false); }, [previewUrl]);
  // User-uploaded media, in the persisted order (slideIndex is the order key):
  // several images for a carousel / one video for a reel.
  const orderedVisuals = visuals.filter(v => v.mimeType.startsWith(isReel ? "video/" : "image/")).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.storagePath.localeCompare(b.storagePath));
  const uploads = orderedVisuals.filter(v => v.kind === "upload");
  const generatedSlides = new Map<number, Visual>();
  for (const visual of orderedVisuals) if (visual.slideIndex != null) generatedSlides.set(visual.slideIndex, visual);
  const uploadedMedia: UploadedMedia[] = orderVisuals(uploads.length ? uploads : [...generatedSlides.values()])
    .map((v, i) => ({ id: v.id, url: visualUrls[v.storagePath] ?? null, mimeType: v.mimeType, position: v.slideIndex ?? i, uploaded: v.kind === "upload" }));
  const hashtagsText = (variant?.hashtags ?? item.hashtags).map((h) => "#" + h).join(" ");



  function generate(mode: "template" | "ai", slideIndex?: number) {
    start(async () => {
      const r = await generateVisualAction(item.id, mode, slideIndex, variant?.id);
      if (r.ok) {
        toast.success(r.model && r.model !== "satori-template" ? "AI visual created (" + r.model + ")" : willPromoteOnVisual ? "Visual created — moved to Ready for Review" : "Visual created");
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
      const r = await scheduleContentAction({ itemId: item.id, dateIso: scheduleDate, timeStr: scheduleTime });
      if (r.ok) {
        toast.success("Scheduled for " + scheduleDate + " " + scheduleTime);
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
      let uploaded = 0;
      let failed = 0;
      let i = 0;
      for (const file of Array.from(files)) {


        const t = targets[i];


        const r = await uploadStudioMedia(item.id, file, t);
        if (r.ok) uploaded++;
        else {
          failed++;
          toast.error(r.error);
        }
        i++;
      }
      if (failed === 0) {
        toast.success(willPromoteOnVisual ? "Visual(s) uploaded — moved to Ready for Review" : "Visual(s) uploaded");
      } else if (uploaded === 0) {
        toast.error("Upload failed — no visual was saved.");
      } else {
        toast.error(`${failed} upload${failed === 1 ? "" : "s"} failed — ${uploaded} saved.`);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-1.5 border-b pb-1.5 pr-7">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className={cn("font-medium", STATUS_STYLE[item.status])}>
            {item.status.replaceAll("_", " ")}
          </Badge>
          <span className="text-xs capitalize text-muted-foreground">{variant?.platform ?? ""} · {variant?.format.replaceAll("_", " ") ?? item.format}</span>
          {typeof scores.overall !== "number" && scores.relevance ? (
            <span className="text-xs text-muted-foreground">Relevance {displayScore(scores.relevance)}/10 · Engagement {displayScore(scores.engagement)}/10 (AI-est.)</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isCarousel || isReel ? <Button size="sm" variant="outline" disabled={!canEditMedia || pending || mediaUploading}
            onClick={() => mediaInputRef.current?.click()}>
            <Upload className="size-3.5" aria-hidden /> {isReel ? "Upload video" : "Add images"}
          </Button> : null}
          <Button size="sm" variant="outline" disabled={pending} onClick={() => { void openMasterPrompt(); }}>
            <Wand2 className="size-3.5" aria-hidden /> Copy Master AI Prompt
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>

      {/* Body — two equal columns, no inner column scrollbars; one shared scroll only if content exceeds the dialog */}
      <div className="grid min-h-0 flex-1 grid-cols-1 content-start items-start gap-2.5 overflow-y-auto scroll-thin md:grid-cols-2 md:gap-3">
        {/* LEFT — post content */}
        <div className="min-w-0 space-y-2">
          <FieldCard label="Topic" inline bodyClassName="text-sm font-semibold leading-snug">
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
                  className={cn("rounded-full border px-2.5 py-1 text-xs capitalize", v.id === variant?.id ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}>
                  {v.platform}
                </button>
              ))}
            </div>
          ) : null}

          {Object.keys((item.internalEdits ?? {}) as object).length ? <p className="text-xs text-muted-foreground">Qurtiz-only corrections shown. The published social post remains unchanged.</p> : null}
          <FieldCard
            label="Caption"
            copy={caption}
            bodyClassName="max-h-40 scroll-thin overflow-y-auto"
            actions={canEditReview ? (
              editingCaption ? null : (
                <button type="button" aria-label="Edit caption" className="rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground" onClick={() => setEditingCaption(true)}>
                  <Pencil className="size-3" aria-hidden />
                </button>
              )
            ) : null}
          >
            {editingCaption ? (
              <div className="space-y-2">
                <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} className="scroll-thin resize-none" disabled={!editable} />
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

          <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-2">
          <FieldCard label="Hashtags" copy={hashtagsText}>
            <div className="flex flex-wrap gap-1">
              {(variant?.hashtags ?? item.hashtags).map((h) => (
                <span key={h} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">#{h}</span>
              ))}
            </div>
          </FieldCard>


          <EditableReviewField key={variant?.id + "-comment"} label="First comment" value={variant?.firstComment ?? item.firstComment ?? ""}
            editable={canEditReview && !!variant} save={value => updateReviewFieldAction(variant!.id, "firstComment", value)} />
          </div>
        </div>

        {/* RIGHT — creative: prompt, media options, preview */}
        <div className="min-w-0 space-y-2">
          <EditableReviewField label="Visual prompt" value={item.visualConcept ?? ""} editable={canEditReview && !!variant}
            save={value => updateReviewFieldAction(variant!.id, "visualConcept", value)} />

          {/* Media options */}
          <div className="flex flex-wrap items-center gap-1.5 px-0.5">
            <Button size="sm" variant="outline" disabled={pending || !editable} onClick={() => generate("template")}>
              {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Wand2 className="size-3.5" aria-hidden />} Template
            </Button>
            <Button size="sm" variant="outline" disabled={pending || !editable || !aiConfigured} onClick={() => generate("ai")}>
              <Sparkles className="size-3.5" aria-hidden /> Generate AI visual
            </Button>
            {editable && !isCarousel && !isReel ? (
              <>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                  onChange={(e) => { uploadFiles(e.target.files); e.target.value = ""; }} />
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => fileRef.current?.click()}>
                  <Upload className="size-3.5" aria-hidden /> Upload image{isCarousel ? "s" : ""}
                </Button>
              </>
            ) : null}
          </div>

          {/* Carousel (multi-image) / Reel (video) media manager */}
          <MediaUploader itemId={item.id} variantId={variant?.id} format={mediaFormat} media={uploadedMedia}
            editable={canEditMedia} uploadInputRef={mediaInputRef} onUploadBusyChange={setMediaUploading}
            lockedReason={editable ? item.status === "approved" ? "Revoke approval to change media." : "Media can be changed when this post is back in review." : "You have read-only access to this post."} />

          {/* Visual preview */}
          {!isCarousel && !isReel ? <FieldCard label="Visual preview">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Preview" onError={() => setPreviewFailed(true)} className="mx-auto max-h-[220px] sm:max-h-[240px] max-w-full rounded-lg border object-contain" />
            ) : (
              <div className="flex h-24 items-center justify-center rounded-lg border border-dashed px-3 text-center text-xs text-muted-foreground">
                {latestVisual ? "Media is saved, but the preview URL could not be loaded. Refresh to try again." : "No visual yet — generate, or upload your own."}
              </div>
            )}
            {latestVisual && !previewUrl ? <Button size="sm" variant="outline" onClick={() => router.refresh()}>Refresh preview</Button> : null}
            {previewFailed ? <div role="alert" className="text-xs text-destructive">The saved image preview could not load. <Button size="sm" variant="outline" onClick={() => router.refresh()}>Refresh preview</Button></div> : null}

          </FieldCard> : null}

          {isCarousel ? (
            <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
              <div className="col-span-full px-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Carousel slides</div>
              {slides.map((s) => {
                return (
                  <FieldCard key={s.index} label={"Slide " + s.index + (s.headline ? " — " + s.headline : "")} copy={s.visualPrompt ?? ""} bodyClassName="p-0"
                    actions={editable && aiConfigured ? (
                      <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]" disabled={pending} onClick={() => generate("ai", s.index)}>
                        <Sparkles className="size-3" aria-hidden /> Generate
                      </Button>
                    ) : null}>
                    <EditableReviewField key={variant?.id + "-slide-" + s.index} label="Visual prompt" value={s.visualPrompt ?? ""} embedded
                      editable={canEditReview && !!variant} save={value => updateReviewFieldAction(variant!.id, "slidePrompt", value, s.index)} />
                  </FieldCard>
                );
              })}
            </div>
          ) : isReel ? (
            <FieldCard label={"Reel script" + (script.totalDuration ? " (" + script.totalDuration + "s)" : "")} copy={JSON.stringify(script, null, 2)} bodyClassName="max-h-60 scroll-thin overflow-y-auto">
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
          ) : null}
        </div>
      </div>

      {/* Footer — always visible: status panels + action bar */}
      <div className="shrink-0 space-y-1.5 border-t pt-1.5">
        {rejecting ? (
          <div className="space-y-1.5 rounded-lg border border-destructive/40 p-2">
            <Label htmlFor={"rr-" + item.id}>Rejection reason (optional)</Label>
            <Input id={"rr-" + item.id} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={300} placeholder="e.g. too salesy" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
              <Button size="sm" variant="destructive" disabled={pending} onClick={reject}>Reject</Button>
            </div>
          </div>
        ) : null}
        {scheduling ? (
          <div className="grid grid-cols-1 items-end gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div className="min-w-0 space-y-1">
            <Label htmlFor={"sd-" + item.id}>Schedule date (workspace time)</Label>
            <Input id={"sd-" + item.id} type="date" value={scheduleDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => { setScheduleDate(e.target.value); setScheduleTimeChosen(true); }} />
            </div>
            <div className="min-w-0 space-y-1">
            <Label htmlFor={"st-" + item.id}>Schedule time</Label>
            <Input id={"st-" + item.id} type="time" value={scheduleTime} onChange={(e) => { setScheduleTime(e.target.value); setScheduleTimeChosen(true); }} />
            </div>
            <div className="flex justify-end gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setScheduling(false)}>Cancel</Button>
              <Button size="sm" disabled={pending} onClick={() => { setScheduleTimeChosen(true); schedule(); }}>
                <CalendarClock className="size-3.5" aria-hidden /> Schedule
              </Button>
            </div>
          </div>
        ) : null}
        {item.status === "scheduled" ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-2 text-xs text-indigo-300">
            <CalendarClock className="size-3.5" aria-hidden />
            Scheduled{item.scheduledAt ? " for " + new Intl.DateTimeFormat("en-CA", { timeZone: displayTimezone, dateStyle: "short", timeStyle: "short" }).format(new Date(item.scheduledAt)) : ""} ({displayTimezone}) — the background worker publishes automatically.
          </div>
        ) : null}
        {item.status === "failed" ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
            <AlertTriangle className="size-3.5" aria-hidden /> Generation failed — use Regenerate.
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-1.5 [&>button]:h-8 [&>button]:px-2.5 sm:[&>button]:h-7">
          {item.status === "approved" || item.status === "ready_for_review" || item.status === "rejected" ? (
            <Button size="sm" variant="outline" disabled={pending || !editable} onClick={() => { if (scheduleTimeChosen) schedule(); else setScheduling(true); }}>
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
