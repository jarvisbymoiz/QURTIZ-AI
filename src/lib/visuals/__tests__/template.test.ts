import { describe, expect, it } from "vitest";
import { renderTemplateVisual } from "@/lib/visuals/template";

describe("renderTemplateVisual", () => {
  it("renders a real PNG for the promo layout", { timeout: 60_000 }, async () => {
    const png = await renderTemplateVisual({
      primaryColor: "#6366f1",
      secondaryColor: "#0ea5e9",
      headline: "5 Canva AI features students do not know",
      subline: "Learn them in 4 minutes and design 10x faster.",
      cta: "DM CANVA",
      brandName: "Moiz Creator",
      logoDataUrl: null,
      layout: "promo",
    });
    expect(png.length).toBeGreaterThan(15_000);
    expect(png.slice(1, 4).toString("ascii")).toBe("PNG");
  });

  it("does not insert a logo even when a legacy caller supplies its data URL", { timeout: 60_000 }, async () => {
    const tinyLogo =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const png = await renderTemplateVisual({
      primaryColor: "#111827",
      secondaryColor: "#374151",
      headline: "Why consistency beats virality",
      subline: "",
      cta: "",
      brandName: "Test Brand",
      logoDataUrl: tinyLogo,
      layout: "statement",
    });
    expect(png.length).toBeGreaterThan(15_000);
    expect(png.slice(1, 4).toString("ascii")).toBe("PNG");
    const withoutLogo = await renderTemplateVisual({
      primaryColor: "#111827", secondaryColor: "#374151", headline: "Why consistency beats virality",
      subline: "", cta: "", brandName: "Test Brand", logoDataUrl: null, layout: "statement",
    });
    expect(png.equals(withoutLogo)).toBe(true);
  });
});
