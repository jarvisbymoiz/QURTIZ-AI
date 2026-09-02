"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Mail, ShieldAlert, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  authorizeWorkspaceDeleteAction,
  deleteWorkspaceAction,
  sendWorkspaceDeleteOtpAction,
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

/**
 * "Delete workspace" danger zone (owner only).
 *
 * Two-step confirmation dialog, never a single click:
 *  1. Ownership is proven with a Supabase email OTP sent to the owner's
 *     address — either the emailed link (lands back on /settings?
 *     wsdelete=authorized after /auth/workspace-delete) or the 6-digit code
 *     typed inline (client verifyOtp, then the authorize action).
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
  const [otpCode, setOtpCode] = useState("");
  const [typedName, setTypedName] = useState("");

  // Handles the return trip from the emailed confirmation link. The param is
  // cleared from the URL so a refresh/back never re-triggers the toast.
  const handledParam = useRef(false);
  useEffect(() => {
    const status = searchParams.get("wsdelete");
    if (!status || handledParam.current) return;
    handledParam.current = true;
    if (status === "authorized") {
      setConfirmed(true);
      setOpen(true);
      toast.success("Email confirmed — type the workspace name to finish deleting.");
    } else if (status === "denied") {
      toast.error("Confirmation failed. Please start the deletion flow again.");
    }
    router.replace("/settings");
  }, [router, searchParams]);

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
      setConfirmed(true);
      toast.success("Email confirmed — type the workspace name to finish deleting.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not verify the code.");
    } finally {
      setCodeBusy(false);
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
