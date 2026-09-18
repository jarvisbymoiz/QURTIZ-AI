type ReviewVisual = { kind: string; createdAt: Date | string; slideIndex?: number | null };

/** Uploads override generated visuals, matching the publishing media selection.
 * A single upload may have slideIndex=0; ordering does not exclude it. */
export function selectSingleReviewVisual<T extends ReviewVisual>(visuals: T[]): T | null {
  const uploads = visuals.filter(visual => visual.kind === "upload");
  const candidates = uploads.length ? uploads : visuals;
  return candidates.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
}
