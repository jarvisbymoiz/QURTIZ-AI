import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentItems, contentVariants, jobs, researchItems, settings, visualAssets } from "@/db/schema";
import { autopilotSettingsSchema } from "../schema";
const mocks = vi.hoisted(() => ({ db:vi.fn(), context:vi.fn(), research:vi.fn(), plan:vi.fn(), generate:vi.fn(), approve:vi.fn(), schedule:vi.fn(), media:vi.fn() }));
vi.mock("@/db",()=>({getDb:mocks.db}));
vi.mock("ai",()=>({generateText:mocks.plan}));
vi.mock("@/lib/jobs/workflows",()=>({buildAutopilotRunContext:mocks.context}));
vi.mock("@/lib/jobs/boss",()=>({getBoss:vi.fn(),QUEUES:{autopilotRun:"autopilot-run"}}));
vi.mock("@/lib/ai/config",()=>({hasWorkspaceAIConfig:async()=>true,getWorkspaceTextModel:async()=>({model:{}})}));
vi.mock("@/lib/ai/content",()=>({AI_GENERATION_TIMEOUT_MS:120000,generateAndPersistContent:mocks.generate}));
vi.mock("@/lib/ai/research",()=>({researchTopics:mocks.research}));
vi.mock("@/lib/visuals/generate",()=>({generateVisual:vi.fn()}));
vi.mock("@/lib/supabase/service",()=>({createServiceClient:()=>({})}));
vi.mock("@/lib/content/lifecycle",()=>({approveItem:mocks.approve}));
vi.mock("@/lib/publishing/service",()=>({schedulePost:mocks.schedule,selectItemMedia:mocks.media}));
import { autoRunItemId, executeAutoRun } from "../run";
type Row = Record<string, unknown>;
function fixture(requireApproval=true) {
  const config = autopilotSettingsSchema.parse({enabled:true,requireApproval,maxPostsPerRun:3,runTimes:["09:00"],platforms:["facebook"],formats:["single_image"],generateImages:false});
  const job: Row = {id:"job-1",workspaceId:"ws",userId:"user",type:"autopilot",status:"queued",input:{config,timezone:"Asia/Karachi",occurrence:"2026-09-16T09:00"},result:{createdIds:[]}};
  const items = new Map<string,Row>();
  const savedSettings = {value:config};
  const updates: Row[]=[];
  const selectRows = (table:unknown) => table===settings?[savedSettings]:table===contentItems?[...items.values()].slice(-1):table===contentVariants?[{id:"v",platform:"facebook",format:"single_image",status:"ready_for_review",slides:[]}]:table===visualAssets?[{kind:"upload",mimeType:"image/png"}]:table===researchItems?[{topic:"One research opportunity",summary:"Source summary",sourceUrl:null}]:[];
  const db = {
    select:()=>({from:(table:unknown)=>({where:async()=>selectRows(table)})}),
    update:(table:unknown)=>({set:(values:Row)=>({where:()=>{
      const canClaim = job.status==="queued";
      if(table===jobs) {Object.assign(job,structuredClone(values));updates.push(values);}
      const result=Promise.resolve([]) as unknown as Promise<Row[]> & {returning:()=>Promise<Row[]>};
      result.returning=async()=>canClaim?[{...job}]:[];
      return result;
    }})}),
    insert:()=>({values:async()=>undefined}),
  };
  mocks.db.mockReturnValue(db);
  const persist = async (args:{contentItemId:string}) => {
    if(!items.has(args.contentItemId)) items.set(args.contentItemId,{id:args.contentItemId,status:"ready_for_review",format:"single_image",qa:{passed:true}});
    return {itemId:args.contentItemId,qa:{passed:true}};
  };
  mocks.generate.mockImplementation(persist);
  return {job,items,config,savedSettings,updates,persist};
}
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({text:"Real data unavailable",metrics:[],metricsCount:0,bestHours:[]});
  mocks.research.mockResolvedValue({ok:true,insertedIds:["research-one"]});
  mocks.plan.mockResolvedValue({text:'["Educational brand topic","Practical brand topic","Brand customer topic"]'});
  mocks.schedule.mockResolvedValue({ok:true});
  mocks.media.mockResolvedValue({kind:"image",paths:["image.png"]});
});
describe("durable Auto Run execution",()=>{
  it("creates exactly 3 requested posts even with only one research result, respecting platform/format and approval",async()=>{
    const f=fixture(); await executeAutoRun("job-1");
    expect(f.items.size).toBe(3); expect(mocks.generate).toHaveBeenCalledTimes(3);
    for(const [args] of mocks.generate.mock.calls) {expect(args.input.platforms).toEqual(["facebook"]);expect(args.input.preferredFormat).toBe("single_image");}
    expect(mocks.approve).not.toHaveBeenCalled();expect(mocks.schedule).not.toHaveBeenCalled();expect(f.job.status).toBe("completed");
  });
  it("routes every eligible post through centralized scheduling with the configured conflict policy",async()=>{
    const f=fixture(false);await executeAutoRun("job-1");
    expect(mocks.schedule).toHaveBeenCalledTimes(3);
    expect(mocks.schedule.mock.calls[0][0].autoTiming).toMatchObject({times:["09:00","12:00","17:00"],source:"configured-fallback",minGapMinutes:120,maxPostsPerDay:3});
    expect(f.job.status).toBe("completed");
  });
  it("resumes after a lost persistence acknowledgement using the same deterministic content identity",async()=>{
    const f=fixture();mocks.generate.mockImplementationOnce(async args=>{await f.persist(args);throw new Error("Lost acknowledgement");});
    await expect(executeAutoRun("job-1")).rejects.toThrow("Lost acknowledgement");
    expect(f.job.status).toBe("queued");await executeAutoRun("job-1");
    expect(f.items.size).toBe(3);expect(mocks.generate.mock.calls[0][0].contentItemId).toBe(mocks.generate.mock.calls[1][0].contentItemId);
  });
  it("stops disabled runs before any AI or publishing work",async()=>{
    const f=fixture(false);f.savedSettings.value.enabled=false;await executeAutoRun("job-1");
    expect(f.job.status).toBe("cancelled");expect(mocks.generate).not.toHaveBeenCalled();expect(mocks.schedule).not.toHaveBeenCalled();
  });
  it("does not regenerate completed posts when a queued recovery resumes saved progress",async()=>{
    const f=fixture();await executeAutoRun("job-1");f.job.status="queued";await executeAutoRun("job-1");
    expect(mocks.generate).toHaveBeenCalledTimes(3);expect(f.items.size).toBe(3);
  });
  it("stable item identities differ by run, ordinal and QA attempt",()=>{
    expect(autoRunItemId("job",0,0)).toBe(autoRunItemId("job",0,0));
    expect(new Set([autoRunItemId("job",0,0),autoRunItemId("job",1,0),autoRunItemId("other",0,0),autoRunItemId("job",0,1)]).size).toBe(4);
  });
  it("fails corrupt saved job settings with a terminal state instead of orphaning a running job", async () => {
    const f=fixture(); f.job.input={config:{enabled:true,maxPostsPerRun:999}};
    await executeAutoRun("job-1");expect(f.job.status).toBe("failed");expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("retries scheduling errors while preserving the requested posts", async () => {
    const f=fixture(false);mocks.schedule.mockResolvedValueOnce({ok:false,message:"Provider temporarily unavailable"});
    await expect(executeAutoRun("job-1")).rejects.toThrow("Provider temporarily unavailable");
    await executeAutoRun("job-1");expect(f.items.size).toBe(3);expect(mocks.generate).toHaveBeenCalledTimes(3);expect(f.job.status).toBe("completed");
  });
  it("retains media-incomplete posts for review without approving or scheduling them", async () => {
    const f=fixture(false);mocks.media.mockResolvedValue({kind:"none",paths:[]});await executeAutoRun("job-1");
    expect(f.items.size).toBe(3);expect(mocks.approve).not.toHaveBeenCalled();expect(mocks.schedule).not.toHaveBeenCalled();
    expect(f.job.result).toMatchObject({stage:"Completed with warnings"});
  });
  it("honors autoSchedule=false even when automatic approval is enabled", async () => {
    const f=fixture(false);f.config.autoSchedule=false;await executeAutoRun("job-1");
    expect(f.items.size).toBe(3);expect(mocks.schedule).not.toHaveBeenCalled();expect(mocks.approve).not.toHaveBeenCalled();
  });
  it("never counts QA-failed candidates as the three requested valid posts and exhausts bounded retries", async () => {
    const f=fixture(false);mocks.generate.mockResolvedValue({itemId:"failed-candidate",qa:{passed:false}});
    await expect(executeAutoRun("job-1")).rejects.toThrow("failed QA");
    await expect(executeAutoRun("job-1")).rejects.toThrow("failed QA");
    await executeAutoRun("job-1");expect(f.job.status).toBe("failed");expect(mocks.generate).toHaveBeenCalledTimes(9);
    expect(f.job.result).toMatchObject({createdIds:[]});expect(mocks.approve).not.toHaveBeenCalled();expect(mocks.schedule).not.toHaveBeenCalled();
  });
  it("requires actual video media for Auto Run Reels instead of approving an image", async () => {
    const f=fixture(false);f.config.formats=["reel"];
    mocks.generate.mockImplementation(async args => {
      const result=await f.persist(args);f.items.get(result.itemId)!.format="reel";return result;
    });
    await executeAutoRun("job-1");expect(f.items.size).toBe(3);expect(mocks.approve).not.toHaveBeenCalled();expect(mocks.schedule).not.toHaveBeenCalled();
    expect(f.job.result).toMatchObject({stage:"Completed with warnings"});
  });
  it("rejects duplicate AI topics and retries a fresh strategy without creating incomplete content", async () => {
    const f=fixture();mocks.plan.mockResolvedValueOnce({text:'["Duplicate topic","Duplicate topic","Distinct topic"]'});
    await expect(executeAutoRun("job-1")).rejects.toThrow("duplicate topics");expect(f.items.size).toBe(0);
    await executeAutoRun("job-1");expect(f.items.size).toBe(3);expect(mocks.plan).toHaveBeenCalledTimes(2);
  });
});
