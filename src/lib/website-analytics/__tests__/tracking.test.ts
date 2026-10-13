import { describe, expect, it } from "vitest";
import { publicTrackingUrl, acquisitionClick } from "../tracking";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config } from "@/middleware";

describe("public telemetry privacy and routing", () => {
  it("strips every query/hash, including auth secrets, before sending permitted public URLs", () => {
    expect(
      publicTrackingUrl(
        "https://qurtiz.test/signup?token=private&email=person#secret",
      ),
    ).toBe("https://qurtiz.test/signup");
    expect(
      publicTrackingUrl(
        "https://qurtiz.test/articles/what-is-qurtiz-ai?utm_source=email",
      ),
    ).toBe("https://qurtiz.test/articles/what-is-qurtiz-ai");
  });
  it("drops private content and token exchange paths", () => {
    for (const path of [
      "/chat/private-id",
      "/settings",
      "/settings/visitors",
      "/auth/callback",
      "/content-studio",
      "/api/admin/website-analytics",
    ])
      expect(publicTrackingUrl(`https://qurtiz.test${path}`)).toBeNull();
    expect(publicTrackingUrl("invalid")).toBeNull();
  });
  it("custom events use fixed categories without URL or content payloads", () => {
    expect(acquisitionClick("/articles/what-is-qurtiz-ai", "/signup")).toEqual({
      name: "article_cta_clicked",
      data: { source: "article", destination: "signup" },
    });
    expect(acquisitionClick("/", "/login")?.name).toBe("login_clicked");
    expect(acquisitionClick("/", "/chat/private-id")).toBeNull();
  });
  it("lets official intake endpoints pass while preserving private application middleware", () => {
    for (const url of [
      "/_vercel/insights/script.js",
      "/_vercel/insights/view",
      "/_vercel/speed-insights/script.js",
      "/_vercel/speed-insights/vitals",
    ])
      expect(
        unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }),
      ).toBe(false);
    for (const url of [
      "/chat",
      "/api/admin/website-analytics",
      "/settings/visitors",
    ])
      expect(
        unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }),
      ).toBe(true);
  });
});
