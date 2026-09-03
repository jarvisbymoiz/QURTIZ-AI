"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Mail, ShieldAlert, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  authorizeWorkspaceDeleteAction,
  deleteWorkspaceAction,
  sendWorkspaceDeleteOtpAction,
  workspaceDeleteAuthorizedAction,
} from "@/server/actions/workspace-delete";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

// Mirrors CONFIRMATION_NOT_DETECTED_ERROR in src/server/actions/workspace-delete.ts
// ("use server" files may only export async functions, so the literal is mirrored
// here instead of imported). The action returns it while the emailed link has not
// been opened in this browser yet — treat it as "still pending": stay silent and
// keep polling. Every other error is real and stops the poll.
const CONFIRMATION_NOT_DETECTED_ERROR = "Email confirmation not detected yet.";

const CONFIRMATION_POLL_MS = 2500;

// Fixed id keeps the success toast from stacking when the ?wsdelete=authorized
// param handler, the typed-code path and the poll confirm around the same time.
const CONFIRMATION_SUCCESS_TOAST_ID = "ws-delete-email-confirmed";

type AuthorizedCheckResult =
  | { status: "authorized" }
  | { status: "pending" }
  | { status: "failed"; message: string };

/**
 * "Delete workspace" danger zone (owner only).
 *
 * Two-step confirmation dialog, never a single click:
 *  1. Ownership is proven with a Supabase email OTP sent to the owner's
 *     address — either the emailed link (lands back on /settings?
 *     wsdelete=authorized after /auth/workspace-delete) or the 6-digit code
 *     typed inline (client verifyOtp, then the authorize action). While
 *     waiting, this dialog polls the marker cookie, so confirming the link
 *     in any tab of this same browser advances it automatically.
 *  2. The workspace name must be typed exactly before the destructive action
 *     runs. On success the session is signed out and the user lands on
 *     /login — the workspace and every cascade of its data is gone.
 */

