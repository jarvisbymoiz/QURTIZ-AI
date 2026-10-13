import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({context:vi.fn(),read:vi.fn(),db:vi.fn(),revalidate:vi.fn(),limit:vi.fn()}));
vi.mock("../workspace",()=>({requireRoleForActiveWorkspace:mocks.context}));
vi.mock("@/db",()=>({getDb:mocks.db}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
vi.mock("@/lib/security/rate-limit",()=>({rateLimit:mocks.limit}));
vi.mock("@/lib/brand-website/service",()=>({ensureWebsiteKnowledge:mocks.read}));
import { refreshBrandWebsiteAction } from "../brand-website";
const knowledge={version:1,sourceUrl:"https://brand.example.org/",status:"ready",attemptedAt:new Date().toISOString(),
  fetchedAt:new Date().toISOString(),pages:[],warnings:[],leaseId:"server-internal"};
beforeEach(()=>{
  vi.clearAllMocks();mocks.context.mockResolvedValue({workspaceId:"current-workspace",userId:"owner"});
  mocks.limit.mockReturnValue({allowed:true});mocks.read.mockResolvedValue(knowledge);
  mocks.db.mockReturnValue({select:()=>({from:()=>({where:async()=>[{website:"https://brand.example.org/"}]})})});
});
describe("website refresh server action",()=>{
  it("requires brand write permission before reading or writing tenant data",async()=>{
    mocks.context.mockResolvedValue({error:"Permission denied"});
    expect(await refreshBrandWebsiteAction()).toEqual({ok:false,error:"Permission denied"});
    expect(mocks.context).toHaveBeenCalledWith("brand:write");expect(mocks.db).not.toHaveBeenCalled();expect(mocks.read).not.toHaveBeenCalled();
  });
  it("uses only the authenticated workspace and its saved website, with no client-selected tenant/URL",async()=>{
    expect(await refreshBrandWebsiteAction()).toMatchObject({ok:true,knowledge:{sourceUrl:knowledge.sourceUrl}});
    expect(mocks.read).toHaveBeenCalledWith("current-workspace",knowledge.sourceUrl,{refresh:true});
    expect(mocks.revalidate).toHaveBeenCalledWith("/brand-brain");
    expect((await refreshBrandWebsiteAction())).not.toHaveProperty("knowledge.leaseId");
  });
  it("preserves real reading failures instead of a success message",async()=>{
    mocks.read.mockResolvedValue({...knowledge,status:"failed",warnings:["robots_blocked"]});
    expect(await refreshBrandWebsiteAction()).toMatchObject({ok:false,error:expect.stringContaining("does not allow")});
  });
  it("reports a missing saved URL without making network calls",async()=>{
    mocks.db.mockReturnValue({select:()=>({from:()=>({where:async()=>[]})})});
    expect(await refreshBrandWebsiteAction()).toMatchObject({ok:false,error:expect.stringContaining("Save the website")});
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("enforces abuse limits",async()=>{
    mocks.limit.mockReturnValue({allowed:false});
    expect(await refreshBrandWebsiteAction()).toMatchObject({ok:false,error:expect.stringContaining("limit")});
    expect(mocks.db).not.toHaveBeenCalled();
  });
});
