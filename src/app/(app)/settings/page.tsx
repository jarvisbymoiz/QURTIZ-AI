import { can } from "@/lib/permissions";
import { isAiConfigured, getModelId } from "@/lib/ai/provider";
import { requireWorkspace } from "@/lib/workspace";
import { PageHeader } from "@/components/layout/page-header";
import { WorkspaceSettingsForm } from "@/components/settings/workspace-settings-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireWorkspace();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Workspace, profile, and integration status." />

      <WorkspaceSettingsForm
        initialName={ctx.workspace.name}
        initialTimezone={ctx.workspace.timezone}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI provider</CardTitle>
          <CardDescription>Provider abstraction — switchable without code changes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Default model</span>
            <span className="font-mono text-xs">{getModelId()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">API key</span>
            <Badge variant={isAiConfigured() ? "default" : "destructive"}>
              {isAiConfigured() ? "Configured" : "Missing GEMINI_API_KEY"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure via QURTIZ_AI_MODEL and GEMINI_API_KEY in .env.local. OpenAI and
            other providers slot into the same registry in a later milestone.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meta platforms</CardTitle>
          <CardDescription>Facebook &amp; Instagram connections arrive in M4 via official Meta OAuth.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No connections configured yet. M4 adds the OAuth flow, encrypted token storage,
          and real connection status.
        </CardContent>
      </Card>
    </div>
  );
}
