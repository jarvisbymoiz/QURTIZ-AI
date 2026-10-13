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
  | "invalid_request"
  | "disabled" // BRAVE_SEARCH_API_KEY missing/empty
  | "unauthorized" // Brave rejected the key (401/403)
  | "quota" // 429 (rate/quota) — retry-after surfaced when Brave provides it
  | "http" // other non-2xx after bounded retry
  | "network" // fetch threw a transport error after bounded retry
  | "response" // malformed provider JSON; not a transport failure
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
  if (!json || typeof json !== "object" || (json.web?.results !== undefined && !Array.isArray(json.web.results))) {
    throw new BraveSearchError("response", "Brave Search returned an invalid results payload.");
  }
  const out: BraveResult[] = [];
  for (const raw of (json.web?.results ?? []).slice(0, 20)) {
    if (!raw || typeof raw.url !== "string") continue;
    try { if (!["https:", "http:"].includes(new URL(raw.url).protocol)) continue; } catch { continue; }
    out.push({
      title: stripMarkup(typeof raw.title === "string" ? raw.title : "").slice(0, 300),
      url: raw.url,
      description: stripMarkup(typeof raw.description === "string" ? raw.description : "").slice(0, 1600),
      age: typeof raw.age === "string" ? raw.age.slice(0, 100) : null,
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

// Brave's supported search enums differ from the complete ISO country/language lists.
export const BRAVE_REGIONS = "AR AU AT BE BR CA CL DK FI FR DE GR HK IN ID IT JP KR MY MX NL NZ NO CN PL PT PH RU SA ZA ES SE CH TW TR GB US ALL".split(" ");
export const BRAVE_LANGUAGES = "ar eu bn bg ca zh-hans zh-hant hr cs da nl en en-gb et fi fr gl de el gu he hi hu is it ja jp kn ko lv lt ms ml mr nb pl pt-br pt-pt pa ro ru sr sk sl es sv ta te th tr uk vi".split(" ");
export function normalizeBraveRegion(value: string): string {
  const region = value.trim().toUpperCase();
  if (BRAVE_REGIONS.includes(region)) return region;
  // Valid countries without a Brave localized index (e.g. PK) use worldwide search.
  if (/^[A-Z]{2}$/.test(region) && new Intl.DisplayNames(["en"], { type: "region" }).of(region) !== region) return "ALL";
  throw new BraveSearchError("invalid_request", "Invalid search country. Use a supported country code or ALL.");
}
export function validateBraveInput(input: BraveSearchInput) {
  const invalid = (message: string): never => { throw new BraveSearchError("invalid_request", message); };
  const query = typeof input.query === "string" ? input.query.trim().replace(/\s+/g, " ") : "";
  if (!query || query.length > 600 || query.split(" ").length > 75) invalid("Search query must contain 1–600 characters and at most 75 words.");
  const region = input.region ? normalizeBraveRegion(input.region) : undefined;
  const language = input.language?.trim().toLowerCase();
  if (region && !BRAVE_REGIONS.includes(region)) invalid("Unsupported Brave country. Use a supported search region or ALL for worldwide results.");
  if (language && !BRAVE_LANGUAGES.includes(language)) invalid("Unsupported Brave search language. Use a supported search language such as en, not a UI locale such as en-US.");
  const count = input.count ?? 10;
  if (!Number.isInteger(count) || count < 1 || count > 20) invalid("Search result count must be an integer between 1 and 20.");
  const freshness = input.freshness?.trim();
  if (freshness && !["pd", "pw", "pm", "py"].includes(freshness)) {
    const range = /^(\d{4}-\d{2}-\d{2})to(\d{4}-\d{2}-\d{2})$/.exec(freshness);
    if (!range || range[1] > range[2] || range.slice(1).some(date => !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) invalid("Invalid search freshness. Use pd, pw, pm, py or a valid ordered YYYY-MM-DDtoYYYY-MM-DD range.");
  }
  return { query, region, language, count, freshness };
}

/** Never surface upstream input values, headers, tokens or arbitrary response text. */
async function validationFields(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const fields = (body?.error?.meta?.errors ?? []).slice(0, 8).flatMap((error: { loc?: unknown[] }) =>
      (error.loc ?? []).filter((field): field is string => typeof field === "string" && ["q", "count", "country", "search_lang", "freshness"].includes(field)));
    return fields.length ? ` Invalid fields: ${[...new Set(fields)].join(", ")}.` : "";
  } catch { return ""; }
}

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
  const validated = validateBraveInput(input);
  const params = new URLSearchParams({ q: validated.query, count: String(validated.count) });
  if (validated.region) params.set("country", validated.region);
  if (validated.language) params.set("search_lang", validated.language);
  if (validated.freshness) params.set("freshness", validated.freshness);

  const url = `${ENDPOINT}?${params.toString()}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetchImpl(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": apiKey,
        },
        signal: AbortSignal.any([AbortSignal.timeout(DEFAULT_TIMEOUT_MS), ...(input.signal ? [input.signal] : [])]),
      });

      if (res.status === 400 || res.status === 422) {
        throw new BraveSearchError("invalid_request", `Brave Search rejected the request (HTTP ${res.status}).${await validationFields(res)} Correct the search arguments/configuration before retrying; this is not a temporary outage.`, { httpStatus: res.status });
      }
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
          await sleep(backoffMs(attempt));
          continue;
        }
        throw new BraveSearchError("http", "Brave Search failed (HTTP " + res.status + ").", {
          httpStatus: res.status,
        });
      }

      let json: BraveWebResponse;
      try { json = await res.json() as BraveWebResponse; }
      catch { throw new BraveSearchError("response", "Brave Search returned invalid JSON."); }
      return normalizeResults(json);
    } catch (error) {
      if (error instanceof BraveSearchError) throw error;
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new BraveSearchError("timeout", "Brave Search request timed out.");
      }
      if (error instanceof DOMException && error.name === "AbortError") throw error; // caller-initiated abort: rethrow as-is
      // Transport-level failure (DNS, TLS, connection reset): one bounded retry.
      if (attempt < MAX_ATTEMPTS) {
        await sleep(backoffMs(attempt));
        continue;
      }
    }
  }

  throw new BraveSearchError("network", "Brave Search transport failure.");
}
