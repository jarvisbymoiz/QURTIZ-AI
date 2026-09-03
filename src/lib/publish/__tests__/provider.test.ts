import { describe, expect, it } from "vitest";
import { resolvePublishProvider } from "@/lib/publish/provider";

describe("resolvePublishProvider", () => {
  it("defaults to meta when the settings key is absent", () => {
    expect(resolvePublishProvider(undefined)).toBe("meta");
    expect(resolvePublishProvider(null)).toBe("meta");
  });

  it("defaults to meta when the value has no provider field", () => {
    expect(resolvePublishProvider({})).toBe("meta");
  });

  it("resolves a persisted buffer provider", () => {
    expect(resolvePublishProvider({ provider: "buffer" })).toBe("buffer");
  });

  it("resolves an explicit meta provider", () => {
    expect(resolvePublishProvider({ provider: "meta" })).toBe("meta");
  });

  it("falls back to meta for unknown or malformed providers", () => {
    expect(resolvePublishProvider({ provider: "twitter" })).toBe("meta");
    expect(resolvePublishProvider({ provider: 42 })).toBe("meta");
    expect(resolvePublishProvider("buffer")).toBe("meta");
  });
});
