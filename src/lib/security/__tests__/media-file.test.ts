import { describe, expect, it } from "vitest";
import { matchesMediaHeader } from "../media-file";

describe("media header validation", () => {
  it("rejects markup, empty and spoofed files", () => {
    for (const mime of ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"]) {
      expect(matchesMediaHeader(Buffer.from("<script>alert(1)</script>"), mime)).toBe(false);
      expect(matchesMediaHeader(new Uint8Array(), mime)).toBe(false);
    }
  });
  it("recognizes supported binary signatures without trusting the filename", () => {
    expect(matchesMediaHeader(Buffer.from([137,80,78,71,13,10,26,10]), "image/png")).toBe(true);
    expect(matchesMediaHeader(Buffer.from([255,216,255,224]), "image/jpeg")).toBe(true);
    expect(matchesMediaHeader(Buffer.from("RIFF1234WEBP"), "image/webp")).toBe(true);
    expect(matchesMediaHeader(Buffer.from("0000ftypisom"), "video/mp4")).toBe(true);
    expect(matchesMediaHeader(Buffer.from([26,69,223,163]), "video/webm")).toBe(true);
  });
});
