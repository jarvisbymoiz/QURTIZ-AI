import { describe, expect, it, vi } from "vitest";
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

/* -- Provider PRIORITY: Meta is primary, Buffer is the fallback ---------------
 * resolvePublishProviderForPlatform is what scheduling and every execution path
 * call to decide the provider, so these tests lock in the required routing
 * scenarios (they are the DB-backed counterpart of the pure tests above). */

vi.mock("@/db", () => ({ getDb: vi.fn() }));

const { getDb } = await import("@/db");
const { platformConnections } = await import("@/db/schema");
const { resolvePublishProviderForPlatform } = await import("@/lib/publish/provider");

type ConnRow = { provider: string; status: string };

/** Minimal fake of the drizzle chain used by provider.ts. The real WHERE clause
 *  (workspace + platform scoping) is SQL and is not simulated here; these tests
 *  focus on the ORDERING rule between providers. */
function fakeDb(conns: ConnRow[], settingValue?: unknown) {
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: async () =>
          table === platformConnections ? conns : settingValue === undefined ? [] : [{ value: settingValue }],
      }),
    }),
  };
}

function useDb(conns: ConnRow[], settingValue?: unknown) {
  vi.mocked(getDb).mockReturnValue(fakeDb(conns, settingValue) as never);
}

describe("resolvePublishProviderForPlatform - Meta primary, Buffer fallback", () => {
  it("1. Meta + Buffer both connected -> Meta publishes", async () => {
    useDb([
      { provider: "buffer", status: "connected" },
      { provider: "meta", status: "connected" },
    ]);
    expect(await resolvePublishProviderForPlatform("ws-1", "facebook")).toBe("meta");
    expect(await resolvePublishProviderForPlatform("ws-1", "instagram")).toBe("meta");
  });

  it("2. Meta connected + Buffer needs reconnect -> Meta publishes", async () => {
    useDb([
      { provider: "meta", status: "connected" },
      { provider: "buffer", status: "expired" },
    ]);
    expect(await resolvePublishProviderForPlatform("ws-1", "facebook")).toBe("meta");
  });

  it("3. Meta unavailable + Buffer connected -> Buffer publishes", async () => {
    useDb([
      { provider: "meta", status: "expired" },
      { provider: "buffer", status: "connected" },
    ]);
    expect(await resolvePublishProviderForPlatform("ws-1", "facebook")).toBe("buffer");
  });

  it("3b. Meta in error, or Meta absent entirely -> Buffer publishes", async () => {
    useDb([
      { provider: "meta", status: "error" },
      { provider: "buffer", status: "connected" },
    ]);
    expect(await resolvePublishProviderForPlatform("ws-1", "instagram")).toBe("buffer");

    useDb([{ provider: "buffer", status: "connected" }]);
    expect(await resolvePublishProviderForPlatform("ws-1", "instagram")).toBe("buffer");
  });

  it("4. Neither available -> the workspace toggle is returned, so the caller fails clearly", async () => {
    // resolvePublishConnection then finds no connected row for that provider and
    // reports not_connected (no silent success).
    useDb(
      [
        { provider: "meta", status: "expired" },
        { provider: "buffer", status: "error" },
      ],
      { provider: "meta" },
    );
    expect(await resolvePublishProviderForPlatform("ws-1", "facebook")).toBe("meta");

    useDb(
      [
        { provider: "meta", status: "expired" },
        { provider: "buffer", status: "error" },
      ],
      { provider: "buffer" },
    );
    expect(await resolvePublishProviderForPlatform("ws-1", "facebook")).toBe("buffer");

    useDb([]);
    expect(await resolvePublishProviderForPlatform("ws-1", "facebook")).toBe("meta");
  });

  it("5. never prefers Buffer while Meta is healthy, whatever the stored order", async () => {
    useDb([
      { provider: "meta", status: "connected" },
      { provider: "buffer", status: "connected" },
    ]);
    expect(await resolvePublishProviderForPlatform("ws-1", "instagram")).toBe("meta");
    // resolved fresh on every call: a Meta connection that recovers wins back,
    // and one that expires hands over to Buffer.
    useDb([
      { provider: "meta", status: "expired" },
      { provider: "buffer", status: "connected" },
    ]);
    expect(await resolvePublishProviderForPlatform("ws-1", "instagram")).toBe("buffer");
    useDb([
      { provider: "meta", status: "connected" },
      { provider: "buffer", status: "connected" },
    ]);
    expect(await resolvePublishProviderForPlatform("ws-1", "instagram")).toBe("meta");
  });
});