"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { connectLocalChatGPT, disconnectLocalChatGPT, getLocalAccountStatus,
  pairLocalCompanion, testLocalImage, type LocalAccountStatus } from "@/lib/ai/local-companion";
import { getImageModePreferenceAction, saveImageModePreferenceAction, type ImageMode } from "@/server/actions/image-mode";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Detection = "checking" | "ready" | "missing";
const SETUP_GUIDE = "https://github.com/jarvisbymoiz/QURTIZ-AI/blob/main/docs/LOCAL_IMAGE_COMPANION.md";

export function ImageModeCard({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  const [mode, setMode] = useState<ImageMode>("api");
  const [savedMode, setSavedMode] = useState<ImageMode>("api");
  const [detection, setDetection] = useState<Detection>("checking");
  const [account, setAccount] = useState<LocalAccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [mobileBrowser, setMobileBrowser] = useState(false);
  const imageRequestRef = useRef(false);

  useEffect(() => { setMobileBrowser(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)); }, []);

  useEffect(() => {
    let cancelled = false;
    void getImageModePreferenceAction().then(result => {
      if (cancelled) return;
      if (!result.ok) setMessage(result.error);
      else { setMode(result.preference.mode); setSavedMode(result.preference.mode); }
    }).catch(() => { if (!cancelled) setMessage("Could not load image mode."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, workspaceId]);

  useEffect(() => {
    if (loading || mode !== "local_companion") return;
    let cancelled = false;
    setDetection("checking");
    void pairLocalCompanion(userId, workspaceId).then(async key => {
      const status = await getLocalAccountStatus(key);
      if (cancelled) return;
      if (status.connected && status.imageRouteReady && savedMode !== "local_companion") {
        const saved = await saveImageModePreferenceAction({ mode: "local_companion", modelId: null });
        if (!saved.ok) throw new Error(saved.error);
        if (!cancelled) setSavedMode("local_companion");
      }
      if (cancelled) return;
      setAccount(status);
      setDetection("ready");
    }).catch(error => {
      if (cancelled) return;
      setDetection("missing");
      setMessage(error instanceof Error ? error.message : "Qurtiz Companion is not running.");
    });
    return () => { cancelled = true; };
  }, [loading, mode, userId, workspaceId, retryNonce, savedMode]);

  useEffect(() => {
    if (loading || mode !== "local_companion" || busy) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void pairLocalCompanion(userId, workspaceId).then(getLocalAccountStatus).then(status => {
        if (cancelled) return;
        setAccount(status);
        setDetection("ready");
      }).catch(() => {
        if (cancelled) return;
        setAccount(null);
        setDetection("missing");
      });
    }, 15_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [loading, mode, userId, workspaceId, busy]);

  async function selectApi() {
    setBusy(true);
    try {
      const result = await saveImageModePreferenceAction({ mode: "api", modelId: null });
      if (!result.ok) throw new Error(result.error);
      setMode("api"); setSavedMode("api"); setMessage(null);
      toast.success("API Mode selected");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not select API Mode."); }
    finally { setBusy(false); }
  }

  async function connect() {
    setBusy(true); setMessage(null);
    try {
      const key = await pairLocalCompanion(userId, workspaceId);
      const status = await connectLocalChatGPT(key);
      if (!status.connected) throw new Error("ChatGPT login did not finish. Try Connect ChatGPT again.");
      const result = await saveImageModePreferenceAction({ mode: "local_companion", modelId: null });
      if (!result.ok) throw new Error(result.error);
      setAccount(status); setSavedMode("local_companion"); setDetection("ready");
      toast.success("ChatGPT account connected");
    } catch (error) { setMessage(error instanceof Error ? error.message : "ChatGPT connection failed."); }
    finally { setBusy(false); }
  }

  async function testImage() {
    if (imageRequestRef.current) return;
    imageRequestRef.current = true;
    setBusy(true); setMessage(null);
    try {
      const key = await pairLocalCompanion(userId, workspaceId);
      await testLocalImage(key);
      setAccount(await getLocalAccountStatus(key));
      toast.success("Test image generated locally");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Test image failed."); }
    finally { imageRequestRef.current = false; setBusy(false); }
  }

  async function disconnect() {
    setBusy(true); setMessage(null);
    try {
      const key = await pairLocalCompanion(userId, workspaceId);
      await disconnectLocalChatGPT(key, userId, workspaceId);
      const result = await saveImageModePreferenceAction({ mode: "api", modelId: null });
      if (!result.ok) throw new Error(result.error);
      setAccount(null); setMode("api"); setSavedMode("api");
      toast.success("Qurtiz disconnected from the local account");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not disconnect."); }
    finally { setBusy(false); }
  }

  return <Card>
    <CardHeader>
      <CardTitle>Image generation mode</CardTitle>
      <CardDescription>Choose how Qurtiz creates images for you in Content Studio.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {loading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading…</p> : <>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" disabled={busy} onClick={() => void selectApi()}
            className={`rounded-lg border p-3 text-left text-sm ${mode === "api" ? "border-primary" : ""}`}>
            <strong>API Mode</strong><br /><span className="text-muted-foreground">Use my configured API provider</span>
          </button>
          <button type="button" disabled={busy} onClick={() => { setMode("local_companion"); setMessage(null); }}
            className={`rounded-lg border p-3 text-left text-sm ${mode === "local_companion" ? "border-primary" : ""}`}>
            <strong>ChatGPT Account Mode</strong><br /><span className="text-muted-foreground">Use my ChatGPT account</span>
          </button>
        </div>
        {mode === "local_companion" ? <div className="space-y-3">
          {detection === "checking" ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Looking for Qurtiz Companion…</p> : null}
          {detection === "missing" ? <div className="space-y-2 rounded-lg border p-3 text-sm">
            <p>{mobileBrowser ? "This local companion works in a browser on the same Windows PC where it is installed. A phone cannot reach the PC companion yet." : "Qurtiz Companion is required on this computer."}</p>
            <div className="flex flex-wrap gap-2"><a className={buttonVariants({ variant: "outline" })} href={SETUP_GUIDE} target="_blank" rel="noopener noreferrer">{mobileBrowser ? "PC setup guide" : "Install / Start Companion"}</a>
              <Button variant="ghost" onClick={() => { setMessage(null); setRetryNonce(value => value + 1); }}>Try again</Button></div>
          </div> : null}
          {detection === "ready" && account?.connected ? <div className="space-y-3 rounded-lg border p-3 text-sm">
            <p className="flex items-center gap-2 font-medium"><CheckCircle2 className="size-4 text-green-600" /> ChatGPT Account Connected</p>
            {account.email ? <p>Connected as {account.email}</p> : null}
            {account.planType ? <p className="text-muted-foreground">Account plan: {account.planType}</p> : null}
            <p className="text-muted-foreground">Image generation: {account.imageStatus === "rate_limited"
              ? "Rate limited" : account.imageStatus === "available" ? "Available" : "Unavailable"}</p>
            {account.imageStatus === "available" && !account.lastImageTestOk ?
              <p className="text-xs text-muted-foreground">Availability is based on account capabilities; generation is verified by a real request.</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={busy} onClick={() => void testImage()}>Test Image</Button>
              <Button variant="outline" disabled={busy} onClick={() => void connect()}>Reconnect</Button>
              <Button variant="ghost" disabled={busy} onClick={() => void disconnect()}>Disconnect</Button>
            </div>
          </div> : null}
          {detection === "ready" && !account?.connected ? <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void connect()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} Connect ChatGPT
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void disconnect()}>Cancel</Button>
          </div> : null}
          <p className="flex items-start gap-2 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> Experimental and unofficial: ChatGPT web-image access can change, use limited quota, or carry account risk. Authentication stays on this computer.</p>
          <p className="text-xs text-muted-foreground">Test Image creates a real image and may use your account&apos;s image quota.</p>
          {savedMode !== "local_companion" && account?.connected ? <p className="text-xs text-muted-foreground">Finish connecting to enable ChatGPT Account Mode in this workspace.</p> : null}
        </div> : null}
          {message && !(mobileBrowser && detection === "missing") ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
      </>}
    </CardContent>
  </Card>;
}
