"use client";

import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert, LogOut } from "lucide-react";
import { disconnectPlatformAction } from "@/server/actions/connections";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Conn = { platform: "facebook" | "instagram"; status: string; meta: Record<string, string> };

const ERROR_TEXT: Record<string, string> = {
  meta_not_configured: "Meta app credentials (META_APP_ID / META_APP_SECRET) are missing in .env.local.",
  oauth_invalid: "The OAuth handshake was incomplete. Try connecting again.",
  oauth_state_mismatch: "Security check failed (state mismatch). Try connecting again.",
  no_pages: "No Facebook Pages were returned — make sure your account manages at least one Page.",
  no_workspace: "Create a workspace before connecting accounts.",
  forbidden: "You do not have permission to connect accounts.",
};

export function ConnectionsClient({
  connections,
  configured,
  canManage,
}: {
  connections: Conn[];
  configured: boolean;
  canManage: boolean;
}) {
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();

  const error = searchParams.get("error");
  const connected = searchParams.get("connected") === "1";
  const rawError = error && !ERROR_TEXT[error] ? decodeURIComponent(error) : null;

  function disconnect(platform: "facebook" | "instagram") {
    start(async () => {
      const r = await disconnectPlatformAction(platform);
      if (r.ok) {
        toast.success("Disconnected");
      } else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-4">
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
      {!configured ? (
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

      <div className="grid gap-4 md:grid-cols-2">
        {(["facebook", "instagram"] as const).map((platform) => {
          const conn = connections.find((c) => c.platform === platform);
          const status = conn?.status ?? "not_connected";
          return (
            <Card key={platform}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base capitalize">
                    {platform === "facebook" ? "Facebook Page" : "Instagram Professional"}
                  </CardTitle>
                  <Badge
                    variant={status === "connected" ? "default" : status === "error" ? "destructive" : "secondary"}
                    className={cnDefault(status)}
                  >
                    {status === "connected" ? "Connected" : status.replaceAll("_", " ")}
                  </Badge>
                </div>
                <CardDescription>
                  {status === "connected"
                    ? platform === "facebook"
                      ? `Page: ${conn?.meta?.pageName ?? conn?.meta?.pageId ?? ""}`
                      : `Account: @${conn?.meta?.igUsername ?? conn?.meta?.igUserId ?? ""}`
                    : "Official Graph API publishing — no browser automation."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {status === "connected" ? (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-emerald-500">
                      <CheckCircle2 className="size-3.5" aria-hidden /> Token stored encrypted
                    </span>
                    {canManage ? (
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => disconnect(platform)}>
                        <LogOut className="size-3.5" aria-hidden /> Disconnect
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <Button nativeButton={false} render={<a href="/api/meta/connect" />} disabled={!configured || !canManage}>
                    Connect with Facebook
                  </Button>
                )}
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

