"use client";

import { useEffect, useRef, useState, useActionState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { updateWorkspaceAction } from "@/server/actions/workspace";
import type { ActionResult } from "@/server/actions/workspace";
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

export function WorkspaceSettingsForm({
  initialName,
  initialTimezone,
  editable,
}: {
  initialName: string;
  initialTimezone: string;
  editable: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult, formData: FormData) => updateWorkspaceAction(formData),
    initial,
  );

  // The success toast fires only AFTER the server action resolves — never
  // optimistically on submit. Failures surface through the inline alert.
  const [submitted, setSubmitted] = useState(false);
  const lastResult = useRef<ActionResult>(initial);
  useEffect(() => {
    if (!submitted || lastResult.current === state) return;
    lastResult.current = state;
    if (state.ok) toast.success("Workspace updated");
  }, [state, submitted]);

  const timezones = TIMEZONES.includes(initialTimezone)
    ? TIMEZONES
    : [initialTimezone, ...TIMEZONES];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Workspace</CardTitle>
        <CardDescription>
          Name and timezone for scheduling. Requires admin or owner role.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={formAction}
          className="space-y-4"
          onSubmit={() => setSubmitted(true)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Workspace name</Label>
              <Input id="name" name="name" defaultValue={initialName} required minLength={2} maxLength={80} disabled={!editable} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select name="timezone" defaultValue={initialTimezone} disabled={!editable}>
                <SelectTrigger id="timezone" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {state.ok === false ? (
            <p className="text-sm text-destructive" role="alert">{state.error}</p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending || !editable}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
