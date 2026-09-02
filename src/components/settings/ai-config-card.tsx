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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Workspace AI configuration (Phase 2).
 *
 * Wired to the REAL Phase-1 server actions: getWorkspaceAIConfigAction
 * (masked view — the raw key never leaves the server), saveWorkspaceAIConfigAction
 * (blank key = keep the stored one), clearWorkspaceAIConfigAction. No mock
 * state anywhere: the card reflects the persisted row or an honest empty
 * state. Only actually-wired providers are offered (gemini,
 * openai-compatible) — registry-ready but unregistered providers are not
 * listed as selectable.
 */

const TEXT_PROVIDER_OPTIONS = [
  { id: "gemini", label: "Google AI Studio / Vertex (Gemini)" },
  { id: "openai-compatible", label: "OpenAI-compatible endpoint" },
] as const;

const TEXT_MODEL_PLACEHOLDERS: Record<string, string> = {
  gemini: "gemini-2.0-flash",
  "openai-compatible": "gpt-4o-mini",
};

const IMAGE_MODEL_PLACEHOLDERS: Record<string, string> = {
  gemini: "gemini-3.1-flash-image",
  "openai-compatible": "gpt-image-1",
};

const BASE_URL_PLACEHOLDER = "https://api.openai.com/v1";

const USAGE_NOTE =
  "Used by: AI Chat, Content Studio, Bulk Creation, Research, Planner, Campaigns (text model) · Visual Generation (image model)";

export function AiConfigCard({ editable }: { editable: boolean }) {
  // null = no stored config, undefined = still loading
  const [config, setConfig] = useState<AIConfigView | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [textProvider, setTextProvider] = useState<string>("gemini");
  const [textModel, setTextModel] = useState("");
  const [textBaseUrl, setTextBaseUrl] = useState("");
  const [textApiKey, setTextApiKey] = useState("");
  const [imageProvider, setImageProvider] = useState<string>("gemini");
  const [imageModel, setImageModel] = useState("");
  const [imageBaseUrl, setImageBaseUrl] = useState("");
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
      setTextProvider(r.config.textProvider);
      setTextModel(r.config.textModel);
      setTextBaseUrl(r.config.textBaseUrl ?? "");
      setImageProvider(r.config.imageProvider);
      setImageModel(r.config.imageModel);
      setImageBaseUrl(r.config.imageBaseUrl ?? "");
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
  function changeTextProvider(next: string) {
    setTextProvider(next);
    if (imageProvider === textProvider) setImageProvider(next);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editable) return;
    startSaving(async () => {
      const r = await saveWorkspaceAIConfigAction({
        textProvider,
        textModel,
        textBaseUrl: textProvider === "openai-compatible" ? textBaseUrl : null,
        textApiKey: textApiKey || null,
        imageProvider,
        imageModel,
        imageBaseUrl: imageProvider === "openai-compatible" ? imageBaseUrl : null,
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
        setTextApiKey("");
        setImageProvider("gemini");
        setImageModel("");
        setImageBaseUrl("");
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
                {config.textProvider} · {config.textModel}
                {config.textApiKeyMasked ? ` · key ${config.textApiKeyMasked}` : " · no key stored"}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Image model</span>
              <span className="font-mono text-xs">
                {config.imageProvider} · {config.imageModel}
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
                  <Select value={textProvider} onValueChange={(v) => changeTextProvider(String(v))} disabled={!editable}>
                    <SelectTrigger id="text-provider" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEXT_PROVIDER_OPTIONS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="text-model">Model</Label>
                  <Input
                    id="text-model"
                    value={textModel}
                    onChange={(e) => setTextModel(e.target.value)}
                    placeholder={TEXT_MODEL_PLACEHOLDERS[textProvider]}
                    required
                    disabled={!editable}
                  />
                </div>
              </div>
              {textProvider === "openai-compatible" ? (
                <div className="space-y-2">
                  <Label htmlFor="text-base-url">Base URL</Label>
                  <Input
                    id="text-base-url"
                    value={textBaseUrl}
                    onChange={(e) => setTextBaseUrl(e.target.value)}
                    placeholder={BASE_URL_PLACEHOLDER}
                    required
                    disabled={!editable}
                  />
                  <p className="text-xs text-muted-foreground">
                    Any OpenAI Chat Completions-compatible endpoint, e.g. OpenAI, OpenRouter, or a self-hosted
                    gateway.
                  </p>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="text-api-key">API key</Label>
                <Input
                  id="text-api-key"
                  type="password"
                  autoComplete="new-password"
                  value={textApiKey}
                  onChange={(e) => setTextApiKey(e.target.value)}
                  placeholder={config?.textApiKeyMasked ? "Enter a new key to replace" : "Paste your API key"}
                  disabled={!editable}
                />
                {config?.textApiKeyMasked ? (
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
                  <Select value={imageProvider} onValueChange={(v) => setImageProvider(String(v))} disabled={!editable}>
                    <SelectTrigger id="image-provider" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEXT_PROVIDER_OPTIONS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image-model">Model</Label>
                  <Input
                    id="image-model"
                    value={imageModel}
                    onChange={(e) => setImageModel(e.target.value)}
                    placeholder={IMAGE_MODEL_PLACEHOLDERS[imageProvider]}
                    required
                    disabled={!editable}
                  />
                </div>
              </div>
              {imageProvider === "openai-compatible" ? (
                <div className="space-y-2">
                  <Label htmlFor="image-base-url">Base URL</Label>
                  <Input
                    id="image-base-url"
                    value={imageBaseUrl}
                    onChange={(e) => setImageBaseUrl(e.target.value)}
                    placeholder={BASE_URL_PLACEHOLDER}
                    required
                    disabled={!editable}
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="image-api-key">API key</Label>
                <Input
                  id="image-api-key"
                  type="password"
                  autoComplete="new-password"
                  value={imageApiKey}
                  onChange={(e) => setImageApiKey(e.target.value)}
                  placeholder={config?.imageApiKeyMasked ? "Enter a new key to replace" : "Paste your API key"}
                  disabled={!editable}
                />
                {config?.imageApiKeyMasked ? (
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
