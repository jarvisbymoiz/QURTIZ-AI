import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Bell } from "lucide-react";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { PageHeader } from "@/components/layout/page-header";
import { MarkReadButton } from "@/components/notifications/mark-read-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
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
        description="Publishing results, generation completions, autopilot activity and system events for this workspace."
      >
        {unread > 0 ? <MarkReadButton count={unread} /> : null}
      </PageHeader>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
          <Bell className="size-8 text-muted-foreground" aria-hidden />
          <p className="max-w-md text-sm text-muted-foreground">
            Nothing yet. Notifications appear when content finishes generating, posts publish
            (or fail), autopilot runs, and accounts need reconnection.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((n) => (
            <Card key={n.id} className={cn(!n.read && "border-primary/40 bg-accent/30")}>
              <CardContent className="flex items-start gap-3 p-4">
                <span className={cn("mt-1 size-2 shrink-0 rounded-full", n.read ? "bg-muted-foreground/40" : "bg-primary")} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{n.title}</span>
                    <Badge variant="secondary" className="text-[10px] uppercase">{n.kind.replaceAll("_", " ")}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("en-CA", { timeZone: ctx.workspace.timezone, dateStyle: "short", timeStyle: "short" }).format(new Date(n.createdAt))}
                    </span>
                  </div>
                  {n.body ? <p className="mt-1 text-sm text-muted-foreground">{n.body}</p> : null}
                </div>
                {n.link ? (
                  <Button size="sm" variant="outline" nativeButton={false} render={<Link href={n.link} />}>
                    Open
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
