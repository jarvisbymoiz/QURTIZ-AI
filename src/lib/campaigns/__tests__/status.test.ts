import { describe, it, expect } from "vitest";
import { campaignDeliveryStatus } from "../status";
const item = { contentItemId: "post" };
const fb = {
  contentItemId: "post",
  platform: "facebook",
  status: "published",
  providerPostId: "page_post",
};
const ig = { ...fb, platform: "instagram", providerPostId: "ig-media" };
describe("campaign delivery truth", () => {
  it("requires confirmed external delivery on every selected platform", () => {
    expect(
      campaignDeliveryStatus("active", ["facebook", "instagram"], [item], [fb]),
    ).toBe("active");
    expect(
      campaignDeliveryStatus(
        "active",
        ["facebook", "instagram"],
        [item],
        [fb, ig],
      ),
    ).toBe("completed");
  });
  it("does not mark scheduled, processing or failed jobs complete", () => {
    for (const status of ["pending", "processing", "failed"])
      expect(
        campaignDeliveryStatus(
          "active",
          ["facebook"],
          [item],
          [{ ...fb, status }],
        ),
      ).toBe("active");
  });
  it("requires real provider IDs, every day and matching content identities", () => {
    expect(
      campaignDeliveryStatus(
        "active",
        ["facebook"],
        [item],
        [{ ...fb, providerPostId: null }],
      ),
    ).toBe("active");
    expect(
      campaignDeliveryStatus(
        "active",
        ["facebook"],
        [item, { contentItemId: null }],
        [fb],
      ),
    ).toBe("active");
    expect(
      campaignDeliveryStatus(
        "active",
        ["facebook"],
        [item],
        [{ ...fb, contentItemId: "other" }],
      ),
    ).toBe("active");
  });
  it("preserves cancellation and generation rather than inventing success", () => {
    for (const state of ["cancelled", "generating"] as const)
      expect(campaignDeliveryStatus(state, ["facebook"], [item], [fb])).toBe(
        state,
      );
  });
  it("handles empty campaigns and reverses completion when a link is removed", () => {
    expect(campaignDeliveryStatus("completed", ["facebook"], [], [])).toBe(
      "planning",
    );
    expect(campaignDeliveryStatus("planning", [], [item], [fb])).toBe("active");
  });
});
