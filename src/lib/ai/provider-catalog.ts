/**
 * Curated third-party provider catalog for the workspace AI configuration
 * ("pick a real gateway, or bring your own endpoint").
 *
 * KIND MODEL
 * ───────────
 * Non-Gemini text providers use OpenAI Chat Completions. Most image gateways
 * use the OpenAI Images shape; Cloudflare image models use a dedicated native
 * Workers AI adapter under /ai/run/{model}.
 *
 * BASE URL RESOLUTION
 * ───────────────────
 * Presets ship a fixed `defaultBaseUrl`; a workspace row may store its own
 * override (text_base_url / image_base_url) or leave it blank — runtime
 * resolution (resolvedBaseUrl) uses stored ?? catalog default. `custom`
 * deliberately has NO default: the user must enter an endpoint, and
 * validation + runtime resolution both fail honestly when it is missing.
 *
 * BACKWARD COMPATIBILITY
 * ──────────────────────
 * Rows saved before this catalog stored the generic id "openai-compatible"
 * (Phase 1/2, migration 0015). That id is not in the catalog — it can no
 * longer be SAVED — but it remains accepted on READ: catalogEntry() and
 * isKnownProvider() resolve it to the `custom` entry, so existing rows keep
 * resolving. App-created legacy rows always carry their own base URL (the
 * Phase-2 validator required one), so the alias never depends on a catalog
 * default. No DB migration is needed: provider ids are TEXT columns and the
 * alias + catalog handle old rows.
 *
 * The catalog module is pure data + pure helpers (no "server-only", no SDK
 * imports) so both server code (validation, resolution) and the client
 * settings card can import it.
 */

export const CATALOG_PROVIDER_IDS = [
  "gemini",
  "openai",
  "cloudflare",
  "openrouter",
  "nvidia",
  "groq",
  "together",
  "fireworks",
  "deepseek",
  "mistral",
  "xai",
  "cerebras",
  "perplexity",
  "github-models",
  "omniroute",
  "ollama",
  "custom",
] as const;

export type CatalogProviderId = (typeof CATALOG_PROVIDER_IDS)[number];

/** Legacy id stored by Phase-1/2 configs; accepted on read, resolved to
 *  `custom`, never savable through the catalog. */
export const LEGACY_OPENAI_COMPATIBLE_ID = "openai-compatible";

/** Any provider id that can appear at runtime (saved rows + alias). */
export type ProviderId = CatalogProviderId | typeof LEGACY_OPENAI_COMPATIBLE_ID;

export type ProviderKind = "gemini" | "openai-compatible";

/** UI grouping for the provider picker (rendered in PROVIDER_GROUP_ORDER). */
export type ProviderGroup = "google" | "gateway" | "local" | "custom";

export type ProviderCatalogEntry = {
  id: CatalogProviderId;
  label: string;
  kind: ProviderKind;
  group: ProviderGroup;
  /** Fixed endpoint shipped with the catalog; used when the row stores none
   *  (placeholder in the UI, runtime default in resolution). */
  defaultBaseUrl?: string;
  /** Example model id shown as the model input placeholder. */
  modelHint?: string;
  textModelHint?: string;
  imageModelHint?: string;
  /** Short honest helper text rendered under the form. */
  note?: string;
};

/**
 * Catalog contents. Base URLs are product-spec fixed values — do not edit
 * without an explicit requirement (no web lookups).
 */
