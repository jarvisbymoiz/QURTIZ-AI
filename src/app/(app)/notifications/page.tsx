import { withSchemaGuard } from "@/components/system/schema-guard";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Link2,
  Sparkles,
  Zap,
} from "lucide-react";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { PageHeader } from "@/components/layout/page-header";
import { MarkReadButton } from "@/components/notifications/mark-read-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatLabel,
  platformLabel,
  resolveNotificationDestinations,
  statusLabel,
  type NotificationMeta,
} from "@/lib/notifications/payload";

export const metadata = { title: "Notifications" };

/** Small status pill colors by publish state. */
const STATUS_TONE: Record<string, string> = {
  published: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  live: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  ready_for_review: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  scheduled: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-300",
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  pending_approval: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  qa_failed: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  partial: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  failed: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300",
  cancelled: "border-border text-muted-foreground",
  draft: "border-border text-muted-foreground",
};

function KindIcon({ kind, publishStatus }: { kind: string; publishStatus?: string }) {
  const cls = "size-4 shrink-0";
  switch (kind) {
    case "publishing_completed":
      if (publishStatus === "failed" || publishStatus === "partial") {
        return <AlertTriangle className={cn(cls, "text-amber-500")} aria-hidden />;
      }
      return publishStatus === "pending"
        ? <CalendarClock className={cn(cls, "text-amber-500")} aria-hidden />
        : <CheckCircle2 className={cn(cls, "text-emerald-500")} aria-hidden />;
    case "publishing_failed":
      return <AlertTriangle className={cn(cls, "text-rose-500")} aria-hidden />;
    case "auth_expired":
      return <Link2 className={cn(cls, "text-amber-500")} aria-hidden />;
    case "content_ready":
      return <Sparkles className={cn(cls, "text-violet-500")} aria-hidden />;
    case "scheduled":
      return <CalendarClock className={cn(cls, "text-sky-500")} aria-hidden />;
    case "job_completed":
      return <Zap className={cn(cls, "text-sky-500")} aria-hidden />;
    default:
      return <Bell className={cn(cls, "text-muted-foreground")} aria-hidden />;
  }
}

function externalButtonLabel(platform: string): string {
  return `View on ${platform === "facebook" ? "Facebook" : platform === "instagram" ? "Instagram" : platform}`;
}

async function NotificationsPage() {
  const ctx = await requireWorkspace();
  const db = getDb();

  const list = await db
    .select()
    .from(notifications)
    .where(eq(notifications.workspaceId, ctx.workspace.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  const unread = list.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Publishing results, Auto Runs, scheduling and account events for this workspace."
      >
        {unread > 0 ? <MarkReadButton count={unread} /> : null}
      </PageHeader>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
          <Bell className="size-8 text-muted-foreground" aria-hidden />
          <p className="max-w-md text-sm text-muted-foreground">
            Nothing yet. Notifications appear when Auto Runs create content, posts publish
            (or fail), and accounts need reconnection.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((n) => {
            const meta = (n.meta ?? {}) as NotificationMeta;
            // Routing decision: real platform permalinks become external
            // "View on …" buttons; the internal link stays ONLY as a no-live-post
            // fallback (review / scheduled / draft / failed → fix it in Qurtiz).
            const { external, internal } = resolveNotificationDestinations({ link: n.link, meta: n.meta });
            const singlePost = meta.posts?.length === 1 ? meta.posts[0] : undefined;
            const format = meta.format ?? singlePost?.format;
            const platforms = meta.platform
              ? [meta.platform]
              : (meta.platforms ?? singlePost?.platforms ?? []);
            const status = meta.publishStatus ?? (meta.posts && meta.posts.length > 1 ? meta.status : (singlePost?.status ?? meta.status));
            return (
              <Card key={n.id} className={cn(!n.read && "border-primary/40 bg-accent/30")}>
                <CardContent className="flex items-start gap-3 p-4">
                  <span className={cn("mt-1 size-2 shrink-0 rounded-full", n.read ? "bg-muted-foreground/40" : "bg-primary")} />
                  <div className="mt-0.5 shrink-0">
                    <KindIcon kind={n.kind} publishStatus={meta.publishStatus} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium">{n.title}</span>
                      <Badge variant="secondary" className="text-[10px] uppercase">{n.kind.replaceAll("_", " ")}</Badge>
                      {format ? (
                        <Badge variant="outline" className="text-[10px] uppercase">{formatLabel(format)}</Badge>
                      ) : null}
                      {platforms.map((p) => (
                        <Badge key={p} variant="outline" className="text-[10px] uppercase">{platformLabel(p)}</Badge>
                      ))}
                      {status ? (
                        <Badge variant="outline" className={cn("text-[10px]", STATUS_TONE[status] ?? STATUS_TONE.draft)}>
                          {statusLabel(status)}
                        </Badge>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("en-CA", { timeZone: ctx.workspace.timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(n.createdAt))}
                      </span>
                    </div>
                    {n.body ? <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{n.body}</p> : null}
                    {external.length > 0 || internal ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {external.map((d) => (
                          <Button
                            key={`${d.platform}:${d.permalink}`}
                            size="sm"
                            variant="outline"
                            nativeButton={false}
                            render={<a href={d.permalink} target="_blank" rel="noopener noreferrer" />}
                          >
                            <ExternalLink className="size-3.5" aria-hidden />
                            {externalButtonLabel(d.platform)}
                          </Button>
                        ))}
                        {internal ? (
                          <Button size="sm" variant="outline" nativeButton={false} render={<Link href={internal} />}>
                            Open
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
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

export default withSchemaGuard("(app)/notifications/page.tsx", NotificationsPage);
