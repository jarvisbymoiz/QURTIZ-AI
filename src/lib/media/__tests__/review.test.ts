import { describe, expect, it } from "vitest";
import { selectSingleReviewVisual } from "../review";

describe("Review media selection", () => {
  it("shows an uploaded single image with an ordered slideIndex", () => {
    const uploaded = { id: "image", kind: "upload", slideIndex: 0, createdAt: new Date() };
    expect(selectSingleReviewVisual([uploaded])).toBe(uploaded);
  });
  it("previews the uploaded override that publishing uses, even after another generation", () => {
    const uploaded = { id: "upload", kind: "upload", slideIndex: 0, createdAt: new Date(1000) };
    const generated = { id: "generated", kind: "ai", slideIndex: null, createdAt: new Date(2000) };
    expect(selectSingleReviewVisual([generated, uploaded])).toBe(uploaded);
  });
  it("selects the latest generated media without depending on database row order", () => {
    const old = { kind: "ai", createdAt: new Date(1000) };
    const latest = { kind: "template", createdAt: new Date(2000) };
    expect(selectSingleReviewVisual([latest, old])).toBe(latest);
    expect(selectSingleReviewVisual([])).toBeNull();
  });
});