export const AI_PROVIDER_CATALOG: Record<CatalogProviderId, ProviderCatalogEntry> = {
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    kind: "gemini",
    group: "google",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    kind: "openai-compatible",
    group: "gateway",
    defaultBaseUrl: "https://api.openai.com/v1",
  },
  cloudflare: {
    id: "cloudflare",
    label: "Cloudflare Workers AI",
    kind: "openai-compatible",
    group: "gateway",
    textModelHint: "@cf/meta/llama-3.1-8b-instruct",
    imageModelHint: "@cf/black-forest-labs/flux-1-schnell",
    note: "Enter your Cloudflare Account ID and Workers AI API token. Image generation uses the native Workers AI API.",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    kind: "openai-compatible",
    group: "gateway",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    modelHint: "openrouter/auto",
  },
  nvidia: {
    id: "nvidia",
    label: "NVIDIA NIM",
    kind: "openai-compatible",
    group: "gateway",
    defaultBaseUrl: "https://integrate.api.nvidia.com/v1",
    modelHint: "meta/llama-3.1-405b-instruct",
  },
  groq: {
    id: "groq",
    label: "Groq",
    kind: "openai-compatible",
    group: "gateway",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    modelHint: "llama-3.3-70b-versatile",
  },
  together: {
    id: "together",
    label: "Together AI",
    kind: "openai-compatible",
    group: "gateway",
    defaultBaseUrl: "https://api.together.xyz/v1",
  },
  fireworks: {
    id: "fireworks",
    label: "Fireworks AI",
    kind: "openai-compatible",
    group: "gateway",
    defaultBaseUrl: "https://api.fireworks.ai/inference/v1",
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    kind: "openai-compatible",
    group: "gateway",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    modelHint: "deepseek-chat",
  },
  mistral: {
    id: "mistral",
    label: "Mistral AI",
    kind: "openai-compatible",
    group: "gateway",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    modelHint: "mistral-large-latest",
  },
  xai: {
    id: "xai",
    label: "xAI (Grok)",
    kind: "openai-compatible",
    group: "gateway",
    defaultBaseUrl: "https://api.x.ai/v1",
    modelHint: "grok-2-latest",
  },
  cerebras: {
    id: "cerebras",
    label: "Cerebras",
    kind: "openai-compatible",
    group: "gateway",
    defaultBaseUrl: "https://api.cerebras.ai/v1",
  },
  perplexity: {
    id: "perplexity",
    label: "Perplexity",
    kind: "openai-compatible",
    group: "gateway",
    defaultBaseUrl: "https://api.perplexity.ai",
  },
  "github-models": {
    id: "github-models",
    label: "GitHub Models",
    kind: "openai-compatible",
    group: "gateway",
    defaultBaseUrl: "https://models.inference.ai.azure.com",
  },
  omniroute: {
    id: "omniroute",
    label: "Omni Route (self-hosted gateway)",
    kind: "openai-compatible",
    group: "local",
    note: "Use a public HTTPS endpoint for your self-hosted router; localhost and private networks are blocked.",
  },
  ollama: {
    id: "ollama",
    label: "Ollama (local)",
    kind: "openai-compatible",
    group: "local",
    note: "Use a public HTTPS endpoint for your Ollama gateway; localhost and private networks are blocked.",
  },
  custom: {
    id: "custom",
    label: "Custom OpenAI-compatible",
    kind: "openai-compatible",
    group: "custom",
  },
};

/** Render order of provider groups in the picker. */
export const PROVIDER_GROUP_ORDER: readonly ProviderGroup[] = [
  "google",
  "gateway",
  "local",
  "custom",
];

export const PROVIDER_GROUP_LABELS: Record<ProviderGroup, string> = {
  google: "Google",
  gateway: "Gateways & third-party",
  local: "Local & self-hosted",
  custom: "Custom",
};

/** True when `id` is one of the savable catalog ids (alias excluded). */
export function isCatalogProviderId(id: string): id is CatalogProviderId {
  return (CATALOG_PROVIDER_IDS as readonly string[]).includes(id);
}

/** True when `id` is a catalog id OR the legacy "openai-compatible" alias. */
export function isKnownProvider(id: string): id is ProviderId {
  return isCatalogProviderId(id) || id === LEGACY_OPENAI_COMPATIBLE_ID;
}

/**
 * Look up the catalog entry for any stored provider id. The legacy
 * "openai-compatible" alias resolves to the `custom` entry, so callers
 * (UI labels, validation, dispatch) never have to special-case old rows.
 * Returns undefined for unknown ids.
 */
export function catalogEntry(id: string): ProviderCatalogEntry | undefined {
  if (id === LEGACY_OPENAI_COMPATIBLE_ID) return AI_PROVIDER_CATALOG.custom;
  return AI_PROVIDER_CATALOG[id as CatalogProviderId];
}

/**
 * True when an openai-compatible provider has no catalog default and
 * therefore demands a user-supplied base URL. Cloudflare is handled through
 * its Account ID field and is excluded. `custom` and its legacy alias need a
 * URL; the rule stays generic so a
 * future catalog entry without a default is handled automatically.
 */
export function providerRequiresBaseUrl(providerId: string): boolean {
  const entry = catalogEntry(providerId);
  return Boolean(entry && entry.id !== "cloudflare" && entry.kind === "openai-compatible" && !entry.defaultBaseUrl);
}

/**
 * Effective base URL for a provider: stored value wins, otherwise the
 * catalog default is filled in (so a saved row with an empty base URL still
 * works for presets). Gemini has no base URL and always returns null.
 * Throws a plain Error when the provider has no stored URL AND no catalog
 * default (i.e. `custom` misconfigured) or when the id is unknown — call
 * sites convert this into their own error contract (AIConfigError).
 */
export function resolvedBaseUrl(
  providerId: string,
  storedBaseUrl?: string | null,
): string | null {
  const entry = catalogEntry(providerId);
  if (!entry) throw new Error(`Unknown AI provider "${providerId}".`);
  if (entry.kind === "gemini") return null;
  const stored = storedBaseUrl?.trim();
  if (stored) return stored;
  if (entry.defaultBaseUrl) return entry.defaultBaseUrl;
  throw new Error(
    `"${entry.label}" requires a Base URL — enter your endpoint (e.g. https://gateway.example.com/v1) in Workspace Settings.`,
  );
}
