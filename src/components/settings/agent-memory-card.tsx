"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { manageAgentMemoryAction, updateAgentProfileAction } from "@/server/actions/agent-memory";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

type Memory = { id: string; memoryKey: string | null; content: string; category: string; type: "preference" | "fact" | "rule"; source: string };
type Profile = { operatingInstructions: string; strategy: string; workflow: string; platforms: string };
export function AgentMemoryCard({ workspaceId, personal, workspace, profile, workspaceEditable, profileEditable }: {
  workspaceId: string; personal: Memory[]; workspace: Memory[]; profile: Profile | null; workspaceEditable: boolean; profileEditable: boolean;
}) {
  const [scope, setScope] = useState<"user" | "workspace">("user");
  const [editing, setEditing] = useState<Memory | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const editable = scope === "user" || workspaceEditable;
  const run = (operation: () => Promise<{ ok: boolean; error?: string }>) => startTransition(async () => {
    try {
      const result = await operation();
      if (!result.ok) toast.error(result.error ?? "Could not save memory.");
      else { toast.success("Agent memory updated"); setEditing(null); router.refresh(); }
    } catch { toast.error("Connection interrupted. Your saved memories are preserved; please retry."); }
  });
  const field = "w-full rounded-md border bg-background px-3 py-2 text-sm";
  return <Card>
    <CardHeader><CardTitle className="text-base">Agent Identity &amp; Memory</CardTitle>
      <CardDescription>Private preferences belong to you in this workspace. Workspace learnings are shared with its members. Qurtiz’s protected identity and permissions cannot be changed by learning.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Memory scope">
        <Button variant={scope === "user" ? "default" : "outline"} onClick={() => { setScope("user"); setEditing(null); }}>My Preferences / Memory ({personal.length})</Button>
        <Button variant={scope === "workspace" ? "default" : "outline"} onClick={() => { setScope("workspace"); setEditing(null); }}>Workspace Agent Memory ({workspace.length})</Button>
      </div>
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {(scope === "user" ? personal : workspace).map(memory => <div key={memory.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-3">
          <div className="min-w-0 flex-1"><p className="whitespace-pre-wrap break-words text-sm">{memory.content}</p><p className="text-xs text-muted-foreground">{memory.category} · {memory.source}</p></div>
          {editable && <div className="flex gap-1"><Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing(memory)}>Edit</Button><Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => manageAgentMemoryAction(workspaceId, "delete", { scope, id: memory.id }))}>Forget</Button></div>}
        </div>)}
        {!(scope === "user" ? personal : workspace).length && <p className="text-sm text-muted-foreground">No memories saved yet. Tell the Agent what to remember, or add a preference below.</p>}
      </div>
      {editable && <form key={scope + (editing?.id ?? "new")} className="space-y-2" action={data => run(() => manageAgentMemoryAction(workspaceId, "save", {
        scope, id: editing?.id, type: editing?.type ?? "preference", category: data.get("category"), key: editing?.memoryKey ?? undefined, content: data.get("content"),
      }))}>
        <label className="block space-y-1 text-sm">{editing ? "Edit memory" : "Add a memory"}<textarea className={field} name="content" required minLength={3} maxLength={1000} rows={2} defaultValue={editing?.content ?? ""} /></label>
        <div className="flex flex-wrap items-center gap-2"><label className="text-sm">Category <select className="ml-2 rounded-md border bg-background p-2" name="category" defaultValue={editing?.category ?? "copy"}>{["general", "copy", "visual", "strategy", "workflow", "research", "analytics", "scheduling"].map(value => <option key={value}>{value}</option>)}</select></label>
          <Button size="sm" type="submit" disabled={pending}>Save memory</Button>{editing && <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(null)}>Cancel</Button>}</div>
      </form>}
      <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">Workspace Agent Profile</summary>
        <form className="mt-3 grid gap-3 sm:grid-cols-2" action={data => run(() => updateAgentProfileAction(workspaceId, Object.fromEntries(["operatingInstructions", "strategy", "workflow", "platforms"].map(key => [key, data.get(key) ?? ""]))))}>
          {([['operatingInstructions', 'Operating guidance'], ['strategy', 'Content strategy'], ['workflow', 'Workflow preferences'], ['platforms', 'Platform preferences']] as const).map(([key, label]) => <label key={key} className="space-y-1 text-sm">{label}<textarea className={field} name={key} defaultValue={profile?.[key] ?? ""} rows={2} maxLength={1000} disabled={!profileEditable} /></label>)}
          {profileEditable ? <Button type="submit" size="sm" disabled={pending} className="w-fit">Save profile</Button> : <p className="text-xs text-muted-foreground">Only workspace admins can edit this profile.</p>}
        </form>
      </details>
    </CardContent>
  </Card>;
}
