"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, Sparkles, Trash2, Users } from "lucide-react";
import type { competitorSnapshots, competitors } from "@/db/schema";
import { addCompetitorAction, refreshCompetitorAction, removeCompetitorAction } from "@/server/actions/intelligence";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Competitor = typeof competitors.$inferSelect;
type Snapshot = typeof competitorSnapshots.$inferSelect;

function AddCompetitorDialog({ editable }: { editable: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    start(async () => {
      const r = await addCompetitorAction({ name, handle, notes: notes || undefined });
      if (r.ok) {
        toast.success("Competitor added — refresh it to pull a snapshot");
        setName(""); setHandle(""); setNotes("");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button disabled={!editable} />}>
        <Plus className="size-4" aria-hidden /> Add competitor
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a competitor</DialogTitle>
          <DialogDescription>
            Instagram username of a public Business or Creator account. Pulls official public data — no scraping.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="comp-name">Display name</Label>
            <Input id="comp-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120}
              placeholder="e.g. Canva Official PK" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comp-handle">Instagram username</Label>
            <Input id="comp-handle" value={handle} onChange={(e) => setHandle(e.target.value)} required maxLength={80}
              placeholder="username (no @)" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comp-notes">Notes (optional)</Label>
            <Input id="comp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
          </div>
          <Button type="submit" className="w-full" disabled={pending || !name.trim() || !handle.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Add
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CompetitorsClient({
  competitors,
  snapshots,
  editable,
}: {
  competitors: Competitor[];
  snapshots: Snapshot[];
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const latestByCompetitor = new Map<string, Snapshot>();
  for (const s of snapshots) {
    const prev = latestByCompetitor.get(s.competitorId);
    if (!prev || s.capturedAt > prev.capturedAt) latestByCompetitor.set(s.competitorId, s);
  }

  function refresh(compId: string) {
    start(async () => {
      const r = await refreshCompetitorAction(compId);
      if (r.ok) {
        toast.success("Snapshot captured");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function remove(compId: string) {
    start(async () => {
      const r = await removeCompetitorAction(compId);
      if (r.ok) {
        toast.success("Removed");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <AddCompetitorDialog editable={editable} />
      </div>

      {competitors.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
          <Users className="size-8 text-muted-foreground" aria-hidden />
          <p className="max-w-md text-sm text-muted-foreground">
            No competitors yet. Add Instagram usernames of public business accounts — snapshots use the official
            Business Discovery API through your connected account.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {competitors.map((comp) => {
            const snap = latestByCompetitor.get(comp.id);
            return (
              <Card key={comp.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">@{comp.handle}</CardTitle>
                      <CardDescription>
                        {comp.name}
                        {comp.lastAnalyzedAt ? ` · analyzed ${comp.lastAnalyzedAt.toLocaleDateString()}` : " · not analyzed yet"}
                      </CardDescription>
                    </div>
                    {editable ? (
                      <Button size="icon" variant="ghost" aria-label="Remove competitor" onClick={() => remove(comp.id)} disabled={pending}>
                        <Trash2 className="size-4 text-destructive" aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {snap ? (
                    <>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <Badge variant="secondary">Followers: {snap.followers?.toLocaleString() ?? "—"}</Badge>
                        <Badge variant="secondary">Posts: {snap.postsCount ?? "—"}</Badge>
                        <Badge variant="secondary">Avg engagement/post: {snap.avgEngagement ?? "—"}</Badge>
                      </div>
                      {snap.analysis ? (
                        <div className="rounded-lg border p-3">
                          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium">
                            <Sparkles className="size-3.5 text-primary" aria-hidden /> AI comparison (AI-generated)
                          </div>
                          <div className="whitespace-pre-wrap text-xs text-muted-foreground">{snap.analysis}</div>
                        </div>
                      ) : null}
                      {snap.recentPosts && Array.isArray(snap.recentPosts) && snap.recentPosts.length > 0 ? (
                        <div className="space-y-1">
                          {((snap.recentPosts as { caption?: string; likes?: number; comments?: number }[]).slice(0, 3)).map((p, i) => (
                            <p key={i} className="line-clamp-2 text-xs text-muted-foreground">
                              {p.caption || "(no caption)"} — {p.likes ?? 0} likes
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No snapshot yet — pull the first one below.</p>
                  )}
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => refresh(comp.id)} disabled={pending || !editable}>
                      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
                      Refresh snapshot
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
