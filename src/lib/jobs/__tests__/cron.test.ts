import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/jobs/workflows", () => ({ publishDueScan: vi.fn(async () => ({ checked: 0, interrupted: 0 })), autopilotLoop: vi.fn(), refreshPendingDeliveryNotifications: vi.fn() }));
vi.mock("@/lib/publishing/service", () => ({ reconcileBufferDeliveries: vi.fn(async () => undefined) }));
vi.mock("@/lib/media/cleanup-worker", () => ({ mediaCleanupTick: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn(() => { throw Error("Cron must not require a browser session"); }) }));
import { GET as publish } from "@/app/api/cron/publish/route";
import { GET as maintenance } from "@/app/api/cron/maintenance/route";
import { publishDueScan } from "../workflows";
import { updateSession } from "@/lib/supabase/middleware";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("machine cron endpoints", () => {
  it.each([publish, maintenance])("fails closed without a secret or with an invalid bearer", async handler => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await handler(new NextRequest("https://example.test/api/cron/publish"))).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    expect((await handler(new NextRequest("https://example.test/api/cron/publish"))).status).toBe(401);
    expect(publishDueScan).not.toHaveBeenCalled();
  });
  it.each(["publish", "maintenance"])("allows %s through session middleware; the route authenticates it", async path => {
    const response = await updateSession(new NextRequest(`https://example.test/api/cron/${path}`));
    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });
  it("runs a bounded durable scan without a user cookie", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    const response = await publish(new NextRequest("https://example.test/api/cron/publish", { headers: { authorization: "Bearer test-cron-secret" } }));
    expect(response.status).toBe(200);
    expect(publishDueScan).toHaveBeenCalledWith({ limit: 5, parallel: true, reconcile: false });
  });
});
