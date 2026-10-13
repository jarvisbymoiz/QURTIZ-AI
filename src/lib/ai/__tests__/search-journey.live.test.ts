import { it, expect } from "vitest";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { streamText, stepCountIs, type ModelMessage } from "ai";
import { getDb } from "@/db";
import { workspaceAiConfig, workspaceMembers } from "@/db/schema";
import { getWorkspaceTextModel } from "../config";
import { buildSystemPrompt } from "../agent";
import { makeWebSearchTool } from "../search-tool";
import { createLazyChatTools } from "../chat-tools";
import { createBudgetedChatModel, resolveChatBudget } from "../chat-budget";
import { createSearchCompatibleModel } from "../search-compatible-model";

it.skipIf(process.env.RUN_LIVE_SEARCH_JOURNEY !== "true")("searches current news, niche and multiple-source topics, continues history and answers non-search chat using the configured provider", async () => {
  config({path:".env.local",quiet:true,override:true});
  const db = getDb();
  const [configured] = await db.select().from(workspaceAiConfig).limit(1);
  expect(configured).toBeTruthy();
  const [member] = await db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId,configured.workspaceId)).limit(1);
  const resolved = await getWorkspaceTextModel(configured.workspaceId,"chat");
  const queries = ["Search the latest NASA news and cite sources.", "Research social media typography and design guidance for small businesses; cite sources.",
    "Search for at least three sources about Instagram professional account content publishing requirements. Answer in three short bullets, each with its exact source link.",
    "Using the previous searched sources, summarize the account requirements with links. Do not search again.", "Thanks. Reply with one short sentence; no search needed."];
  let messages: ModelMessage[] = [];
  for (let i=0;i<queries.length;i++) {
    const request = queries[i];
    if (i<3) messages=[];
    messages.push({role:"user",content:request});
    const system = buildSystemPrompt({workspaceName:"Read-only search verification",brandSummary:"",memories:[],lazyContext:true,currentTask:request});
    const tools = createLazyChatTools({web_search:makeWebSearchTool({workspaceId:configured.workspaceId,userId:member.userId,logStep:async()=>{}})},request,system);
    const model=createBudgetedChatModel({model:createSearchCompatibleModel(resolved.model),budget:resolveChatBudget(resolved.provider,resolved.modelId),save:async()=>{}});
    const result=streamText({model,system,messages,tools:tools.tools,prepareStep:tools.prepareStep,stopWhen:stepCountIs(5),abortSignal:AbortSignal.timeout(120000)});
    const text=await result.text;
    const steps=await result.steps;
    const outputs=steps.flatMap(step=>step.toolResults).filter(r=>r.toolName==="web_search").map(r=>r.output as {searched?:boolean;sources?:{url:string}[]});
    expect(text.trim()).not.toBe("");
    if (i<3) {
      expect(outputs.some(output=>output.searched && (output.sources?.length??0)>0)).toBe(true);
      const urls=outputs.flatMap(output=>output.sources?.map(source=>source.url)??[]);
      console.info("[search:citation-check]",{scenario:i+1,finishReason:steps.at(-1)?.finishReason,answerTail:text.slice(-800)}); expect(urls.some(url=>text.includes(url))).toBe(true);
      if (i===2) expect(urls.length).toBeGreaterThanOrEqual(3);
    } else expect(outputs).toHaveLength(0);
    if (i===3) expect(text).toMatch(/https:\/\//);
    messages.push(...(await result.response).messages);
    console.info("[search:journey]",{scenario:i+1,provider:resolved.provider,toolCalls:outputs.length,sourceCount:outputs.reduce((n,r)=>n+(r.sources?.length??0),0),answerChars:text.length,passed:true});
    if (i<4) await new Promise(resolve=>setTimeout(resolve,3000));
  }
}, 600000);


