"use client";

import type { brands } from "@/db/schema";
import { updateAudienceAction } from "@/server/actions/brand";
import { BrandForm, TextAreaField } from "./form-field";

type Brand = typeof brands.$inferSelect | null;

export function AudienceForm({ brand, editable }: { brand: Brand; editable: boolean }) {
  const a = (brand?.audience ?? {}) as Record<string, string | undefined>;
  return (
    <BrandForm
      action={updateAudienceAction}
      title="Audience"
      description="Who you're talking to. The agent writes for these people, not a generic audience."
      editable={editable}
    >
      <TextAreaField id="demographics" label="Demographics" defaultValue={a.demographics} placeholder="e.g. 18–24, university students, urban Pakistan" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextAreaField id="interests" label="Interests" defaultValue={a.interests} />
        <TextAreaField id="problems" label="Problems they face" defaultValue={a.problems} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextAreaField id="goals" label="Goals" defaultValue={a.goals} />
        <TextAreaField id="buyingMotivations" label="Buying motivations" defaultValue={a.buyingMotivations} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextAreaField id="objections" label="Objections" defaultValue={a.objections} hint="What stops them from buying." />
        <TextAreaField id="preferredLanguage" label="Preferred language" defaultValue={a.preferredLanguage} hint="e.g. Roman Urdu, English, mix" />
      </div>
    </BrandForm>
  );
}
