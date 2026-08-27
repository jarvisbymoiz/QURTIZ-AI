"use client";

import { useState } from "react";
import type { brands } from "@/db/schema";
import { updateVoiceAction } from "@/server/actions/brand";
import { VOICE_PRESETS } from "@/lib/validation";
import { BrandForm } from "./form-field";
import { cn } from "@/lib/utils";

type Brand = typeof brands.$inferSelect | null;

export function VoiceForm({ brand, editable }: { brand: Brand; editable: boolean }) {
  const [selected, setSelected] = useState<string[]>(brand?.voicePresets ?? []);

  function toggle(preset: string) {
    setSelected((s) => (s.includes(preset) ? s.filter((p) => p !== preset) : [...s, preset]));
  }

  return (
    <BrandForm
      action={updateVoiceAction}
      title="Brand voice"
      description="Pick how the brand should sound. The agent matches this tone in everything it writes."
      editable={editable}
    >
      <div className="space-y-3">
        <div className="text-sm font-medium">Voice presets</div>
        <div className="flex flex-wrap gap-2">
          {VOICE_PRESETS.map((preset) => {
            const active = selected.includes(preset);
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={active}
                disabled={!editable}
                onClick={() => toggle(preset)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                  !editable && "cursor-not-allowed opacity-60",
                )}
              >
                {preset}
              </button>
            );
          })}
        </div>
        {/* Hidden inputs so FormData carries the selection */}
        {selected.map((p) => (
          <input key={p} type="hidden" name="presets" value={p} />
        ))}
        <p className="text-xs text-muted-foreground">
          {selected.length === 0
            ? "No presets selected — the agent will ask before assuming a tone."
            : `${selected.join(", ")} — applied to all generated copy.`}
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="custom" className="text-sm font-medium">Custom voice instructions</label>
        <textarea
          id="custom"
          name="custom"
          defaultValue={brand?.voiceCustom ?? ""}
          disabled={!editable}
          rows={4}
          placeholder="e.g. Speak like a senior mentor: warm but direct, no corporate jargon, light humor is fine."
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    </BrandForm>
  );
}

