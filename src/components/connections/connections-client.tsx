"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, CheckCircle2, CircleAlert, LogOut } from "lucide-react";
import { disconnectPlatformAction, updatePublishingProviderAction } from "@/server/actions/connections";
import type { PublishProvider } from "@/lib/publish/provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

type Platform = "facebook" | "instagram";
type Conn = {
  platform: Platform;
  provider: PublishProvider;
  status: string;
  channelRef: string | null;
  meta: Record<string, string>;
};

const PLATFORM_LABEL: Record<Platform, string> = {
  facebook: "Facebook Page",
  instagram: "Instagram Professional",
};

const PROVIDER_LABEL: Record<PublishProvider, string> = {
  meta: "Meta API",
  buffer: "Buffer API",
};

const OTHER_PROVIDER: Record<PublishProvider, PublishProvider> = { meta: "buffer", buffer: "meta" };

const ERROR_TEXT: Record<string, string> = {
  meta_not_configured: "Meta app credentials (META_APP_ID / META_APP_SECRET) are missing in .env.local.",
  oauth_invalid: "The OAuth handshake was incomplete. Try connecting again.",
  oauth_state_mismatch: "Security check failed (state mismatch). Try connecting again.",
  no_pages: "No Facebook Pages were returned — make sure your account manages at least one Page.",
  no_workspace: "Create a workspace before connecting accounts.",
  forbidden: "You do not have permission to connect accounts.",
};

// Mirrors the reasons the Buffer connect/callback routes redirect with
// (?buffer=error&reason=…). One entry per server-emitted reason.
const BUFFER_ERROR_TEXT: Record<string, string> = {
  not_configured:
    "Buffer is not configured — add BUFFER_CLIENT_ID and BUFFER_CLIENT_SECRET to .env.local, then restart the server.",
  no_workspace: "Create a workspace before connecting Buffer.",
  forbidden: "You do not have permission to connect Buffer.",
  denied: "Buffer access was denied. Start the connection again to authorize.",
  oauth_invalid: "That Buffer connection link was invalid or expired. Try connecting again.",
  token_exchange: "Buffer rejected the authorization. Try connecting again.",
  channels_fetch: "Buffer authorized, but its channels could not be loaded. Try connecting again.",
  no_supported_channels:
    "Buffer authorized, but no Facebook or Instagram channels are linked to your Buffer account. Link them inside Buffer, then connect again.",
  oauth_failed: "Buffer connection failed. Try connecting again.",
};

function accountDetail(platform: Platform, conn: Conn): string {
  const meta = conn.meta;
  if (conn.provider === "buffer") {
    if (meta.bufferUsername) return `Channel: @${meta.bufferUsername}`;
    if (conn.channelRef) return `Channel: ${conn.channelRef}`;
    return "Channel connected";
  }
  if (platform === "facebook") {
    const name = meta.pageName ?? meta.pageId;
    return name ? `Page: ${name}` : "Facebook Page connected";
  }
  const handle = meta.igUsername ?? meta.igUserId;
  return handle ? `Account: @${handle}` : "Instagram account connected";
}

