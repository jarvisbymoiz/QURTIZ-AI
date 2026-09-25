"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, Bot, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import {
  clearWorkspaceAIConfigAction,
  getWorkspaceAIConfigAction,
  saveWorkspaceAIConfigAction,
  type AIConfigView,
} from "@/server/actions/ai-config";
import {
  AI_PROVIDER_CATALOG,
  CATALOG_PROVIDER_IDS,
  PROVIDER_GROUP_LABELS,
  PROVIDER_GROUP_ORDER,
  catalogEntry,
  providerRequiresBaseUrl,
  type CatalogProviderId,
} from "@/lib/ai/provider-catalog";
import { cloudflareAccountIdFromBaseUrl } from "@/lib/ai/cloudflare";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Workspace AI configuration (Phase 2 UI, Phase 3 catalog).
 *
 * Wired to the REAL Phase-1 server actions: getWorkspaceAIConfigAction
 * (masked view — the raw key never leaves the server), saveWorkspaceAIConfigAction
 * (blank key = keep the stored one), clearWorkspaceAIConfigAction. No mock
 * state anywhere: the card reflects the persisted row or an honest empty
 * state.
 *
 * The provider pickers render the CURATED catalog (lib/ai/provider-catalog)
 * grouped by Google / Gateways & third-party / Local & self-hosted /
 * Custom. Picking a preset pre-fills its base URL (still editable) and
 * shows the catalog's model hint; `custom` demands its own base URL. The
 * legacy stored id "openai-compatible" (Phase-1 rows) is normalized to the
 * catalog's `custom` entry on load, so old configs keep editing fine.
 */

/** Placeholder model examples per section for providers whose catalog entry
 *  has no modelHint (today: gemini — its text vs image examples differ). */
const FALLBACK_MODEL_HINTS: Record<"text" | "image", Partial<Record<CatalogProviderId, string>>> = {
  text: { gemini: "gemini-3.6-flash" },
  image: { gemini: "gemini-3.1-flash-image" },
};

const CUSTOM_BASE_URL_HELP =
  "Required. Any OpenAI-compatible endpoint — OpenRouter, NVIDIA NIM, Omni Route, local gateways…";

const USAGE_NOTE =
  "Used by: AI Chat, Content Studio, Bulk Creation, Research, Planner, Campaigns (text model) · Visual Generation (image model)";

function providerLabel(id: string): string {
  return catalogEntry(id)?.label ?? id;
}

/** Model input placeholder: catalog hint, else the section fallback. */
function modelPlaceholder(providerId: string, section: "text" | "image"): string | undefined {
  const entry = catalogEntry(providerId);
  if (providerId === "cloudflare") return section === "text" ? entry?.textModelHint : entry?.imageModelHint;
  if (entry?.modelHint) return entry.modelHint;
  if (entry?.kind === "gemini") return FALLBACK_MODEL_HINTS[section][providerId as CatalogProviderId];
  return undefined;
}

/**
 * Base URL to show after a provider change. Selecting a preset pre-fills
 * its catalog default; `custom` starts empty. A user-typed override is kept
 * unless it is exactly the previous provider's default (the field then just
 * tracks the new preset).
 */
function nextBaseUrl(providerId: string, prevProviderId: string, current: string): string {
  const entry = catalogEntry(providerId);
  if (!entry || entry.kind === "gemini") return "";
  if (providerId === "cloudflare" || prevProviderId === "cloudflare") return entry.defaultBaseUrl ?? "";
  const trimmed = current.trim();
  if (trimmed === "") return entry.defaultBaseUrl ?? "";
  const prevDefault = catalogEntry(prevProviderId)?.defaultBaseUrl;
  if (prevDefault && trimmed === prevDefault) return entry.defaultBaseUrl ?? "";
  return current;
}

