"use client";

import type { brands } from "@/db/schema";
import { updateBusinessInfoAction } from "@/server/actions/brand";
import { BrandForm, TextAreaField, TextField } from "./form-field";

type Brand = typeof brands.$inferSelect | null;

export function BusinessForm({ brand, editable }: { brand: Brand; editable: boolean }) {
  return (
    <BrandForm
      action={updateBusinessInfoAction}
      title="Business information"
      description="What the agent knows about your business. Every field feeds into strategy, copy, and visuals."
      editable={editable}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="businessName" label="Business name" defaultValue={brand?.businessName} placeholder="e.g. Moiz Academy" />
        <TextField id="industry" label="Industry" defaultValue={brand?.industry} placeholder="e.g. Education / EdTech" />
      </div>
      <TextAreaField id="description" label="Description" defaultValue={brand?.description} rows={4} placeholder="What the business does, in plain words." />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextAreaField id="products" label="Products" defaultValue={brand?.products} hint="One per line." />
        <TextAreaField id="services" label="Services" defaultValue={brand?.services} hint="One per line." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="pricing" label="Pricing" defaultValue={brand?.pricing} placeholder="e.g. Rs. 2,500/month" />
        <TextField id="offers" label="Current offers" defaultValue={brand?.offers} placeholder="e.g. 20% student discount" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="locations" label="Locations" defaultValue={brand?.locations} placeholder="e.g. Lahore, online" />
        <TextField id="website" label="Website" defaultValue={brand?.website} placeholder="https://" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="contact" label="Contact" defaultValue={brand?.contact} placeholder="WhatsApp, email, phone" />
        <TextField id="cta" label="Primary CTA" defaultValue={brand?.cta} placeholder="e.g. DM 'CANVA' to enroll" />
      </div>
      <TextAreaField id="targetMarket" label="Target market" defaultValue={brand?.targetMarket} rows={2} placeholder="Who you sell to and where." />
    </BrandForm>
  );
}
