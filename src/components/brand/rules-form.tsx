"use client";

import { useState } from "react";
import type { brands } from "@/db/schema";
import { updateContentRulesAction } from "@/server/actions/brand";
import { linesToArray } from "@/lib/validation";
import { BrandForm, TextAreaField } from "./form-field";

type Brand = typeof brands.$inferSelect | null;

/**
 * Content rules form. List fields are textareas (one item per line);
 * a small client transform posts them as repeated form entries.
 */
export function RulesForm({ brand, editable }: { brand: Brand; editable: boolean }) {
  const r = (brand?.contentRules ?? {}) as {
    avoidWords?: string[];
    avoidClaims?: string[];
    avoidTopics?: string[];
    ctaRule?: string | null;
    hashtagRules?: string | null;
    languageRules?: string | null;
  };

  const [avoidWords, setAvoidWords] = useState((r.avoidWords ?? []).join("\n"));
  const [avoidClaims, setAvoidClaims] = useState((r.avoidClaims ?? []).join("\n"));
  const [avoidTopics, setAvoidTopics] = useState((r.avoidTopics ?? []).join("\n"));

  return (
    <BrandForm
      action={updateContentRulesAction}
      title="Content rules"
      description="Hard constraints the agent must respect in every generation. Avoid-lists are enforced, not suggestions."
      editable={editable}
    >
      {/* Send list fields as repeated entries */}
      {linesToArray(avoidWords).map((w, i) => (
        <input key={`aw-${i}`} type="hidden" name="avoidWords[]" value={w} />
      ))}
      {linesToArray(avoidClaims).map((w, i) => (
        <input key={`ac-${i}`} type="hidden" name="avoidClaims[]" value={w} />
      ))}
      {linesToArray(avoidTopics).map((w, i) => (
        <input key={`at-${i}`} type="hidden" name="avoidTopics[]" value={w} />
      ))}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="avoidWordsText" className="text-sm font-medium">Words to avoid</label>
          <textarea
            id="avoidWordsText"
            disabled={!editable}
            rows={6}
            value={avoidWords}
            onChange={(e) => setAvoidWords(e.target.value)}
            placeholder={"cheap\nguaranteed\n#1"}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground">One per line.</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="avoidClaimsText" className="text-sm font-medium">Claims to avoid</label>
          <textarea
            id="avoidClaimsText"
            disabled={!editable}
            rows={6}
            value={avoidClaims}
            onChange={(e) => setAvoidClaims(e.target.value)}
            placeholder={"get rich quick\n100% refund no questions"}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground">One per line.</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="avoidTopicsText" className="text-sm font-medium">Topics to avoid</label>
          <textarea
            id="avoidTopicsText"
            disabled={!editable}
            rows={6}
            value={avoidTopics}
            onChange={(e) => setAvoidTopics(e.target.value)}
            placeholder={"politics\ncompetitor drama"}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground">One per line.</p>
        </div>
      </div>
      <TextAreaField id="ctaRule" label="CTA rules" defaultValue={r.ctaRule} placeholder="e.g. Always use WhatsApp DM as CTA; never use 'link in bio'." />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextAreaField id="hashtagRules" label="Hashtag rules" defaultValue={r.hashtagRules} placeholder="e.g. Max 8 hashtags, mix English + Roman Urdu." />
        <TextAreaField id="languageRules" label="Language rules" defaultValue={r.languageRules} placeholder="e.g. Roman Urdu for Reels captions, English for carousels." />
      </div>
    </BrandForm>
  );
}
