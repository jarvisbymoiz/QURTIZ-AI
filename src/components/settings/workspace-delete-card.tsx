"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldAlert, Trash2 } from "lucide-react";
import { deleteWorkspaceAction } from "@/server/actions/workspace-delete";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function WorkspaceDeleteCard({ workspaceId, workspaceName, userEmail, isOwner }: {
  workspaceId: string; workspaceName: string; userEmail: string; isOwner: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState({ id: workspaceId, name: workspaceName });
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function changeOpen(value: boolean) {
    if (deleting) return;
    if (value) setTarget({ id: workspaceId, name: workspaceName });
    setOpen(value); setPassword(""); setError(null);
  }
  async function confirmDelete(event: React.FormEvent) {
    event.preventDefault();
    if (deleting || !password || !isOwner) return;
    setDeleting(true); setError(null);
    try {
      const result = await deleteWorkspaceAction({ workspaceId: target.id, password });
      setPassword("");
      if (!result.ok) { setError(result.error); return; }
      setOpen(false);
      toast.success("Workspace removed. Background data cleanup is queued.");
      router.replace(result.nextPath); router.refresh();
    } catch {
      setPassword(""); setError("Could not delete the workspace. Please try again.");
    } finally { setDeleting(false); }
  }
  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base"><Trash2 className="size-4 text-destructive" aria-hidden />Delete workspace</CardTitle>
      <CardDescription>Permanently remove this workspace. Your account and other workspaces stay available.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <p className="text-sm text-muted-foreground">{isOwner ? "Access to this workspace is removed immediately. Its content, brand data, chats, analytics and files are deleted automatically in the background. This cannot be undone." : "Only the workspace owner can delete it."}</p>
      </div>
      <div className="flex justify-end"><Button variant="destructive" disabled={!isOwner} onClick={() => changeOpen(true)}><Trash2 className="size-4" aria-hidden />Delete workspace</Button></div>
    </CardContent>
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Delete {target.name}?</DialogTitle><DialogDescription>Enter the account password for {userEmail} to permanently remove only this workspace. No email link or OTP is required.</DialogDescription></DialogHeader>
        <form onSubmit={confirmDelete} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="ws-delete-password">Account password</Label><Input id="ws-delete-password" type="password" autoComplete="current-password" autoFocus required maxLength={1024} value={password} disabled={deleting} onChange={event => { setPassword(event.target.value); setError(null); }} /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">Already published posts on Facebook or Instagram are not removed from those platforms.</p>
          <DialogFooter><Button type="button" variant="outline" disabled={deleting} onClick={() => changeOpen(false)}>Cancel</Button><Button type="submit" variant="destructive" disabled={deleting || !password}>{deleting ? "Deleting…" : "Permanently delete workspace"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </Card>;
}
