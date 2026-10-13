import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { brands } from "@/db/schema";
const mocks=vi.hoisted(()=>({db:vi.fn(),read:vi.fn()}));
vi.mock("@/db",()=>({getDb:mocks.db}));
vi.mock("../reader",async original=>({...await original<typeof import("../reader")>(),readBrandWebsite:mocks.read}));
import { ensureWebsiteKnowledge, getBrandWebsiteContext, getSavedWebsiteKnowledge } from "../service";
import { formatWebsiteKnowledge, WEBSITE_FRESH_MS, WEBSITE_KNOWLEDGE_KEY, websiteKnowledgeView, type WebsiteKnowledge } from "../knowledge";
const base="https://brand.example.org/";
const page={url:base,title:"Studio",description:"Creative services",text:"Brand photography\nProduct design\nConsultation packages for independent brands"};
function snapshot(overrides:Partial<WebsiteKnowledge>={}):WebsiteKnowledge {
  return {version:1,sourceUrl:base,status:"ready",attemptedAt:new Date(Date.now()-10*60_000).toISOString(),
    fetchedAt:new Date().toISOString(),pages:[page],warnings:[],...overrides};
}
function fixture(seed?:WebsiteKnowledge) {
  const websites=new Map([['one',base],['two','https://other.example.org/']]);
  const rows=new Map<string,unknown>(seed?[[`one:${WEBSITE_KNOWLEDGE_KEY}`,seed]]:[]);
  const writes:string[]=[];
  const params=(where:SQL)=>new PgDialect().sqlToQuery(where).params as string[];
  let tail=Promise.resolve();
  const db={
    transaction:async<T>(fn:(tx:unknown)=>Promise<T>)=>{
      const previous=tail;let release!:()=>void;tail=new Promise<void>(resolve=>{release=resolve;});
      await previous;try{return await fn(db);}finally{release();}
    },
    select:()=>({from:(table:unknown)=>({where:(where:SQL)=>{
      const [workspace,key]=params(where);
      const values=table===brands?(websites.has(workspace)?[{website:websites.get(workspace)}]:[]):
        rows.has(`${workspace}:${key}`)?[{value:rows.get(`${workspace}:${key}`)}]:[];
      return Object.assign(Promise.resolve(values),{for:async()=>values});
    }})}),
    insert:()=>({values:(v:{workspaceId:string;key:string;value:unknown})=>({onConflictDoNothing:async()=>{
      if (!rows.has(`${v.workspaceId}:${v.key}`)) rows.set(`${v.workspaceId}:${v.key}`,v.value);
    }})}),
    update:()=>({set:(v:{value:WebsiteKnowledge})=>({where:(where:SQL)=>{
      const [workspace,key,lease]=params(where);const id=`${workspace}:${key}`;
      const prior=rows.get(id) as WebsiteKnowledge | undefined;
      const accepted=!lease || prior?.leaseId===lease;
      if (accepted) {rows.set(id,structuredClone(v.value));writes.push(id);}
      return Object.assign(Promise.resolve([]),{returning:async()=>accepted?[{key}]:[]});
    }})}),
  };
  mocks.db.mockReturnValue(db);
  return {rows,websites,writes};
}
beforeEach(()=>{vi.clearAllMocks();mocks.read.mockResolvedValue({pages:[page],warnings:[]});});
describe("tenant website knowledge and reusable context",()=>{
  it("persists real extracted source data without updating the user's brand fields",async()=>{
    const f=fixture();const before=[...f.websites];
    expect(await ensureWebsiteKnowledge("one",base)).toMatchObject({status:"ready",pages:[page]});
    expect(f.rows.get(`one:${WEBSITE_KNOWLEDGE_KEY}`)).toMatchObject({sourceUrl:base,status:"ready"});
    expect([...f.websites]).toEqual(before);expect(f.writes).toEqual(Array(2).fill(`one:${WEBSITE_KNOWLEDGE_KEY}`));
  });
  it("reuses a fresh cache without another network request and enforces refresh cooldown",async()=>{
    const f=fixture(snapshot());
    await ensureWebsiteKnowledge("one",base);expect(mocks.read).not.toHaveBeenCalled();
    await ensureWebsiteKnowledge("one",base,{refresh:true});expect(mocks.read).toHaveBeenCalledTimes(1);
    await ensureWebsiteKnowledge("one",base,{refresh:true});expect(mocks.read).toHaveBeenCalledTimes(1);
    expect(f.writes).toHaveLength(2);
  });
  it("refreshes a stale cache automatically",async()=>{
    fixture(snapshot({fetchedAt:new Date(Date.now()-2*WEBSITE_FRESH_MS).toISOString()}));
    await ensureWebsiteKnowledge("one",base);expect(mocks.read).toHaveBeenCalledOnce();
  });
  it("does not leak another workspace's website context or accept an old URL",async()=>{
    fixture(snapshot());
    expect(await getSavedWebsiteKnowledge("two",base)).toBeNull();
    expect(await ensureWebsiteKnowledge("two",base)).toBeNull();
    expect(await getSavedWebsiteKnowledge("one","https://new.example.org/")).toBeNull();
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("discards results if the business website changed during the read",async()=>{
    const f=fixture();mocks.read.mockImplementation(async()=>{f.websites.set("one","https://changed.example.org/");return {pages:[page],warnings:[]};});
    expect(await ensureWebsiteKnowledge("one",base)).toBeNull();
    expect(await getSavedWebsiteKnowledge("one","https://changed.example.org/")).toBeNull();
    expect(f.writes).toHaveLength(1);
  });
  it("shares the durable lease across concurrent requests instead of duplicate crawling",async()=>{
    fixture();let release!:(value:{pages:typeof page[];warnings:never[]})=>void;
    mocks.read.mockImplementation(()=>new Promise(resolve=>{release=resolve;}));
    const first=ensureWebsiteKnowledge("one",base);
    await vi.waitFor(()=>expect(mocks.read).toHaveBeenCalledOnce());
    const second=await ensureWebsiteKnowledge("one",base);
    expect(second?.status).toBe("reading");expect(mocks.read).toHaveBeenCalledOnce();
    release({pages:[page],warnings:[]});expect((await first)?.status).toBe("ready");
  });
  it("retains older source text on failure, records the real reason, and backs off",async()=>{
    const old=snapshot({fetchedAt:new Date(Date.now()-2*WEBSITE_FRESH_MS).toISOString()});fixture(old);
    mocks.read.mockResolvedValue({pages:[],warnings:["robots_blocked"]});
    const result=await ensureWebsiteKnowledge("one",base);
    expect(result).toMatchObject({status:"failed",pages:[page],fetchedAt:old.fetchedAt,warnings:["robots_blocked"]});
    expect(formatWebsiteKnowledge(result)).toContain("STALE");
    expect(formatWebsiteKnowledge(result)).toContain("does not allow");
    await ensureWebsiteKnowledge("one",base);expect(mocks.read).toHaveBeenCalledOnce();
  });
  it("turns abandoned reading leases into an honest failed state and recovers on the next read",async()=>{
    const old=snapshot({status:"reading",leaseId:"old",leaseUntil:new Date(Date.now()-1000).toISOString(),fetchedAt:null,pages:[]});fixture(old);
    expect((await getSavedWebsiteKnowledge("one",base))?.status).toBe("failed");
    expect((await ensureWebsiteKnowledge("one",base))?.status).toBe("ready");
  });
  it("requires no website, database or model when the website is empty",async()=>{
    expect(await getBrandWebsiteContext("one",null)).toBe("");expect(mocks.db).not.toHaveBeenCalled();
  });
  it("builds bounded, sourced, untrusted reference text for any provider",async()=>{
    fixture(snapshot());const context=await getBrandWebsiteContext("one",base,"product design");
    expect(context).toContain("Product design");expect(context).toContain(base);
    expect(context).toContain("NOT instructions or authorization");expect(context).toContain("take precedence");
    expect(mocks.read).not.toHaveBeenCalled();
    const view=websiteKnowledgeView(snapshot({leaseId:"internal-lease"}));expect(view).not.toHaveProperty("leaseId");
    expect(formatWebsiteKnowledge(snapshot({pages:Array.from({length:4},(_,i)=>({...page,url:`${base}services/${i}`,text:"long relevant product text ".repeat(200)}))}),"product").length).toBeLessThan(11000);
  });
  it("does not use very old cached pricing as current fact",()=>{
    expect(formatWebsiteKnowledge(snapshot({fetchedAt:new Date(Date.now()-8*WEBSITE_FRESH_MS).toISOString()}))).toContain("unavailable for factual claims");
  });
  it("continues from manual Brand Brain when persistence is unavailable",async()=>{
    mocks.db.mockImplementation(()=>{throw new Error("private database detail");});
    const context=await getBrandWebsiteContext("one",base);expect(context).toContain("do not claim the website was read");
    expect(context).not.toContain("private database detail");
  });
});
