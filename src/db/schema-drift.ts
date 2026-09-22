/** PostgreSQL schema errors only; never classify by SQL/error-message text. */
export function schemaDriftCode(error: unknown): "42P01" | "42703" | null {
  const seen = new Set<object>();
  let current = error;
  // Drizzle wraps pg errors in `cause`. Bound traversal for malformed chains.
  for (let depth = 0; depth < 16; depth++) {
    if (typeof current !== "object" || current === null || seen.has(current)) return null;
    seen.add(current);
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (code === "42P01" || code === "42703") return code;
    current = cause;
  }
  return null;
}
