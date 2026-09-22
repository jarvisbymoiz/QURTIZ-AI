import "server-only";

/**
 * BraveSearchProvider — the ONE secure location that reads
 * BRAVE_SEARCH_API_KEY from the server environment.
 *
 * Security contract (enforced here and tested in __tests__):
 * - The key is read ONLY from process.env.BRAVE_SEARCH_API_KEY, at call
 *   time, inside this module. No other module may read that variable.
 * - The key is sent to Brave in the `X-Subscription-Token` request header
 *   — never in the URL (URLs end up in logs, caches, telemetry).
 * - No error message, return value, or log line from this module ever
 *   contains the key or the request headers that carry it.
 * - Nothing here reads cookies()/headers() or any per-tenant credential:
 *   auth is the single shared project key, by design.
 *
 * The provider never throws arbitrary exceptions to callers: transport and
 * API failures are wrapped in BraveSearchError with a typed `kind` so the
 * ResearchService can map them to honest, agent-handleable results.
 */

export type BraveResult = {
  title: string;
  url: string;
  description: string;
  /** Brave-reported age string, e.g. "3 days ago" — nullable. */
  age: string | null;
};

export type BraveErrorKind =
  | "disabled" // BRAVE_SEARCH_API_KEY missing/empty
  | "unauthorized" // Brave rejected the key (401/403)
  | "quota" // 429 (rate/quota) — retry-after surfaced when Brave provides it
  | "http" // other non-2xx after bounded retry
  | "network" // fetch threw a transport error after bounded retry
  | "timeout"; // aborted by our own timeout signal

export class BraveSearchError extends Error {
  readonly kind: BraveErrorKind;
  readonly httpStatus: number | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    kind: BraveErrorKind,
    message: string,
    opts?: { httpStatus?: number; retryAfterSeconds?: number },
  ) {
    super(message);
    this.name = "BraveSearchError";
    this.kind = kind;
    this.httpStatus = opts?.httpStatus;
    this.retryAfterSeconds = opts?.retryAfterSeconds;
  }
}

/** True when the shared project key is present. Never throws. */
export function isBraveConfigured(): boolean {
  return Boolean(process.env.BRAVE_SEARCH_API_KEY?.trim());
}

const ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 2; // one initial try + one bounded retry for transient 5xx/network failures
const MAX_RETRY_AFTER_HINT = 3600; // never honor absurd Retry-After hints

function backoffMs(attempt: number): number {
  // 300ms, 600ms — small: this is one bounded retry, not an aggressive loop.
  return 300 * attempt;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return Math.min(Math.ceil(seconds), MAX_RETRY_AFTER_HINT);
}

type BraveWebResponse = {
  web?: {
    results?: { title?: string; url?: string; description?: string; age?: string }[];
  };
};

function stripMarkup(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Normalize Brave web results into the public, cache-safe shape. */
function normalizeResults(json: BraveWebResponse): BraveResult[] {
  const out: BraveResult[] = [];
  for (const raw of json.web?.results ?? []) {
    if (!raw.url || typeof raw.url !== "string" || !raw.url.startsWith("http")) continue;
    out.push({
      title: stripMarkup(raw.title ?? ""),
      url: raw.url,
      description: stripMarkup(raw.description ?? ""),
      age: raw.age ?? null,
    });
  }
  return out;
}

export type BraveSearchInput = {
  query: string;
  /** Brave `country` (2-letter region code), e.g. "US". */
  region?: string;
  /** Brave `search_lang` (ISO language), e.g. "en". */
  language?: string;
  /** Brave freshness window: pd | pw | pm | py (or explicit range). */
  freshness?: string;
  /** 1-20 results per request. */
  count?: number;
  signal?: AbortSignal;
  /** Test seam — production code always uses the global fetch. */
  fetchImpl?: typeof fetch;
};

/**
 * Perform one Brave web search with the shared project key.
 * Throws BraveSearchError (typed) — never raw fetch/provider errors.
 */
export async function braveWebSearch(input: BraveSearchInput): Promise<BraveResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!apiKey) {
    throw new BraveSearchError(
      "disabled",
      "Live research is not configured on this Qurtiz deployment (BRAVE_SEARCH_API_KEY is not set).",
    );
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    q: input.query.slice(0, 400),
    count: String(Math.max(1, Math.min(input.count ?? 10, 20))),
  });
  if (input.region) params.set("country", input.region.slice(0, 20));
  if (input.language) params.set("search_lang", input.language.slice(0, 20));
  if (input.freshness) params.set("freshness", input.freshness.slice(0, 20));

  const url = `${ENDPOINT}?${params.toString()}`;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetchImpl(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": apiKey,
        },
        signal: input.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });

      if (res.status === 401 || res.status === 403) {
        // Bad/revoked shared key — a platform configuration problem, never
        // retried (retries would just burn quota against a bad key).
        throw new BraveSearchError("unauthorized", "The Brave Search API key was rejected (HTTP " + res.status + ").", {
          httpStatus: res.status,
        });
      }
      if (res.status === 429) {
        // Shared quota/rate exhausted. Do NOT retry into the same window —
        // surface the honest retry-after hint to the caller instead.
        throw new BraveSearchError(
          "quota",
          "Brave Search rate/quota limit reached (HTTP 429).",
          { httpStatus: res.status, retryAfterSeconds: parseRetryAfter(res.headers.get("retry-after")) },
        );
      }
      if (!res.ok) {
        // Transient upstream failure: one bounded retry, then give up.
        if (res.status >= 500 && attempt < MAX_ATTEMPTS) {
          lastError = new BraveSearchError("http", "Brave Search upstream error (HTTP " + res.status + ").", {
            httpStatus: res.status,
          });
          await sleep(backoffMs(attempt));
          continue;
        }
        throw new BraveSearchError("http", "Brave Search failed (HTTP " + res.status + ").", {
          httpStatus: res.status,
        });
      }

      const json = (await res.json()) as BraveWebResponse;
      return normalizeResults(json);
    } catch (error) {
      if (error instanceof BraveSearchError) throw error;
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new BraveSearchError("timeout", "Brave Search request timed out.");
      }
      if (error instanceof DOMException && error.name === "AbortError") throw error; // caller-initiated abort: rethrow as-is
      // Transport-level failure (DNS, TLS, connection reset): one bounded retry.
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(backoffMs(attempt));
        continue;
      }
    }
  }

  const detail = lastError instanceof Error ? lastError.message : "unknown transport error";
  throw new BraveSearchError("network", `Brave Search transport failure: ${detail.slice(0, 120)}`);
}
