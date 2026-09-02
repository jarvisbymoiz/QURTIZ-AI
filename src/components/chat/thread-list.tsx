"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteThreadAction,
  loadThreadsAction,
  renameThreadAction,
  searchChatsAction,
  setThreadArchivedAction,
  setThreadPinnedAction,
  type ThreadSearchResult,
} from "@/server/actions/chat";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ThreadRow = {
  id: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  updatedAt: string;
};

function dateGroup(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((startOfToday.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "Previous 7 days";
  if (diffDays <= 30) return "Previous 30 days";
  return "Older";
}

function groupThreads(threads: ThreadRow[]): { group: string; items: ThreadRow[] }[] {
  const groups = new Map<string, ThreadRow[]>();
  for (const t of threads) {
    const g = dateGroup(t.updatedAt);
    const list = groups.get(g) ?? [];
    list.push(t);
    groups.set(g, list);
  }
  const order = ["Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older"];
  return order.filter((g) => groups.has(g)).map((g) => ({ group: g, items: groups.get(g)! }));
}

export function ThreadList({ activeThreadId }: { activeThreadId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ThreadSearchResult[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [renaming, setRenaming] = useState<ThreadRow | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<ThreadRow | null>(null);
  const [pending, start] = useTransition();

  function refresh() {
    start(async () => {
      const r = await loadThreadsAction();
      if (r.ok) setThreads(r.threads);
      setLoading(false);
    });
  }

  useEffect(() => {
    refresh();
  }, [activeThreadId, pathname]);

  // Debounced search
  useEffect(() => {
    if (!searchOpen || query.trim().length < 2) {
      setResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      const r = await searchChatsAction(query);
      setResults(r.results);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchOpen]);

  const active = useMemo(() => threads.filter((t) => !t.archived), [threads]);
  const archived = useMemo(() => threads.filter((t) => t.archived), [threads]);
  const pinnedFirst = useMemo(() => [...active].sort((a, b) => Number(b.pinned) - Number(a.pinned)), [active]);
  const grouped = useMemo(() => groupThreads(pinnedFirst), [pinnedFirst]);

  function menu(fn: () => Promise<ActionResult2>, msg: string) {
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(msg);
        router.refresh();
        refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <Button className="w-full justify-start gap-2" nativeButton={false} render={<Link href="/chat" />}>
        <Plus className="size-4" aria-hidden /> New chat
      </Button>

      <Button
        variant="outline"
        className={cn("w-full justify-start gap-2", searchOpen && "border-primary")}
        onClick={() => {
          setSearchOpen((v) => !v);
          if (searchOpen) { setQuery(""); setResults(null); }
        }}
      >
        <Search className="size-4" aria-hidden />
        Search chats
      </Button>

      {searchOpen ? (
        <div className="space-y-1 rounded-lg border p-2">
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles and messages…"
              className="h-8 text-sm"
            />
            <Button size="icon" variant="ghost" aria-label="Close search" onClick={() => { setSearchOpen(false); setQuery(""); setResults(null); }}>
              <X className="size-4" aria-hidden />
            </Button>
          </div>
          {query.trim().length >= 2 && results !== null ? (
            <div className="max-h-72 space-y-1 overflow-y-auto scroll-thin">
              {results.length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">No matches found.</p>
              ) : (
                results.map((r, i) => (
                  <Link
                    key={r.messageId ?? r.threadId + "-" + i}
                    href={r.messageId ? `/chat/${r.threadId}?m=${encodeURIComponent(r.messageId)}` : `/chat/${r.threadId}`}
                    onClick={() => setSearchOpen(false)}
                    className="block rounded-md border p-2 hover:bg-accent"
                  >
                    <div className="truncate text-sm font-medium">{r.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.snippet}</div>
                    <div className="text-[10px] text-muted-foreground">{new Date(r.updatedAt).toLocaleString()}</div>
                  </Link>
                ))
              )}
            </div>
          ) : query.trim().length >= 2 ? (
            <p className="p-2 text-xs text-muted-foreground">Searching…</p>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p className="p-2 text-xs text-muted-foreground">Loading chats…</p>
      ) : active.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">No conversations yet.</p>
      ) : (
        <div className="flex-1 space-y-3 overflow-y-auto pb-2 scroll-thin">
          {grouped.map(({ group, items }) => (
            <div key={group}>
              <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{group}</div>
              <ul className="space-y-1">
                {items.map((t) => (
                  <li key={t.id} className="group relative">
                    <Link
                      href={`/chat/${t.id}`}
                      className={cn(
                        "flex items-center gap-2 rounded-md border p-2 pr-8 text-sm hover:bg-accent",
                        t.id === activeThreadId && "bg-accent font-medium",
                      )}
                    >
                      {t.pinned ? <Pin className="size-3.5 shrink-0 text-primary" aria-hidden /> : null}
                      <span className="truncate">{t.title}</span>
                    </Link>
                    <div className="absolute right-1 top-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button size="icon" variant="ghost" className="size-6" aria-label="Chat options" />}
                        >
                          <MoreHorizontal className="size-4" aria-hidden />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-44">
                          <DropdownMenuItem onClick={() => { setRenaming(t); setRenameValue(t.title); }}>
                            <Pencil className="size-3.5" aria-hidden /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => menu(() => setThreadPinnedAction(t.id, !t.pinned), t.pinned ? "Unpinned" : "Pinned")}>
                            {t.pinned ? <PinOff className="size-3.5" aria-hidden /> : <Pin className="size-3.5" aria-hidden />}
                            {t.pinned ? "Unpin" : "Pin"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => menu(() => setThreadArchivedAction(t.id, true), "Archived")}>
                            <Archive className="size-3.5" aria-hidden /> Archive
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(t)}>
                            <Trash2 className="size-3.5" aria-hidden /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {archived.length > 0 ? (
            <div>
              <button
                type="button"
                className="flex w-full items-center gap-1.5 px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                onClick={() => setShowArchived((v) => !v)}
              >
                <Archive className="size-3" aria-hidden /> Archived ({archived.length})
              </button>
              {showArchived ? (
                <ul className="space-y-1">
                  {archived.map((t) => (
                    <li key={t.id} className="group relative opacity-70">
                      <Link
                        href={`/chat/${t.id}`}
                        className={cn(
                          "flex items-center gap-2 rounded-md border p-2 pr-8 text-sm hover:bg-accent",
                          t.id === activeThreadId && "bg-accent font-medium",
                        )}
                      >
                        <span className="truncate">{t.title}</span>
                      </Link>
                      <div className="absolute right-1 top-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button size="icon" variant="ghost" className="size-6" aria-label="Chat options" />}
                          >
                            <MoreHorizontal className="size-4" aria-hidden />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-44">
                            <DropdownMenuItem onClick={() => menu(() => setThreadArchivedAction(t.id, false), "Restored")}>
                              <ArchiveRestore className="size-3.5" aria-hidden /> Restore
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(t)}>
                              <Trash2 className="size-3.5" aria-hidden /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {/* Rename dialog */}
      <Dialog open={renaming !== null} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={100}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renaming) {
                menu(() => renameThreadAction(renaming.id, renameValue), "Renamed");
                setRenaming(null);
              }
            }}
          />
          <DialogFooter>
            <Button
              disabled={pending || renameValue.trim().length === 0}
              onClick={() => {
                if (renaming) menu(() => renameThreadAction(renaming.id, renameValue), "Renamed");
                setRenaming(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete chat?</DialogTitle>
            <DialogDescription>
              This permanently deletes “{deleting?.title}” and all its messages. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (deleting) {
                  menu(() => deleteThreadAction(deleting.id), "Deleted");
                  if (deleting.id === activeThreadId) router.push("/chat");
                }
                setDeleting(null);
              }}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type ActionResult2 = { ok: true } | { ok: false; error: string };
