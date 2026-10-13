import { withSchemaGuard } from "@/components/system/schema-guard";
﻿import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  CalendarClock,
  CheckCircle2,
  Users,
  Camera,
  MessageSquare,
  PenSquare,
  Share2,
  TrendingUp,
  ArrowUpRight,
  FileText,
  BarChart3,
  Settings2,
  Bell,
} from "lucide-react";
import { getDb } from "@/db";
import { aiInsights } from "@/db/schema";
import { agentRuns, chatThreads, contentItems, platformConnections } from "@/db/schema";
import { hasWorkspaceAIConfig, getWorkspaceAIModelLabel } from "@/lib/ai/config";
import { requireWorkspace } from "@/lib/workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Dashboard" };

async function DashboardPage() {
  const ctx = await requireWorkspace();
  const db = getDb();

  const contentRows = await db
    .select({ id: contentItems.id, status: contentItems.status, topic: contentItems.topic, scheduledAt: contentItems.scheduledAt })
    .from(contentItems)
    .where(and(eq(contentItems.workspaceId, ctx.workspace.id)));
  const generatedCount = contentRows.filter((r) => r.status !== "draft").length;
  const approvedCount = contentRows.filter((r) => r.status === "approved").length;
  const scheduledCount = contentRows.filter((r) => r.status === "scheduled").length;
  const publishedCount = contentRows.filter((r) => r.status === "published").length;
  const upcoming = contentRows
    .filter((r) => r.status === "scheduled" && r.scheduledAt !== null)
    .sort((a, b) => (a.scheduledAt?.getTime() ?? 0) - (b.scheduledAt?.getTime() ?? 0))
    .slice(0, 5);

  const connections = await db
    .select()
    .from(platformConnections)
    .where(eq(platformConnections.workspaceId, ctx.workspace.id));
  // Buffer-owned rows (provider "buffer") render in their own section below —
  // the Meta loop must not pick them up as direct Meta connections.
  const bufferConnections = connections.filter((c) => c.provider === "buffer");

  const recentThreads = await db
    .select({ id: chatThreads.id, title: chatThreads.title, updatedAt: chatThreads.updatedAt })
    .from(chatThreads)
    .where(and(eq(chatThreads.workspaceId, ctx.workspace.id), eq(chatThreads.userId, ctx.user.id), isNull(chatThreads.deletedAt)))
    .orderBy(desc(chatThreads.updatedAt))
    .limit(3);

  const [latestInsight] = await db
    .select({ content: aiInsights.content })
    .from(aiInsights)
    .where(eq(aiInsights.workspaceId, ctx.workspace.id))
    .orderBy(desc(aiInsights.createdAt))
    .limit(1);

  const recentRuns = await db
    .select({ id: agentRuns.id, status: agentRuns.status, model: agentRuns.model, finishedAt: agentRuns.finishedAt })
    .from(agentRuns)
    .where(eq(agentRuns.workspaceId, ctx.workspace.id))
    .orderBy(desc(agentRuns.startedAt))
    .limit(5);

  const aiReady = await hasWorkspaceAIConfig(ctx.workspace.id);
  const aiModel = await getWorkspaceAIModelLabel(ctx.workspace.id);

  return (
    <div className="qurtiz-dashboard">
      <div className="dashboard-context">
        <span>WORKSPACE OVERVIEW</span>
        <span>{ctx.workspace.timezone}</span>
      </div>
      <PageHeader
        className="dashboard-header"
        title={`Good to see you, ${ctx.workspace.name}`}
        description="Your brand, content and publishing. One connected workspace."
      >
        <Button nativeButton={false} render={<Link href="/content-studio" />}>
          <PenSquare className="size-4" aria-hidden />Open Content Studio
        </Button>
      </PageHeader>

      <nav className="dashboard-quick-actions" aria-label="Dashboard quick actions">
        {[
          { href: "/chat", label: "Open AI Chat", detail: "Plan your next idea", icon: MessageSquare },
          { href: "/calendar", label: "Content Calendar", detail: "Review your schedule", icon: CalendarClock },
          { href: "/analytics", label: "Analytics", detail: "Explore real results", icon: BarChart3 },
          { href: "/notifications", label: "Notifications", detail: "Workspace updates", icon: Bell },
        ].map(item => <Link key={item.href} href={item.href}>
          <item.icon className="size-4" aria-hidden />
          <span><strong>{item.label}</strong><small>{item.detail}</small></span>
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>)}
      </nav>

      {/* Today&apos;s activity */}
      <section className="dashboard-overview space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Content overview
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Posts generated", value: generatedCount, icon: FileText },
            { label: "Posts approved", value: approvedCount, icon: CheckCircle2 },
            { label: "Posts scheduled", value: scheduledCount, icon: CalendarClock },
            { label: "Posts published", value: publishedCount, icon: TrendingUp },
          ].map((s) => (
            <Card key={s.label} className="dashboard-stat">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {s.label}
                </CardTitle>
                <s.icon className="size-4 text-muted-foreground" aria-hidden />
              </CardHeader>
              <CardContent>
                <div className="dashboard-stat-value text-2xl font-semibold">{s.value}</div>
                <p className="text-xs text-muted-foreground">
                  Live counts from this workspace&apos;s content library.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="dashboard-status-grid grid gap-6 lg:grid-cols-2">
        {/* Platform status */}
          <Card className="dashboard-platforms">
            <CardHeader>
              <CardTitle role="heading" aria-level={2} className="text-base">Platform status</CardTitle>
              <CardDescription>
                Direct Meta API and Buffer connections for Facebook and Instagram publishing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(["facebook", "instagram"] as const).map((platform) => {
                const conn = connections.find((c) => c.platform === platform && c.provider !== "buffer");
              const status = conn?.status ?? "not_connected";
              return (
                <div key={platform} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    {platform === "facebook" ? (
                      <Users className="size-5 text-muted-foreground" aria-hidden />
                    ) : (
                      <Camera className="size-5 text-muted-foreground" aria-hidden />
                    )}
                    <div>
                      <div className="text-sm font-medium capitalize">
                        {platform === "facebook" ? "Facebook Page" : "Instagram Professional"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {status === "not_connected"
                          ? "Not connected — connect it on the Connections page"
                          : status}
                      </div>
                    </div>
                  </div>
                  <Badge variant={status === "connected" ? "default" : "secondary"}>
                    {status === "not_connected" ? "Not connected" : status}
                  </Badge>
                </div>
              );
            })}
            {bufferConnections.map((conn) => {
              const meta = conn.meta as Record<string, string | undefined>;
              const channel = meta.bufferUsername || conn.channelRef || "Buffer channel";
              const connected = conn.status === "connected";
              return (
                <div key={conn.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Share2 className="size-5 text-muted-foreground" aria-hidden />
                    <div>
                      <div className="text-sm font-medium">{channel}</div>
                      <div className="text-xs text-muted-foreground">
                        Buffer channel — {conn.platform === "facebook" ? "Facebook" : "Instagram"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Buffer API</Badge>
                    <Badge variant={connected ? "default" : "secondary"}>
                      {conn.status === "not_connected" ? "Not connected" : conn.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* AI status */}
        <Card className="dashboard-agent">
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-base">AI agent</CardTitle>
            <CardDescription>Provider status and getting started.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="text-sm">
                <div className="font-medium">{aiReady ? "Ready" : "Configuration required"}</div>
                <div className="text-xs text-muted-foreground">
                  {aiReady
                    ? `Model: ${aiModel}`
                    : "Add your AI provider + API key in Workspace Settings"}
                </div>
              </div>
              <Badge variant={aiReady ? "default" : "destructive"}>
                {aiReady ? "Connected" : "Not configured"}
              </Badge>
            </div>
            {recentThreads.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Start a conversation with your agent — it knows your Brand Brain and
                remembers durable preferences.
              </p>
            ) : (
              <ul className="space-y-2">
                {recentThreads.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/chat/${t.id}`}
                      className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-accent"
                    >
                      <MessageSquare className="size-4 text-muted-foreground" aria-hidden />
                      <span className="truncate">{t.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Button nativeButton={false} className="w-full" render={<Link href="/chat" />}><MessageSquare className="size-4" aria-hidden />
                Open AI Chat</Button>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming content */}
      <Card className="dashboard-upcoming">
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="text-base">Upcoming content</CardTitle>
          <CardDescription>Scheduled posts publish automatically via the background worker.</CardDescription>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
              <PenSquare className="size-8 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Nothing scheduled yet. Approve content in Content Studio and schedule it — the
                worker publishes it automatically.
              </p>
              <Button nativeButton={false} variant="outline" render={<Link href="/content-studio" />}>Open Content Studio</Button>
            </div>
          ) : (
            <ul className="divide-y rounded-lg border">
              {upcoming.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <Link href="/content-studio" className="min-w-0 truncate hover:underline">{r.topic}</Link>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {r.scheduledAt
                      ? new Intl.DateTimeFormat("en", { timeZone: ctx.workspace.timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(r.scheduledAt))
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="dashboard-library-grid grid gap-5 lg:grid-cols-2">
        <Card className="dashboard-published">
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>Published content</CardTitle>
            <CardDescription>Published entries from your workspace content library.</CardDescription>
          </CardHeader>
          <CardContent>
            {contentRows.some(r => r.status === "published") ? (
              <ul className="dashboard-content-list">
                {contentRows.filter(r => r.status === "published").slice(0, 5).map(r => (
                  <li key={r.id}>
                    <Link href="/content-studio"><FileText className="size-4" aria-hidden /><span>{r.topic}</span><ArrowUpRight className="size-3.5" aria-hidden /></Link>
                    <Badge variant="secondary">Published</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className="dashboard-empty-copy">No published content yet. Approved posts will appear here after publishing succeeds.</p>}
          </CardContent>
        </Card>
        <Card className="dashboard-insights">
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>Latest AI analysis</CardTitle>
            <CardDescription>Saved analysis from this workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            {latestInsight ? <p className="line-clamp-6 whitespace-pre-wrap text-sm text-muted-foreground">{latestInsight.content}</p>
              : <div className="dashboard-empty-copy"><BarChart3 className="size-6" aria-hidden /><p>No saved analysis yet. Explore Analytics to review the performance data available from your connected accounts.</p></div>}
            <Link className="dashboard-panel-link" href="/analytics">Open Analytics <ArrowUpRight className="size-3.5" aria-hidden /></Link>
          </CardContent>
        </Card>
      </div>

      <section className="dashboard-automation" aria-label="Auto Run">
        <div className="dashboard-automation-icon"><Settings2 className="size-5" aria-hidden /></div>
        <div>
          <h2>Auto Run</h2>
          <p>Manage your automation settings and review the latest run in Workspace Settings.</p>
        </div>
        <Link href="/settings">Workspace Settings <ArrowUpRight className="size-4" aria-hidden /></Link>
      </section>
    </div>
  );
}






export default withSchemaGuard("(app)/dashboard/page.tsx", DashboardPage);
