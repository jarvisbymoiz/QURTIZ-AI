"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useActionState } from "react";
import type { ActionResult } from "@/server/actions/workspace";

const initial: ActionResult = { ok: true };

/**
 * Shared wrapper for Brand Brain forms: server action + pending state +
 * error surface + toast on success.
 */
export function BrandForm({
  action,
  title,
  description,
  editable,
  submitLabel = "Save",
  children,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  title: string;
  description: string;
  editable: boolean;
  submitLabel?: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult, formData: FormData) => action(formData),
    initial,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={formAction}
          className="space-y-4"
          onSubmit={() => {
            if (state.ok === false) return;
            toast.success("Saved");
          }}
        >
          {children}
          {state.ok === false ? (
            <p className="text-sm text-destructive" role="alert">{state.error}</p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending || !editable}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {pending ? "Saving…" : submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function TextField({
  id,
  label,
  hint,
  defaultValue,
  disabled,
  placeholder,
}: {
  id: string;
  label: string;
  hint?: string;
  defaultValue?: string | null;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        defaultValue={defaultValue ?? ""}
        disabled={disabled}
        placeholder={placeholder}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function TextAreaField({
  id,
  label,
  hint,
  defaultValue,
  disabled,
  rows = 3,
  placeholder,
}: {
  id: string;
  label: string;
  hint?: string;
  defaultValue?: string | null;
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        name={id}
        defaultValue={defaultValue ?? ""}
        disabled={disabled}
        rows={rows}
        placeholder={placeholder}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