export function WorkspaceDeleteCard({
  workspaceId,
  workspaceName,
  userEmail,
  isOwner,
}: {
  workspaceId: string;
  workspaceName: string;
  userEmail: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  // false = step 1 (email OTP), true = step 2 (type name + delete)
  const [confirmed, setConfirmed] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checkingAuthorized, setCheckingAuthorized] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [typedName, setTypedName] = useState("");

  // Poll timer must be cleared when step 2 is reached, the dialog closes, a
  // probe hits a real error, or the component unmounts — otherwise the
  // interval leaks and keeps calling the action.
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  // Shared "ownership confirmed" transition to step 2 (type the name). The
  // ?wsdelete=authorized param handler, the typed-code path and the poll all
  // funnel through it, so a race between them stays idempotent: state updates
  // are no-ops once confirmed and the fixed toast id dedupes the toast.
  const markConfirmed = useCallback(() => {
    setConfirmed(true);
    setOpen(true);
    toast.success("Email confirmed — type the workspace name to finish deleting.", {
      id: CONFIRMATION_SUCCESS_TOAST_ID,
    });
  }, []);

  // One cheap read-only probe of the marker cookie. Returns an outcome; the
  // callers decide what to surface ("pending" is normal while the owner has
  // not opened the emailed link in this browser yet — it is not a failure).
  const runAuthorizedCheck = useCallback(async (): Promise<AuthorizedCheckResult> => {
    try {
      const r = await workspaceDeleteAuthorizedAction();
      if (r.ok) return { status: "authorized" };
      if (r.error === CONFIRMATION_NOT_DETECTED_ERROR) return { status: "pending" };
      return { status: "failed", message: r.error };
    } catch (err) {
      return {
        status: "failed",
        message: err instanceof Error ? err.message : "Could not check the email confirmation.",
      };
    }
  }, []);

  // While the dialog is on step 1, poll the marker cookie: when the emailed
  // link is confirmed in ANOTHER tab of this same browser, the
  // /auth/workspace-delete route sets the cookie here and this dialog
  // advances on its own. Never polls while a send/verify/delete request is in
  // flight, and each tick drops its result if its timer was cleared or
  // replaced while the probe was running (dialog closed, confirmed, unmount).
  useEffect(() => {
    if (!open || confirmed || !isOwner || emailBusy || codeBusy || deleting) return;

    const timerId = setInterval(() => {
      void (async () => {
        const r = await runAuthorizedCheck();
        if (pollTimer.current !== timerId) return; // stale tick
        if (r.status === "authorized") {
          stopPolling();
          markConfirmed();
        } else if (r.status === "failed") {
          // Real failure — surface it once and stop hammering the action.
          stopPolling();
          toast.error(r.message);
        }
        // "pending": the link just has not been opened in this browser yet —
        // stay silent and keep polling.
      })();
    }, CONFIRMATION_POLL_MS);
    pollTimer.current = timerId;

    return () => {
      if (pollTimer.current === timerId) pollTimer.current = null;
      clearInterval(timerId);
    };
  }, [
    open,
    confirmed,
    isOwner,
    emailBusy,
    codeBusy,
    deleting,
    markConfirmed,
    runAuthorizedCheck,
    stopPolling,
  ]);

  // Handles the return trip from the emailed confirmation link. The param is
  // cleared from the URL so a refresh/back never re-triggers the toast.
  const handledParam = useRef(false);
  useEffect(() => {
    const status = searchParams.get("wsdelete");
    if (!status || handledParam.current) return;
    handledParam.current = true;
    if (status === "authorized") {
      markConfirmed();
    } else if (status === "denied") {
      toast.error("Confirmation failed. Please start the deletion flow again.");
    }
    router.replace("/settings");
  }, [router, searchParams, markConfirmed]);

  function openFlow() {
    setConfirmed(false);
    setOtpCode("");
    setTypedName("");
    setOpen(true);
  }

  function closeDialog(next: boolean) {
    setOpen(next);
    if (!next) {
      setConfirmed(false);
      setOtpCode("");
      setTypedName("");
    }
  }

  async function sendEmail() {
    if (emailBusy) return;
    const email = userEmail.trim();
    if (!email) {
      toast.error("Your account has no email address to send the confirmation to.");
      return;
    }
    setEmailBusy(true);
    try {
      // Server gate: membership, permission, rate limit, owner check.
      const r = await sendWorkspaceDeleteOtpAction();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: r.email || email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/workspace-delete?workspaceId=${encodeURIComponent(workspaceId)}`,
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Check your inbox and click the confirmation link.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not send the confirmation email.",
      );
    } finally {
      setEmailBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (codeBusy) return;
    const email = userEmail.trim();
    if (!email) {
      toast.error("Your account has no email address to verify against.");
      return;
    }
    const token = otpCode.trim();
    if (!token) return;
    setCodeBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      // OTP verified → mint the short-lived marker cookie server-side.
      const auth = await authorizeWorkspaceDeleteAction();
      if (!auth.ok) {
        toast.error(auth.error);
        return;
      }
      markConfirmed();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not verify the code.");
    } finally {
      setCodeBusy(false);
    }
  }

  // Manual fallback for "I opened the link, but this dialog has not advanced":
  // run the same probe once, right now, instead of waiting for the next poll
  // tick. Still pending (link not opened in THIS browser) gets a gentle hint —
  // the poll itself stays silent for that outcome.
  async function continueAfterLink() {
    if (checkingAuthorized) return;
    setCheckingAuthorized(true);
    try {
      const r = await runAuthorizedCheck();
      if (r.status === "authorized") {
        markConfirmed();
        return;
      }
      if (r.status === "pending") {
        toast.info(
          "Confirmation not detected yet — the link must be opened in this same browser. Still stuck? Use the code from the email.",
        );
        return;
      }
      toast.error(r.message);
    } finally {
      setCheckingAuthorized(false);
    }
  }

  async function confirmDelete() {
    if (deleting || typedName !== workspaceName) return;
    setDeleting(true);
    try {
      const r = await deleteWorkspaceAction({ workspaceName: typedName });
      if (!r.ok) {
        toast.error(r.error);
        // Marker expired (or never set) — back to the email step.
        if (r.error.includes("missing or expired")) {
          setConfirmed(false);
          setTypedName("");
        }
        return;
      }
      toast.success("Workspace deleted.");
      setOpen(false);
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the workspace.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trash2 className="size-4 text-destructive" aria-hidden /> Delete workspace
        </CardTitle>
        <CardDescription>
          Permanently delete this workspace and everything in it. This cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isOwner ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            <p className="text-sm text-destructive">
              Only the workspace owner can delete it. Ask the owner to sign in and use this
              card.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Deleting removes all content, drafts, scheduled and published posts, visuals,
              research, brand data, analytics, campaigns, autopilot settings and chat history.
              Connected social accounts are disconnected and publishing stops immediately.
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="destructive" onClick={openFlow} disabled={!isOwner}>
            <Trash2 className="size-4" aria-hidden /> Delete workspace
          </Button>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogContent>
          {!confirmed ? (
            <>
              <DialogHeader>
                <DialogTitle>Confirm you own this workspace</DialogTitle>
                <DialogDescription>
                  We&apos;ll email a one-time confirmation to the address on your account. The
                  workspace <span className="font-medium text-foreground">{workspaceName}</span>{" "}
                  can then be permanently deleted — this cannot be undone.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label htmlFor="ws-delete-email">Confirmation email</Label>
                <Input
                  id="ws-delete-email"
                  type="email"
                  value={userEmail}
                  readOnly
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  The link must be opened in this same browser where you sent the email —
                  this dialog advances automatically once it&apos;s confirmed, even when
                  the link opens in another tab. Prefer a code? Enter the 6-digit code
                  from the email below instead.
                </p>
              </div>

              <Button type="button" onClick={() => void sendEmail()} disabled={emailBusy}>
                {emailBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Mail className="size-4" aria-hidden />}
                {emailBusy ? "Sending…" : "Send confirmation email"}
              </Button>

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">or</span>
                <Separator className="flex-1" />
              </div>

              <form onSubmit={(e) => void verifyCode(e)} className="space-y-2">
                <Label htmlFor="ws-delete-code">Enter the code from the email</Label>
                <div className="flex gap-2">
                  <Input
                    id="ws-delete-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    className="font-mono"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                  />
                  <Button type="submit" variant="secondary" disabled={codeBusy || otpCode.trim().length === 0}>
                    {codeBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    {codeBusy ? "Verifying…" : "Verify code"}
                  </Button>
                </div>
              </form>

              <Button
                type="button"
                variant="outline"
                className="w-full text-muted-foreground"
                onClick={() => void continueAfterLink()}
                disabled={checkingAuthorized || emailBusy || codeBusy}
              >
                {checkingAuthorized ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                {checkingAuthorized ? "Checking…" : "I clicked the confirmation link — continue"}
              </Button>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-destructive">
                  Permanently delete this workspace?
                </DialogTitle>
                <DialogDescription>
                  This deletes <span className="font-medium text-foreground">{workspaceName}</span>{" "}
                  and all of its data — content, visuals, research, brand data, analytics,
                  campaigns and chat history — right now. Publishing stops and connected social
                  accounts are disconnected. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label htmlFor="ws-delete-name">
                  Type <span className="font-mono text-foreground">{workspaceName}</span> to
                  confirm
                </Label>
                <Input
                  id="ws-delete-name"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder={workspaceName}
                  autoComplete="off"
                  autoFocus
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => closeDialog(false)} disabled={deleting}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void confirmDelete()}
                  disabled={typedName !== workspaceName || deleting}
                >
                  {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
                  {deleting ? "Deleting…" : "Permanently delete workspace"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