export function ConnectionsClient({
  connections,
  publishingProvider,
  metaConfigured,
  bufferConfigured,
  canManage,
}: {
  connections: Conn[];
  publishingProvider: PublishProvider;
  metaConfigured: boolean;
  bufferConfigured: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();
  // Optimistic toggle state; reverted on action failure (the server page
  // re-delivers the persisted provider via router.refresh() after success).
  const [provider, setProvider] = useState<PublishProvider>(publishingProvider);
  const [busy, setBusy] = useState(false);

  const error = searchParams.get("error");
  const connected = searchParams.get("connected") === "1";
  const rawError = error && !ERROR_TEXT[error] ? decodeURIComponent(error) : null;

  // Handles the return trip from the Buffer OAuth flow. The param is cleared
  // from the URL so a refresh/back never re-triggers the toast (same pattern
  // as the workspace-delete ?wsdelete= param).
  const handledBufferParam = useRef(false);
  useEffect(() => {
    const status = searchParams.get("buffer");
    if (!status || handledBufferParam.current) return;
    handledBufferParam.current = true;
    if (status === "connected") {
      toast.success("Buffer connected — your linked Facebook/Instagram channels are ready to publish.");
    } else if (status === "error") {
      const reason = searchParams.get("reason") ?? "oauth_failed";
      toast.error(BUFFER_ERROR_TEXT[reason] ?? BUFFER_ERROR_TEXT.oauth_failed);
    }
    router.replace("/connections");
  }, [router, searchParams]);

  async function changeProvider(next: PublishProvider) {
    if (busy || next === provider) return;
    const prev = provider;
    setProvider(next); // optimistic
    setBusy(true);
    try {
      const r = await updatePublishingProviderAction(next);
      if (r.ok) {
        toast.success(`Publishing provider: ${PROVIDER_LABEL[next]}`);
        router.refresh();
      } else {
        setProvider(prev); // revert
        toast.error(r.error);
      }
    } catch {
      setProvider(prev); // revert
      toast.error("Could not change the publishing provider.");
    } finally {
      setBusy(false);
    }
  }

  function disconnect(platform: Platform, connProvider: PublishProvider) {
    start(async () => {
      const r = await disconnectPlatformAction(platform, connProvider);
      if (r.ok) {
        toast.success("Disconnected");
      } else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowLeftRight className="size-4 text-primary" aria-hidden /> Publishing provider
          </CardTitle>
          <CardDescription>
            All posts scheduled from Content Studio, AI Chat, Bulk or Autopilot publish through {PROVIDER_LABEL[provider]}
            {provider === "meta" ? ", directly via your connected Facebook/Instagram accounts" : ", queued through your Buffer account"}.
            Scheduled posts keep the provider that was active when they were scheduled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Meta API ⇄ Buffer API</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Active: <span className="font-medium text-foreground">{PROVIDER_LABEL[provider]}</span>
                {provider === "buffer" ? " (early-access route until Meta App Review)" : " (official direct publishing)"}
              </p>
            </div>
            <Switch
              checked={provider === "buffer"}
              onCheckedChange={(next) => void changeProvider(next ? "buffer" : "meta")}
              disabled={busy || !canManage}
              aria-label="Publishing provider — on: Buffer API, off: Meta API"
            />
          </div>
          {!canManage ? (
            <p className="text-xs text-muted-foreground">Only workspace admins can change the publishing provider.</p>
          ) : null}
          {provider === "buffer" ? (
            <p className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
              The Buffer route is for early access until Meta App Review — posts queue through your Buffer account.
              Analytics and competitor analysis stay on the Meta data already collected; Buffer does not feed them.
              After authorizing, Buffer sends you back here and your linked Facebook/Instagram channels appear below —
              channel access itself is managed inside Buffer.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {!metaConfigured && provider === "meta" ? (
        <Alert variant="destructive">
          <CircleAlert className="size-4" aria-hidden />
          <AlertTitle>Meta app not configured</AlertTitle>
          <AlertDescription>
            Add META_APP_ID and META_APP_SECRET to .env.local (from developers.facebook.com), set the Valid OAuth
            Redirect URI to <code className="rounded bg-muted px-1 py-0.5">{"/api/meta/callback"}</code>, then restart
            the server. Publishing code is already live — it needs these credentials only.
          </AlertDescription>
        </Alert>
      ) : null}

      {!bufferConfigured && provider === "buffer" ? (
        <Alert variant="destructive">
          <CircleAlert className="size-4" aria-hidden />
          <AlertTitle>Buffer app not configured</AlertTitle>
          <AlertDescription>
            Add BUFFER_CLIENT_ID and BUFFER_CLIENT_SECRET to .env.local (Buffer developer app from
            buffer.com/developers), set the redirect URI to <code className="rounded bg-muted px-1 py-0.5">{"/api/buffer/callback"}</code>, then
            restart the server. The Buffer route stays selectable, but connecting requires these credentials.
          </AlertDescription>
        </Alert>
      ) : null}

      {connected ? (
        <Alert>
          <CheckCircle2 className="size-4" aria-hidden />
          <AlertTitle>Account connected</AlertTitle>
          <AlertDescription> Publishing is now enabled for the linked platforms.</AlertDescription>
        </Alert>
      ) : null}
      {error && ERROR_TEXT[error] ? (
        <Alert variant="destructive">
          <CircleAlert className="size-4" aria-hidden />
          <AlertTitle>Connection problem</AlertTitle>
          <AlertDescription>{ERROR_TEXT[error]}</AlertDescription>
        </Alert>
      ) : null}
      {rawError ? (
        <Alert variant="destructive">
          <CircleAlert className="size-4" aria-hidden />
          <AlertTitle>Connection problem</AlertTitle>
          <AlertDescription>{rawError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {(["facebook", "instagram"] as const).map((platform) => {
          const activeRow = connections.find((c) => c.platform === platform && c.provider === provider);
          const status = activeRow?.status ?? "not_connected";
          const inactiveProvider = OTHER_PROVIDER[provider];
          const inactiveRow = connections.find((c) => c.platform === platform && c.provider === inactiveProvider);
          const showInactive = inactiveRow && inactiveRow.status !== "not_connected";
          const connectHref = provider === "meta" ? "/api/meta/connect" : "/api/buffer/connect";
          const envReady = provider === "meta" ? metaConfigured : bufferConfigured;
          return (
            <Card key={platform}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base capitalize">{PLATFORM_LABEL[platform]}</CardTitle>
                    <Badge variant="secondary">{PROVIDER_LABEL[provider]}</Badge>
                  </div>
                  <Badge
                    variant={status === "connected" ? "default" : status === "error" ? "destructive" : "secondary"}
                    className={cnDefault(status)}
                  >
                    {status === "connected" ? "Connected" : status.replaceAll("_", " ")}
                  </Badge>
                </div>
                <CardDescription>
                  {activeRow?.status === "connected"
                    ? accountDetail(platform, activeRow)
                    : provider === "buffer"
                      ? "Queue posts through your Buffer account — Buffer owns the Facebook/Instagram channel links."
                      : "Official Graph API publishing — no browser automation."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeRow?.status === "connected" ? (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-emerald-500">
                      <CheckCircle2 className="size-3.5" aria-hidden /> Token stored encrypted
                    </span>
                    {canManage ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => disconnect(platform, provider)}
                      >
                        <LogOut className="size-3.5" aria-hidden /> Disconnect
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Button nativeButton={false} render={<a href={connectHref} />} disabled={!envReady || !canManage}>
                      {provider === "meta"
                        ? `Connect with ${platform === "facebook" ? "Facebook" : "Instagram"}`
                        : "Connect with Buffer"}
                    </Button>
                    {provider === "buffer" && !bufferConfigured ? (
                      <p className="text-xs text-muted-foreground">
                        Requires BUFFER_CLIENT_ID and BUFFER_CLIENT_SECRET in .env.local to enable Buffer connections.
                      </p>
                    ) : null}
                  </div>
                )}
                {showInactive ? (
                  <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                    <Badge variant="secondary">{PROVIDER_LABEL[inactiveProvider]}</Badge>
                    <span className="truncate text-sm text-muted-foreground">
                      {accountDetail(platform, inactiveRow)}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {inactiveRow.status === "error"
                        ? `Connection error — switch to ${PROVIDER_LABEL[inactiveProvider]} to manage it`
                        : `Inactive — switch to ${PROVIDER_LABEL[inactiveProvider]} to publish through this connection`}
                    </span>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function cnDefault(status: string): string {
  return status === "connected" ? "bg-emerald-500/10 text-emerald-500" : "";
}
