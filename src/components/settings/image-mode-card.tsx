"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { connectLocalChatGPT, disconnectLocalChatGPT, pairCloudCompanion,
  pairLocalCompanion } from "@/lib/ai/local-companion";
import { beginCompanionPairingAction, listCompanionDevicesAction,
  revokeCompanionDeviceAction } from "@/server/actions/companion-pairing";
import { enqueueCompanionTestImageAction, getCompanionImageJobAction } from "@/server/actions/companion-image";
import { getImageModePreferenceAction, saveCompanionOfflinePolicyAction,
  saveImageModePreferenceAction, type ImageMode } from "@/server/actions/image-mode";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SETUP_GUIDE = "https://github.com/jarvisbymoiz/QURTIZ-AI/blob/main/docs/LOCAL_IMAGE_COMPANION.md";
type Device = { id: string; displayName: string; chatgptConnected: boolean; imageStatus: string;
  online: boolean; lastSeenAt: Date | null; createdAt: Date };

export function ImageModeCard({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  const [mode, setMode] = useState<ImageMode>("api");
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mobileBrowser, setMobileBrowser] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [testJobId, setTestJobId] = useState<string | null>(null);
  const [offlinePolicy, setOfflinePolicy] = useState<"wait" | "api_fallback" | "fail">("wait");
  const [timeoutMinutes, setTimeoutMinutes] = useState(120);
  const requestRef = useRef(false);
  const device = devices[0] ?? null;

  const refreshDevices = useCallback(async () => {
    const result = await listCompanionDevicesAction();
    if (!result.ok) throw new Error(result.error);
    setDevices(result.devices);
  }, []);

  useEffect(() => {
    setMobileBrowser(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    let cancelled = false;
    void Promise.all([getImageModePreferenceAction(), listCompanionDevicesAction()]).then(([preference, deviceList]) => {
      if (cancelled) return;
      if (preference.ok) {
        setMode(preference.preference.mode);
        setOfflinePolicy(preference.preference.companionOfflinePolicy);
        setTimeoutMinutes(preference.preference.companionTimeoutMinutes);
      }
      else setMessage(preference.error);
      if (deviceList.ok) setDevices(deviceList.devices);
      else setMessage(deviceList.error);
    }).catch(() => { if (!cancelled) setMessage("Could not load image connection settings."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, workspaceId]);

  useEffect(() => {
    const timer = window.setInterval(() => { void refreshDevices().catch(() => undefined); }, 15_000);
    return () => window.clearInterval(timer);
  }, [refreshDevices]);

  useEffect(() => {
    if (!testJobId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await getCompanionImageJobAction(testJobId);
        if (stopped) return;
        if (!result.ok) throw new Error(result.error);
        if (result.job.status === "completed") {
          setTestJobId(null); toast.success("Real ChatGPT test image generated"); return;
        }
        if (result.job.status === "failed") {
          setTestJobId(null); setMessage(result.job.error ?? "Test image failed."); return;
        }
      } catch (error) { if (!stopped) setMessage(error instanceof Error ? error.message : "Could not check test image."); }
      if (!stopped) timer = setTimeout(poll, 5_000);
    };
    timer = setTimeout(poll, 2_000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [testJobId]);

  async function selectMode(selected: ImageMode) {
    setMessage(null);
    if (selected === "local_companion" && !device) { setMode(selected); return; }
    setBusy(true);
    try {
      const result = await saveImageModePreferenceAction({ mode: selected, modelId: null });
      if (!result.ok) throw new Error(result.error);
      setMode(selected);
      toast.success(selected === "api" ? "API Mode selected" : "ChatGPT Account Mode selected");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not change image mode."); }
    finally { setBusy(false); }
  }

  async function pairComputer() {
    if (mobileBrowser || requestRef.current) return;
    requestRef.current = true; setBusy(true); setMessage(null);
    try {
      const key = await pairLocalCompanion(userId, workspaceId);
      const challenge = await beginCompanionPairingAction();
      if (!challenge.ok) throw new Error(challenge.error);
      await pairCloudCompanion(key, challenge.challenge);
      await refreshDevices();
      const saved = await saveImageModePreferenceAction({ mode: "local_companion", modelId: null });
      if (!saved.ok) throw new Error(saved.error);
      setMode("local_companion");
      toast.success("Qurtiz Companion paired to this workspace");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not pair this computer."); }
    finally { requestRef.current = false; setBusy(false); }
  }

  async function connect() {
    if (mobileBrowser || requestRef.current) return;
    requestRef.current = true; setBusy(true); setMessage(null);
    try {
      const key = await pairLocalCompanion(userId, workspaceId);
      const status = await connectLocalChatGPT(key);
      if (!status.connected) throw new Error("ChatGPT login did not finish on this PC.");
      await refreshDevices();
      toast.success("ChatGPT connected locally. Cloud status will update shortly.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "ChatGPT connection failed."); }
    finally { requestRef.current = false; setBusy(false); }
  }

  async function testImage() {
    if (requestRef.current || testJobId) return;
    requestRef.current = true; setBusy(true); setMessage(null);
    try {
      const result = await enqueueCompanionTestImageAction(crypto.randomUUID());
      if (!result.ok) throw new Error(result.error);
      setTestJobId(result.job.id);
      toast.success(result.job.status === "waiting_for_companion"
        ? "Test queued until your PC companion reconnects." : "Test image queued on your PC companion.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Test image failed."); }
    finally { requestRef.current = false; setBusy(false); }
  }

  async function disconnect() {
    if (!device) return;
    setBusy(true); setMessage(null);
    try {
      const revoked = await revokeCompanionDeviceAction(device.id);
      if (!revoked.ok) throw new Error(revoked.error);
      if (!mobileBrowser) {
        try {
          const key = await pairLocalCompanion(userId, workspaceId);
          await disconnectLocalChatGPT(key, userId, workspaceId);
        } catch { /* Cloud access was revoked; local OAuth may need removal on the PC. */ }
      }
      const saved = await saveImageModePreferenceAction({ mode: "api", modelId: null });
      if (!saved.ok) throw new Error(saved.error);
      await refreshDevices(); setMode("api");
      toast.success("Companion access revoked from Qurtiz");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not disconnect companion."); }
    finally { setBusy(false); }
  }

  async function saveOfflinePolicy(policy: "wait" | "api_fallback" | "fail", minutes: number) {
    setBusy(true); setMessage(null);
    try {
      const result = await saveCompanionOfflinePolicyAction({ policy, timeoutMinutes: minutes });
      if (!result.ok) throw new Error(result.error);
      setOfflinePolicy(policy); setTimeoutMinutes(minutes);
      toast.success("Auto Run companion fallback saved");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save fallback setting."); }
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
          <button type="button" disabled={busy} onClick={() => void selectMode("api")}
            className={`rounded-lg border p-3 text-left text-sm ${mode === "api" ? "border-primary" : ""}`}>
            <strong>API Mode</strong><br /><span className="text-muted-foreground">Use my configured API provider</span>
          </button>
          <button type="button" disabled={busy} onClick={() => void selectMode("local_companion")}
            className={`rounded-lg border p-3 text-left text-sm ${mode === "local_companion" ? "border-primary" : ""}`}>
            <strong>ChatGPT Account Mode</strong><br /><span className="text-muted-foreground">Use my ChatGPT account through my paired PC</span>
          </button>
        </div>
        {mode === "local_companion" ? <div className="space-y-3">
          {!device ? <div className="space-y-2 rounded-lg border p-3 text-sm">
            <p>No companion is paired to this workspace yet.</p>
            {mobileBrowser ? <p className="text-muted-foreground">Install and pair Qurtiz Companion on your Windows PC first. Then return here on your phone.</p> : null}
            <div className="flex flex-wrap gap-2">
              <a className={buttonVariants({ variant: "outline" })} href={SETUP_GUIDE} target="_blank" rel="noopener noreferrer">Install Qurtiz Companion</a>
              {!mobileBrowser ? <Button disabled={busy} onClick={() => void pairComputer()}>Pair this computer</Button> : null}
            </div>
          </div> : <div className="space-y-2 rounded-lg border p-3 text-sm">
            <p className="font-medium">Qurtiz Companion {device.displayName}</p>
            <p className={device.online ? "text-green-600" : "text-muted-foreground"}>
              {device.online ? "Online ✅" : "Offline — image jobs will wait until this PC reconnects."}</p>
            <p className="flex items-center gap-2">{device.chatgptConnected ? <CheckCircle2 className="size-4 text-green-600" /> : null}
              ChatGPT {device.chatgptConnected ? "Connected ✅" : "Disconnected"}</p>
            <p className="text-muted-foreground">Image generation: {device.imageStatus === "rate_limited" ? "Rate limited"
              : device.imageStatus === "available" ? "Available" : "Unavailable"}</p>
            {!device.chatgptConnected && mobileBrowser ? <p className="text-muted-foreground">Open Qurtiz on the paired PC to complete ChatGPT sign-in.</p> : null}
            <div className="flex flex-wrap gap-2">
              {!mobileBrowser ? <Button variant="outline" disabled={busy} onClick={() => void connect()}>
                {device.chatgptConnected ? "Reconnect ChatGPT" : "Connect ChatGPT"}</Button> : null}
              <Button variant="outline" disabled={busy || !!testJobId} onClick={() => void testImage()}>Test Image</Button>
              <Button variant="ghost" disabled={busy} onClick={() => void disconnect()}>Disconnect</Button>
            </div>
          </div>}
          {testJobId ? <p role="status" className="text-xs text-muted-foreground">Test image queued or generating on your PC companion…</p> : null}
          {device ? <div className="space-y-2 rounded-lg border p-3 text-sm">
            <p className="font-medium">Auto Run when companion is offline</p>
            <label className="block text-xs text-muted-foreground" htmlFor="companion-offline-policy">Fallback choice</label>
            <select id="companion-offline-policy" className="w-full rounded-md border bg-background p-2" disabled={busy}
              value={offlinePolicy} onChange={event => void saveOfflinePolicy(event.target.value as "wait" | "api_fallback" | "fail", timeoutMinutes)}>
              <option value="wait">Wait for companion</option>
              <option value="api_fallback">Use configured API image provider</option>
              <option value="fail">Keep post for review and notify me</option>
            </select>
            {offlinePolicy === "wait" ? <label className="block text-xs text-muted-foreground" htmlFor="companion-wait-timeout">Maximum wait</label> : null}
            {offlinePolicy === "wait" ? <select id="companion-wait-timeout" className="w-full rounded-md border bg-background p-2" disabled={busy}
              value={timeoutMinutes} onChange={event => void saveOfflinePolicy(offlinePolicy, Number(event.target.value))}>
              <option value={30}>30 minutes</option><option value={120}>2 hours</option><option value={360}>6 hours</option><option value={1440}>24 hours</option>
            </select> : null}
          </div> : null}
          <p className="flex items-start gap-2 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> Experimental and unofficial: ChatGPT image access can change, use limited quota, or carry account risk. ChatGPT authentication stays on your PC.</p>
          <p className="text-xs text-muted-foreground">Test Image creates a real image and may use your account&apos;s image quota.</p>
        </div> : null}
        {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
      </>}
    </CardContent>
  </Card>;
}
