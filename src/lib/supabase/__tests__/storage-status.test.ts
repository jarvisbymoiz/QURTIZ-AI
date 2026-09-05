import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// The helper probes THROUGH the service client — mock the whole module so no
// env-dependent client is ever constructed (hermetic, no network).
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

const { createServiceClient } = await import("@/lib/supabase/service");
const { getServerStorageConfigStatus } = await import("@/lib/supabase/storage-status");

const mockedCreateServiceClient = vi.mocked(createServiceClient);

// Hermetic env: save the real values, run every test with the three relevant
// vars absent, restore afterwards.
const ENV_KEYS = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeAll(() => {
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
});

afterAll(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

beforeEach(() => {
  mockedCreateServiceClient.mockClear();
});

describe("getServerStorageConfigStatus", () => {
  it("missing env → { configured: false } and NO probe attempt", async () => {
    // Only the URL present — the service key is still missing.
    process.env.SUPABASE_URL = "https://example.supabase.co";

    const status = await getServerStorageConfigStatus();

    expect(status).toEqual({ configured: false, connected: false });
    expect(status.error).toBeUndefined();
    expect(mockedCreateServiceClient).not.toHaveBeenCalled();
  });

  it("present env + throwing service client → { configured: true, connected: false, error }", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    mockedCreateServiceClient.mockImplementation(() => {
      throw new Error("connection refused");
    });

    const status = await getServerStorageConfigStatus();

    expect(status).toEqual({ configured: true, connected: false, error: "connection refused" });
    expect(mockedCreateServiceClient).toHaveBeenCalledTimes(1);
  });

  it("present env + successful probe → { configured: true, connected: true }", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_URL = undefined;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    mockedCreateServiceClient.mockImplementation(
      () =>
        ({
          storage: { listBuckets: async () => ({ data: [{ name: "brand-assets" }], error: null }) },
        }) as never,
    );

    const status = await getServerStorageConfigStatus();

    expect(status).toEqual({ configured: true, connected: true });
    expect(status.error).toBeUndefined();
  });

  it("a listBuckets error OBJECT (not a throw) also reports unreachable with its message", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    mockedCreateServiceClient.mockImplementation(
      () =>
        ({
          storage: { listBuckets: async () => ({ data: null, error: { message: "invalid jwt" } }) },
        }) as never,
    );

    const status = await getServerStorageConfigStatus();

    expect(status).toEqual({ configured: true, connected: false, error: "invalid jwt" });
  });

  it("NEVER leaks the service key: a probe error quoting it comes back redacted", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "super-secret-key";
    mockedCreateServiceClient.mockImplementation(() => {
      throw new Error("auth failed for key super-secret-key");
    });

    const status = await getServerStorageConfigStatus();

    expect(status.configured).toBe(true);
    expect(status.connected).toBe(false);
    expect(status.error).not.toContain("super-secret-key");
    expect(status.error).toContain("[redacted]");
  });
});
