import { beforeEach, expect, it, vi } from "vitest";
import type { ToolCallOptions } from "ai";
import { buildAgentTools } from "../tools";
import { generateAndPersistContent } from "../content";
import { searchResearch } from "@/lib/research/service";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/workspace", () => ({ getMembership: vi.fn(async () => ({ role: "editor" })) }));
vi.mock("@/lib/research/service", () => ({ searchResearch: vi.fn() }));
vi.mock("../content", async importOriginal => ({ ...await importOriginal<object>(), generateAndPersistContent: vi.fn(async () => ({itemId:"saved-item",qa:{score:90,passed:true,issues:[]}})) }));
vi.mock("@/db", () => ({ getDb: () => ({
  select: () => ({from: () => ({where: async () => [{status:"running"}]})}),
  insert: () => ({values: async () => {}}),
}) }));

const options: ToolCallOptions = {toolCallId:"test",messages:[]};
beforeEach(() => { vi.clearAllMocks(); });

it("passes the original style brief and real search reference into creation, scoped to the current run", async () => {
  const ctx = {workspaceId:"caption-workspace",userId:"caption-user",runId:"run-1",currentTask:"Create an energetic Roman Urdu caption with relevant emojis"};
  const first = buildAgentTools(ctx);
  vi.mocked(searchResearch).mockResolvedValue({ok:true,provider:"brave",strategy:"web",strategyLabel:"Web",query:"public query",results:[{title:"Official announcement",url:"https://example.com/announcement",description:"Verified feature information",age:null}],count:1,fromCache:false,deduped:false});
  await first.web_search.execute!({query:"public query"},options);
  const input = {topic:"A researched feature",platforms:["facebook"]};
  await first.create_content.execute!(input,options);
  expect(vi.mocked(generateAndPersistContent).mock.calls[0][0].input).toMatchObject({requestBrief:ctx.currentTask,researchContext:expect.stringContaining("https://example.com/announcement")});
  const second = buildAgentTools({...ctx,workspaceId:"another-workspace",runId:"run-2"});
  await second.create_content.execute!(input,options);
  expect(vi.mocked(generateAndPersistContent).mock.calls[1][0].input.researchContext).toBeUndefined();
  vi.mocked(searchResearch).mockResolvedValue({ok:false,reason:"provider_unavailable",message:"No provider"});
  await first.web_search.execute!({query:"new public query"},options);
  await first.create_content.execute!(input,options);
  expect(vi.mocked(generateAndPersistContent).mock.calls[2][0].input.researchContext).toBeUndefined();
});
