import { beforeEach, expect, it, vi } from "vitest";
import { agentRuns, brands } from "@/db/schema";
const mocks=vi.hoisted(()=>({db:vi.fn(),website:vi.fn(),generate:vi.fn()}));
vi.mock("@/db",()=>({getDb:mocks.db}));
vi.mock("@/lib/brand-website/service",()=>({getBrandWebsiteContext:mocks.website}));
vi.mock("@/lib/ai/config",()=>({getWorkspaceTextModel:async()=>({model:{},modelId:"configured-model"})}));
vi.mock("@/lib/ai/persistent-memory",()=>({retrieveAgentMemory:async()=>({identity:"protected identity",profile:{},workspace:[],personal:[]})}));
vi.mock("@/lib/content/entitlement",()=>({assertContentCreationAllowed:async()=>undefined}));
vi.mock("ai",async original=>({...await original<typeof import("ai")>(),generateObject:mocks.generate}));
import { generateAndPersistContent } from "@/lib/ai/content";
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.db.mockReturnValue({
    select:()=>({from:(table:unknown)=>({where:()=>Object.assign(Promise.resolve(table===brands?[{
      businessName:"Studio",website:"https://brand.example.org/",description:"Manual brand details win",voicePresets:[],
    }]:[]),{orderBy:()=>({limit:async()=>[]})})})}),
    insert:(table:unknown)=>({values:()=>({returning:async()=>table===agentRuns?[{id:"generation-run"}]:[]})}),
    update:()=>({set:()=>({where:async()=>[]})}),
  });
  mocks.website.mockResolvedValue("Untrusted website reference: Actual document formatting service. Source: https://brand.example.org/services/");
  mocks.generate.mockRejectedValue(new Error("Test stops at the real model-request boundary"));
});
it("passes website facts and source links through the actual shared content generator while retaining manual brand context",async()=>{
  const signal=new AbortController().signal;
  await expect(generateAndPersistContent({workspaceId:"one",userId:"owner",input:{topic:"Document design",platforms:["facebook"]},abortSignal:signal}))
    .rejects.toThrow("Test stops at the real model-request boundary");
  expect(mocks.website).toHaveBeenCalledWith("one","https://brand.example.org/","Document design ",signal);
  expect(mocks.generate).toHaveBeenCalledOnce();
  const call=mocks.generate.mock.calls[0][0];
  expect(call.prompt).toContain("Actual document formatting service");expect(call.prompt).toContain("https://brand.example.org/services/");
  expect(call.system).toContain("Manual brand details win");
});
it("continues generating with saved Brand Brain when website context reports a failure",async()=>{
  mocks.website.mockResolvedValue("Website unavailable; use saved Brand Brain.");
  await expect(generateAndPersistContent({workspaceId:"one",userId:"owner",input:{topic:"Design",platforms:["facebook"]}}))
    .rejects.toThrow("Test stops at the real model-request boundary");
  expect(mocks.generate).toHaveBeenCalledOnce();
  expect(mocks.generate.mock.calls[0][0].system).toContain("Manual brand details win");
});
