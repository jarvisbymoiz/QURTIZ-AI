"use client";
import { uploadStudioMedia } from "@/lib/media/client-upload";

import { useEffect, useRef, useState, useTransition, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Loader2, Trash2, Upload, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  removeVisualUploadAction,
  reorderVisualUploadsAction,

} from "@/server/actions/visuals";

export type UploadedMedia = {
  id: string;
  url: string | null;
  mimeType: string;
  position: number;
  uploaded?: boolean;
};

/**
 * Carousel / Reel media manager.
 *
 * - Carousel: uploads several images in one go (sequentially, so progress and
 *   per-file failures are visible), and previews ONE image at a time with
 *   subtle edge arrows plus a small `i / N` indicator. Individual images can be
 *   removed or moved left/right without affecting the others.
 * - Reel: uploads a video and previews it with the browser's native controls.
 *
 * A media item only appears once storage confirmed it (the server action
 * returns per-file results); nothing is optimistically shown as uploaded.
 */
export function MediaUploader({
  itemId,
  format,
  media,
  editable,
  variantId,
  lockedReason,
  uploadInputRef,
  onUploadBusyChange,
}: {
  itemId: string;
  format: string | null;
  media: UploadedMedia[];
  editable: boolean;
  variantId?: string;
  lockedReason?: string;
  uploadInputRef?: RefObject<HTMLInputElement | null>;
  onUploadBusyChange?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<File[]>([]);
  const [previewFailed, setPreviewFailed] = useState(false);
  const cancelRef = useRef(false);
  const uploadingRef = useRef(false);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const isCarousel = format === "carousel";
  const isReel = format === "reel";
  const inputRef = uploadInputRef ?? (isReel ? videoRef : imageRef);
  const list = media.filter(m => m.mimeType.startsWith(isReel ? "video/" : "image/"));
  const safeIndex = list.length === 0 ? 0 : Math.min(index, list.length - 1);
  const current = list[safeIndex] ?? null;
  const activeUrl = current?.url;
  useEffect(() => { setPreviewFailed(false); }, [activeUrl]);
  useEffect(() => () => { cancelRef.current = true; }, []);
  if (!isCarousel && !isReel) return null;

  async function uploadAll(files: File[]) {
    if (!editable || files.length === 0 || uploadingRef.current || pending) return;
    const allowed = isReel ? ["video/mp4", "video/quicktime", "video/webm"] : ["image/png", "image/jpeg", "image/webp"];
    const invalid = files.find(file => !allowed.includes(file.type) || file.size === 0 || file.size > (isReel ? 50 : 9) * 1024 * 1024);
    if (invalid) { toast.error(isReel ? "Use MP4, MOV or WebM videos up to 50MB." : "Use PNG, JPEG or WebP images up to 9MB."); return; }
    if (files.length + list.filter(m => m.uploaded !== false).length > (isReel ? 1 : 10)) {
      toast.error(isReel ? "Remove the current video before uploading another." : "A carousel supports up to 10 images. Remove an image or select fewer files."); return;
    }
    uploadingRef.current = true;
    onUploadBusyChange?.(true);
    cancelRef.current = false;
    setFailed([]);
    setProgress({ done: 0, total: files.length });
    const failures: File[] = [];
    for (let i = 0; i < files.length; i++) {
      if (cancelRef.current) {
        failures.push(...files.slice(i));
        break;
      }



      try {
      const r = await uploadStudioMedia(itemId, files[i], undefined, variantId);
      if (!r.ok) {
        failures.push(...files.slice(i));
        toast.error(r.error);
        break;
      } else if (r.failures.length > 0 || r.uploaded.length === 0) {
        failures.push(...files.slice(i));
        toast.error(r.failures[0]?.error ?? "The file was not saved.");
        break;
      }
      router.refresh();
      } catch (error) {
        failures.push(...files.slice(i));
        toast.error(error instanceof Error ? error.message : "Upload interrupted. Retry this file.");
        break;
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setProgress(null);
    uploadingRef.current = false;
    onUploadBusyChange?.(false);
    setFailed(failures);
    if (cancelRef.current) {
      toast.info("Upload stopped. Saved files are kept; remaining files can be retried.");
    } else if (failures.length === 0) {
      toast.success(files.length === 1 ? "Media uploaded" : files.length + " media uploaded");
    } else if (failures.length < files.length) {
      toast.error((files.length - failures.length) + " saved; " + failures.length + " remaining. Retry to continue.");
    } else {
      toast.error("Upload failed - nothing was saved.");
    }
    router.refresh();
  }

  function remove(mediaId: string) {
    start(async () => {
      const r = await removeVisualUploadAction(mediaId);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success("Removed");
      if (safeIndex > 0 && safeIndex >= list.length - 1) setIndex(safeIndex - 1);
      router.refresh();
    });
  }

  function move(direction: -1 | 1) {
    const to = safeIndex + direction;
    if (to < 0 || to >= list.length) return;
    const ids = list.map((m) => m.id);
    const [moved] = ids.splice(safeIndex, 1);
    ids.splice(to, 0, moved);
    start(async () => {
      const r = await reorderVisualUploadsAction(itemId, ids, "image/");
      if (!r.ok) { toast.error(r.error); return; }
      setIndex(to);
      router.refresh();
    });
  }

  return (
    <div className="min-w-0 space-y-1.5 px-0.5">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {isReel ? "Reel video" : "Carousel media"}
        </span>
        {(
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              ref={inputRef}
              type="file"
              accept={isReel ? "video/mp4,video/quicktime,video/webm" : "image/png,image/jpeg,image/webp"}
              multiple={isCarousel}
              disabled={!editable}
              aria-label={isReel ? "Upload Reel video" : "Upload Carousel images"}
              className="hidden"
              onChange={(e) => { const fs = e.target.files ? Array.from(e.target.files) : []; e.target.value = ""; void uploadAll(fs); }}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!editable || pending || progress !== null}
              onClick={() => inputRef.current?.click()}
            >
              {progress ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : isReel ? <Video className="size-3.5" aria-hidden /> : <Upload className="size-3.5" aria-hidden />}
              {progress ? progress.done + " / " + progress.total : isReel ? "Upload video" : "Add images"}
            </Button>
            {progress ? (
              <Button size="sm" variant="ghost" onClick={() => { cancelRef.current = true; }}>Stop after current file</Button>
            ) : failed.length > 0 ? (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => void uploadAll(failed)}>
                Retry {failed.length} remaining
              </Button>
            ) : null}
          </div>
        )}
      </div>
      {!editable && lockedReason ? <p className="text-xs text-muted-foreground">{lockedReason}</p> : null}

      {current ? (
        <div className="relative overflow-hidden rounded-lg border">
          {!current.url ? <div className="flex h-24 items-center justify-center px-3 text-center text-xs text-muted-foreground">Media is saved, but its preview URL could not be loaded. Refresh to try again.</div> : current.mimeType.startsWith("video/") ? (
            <video src={current.url} controls playsInline preload="metadata" onError={() => setPreviewFailed(true)} className="mx-auto max-h-[220px] sm:max-h-[240px] w-full bg-black object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.url} alt={"Media " + (safeIndex + 1)} onError={() => setPreviewFailed(true)} className="mx-auto max-h-[220px] sm:max-h-[240px] max-w-full object-contain" />
          )}

          {list.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous image"
                disabled={safeIndex === 0}
                onClick={() => setIndex(safeIndex - 1)}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full border bg-background/80 p-1.5 text-foreground opacity-70 transition hover:opacity-100 disabled:opacity-20"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Next image"
                disabled={safeIndex === list.length - 1}
                onClick={() => setIndex(safeIndex + 1)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full border bg-background/80 p-1.5 text-foreground opacity-70 transition hover:opacity-100 disabled:opacity-20"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
              <span className="absolute bottom-1.5 right-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                {safeIndex + 1} / {list.length}
              </span>
            </>
          ) : null}
        </div>
      ) : (
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed px-3 text-center text-xs text-muted-foreground">
          {current ? "Media is saved, but its preview URL could not be loaded. Refresh to try again." : isReel ? "No video yet - upload an MP4 or MOV." : "No carousel images yet - add one or more images."}
        </div>
      )}
      {previewFailed ? <div role="alert" className="text-xs text-destructive">The saved media preview could not load. <Button size="sm" variant="outline" onClick={() => router.refresh()}>Refresh preview</Button></div> : null}
      {current && !current.url ? <Button size="sm" variant="outline" onClick={() => router.refresh()}>Refresh preview</Button> : null}

      {editable && current && current.uploaded !== false ? (
        <div className="flex flex-wrap items-center justify-end gap-1">
          {list.length > 1 ? (
            <>
              <Button size="sm" variant="ghost" disabled={pending || progress !== null || safeIndex === 0} onClick={() => move(-1)}>
                <ArrowLeft className="size-3.5" aria-hidden /> Move left
              </Button>
              <Button size="sm" variant="ghost" disabled={pending || progress !== null || safeIndex === list.length - 1} onClick={() => move(1)}>
                Move right <ArrowRight className="size-3.5" aria-hidden />
              </Button>
            </>
          ) : null}
          <Button size="sm" variant="ghost" disabled={pending || progress !== null} onClick={() => remove(current.id)}>
            <Trash2 className="size-3.5" aria-hidden /> Remove
          </Button>
        </div>
      ) : null}
    </div>
  );
}
