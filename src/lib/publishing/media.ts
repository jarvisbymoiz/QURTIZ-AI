/**
 * Provider-agnostic media selection for a publish.
 *
 * The stored assets are used EXACTLY as recorded: `mimeType` decides image vs
 * video (never the file name, never the extension) and `slideIndex` is the
 * order key (null/absent sorts last, remaining ties keep insertion order).
 *
 * Selection rules:
 *   - a video wins over images (a reel is a video post - never converted);
 *   - otherwise 0 assets -> "none", 1 -> "image", 2+ -> "images" (carousel);
 *   - assets whose mimeType is neither image/* nor video/* are ignored.
 */
export type VisualRef = {
  storagePath: string;
  mimeType: string;
  slideIndex: number | null;
  /** "upload" for user media; AI/template visuals keep their own kind. */
  kind?: string | null;
};

export type MediaKind = "none" | "image" | "images" | "video";

export type MediaSelection = {
  kind: MediaKind;
  /** Selected storage paths, in publish order. */
  paths: string[];
  mimeTypes: string[];
};

export function mediaFormatError(format: string | null | undefined, selection: MediaSelection): string | null {
  if (format === "reel" && selection.kind !== "video") return "Reels require an uploaded video. An image cannot be published as a Reel.";
  if (format === "carousel" && selection.kind === "video") return "Carousel posts require images, not a video.";
  return null;
}

function isImage(mime: string | null | undefined): boolean {
  return typeof mime === "string" && mime.startsWith("image/");
}
function isVideo(mime: string | null | undefined): boolean {
  return typeof mime === "string" && mime.startsWith("video/");
}

/** Stable order: slideIndex ascending (nulls last), otherwise input order. */
export function orderVisuals<T extends VisualRef>(visuals: T[]): T[] {
  return visuals
    .map((v, i) => ({ v, i }))
    .sort((a, b) => {
      const ai = a.v.slideIndex;
      const bi = b.v.slideIndex;
      if (ai == null && bi == null) return a.i - b.i;
      if (ai == null) return 1;
      if (bi == null) return -1;
      if (ai !== bi) return ai - bi;
      return a.i - b.i;
    })
    .map((x) => x.v);
}

export function selectPublishMedia(visuals: VisualRef[]): MediaSelection {
  const ordered = orderVisuals(visuals).filter((v) => isImage(v.mimeType) || isVideo(v.mimeType));
  const video = ordered.find((v) => isVideo(v.mimeType));
  if (video) {
    return { kind: "video", paths: [video.storagePath], mimeTypes: [video.mimeType] };
  }
  if (ordered.length === 0) return { kind: "none", paths: [], mimeTypes: [] };
  if (ordered.length === 1) return { kind: "image", paths: [ordered[0].storagePath], mimeTypes: [ordered[0].mimeType] };
  return { kind: "images", paths: ordered.map((v) => v.storagePath), mimeTypes: ordered.map((v) => v.mimeType) };
}
