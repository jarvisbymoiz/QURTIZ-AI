import { it, expect } from "vitest";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns, campaignItems, contentItems, workspaces } from "@/db/schema";
import { manageCampaign, campaignReport } from "../manage";
it.skipIf(process.env.RUN_LIVE_CAMPAIGNS !== "true")(
  "rejects real cross-workspace campaign edits, deletes and content links without mutations",
  async () => {
    config({ path: ".env.local", quiet: true, override: true });
    const db = getDb();
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.name, "Campaign verification — reviewed workflow"));
    expect(campaign).toBeTruthy();
    const [otherWorkspace] = await db.select({id:workspaces.id}).from(workspaces).where(ne(workspaces.id,campaign.workspaceId)).limit(1);
    const foreign = otherWorkspace?.id ?? randomUUID();
    for (const operation of [
      { type: "edit", name: "Forbidden", goal: "", cta: "" },
      { type: "delete" },
      { type: "retry" },
    ] as const)
      await expect(
        manageCampaign(foreign, campaign.id, operation),
      ).rejects.toThrow("Campaign not found");
    await expect(campaignReport(foreign, campaign.id)).rejects.toThrow(
      "Campaign not found",
    );
    const [day] = await db
      .select()
      .from(campaignItems)
      .where(
        and(
          eq(campaignItems.campaignId, campaign.id),
          eq(campaignItems.workspaceId, campaign.workspaceId),
        ),
      );
    await expect(
      manageCampaign(campaign.workspaceId, campaign.id, {
        type: "link",
        dayId: randomUUID(),
        itemId: null,
      }),
    ).rejects.toThrow("Campaign day not found");
    const [other] = await db
      .select()
      .from(contentItems)
      .where(ne(contentItems.workspaceId, campaign.workspaceId))
      .limit(1);
    if (other)
      await expect(
        manageCampaign(campaign.workspaceId, campaign.id, {
          type: "link",
          dayId: day.id,
          itemId: other.id,
        }),
      ).rejects.toThrow("Content item not found");
    const [unchanged] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaign.id));
    expect(unchanged.name).toBe(campaign.name);
    console.info("[campaign:isolation]", {
      crossWorkspaceCampaign: true,
      foreignDay: true,
      foreignContent: !!other,
    });
  },
  60000,
);