/** Grouped provider picker rendered from the catalog (text AND image). */
function ProviderSelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(String(v))} disabled={disabled}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PROVIDER_GROUP_ORDER.map((group) => {
          const entries = CATALOG_PROVIDER_IDS.filter((pid) => AI_PROVIDER_CATALOG[pid].group === group);
          return (
            <SelectGroup key={group}>
              <SelectLabel>{PROVIDER_GROUP_LABELS[group]}</SelectLabel>
              {entries.map((pid) => (
                <SelectItem key={pid} value={pid}>
                  {AI_PROVIDER_CATALOG[pid].label}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/** Base URL row: visible for every non-Gemini provider; required (with the
 *  honest helper text) only for providers without a catalog default. */
function BaseUrlField({
  id,
  providerId,
  value,
  onChange,
  disabled,
}: {
  id: string;
  providerId: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const entry = catalogEntry(providerId);
  if (!entry || entry.kind === "gemini" || providerId === "cloudflare") return null;
  const required = providerRequiresBaseUrl(providerId);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        Base URL{required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={entry.defaultBaseUrl}
        required={required}
        disabled={disabled}
      />
      {required ? (
        <p className="text-xs text-muted-foreground">{CUSTOM_BASE_URL_HELP}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Preset endpoint (editable) — leave blank to use it, or point it at any compatible gateway.
        </p>
      )}
      {entry.note ? <p className="text-xs text-muted-foreground">{entry.note}</p> : null}
    </div>
  );
}

export function AiConfigCard({ editable }: { editable: boolean }) {
  // null = no stored config, undefined = still loading
  const [config, setConfig] = useState<AIConfigView | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [textProvider, setTextProvider] = useState<string>("gemini");
  const [textModel, setTextModel] = useState("");
  const [textBaseUrl, setTextBaseUrl] = useState("");
  const [textAccountId, setTextAccountId] = useState("");
  const [textApiKey, setTextApiKey] = useState("");
  const [imageProvider, setImageProvider] = useState<string>("gemini");
  const [imageModel, setImageModel] = useState("");
  const [imageBaseUrl, setImageBaseUrl] = useState("");
  const [imageAccountId, setImageAccountId] = useState("");
  const [imageApiKey, setImageApiKey] = useState("");

  const [saving, startSaving] = useTransition();
  const [removing, startRemoving] = useTransition();
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  async function load() {
    const r = await getWorkspaceAIConfigAction();
    if (!r.ok) {
      setLoadError(r.error);
      setConfig(null);
      return;
    }
    setLoadError(null);
    setConfig(r.config ?? null);
    if (r.config) {
      // Legacy rows stored the generic id "openai-compatible" — normalize to
      // the catalog id (`custom`) so the select has a matching option.
      setTextProvider(catalogEntry(r.config.textProvider)?.id ?? r.config.textProvider);
      setTextModel(r.config.textModel);
      setTextBaseUrl(r.config.textBaseUrl ?? "");
      setTextAccountId(r.config.textProvider === "cloudflare" ? cloudflareAccountIdFromBaseUrl(r.config.textBaseUrl ?? "", "text") ?? "" : "");
      setImageProvider(catalogEntry(r.config.imageProvider)?.id ?? r.config.imageProvider);
      setImageModel(r.config.imageModel);
      setImageBaseUrl(r.config.imageBaseUrl ?? "");
      setImageAccountId(r.config.imageProvider === "cloudflare" ? cloudflareAccountIdFromBaseUrl(r.config.imageBaseUrl ?? "", "image") ?? "" : "");
    }
    // Keys intentionally NOT prefilled — the masked hint below is the only
    // trace of a stored key. Blank on save preserves it server-side.
    setTextApiKey("");
    setImageApiKey("");
  }

  useEffect(() => {
    void load();
  }, []);

  // The image provider follows the text provider unless the user already
  // diverged it (independent text vs image choice is a core requirement).
  // The base URL follows the same prefill rules as a manual pick.
  function changeTextProvider(next: string) {
    const prev = textProvider;
    setTextProvider(next);
    setTextBaseUrl(nextBaseUrl(next, prev, textBaseUrl));
    if (next !== "cloudflare") setTextAccountId("");
    if (imageProvider === prev) {
      setImageProvider(next);
      setImageBaseUrl(nextBaseUrl(next, prev, imageBaseUrl));
      if (next === "cloudflare") setImageAccountId(textAccountId);
      else setImageAccountId("");
    }
  }

  function changeImageProvider(next: string) {
    const prev = imageProvider;
    setImageProvider(next);
    setImageBaseUrl(nextBaseUrl(next, prev, imageBaseUrl));
    if (next === "cloudflare" && !imageAccountId) setImageAccountId(textAccountId);
    if (next !== "cloudflare") setImageAccountId("");
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editable) return;
    const textIsOpenAiCompatible = catalogEntry(textProvider)?.kind === "openai-compatible";
    const imageIsOpenAiCompatible = catalogEntry(imageProvider)?.kind === "openai-compatible";
    startSaving(async () => {
      const r = await saveWorkspaceAIConfigAction({
        textProvider,
        textModel,
        textBaseUrl: textIsOpenAiCompatible ? textBaseUrl : null,
        textAccountId: textProvider === "cloudflare" ? textAccountId : null,
        textApiKey: textApiKey || null,
        imageProvider,
        imageModel,
        imageBaseUrl: imageIsOpenAiCompatible ? imageBaseUrl : null,
        imageAccountId: imageProvider === "cloudflare" ? imageAccountId : null,
        imageApiKey: imageApiKey || null,
      });
      if (r.ok) {
        toast.success("AI configuration saved");
        await load();
      } else {
        toast.error(r.error);
      }
    });
  }

  function remove() {
    startRemoving(async () => {
      const r = await clearWorkspaceAIConfigAction();
      if (r.ok) {
        toast.success("AI configuration removed — AI features are now disabled for this workspace");
        setConfig(null);
        setShowForm(false);
        setTextProvider("gemini");
        setTextModel("");
        setTextBaseUrl("");
        setTextAccountId("");
        setTextApiKey("");
        setImageProvider("gemini");
        setImageModel("");
        setImageBaseUrl("");
        setImageAccountId("");
        setImageApiKey("");
      } else {
        toast.error(r.error);
      }
    });
  }

  const notConfigured = config === null && loadError === null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="size-4 text-primary" aria-hidden /> AI configuration
        </CardTitle>
        <CardDescription>
          Your own AI provider + API key. Keys are encrypted at rest and never leave this workspace — AI
          features use YOUR key, not the platform&apos;s.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {config === undefined && loadError === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Loading AI configuration…
          </div>
        ) : null}

        {loadError ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="size-4" aria-hidden /> Could not load AI configuration: {loadError}
            </p>
            <Button size="sm" variant="outline" onClick={() => void load()}>Retry</Button>
          </div>
        ) : null}

        {notConfigured && !showForm ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
              <KeyRound className="size-5 text-muted-foreground" aria-hidden />
            </div>
            <p className="max-w-md text-sm text-muted-foreground">
              Add your own AI provider + API key — your keys are encrypted and never leave your workspace; AI
              features use YOUR key, not the platform&apos;s.
            </p>
            <Button type="button" onClick={() => setShowForm(true)} disabled={!editable}>
              <Plus className="size-4" aria-hidden /> Configure AI
            </Button>
          </div>
        ) : null}

        {notConfigured && showForm ? (
          <p className="text-sm text-muted-foreground">
            Pick a provider and enter your keys below. Leaving a key blank is only possible once a key is
            stored — it preserves the saved key.
          </p>
        ) : null}

        {config ? (
          <div className="space-y-2 rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Text model</span>
              <span className="font-mono text-xs">
                {providerLabel(config.textProvider)} · {config.textModel}
                {config.textApiKeyMasked ? ` · key ${config.textApiKeyMasked}` : " · no key stored"}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Image model</span>
              <span className="font-mono text-xs">
                {providerLabel(config.imageProvider)} · {config.imageModel}
                {config.imageApiKeyMasked ? ` · key ${config.imageApiKeyMasked}` : " · no key stored"}
              </span>
            </div>
          </div>
        ) : null}

        {(!notConfigured || showForm) && config !== undefined && loadError === null ? (
          <form onSubmit={save} className="space-y-5">
            <div className="space-y-4">
              <div className="text-sm font-medium">Text model</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="text-provider">Provider</Label>
                  <ProviderSelect
                    id="text-provider"
                    value={textProvider}
                    onChange={(v) => changeTextProvider(v)}
                    disabled={!editable}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="text-model">Model</Label>
                  <Input
                    id="text-model"
                    value={textModel}
                    onChange={(e) => setTextModel(e.target.value)}
                    placeholder={modelPlaceholder(textProvider, "text")}
                    required
                    disabled={!editable}
                  />
                </div>
              </div>
              <BaseUrlField
                id="text-base-url"
                providerId={textProvider}
                value={textBaseUrl}
                onChange={setTextBaseUrl}
                disabled={!editable}
              />
              {textProvider === "cloudflare" ? (
                <div className="space-y-2">
                  <Label htmlFor="text-account-id">Cloudflare Account ID</Label>
                  <Input id="text-account-id" value={textAccountId} onChange={e => setTextAccountId(e.target.value)}
                    placeholder="32-character Account ID" required disabled={!editable} autoComplete="off" />
                  <p className="text-xs text-muted-foreground">The server constructs the account’s /ai/v1 chat endpoint.</p>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="text-api-key">{textProvider === "cloudflare" ? "Workers AI API token" : "API key"}</Label>
                <Input
                  id="text-api-key"
                  type="password"
                  autoComplete="new-password"
                  value={textApiKey}
                  onChange={(e) => setTextApiKey(e.target.value)}
                  placeholder={config?.textProvider === textProvider && config.textApiKeyMasked ? "Enter a new key to replace" : "Paste this provider’s API key"}
                  required={config?.textProvider !== textProvider || !config?.textApiKeyMasked}
                  disabled={!editable}
                />
                {config?.textProvider === textProvider && config.textApiKeyMasked ? (
                  <p className="text-xs text-muted-foreground">
                    Key saved ({config.textApiKeyMasked}) — enter a new key to replace it. Leaving it blank
                    keeps the saved key.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Stored encrypted — the raw key is never shown again after saving.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-sm font-medium">Image generation</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="image-provider">Provider</Label>
                  <ProviderSelect
                    id="image-provider"
                    value={imageProvider}
                    onChange={(v) => changeImageProvider(v)}
                    disabled={!editable}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image-model">Model</Label>
                  <Input
                    id="image-model"
                    value={imageModel}
                    onChange={(e) => setImageModel(e.target.value)}
                    placeholder={modelPlaceholder(imageProvider, "image")}
                    required
                    disabled={!editable}
                  />
                </div>
              </div>
              <BaseUrlField
                id="image-base-url"
                providerId={imageProvider}
                value={imageBaseUrl}
                onChange={setImageBaseUrl}
                disabled={!editable}
              />
              {imageProvider === "cloudflare" ? (
                <div className="space-y-2">
                  <Label htmlFor="image-account-id">Cloudflare Account ID</Label>
                  <Input id="image-account-id" value={imageAccountId} onChange={e => setImageAccountId(e.target.value)}
                    placeholder="32-character Account ID" required disabled={!editable} autoComplete="off" />
                  <p className="text-xs text-muted-foreground">Supports @cf/black-forest-labs/flux-1-schnell and @cf/stabilityai/stable-diffusion-xl-base-1.0. The server constructs the native /ai/run endpoint.</p>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="image-api-key">{imageProvider === "cloudflare" ? "Workers AI API token" : "API key"}</Label>
                <Input
                  id="image-api-key"
                  type="password"
                  autoComplete="new-password"
                  value={imageApiKey}
                  onChange={(e) => setImageApiKey(e.target.value)}
                  placeholder={config?.imageProvider === imageProvider && config.imageApiKeyMasked ? "Enter a new key to replace" : "Paste this provider’s API key"}
                  required={config?.imageProvider !== imageProvider || !config?.imageApiKeyMasked}
                  disabled={!editable}
                />
                {config?.imageProvider === imageProvider && config.imageApiKeyMasked ? (
                  <p className="text-xs text-muted-foreground">
                    Key saved ({config.imageApiKeyMasked}) — enter a new key to replace it. Leaving it blank
                    keeps the saved key.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Can differ from the text provider — image models are often billed separately.
                  </p>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">{USAGE_NOTE}</p>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button type="submit" disabled={saving || !editable}>
                  {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  {saving ? "Saving…" : "Save configuration"}
                </Button>
                {config ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setConfirmRemoveOpen(true)}
                    disabled={removing || !editable}
                  >
                    {removing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
                    Remove config
                  </Button>
                ) : null}
              </div>
            </div>
          </form>
        ) : null}

        <Dialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove AI configuration?</DialogTitle>
              <DialogDescription>
                Your API keys will be deleted from this workspace. AI Chat, Content Studio, Research,
                Campaigns and Visual Generation stop working until you add a new configuration.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmRemoveOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmRemoveOpen(false);
                  remove();
                }}
                disabled={removing}
              >
                {removing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Remove configuration
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
