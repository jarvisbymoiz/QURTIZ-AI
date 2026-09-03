import { describe, expect, it } from "vitest";
import { shouldShowMetaDataNotice } from "@/lib/publish/logic";

describe("shouldShowMetaDataNotice", () => {
  const base = { provider: "buffer" as const, hasMetaConnection: false, hasBufferConnection: true };

  it("shows the notice when publishing is Buffer with a Buffer connection and no Meta connection", () => {
    expect(shouldShowMetaDataNotice(base)).toBe(true);
  });

  it("never shows the notice on the Meta provider", () => {
    expect(
      shouldShowMetaDataNotice({ provider: "meta", hasMetaConnection: false, hasBufferConnection: true }),
    ).toBe(false);
  });

  it("stays silent when a Meta connection exists — data already collected keeps working", () => {
    expect(
      shouldShowMetaDataNotice({ provider: "buffer", hasMetaConnection: true, hasBufferConnection: true }),
    ).toBe(false);
    expect(
      shouldShowMetaDataNotice({ provider: "buffer", hasMetaConnection: true, hasBufferConnection: false }),
    ).toBe(false);
  });

  it("stays silent when nothing is connected — generic empty states already cover it", () => {
    expect(
      shouldShowMetaDataNotice({ provider: "buffer", hasMetaConnection: false, hasBufferConnection: false }),
    ).toBe(false);
  });
});
