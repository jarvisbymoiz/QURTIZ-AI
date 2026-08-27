"use client";

import type { brands } from "@/db/schema";
import { updateVisualIdentityAction } from "@/server/actions/brand";
import { BrandForm, TextAreaField, TextField } from "./form-field";

type Brand = typeof brands.$inferSelect | null;

export function VisualForm({ brand, editable }: { brand: Brand; editable: boolean }) {
  const v = (brand?.visualIdentity ?? {}) as Record<string, string | undefined>;
  return (
    <BrandForm
      action={updateVisualIdentityAction}
      title="Visual identity"
      description="Brand tokens the visual engine will respect in every generated design (M2). Logo upload arrives with storage setup."
      editable={editable}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="primaryColor" className="text-sm font-medium">Primary color</label>
          <div className="flex gap-2">
            <input
              id="primaryColor"
              name="primaryColor"
              type="color"
              disabled={!editable}
              defaultValue={v.primaryColor || "#6366f1"}
              className="size-10 cursor-pointer rounded-md border border-input bg-transparent p-1 disabled:cursor-not-allowed"
            />
            <span className="self-center font-mono text-xs text-muted-foreground">
              {v.primaryColor || "not set (default shown)"}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="secondaryColor" className="text-sm font-medium">Secondary color</label>
          <div className="flex gap-2">
            <input
              id="secondaryColor"
              name="secondaryColor"
              type="color"
              disabled={!editable}
              defaultValue={v.secondaryColor || "#0ea5e9"}
              className="size-10 cursor-pointer rounded-md border border-input bg-transparent p-1 disabled:cursor-not-allowed"
            />
            <span className="self-center font-mono text-xs text-muted-foreground">
              {v.secondaryColor || "not set (default shown)"}
            </span>
          </div>
        </div>
      </div>
      <TextField id="fonts" label="Fonts" defaultValue={v.fonts} placeholder="e.g. Inter for headings, Roboto for body" />
      <TextAreaField id="imageStyle" label="Image style" defaultValue={v.imageStyle} placeholder="e.g. Clean minimal mockups, real photos of students, no stocky handshakes" />
      <TextAreaField id="notes" label="Layout / design notes" defaultValue={v.notes} placeholder="Anything the design engine must respect." />
    </BrandForm>
  );
}
