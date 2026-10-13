import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const signOut = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signOut } }) }));
import { POST } from "@/app/auth/signout/route";
beforeEach(() => vi.clearAllMocks());
const rejectedHeaders: Record<string, string>[] = [{}, { origin: "https://foreign.example" }, { origin: "https://qurtiz-ai.vercel.app", "sec-fetch-site": "cross-site" }];
it.each(rejectedHeaders)("refuses cross-site or originless sign-out %j", async headers => {
  const response = await POST(new NextRequest("https://qurtiz-ai.vercel.app/auth/signout", { method: "POST", headers }));
  expect(response.status).toBe(403); expect(signOut).not.toHaveBeenCalled();
});
it("preserves same-origin sign-out", async () => {
  const response = await POST(new NextRequest("https://qurtiz-ai.vercel.app/auth/signout", { method: "POST", headers: { origin: "https://qurtiz-ai.vercel.app" } }));
  expect(response.status).toBe(302); expect(signOut).toHaveBeenCalledOnce();
});
