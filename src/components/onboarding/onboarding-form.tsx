"use client";

import { useActionState } from "react";
import { Sparkles, Building2, Globe2 } from "lucide-react";
import { createWorkspaceAction, type ActionResult } from "@/server/actions/workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TIMEZONES = [
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Europe/London",
  "America/New_York",
  "UTC",
];

const initial: ActionResult = { ok: true };

export function OnboardingForm({ userEmail }: { userEmail: string }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult, formData: FormData) => createWorkspaceAction(formData),
    initial,
  );

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted">
          <Sparkles className="size-5 text-primary" aria-hidden />
        </div>
        <CardTitle className="text-xl">Create your first workspace</CardTitle>
        <CardDescription>
          Signed in as {userEmail}. A workspace holds one brand: its Brand Brain,
          content, calendar, and connected social accounts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Workspace name</Label>
            <Input id="name" name="name" required minLength={2} maxLength={80}
              placeholder="e.g. Moiz Creator" />
            <p className="text-xs text-muted-foreground">
              Usually your brand or business name.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry (optional)</Label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="industry" name="industry" maxLength={120} className="pl-9"
                placeholder="e.g. Education, E-commerce, Food" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select name="timezone" defaultValue="Asia/Karachi">
              <SelectTrigger id="timezone" className="w-full">
                <div className="flex items-center gap-2">
                  <Globe2 className="size-4 text-muted-foreground" aria-hidden />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Used for scheduling and posting times.
            </p>
          </div>
          {state.ok === false ? (
            <p className="text-sm text-destructive" role="alert">{state.error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Create workspace"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
