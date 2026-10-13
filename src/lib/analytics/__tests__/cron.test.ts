import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/analytics/sync",()=>({syncDueInsights:vi.fn(async()=>[])}));
import { GET } from "@/app/api/cron/insights/route";
import { syncDueInsights } from "../sync";
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
describe("durable insights endpoint",()=>{
 it("fails closed without secret/session and only invokes the shared service after auth",async()=>{vi.stubEnv('CRON_SECRET','');expect((await GET(new NextRequest('https://example.test/api/cron/insights'))).status).toBe(503);vi.stubEnv('CRON_SECRET','test-secret');expect((await GET(new NextRequest('https://example.test/api/cron/insights'))).status).toBe(401);expect(syncDueInsights).not.toHaveBeenCalled();expect((await GET(new NextRequest('https://example.test/api/cron/insights',{headers:{authorization:'Bearer test-secret'}}))).status).toBe(200);expect(syncDueInsights).toHaveBeenCalledTimes(1);});
});
