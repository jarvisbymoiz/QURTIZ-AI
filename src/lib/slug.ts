/**
 * Convert an arbitrary workspace name into a URL/npm-friendly slug.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "workspace";
}

/**
 * Build a unique slug given a list of already-taken slugs.
 */
export function uniqueSlug(base: string, taken: readonly string[]): string {
  const takenSet = new Set(taken);
  const root = slugify(base);
  if (!takenSet.has(root)) return root;
  for (let i = 2; i < 10_000; i++) {
    const candidate = `${root}-${i}`;
    if (!takenSet.has(candidate)) return candidate;
  }
  return `${root}-${Date.now()}`;
}
