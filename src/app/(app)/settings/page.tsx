import { withSchemaGuard } from "@/components/system/schema-guard";
import { AgentMemoryCard } from "@/components/settings/agent-memory-card";
import { listAgentMemory } from "@/lib/ai/persistent-memory";
﻿import { can } from "@/lib/permissions";
import { requireWorkspace } from "@/lib/workspace";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { jobs, settings } from "@/db/schema";
import { autopilotSettingsSchema } from "@/lib/autopilot/schema";
import { PageHeader } from "@/components/layout/page-header";
import { WorkspaceSettingsForm } from "@/components/settings/workspace-settings-form";
import { AiConfigCard } from "@/components/settings/ai-config-card";
import { WorkspaceDeleteCard } from "@/components/settings/workspace-delete-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Settings" };

import { AutopilotCard } from "@/components/settings/autopilot-card";

async function SettingsPage() {
  const ctx = await requireWorkspace();
  const db = getDb();
  const agentMemory = await listAgentMemory({ userId: ctx.user.id, workspaceId: ctx.workspace.id });
  const [autopilotRow] = await db
    .select()
    .from(settings)
    .where(and(eq(settings.workspaceId, ctx.workspace.id), eq(settings.key, "autopilot")));
  const parsedAutopilot = autopilotSettingsSchema.safeParse(autopilotRow?.value ?? { enabled: false });
  const autopilot = parsedAutopilot.success ? parsedAutopilot.data : autopilotSettingsSchema.parse({ enabled: false });
  const [lastAutoRun] = await db.select().from(jobs).where(and(eq(jobs.workspaceId, ctx.workspace.id), eq(jobs.type, "autopilot"))).orderBy(desc(jobs.createdAt)).limit(1);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Workspace, profile, and integration status." />

      <WorkspaceSettingsForm
        initialName={ctx.workspace.name}
        initialTimezone={ctx.workspace.timezone}
        editable={can(ctx.role, "workspace:manage")}
      />

      <AutopilotCard
        initial={autopilot}
        lastRun={lastAutoRun ? { status: lastAutoRun.status, progress: lastAutoRun.progress, total: lastAutoRun.total, error: lastAutoRun.error,
          stage: (lastAutoRun.result as { stage?: string } | null)?.stage ?? "", occurrence: (lastAutoRun.input as { occurrence?: string } | null)?.occurrence ?? "",
          warnings: (lastAutoRun.result as { errors?: string[] } | null)?.errors ?? [] } : undefined}
        timezone={ctx.workspace.timezone}
        editable={can(ctx.role, "workspace:manage")}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your account for this session.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{ctx.user.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Role in {ctx.workspace.name}</span>
            <Badge variant="secondary" className="capitalize">{ctx.role}</Badge>
          </div>
        </CardContent>
      </Card>

      <AgentMemoryCard key={ctx.workspace.id} workspaceId={ctx.workspace.id} personal={agentMemory.personal} workspace={agentMemory.workspace} profile={agentMemory.profile}
        workspaceEditable={can(ctx.role, "brand:write")} profileEditable={can(ctx.role, "workspace:manage")} />

      <AiConfigCard editable={can(ctx.role, "workspace:manage")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Publishing platforms</CardTitle>
          <CardDescription>
            Facebook &amp; Instagram connect via the Meta API, or via Buffer for early access — pick the publishing
            provider and manage connections on the Connections page.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Tokens are encrypted at rest and never exposed to the browser. Publishing runs through the selected
          provider; analytics sync runs for Meta-connected accounts only.
        </CardContent>
      </Card>

      <WorkspaceDeleteCard
        workspaceId={ctx.workspace.id}
        workspaceName={ctx.workspace.name}
        userEmail={ctx.user.email}
        isOwner={ctx.user.id === ctx.workspace.createdBy}
      />
    </div>
  );
}

export default withSchemaGuard("(app)/settings/page.tsx", SettingsPage);
