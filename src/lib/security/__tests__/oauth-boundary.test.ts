import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ role: "viewer" }));
vi.mock("@/lib/workspace", () => ({ getSessionUser: async () => ({ id: "user" }), resolveActionWorkspace: async () => "workspace", getMembership: async () => ({ role: state.role }) }));
vi.mock("@/lib/app-url", () => ({ getPublicAppUrl: () => "https://qurtiz-ai.vercel.app" }));
vi.mock("@/lib/meta/oauth", () => ({ metaConfigured: () => true, buildOAuthUrl: () => "https://facebook.com/dialog/oauth", discoverMetaAccounts: vi.fn() }));
vi.mock("@/lib/buffer/client", () => ({ BUFFER_AUTHORIZE_URL: "https://buffer.com/oauth", BUFFER_OAUTH_SCOPES: [], bufferConfigured: () => true, generatePkcePair: () => ({ codeVerifier: "test", codeChallenge: "test" }),
  signBufferOAuthState: () => "signed", bufferRedirectUri: () => "https://qurtiz-ai.vercel.app/api/buffer/callback", buildAuthorizeUrl: () => "https://buffer.com/oauth",
  logBufferOAuthDiagnostic: vi.fn(), verifyBufferOAuthState: () => ({ userId: "user", workspaceId: "workspace" }), exchangeCode: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: Buffer.from(JSON.stringify({ state: "valid", userId: "user", workspaceId: "workspace" })).toString("base64url") }) }) }));
import { GET as metaConnect } from "@/app/api/meta/connect/route";
import { GET as bufferConnect } from "@/app/api/buffer/connect/route";
import { GET as metaCallback } from "@/app/api/meta/callback/route";
import { GET as bufferCallback } from "@/app/api/buffer/callback/route";
import { discoverMetaAccounts } from "@/lib/meta/oauth";
import { exchangeCode } from "@/lib/buffer/client";
beforeEach(() => vi.clearAllMocks());
describe("workspace connection authority", () => {
  it.each(["viewer", "editor"])("rejects %s before OAuth redirect or token exchange", async role => {
    state.role = role;
    for (const connect of [metaConnect, bufferConnect]) expect((await connect(new NextRequest("https://qurtiz-ai.vercel.app/api/connect"))).status).toBe(403);
    for (const callback of [metaCallback, bufferCallback]) expect((await callback(new NextRequest("https://qurtiz-ai.vercel.app/api/callback?code=dummy&state=valid"))).status).toBe(403);
    expect(discoverMetaAccounts).not.toHaveBeenCalled(); expect(exchangeCode).not.toHaveBeenCalled();
  });
  it.each(["owner", "admin"])("preserves connection initiation for %s", async role => {
    state.role = role;
    for (const connect of [metaConnect, bufferConnect]) expect((await connect(new NextRequest("https://qurtiz-ai.vercel.app/api/connect"))).status).toBe(307);
  });
});
