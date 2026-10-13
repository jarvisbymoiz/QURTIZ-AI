import "server-only";
import { Parser } from "htmlparser2";
import robotsParser from "robots-parser";
import { assertAllowedAiEndpoint, fetchPublicWebsiteResource } from "@/lib/security/ai-endpoint";
import type { WebsiteErrorCode, WebsitePage } from "./knowledge";

const AGENT = "QurtizAIWebsiteReader";
const MAX_HTML_BYTES = 512 * 1024;
const PRIVATE_PATH = /(?:^|\/)(?:api|auth|oauth|login|logout|sign-?in|sign-?up|register|account|admin|dashboard|settings|checkout|cart|reset-password)(?:\/|$)/i;
export class WebsiteReadError extends Error {
  constructor(public readonly code:WebsiteErrorCode) { super(code); }
}
/** Drop query/fragment tracking, never send credentials, and upgrade HTTP to HTTPS.
 * TLS is mandatory; there is no fallback to insecure HTTP. */
export function normalizeWebsiteUrl(raw:string):string {
  try {
    const url = new URL(raw.trim());
    if (url.username || url.password || !["http:","https:"].includes(url.protocol) ||
      (url.port && url.port!=="443") || PRIVATE_PATH.test(decodeURIComponent(url.pathname))) throw new Error();
    url.protocol="https:"; url.search=""; url.hash="";
    if (url.href.length>2048) throw new Error();
    assertAllowedAiEndpoint(url.href);
    return url.href;
  } catch { throw new WebsiteReadError("invalid_url"); }
}

export async function readWebsiteText(response:Response, maxBytes=MAX_HTML_BYTES):Promise<string> {
  if (Number(response.headers.get("content-length"))>maxBytes) {
    await response.body?.cancel(); throw new WebsiteReadError("too_large");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks:Uint8Array[]=[]; let bytes=0;
  try {
    for (;;) {
      const {done,value}=await reader.read(); if (done) break;
      bytes+=value.byteLength;
      if (bytes>maxBytes) throw new WebsiteReadError("too_large");
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally { await reader.cancel().catch(()=>undefined); reader.releaseLock(); }
}

export function extractWebsitePage(html:string,url:string):WebsitePage & {links:string[]} {
  const stack:{tag:string;hidden:boolean}[]=[];
  const text:string[]=[]; const title:string[]=[]; const h1:string[]=[];
  const links:string[]=[]; let description="";
  const excluded = new Set(["head","script","style","noscript","svg","iframe","template","form","nav","footer"]);
  const blocks = new Set(["p","div","section","article","main","h1","h2","h3","h4","li","br","tr"]);
  const parser = new Parser({
    onopentag(tag,attrs) {
      const hidden=Boolean(stack.at(-1)?.hidden || excluded.has(tag) || "hidden" in attrs ||
        attrs["aria-hidden"]==="true" || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(attrs.style ?? ""));
      stack.push({tag,hidden});
      if (tag==="meta" && /^(description|og:description)$/i.test(attrs.name ?? attrs.property ?? "") && !description) description=(attrs.content ?? "").slice(0,500);
      // Navigation links remain discoverable, even though nav text is excluded.
      if (tag==="a" && attrs.href && links.length<200 && !attrs.href.startsWith("#")) {
        try {
          const link=normalizeWebsiteUrl(new URL(attrs.href,url).href);
          if (new URL(link).origin===new URL(url).origin && link!==url && !/\.(pdf|png|jpe?g|svg|gif|zip|mp4|webp)$/i.test(new URL(link).pathname)) links.push(link);
        } catch { /* Ignore unsupported links without making requests. */ }
      }
      if (!hidden && blocks.has(tag)) text.push("\n");
    },
    ontext(value) {
      if (stack.some(n=>n.tag==="title")) title.push(value);
      if (!stack.at(-1)?.hidden) {
        text.push(value);
        if (stack.some(n=>n.tag==="h1")) h1.push(value);
      }
    },
    onclosetag(tag) {
      const frame=stack.pop();
      if (!frame?.hidden && blocks.has(tag)) text.push("\n");
    },
  },{decodeEntities:true});
  parser.end(html);
  const clean=(value:string)=>value.replace(/[\t\r ]+/g," ").split("\n").map(s=>s.trim()).filter(Boolean).join("\n");
  return {url,title:clean(title.join("") || h1.join("")).slice(0,240),description,
    text:clean(text.join("")).slice(0,6000),links:[...new Set(links)]};
}

export type WebsiteReadResult={pages:WebsitePage[];warnings:WebsiteErrorCode[]};
export async function readBrandWebsite(raw:string,options:{signal?:AbortSignal}={}):Promise<WebsiteReadResult> {
  const signal=AbortSignal.any([AbortSignal.timeout(20_000),...(options.signal?[options.signal]:[])]);
  const rules = new Map<string,ReturnType<typeof robotsParser>>();
  const pages:WebsitePage[]=[]; const warnings:WebsiteErrorCode[]=[];
  const request=async(url:string,timeout=8000)=>{
    signal.throwIfAborted();
    try { return await fetchPublicWebsiteResource(normalizeWebsiteUrl(url),AbortSignal.any([signal,AbortSignal.timeout(timeout)])); }
    catch(error) {
      options.signal?.throwIfAborted();
      if (error instanceof WebsiteReadError) throw error;
      if (signal.aborted || (error instanceof Error && /abort|timeout/i.test(error.name))) throw new WebsiteReadError("timeout");
      const cause=error instanceof Error?(error as Error & {cause?:Error}).cause:undefined;
      throw new WebsiteReadError(/non-public|private.network|localhost|IP family/i.test(cause?.message ?? "")?"unsafe_destination":"network_error");
    }
  };
  const robots=async(url:string)=>{
    const origin=new URL(url).origin;
    if (rules.has(origin)) return rules.get(origin)!;
    let target=`${origin}/robots.txt`; let body="";
    try {
      for (let hop=0;hop<=3;hop++) {
        const response=await request(target,4000);
        if ([301,302,303,307,308].includes(response.status)) {
          await response.body?.cancel();
          const location=response.headers.get("location");
          if (!location || hop===3) throw new WebsiteReadError("robots_unavailable");
          target=normalizeWebsiteUrl(new URL(location,target).href); continue;
        }
        if (response.status===404 || response.status===410) {await response.body?.cancel();break;}
        if (!response.ok) {await response.body?.cancel();throw new WebsiteReadError("robots_unavailable");}
        body=await readWebsiteText(response,64*1024);
        if (/^\s*</.test(body)) throw new WebsiteReadError("robots_unavailable");
        break;
      }
    } catch(error) {options.signal?.throwIfAborted();throw error instanceof WebsiteReadError?error:new WebsiteReadError("robots_unavailable");}
    const rule=robotsParser(`${origin}/robots.txt`,body);rules.set(origin,rule);return rule;
  };
  const document=async(start:string,allowedOrigin?:string)=>{
    let url=normalizeWebsiteUrl(start);
    for (let hop=0;hop<=3;hop++) {
      if (allowedOrigin && new URL(url).origin!==allowedOrigin) throw new WebsiteReadError("unsafe_destination");
      const rule=await robots(url);
      if (rule.isAllowed(url,AGENT)===false) throw new WebsiteReadError("robots_blocked");
      const response=await request(url);
      if ([301,302,303,307,308].includes(response.status)) {
        await response.body?.cancel();
        const location=response.headers.get("location");
        if (!location || hop===3) throw new WebsiteReadError("redirect_limit");
        url=normalizeWebsiteUrl(new URL(location,url).href);continue;
      }
      if (!response.ok) {await response.body?.cancel();throw new WebsiteReadError("http_error");}
      const type=response.headers.get("content-type") ?? "";
      if (!/^text\/(html|plain)(?:;|$)|^application\/xhtml\+xml(?:;|$)/i.test(type)) {
        await response.body?.cancel();throw new WebsiteReadError("unsupported_content");
      }
      const body=await readWebsiteText(response);
      const page=type.toLowerCase().startsWith("text/plain")?{url,title:"",description:"",text:body.trim().slice(0,6000),links:[]}:extractWebsitePage(body,url);
      if (/^(just a moment|access denied|attention required.*cloudflare)/i.test(page.title)) throw new WebsiteReadError("http_error");
      if (page.text.length<80) throw new WebsiteReadError("empty_content");
      return page;
    }
    throw new WebsiteReadError("redirect_limit");
  };
  try {
    const home=await document(raw);
    const {links,...page}=home;pages.push(page);
    const candidates=links.map((url,index)=>({url,index,score:
      /product|service|course|solution|catalog/i.test(new URL(url).pathname)?3:
      /about|pricing|plans|contact/i.test(new URL(url).pathname)?2:0}))
      .filter(v=>v.score>0).sort((a,b)=>b.score-a.score || a.index-b.index).slice(0,3);
    const delay=rules.get(new URL(home.url).origin)?.getCrawlDelay(AGENT);
    if (delay && candidates.length) warnings.push("crawl_delay");
    else for (const candidate of candidates) {
      try {
        const {links:ignored,...child}=await document(candidate.url,new URL(home.url).origin);void ignored;
        if (!pages.some(p=>p.url===child.url)) pages.push(child);
      } catch(error) {
        options.signal?.throwIfAborted();
        warnings.push(error instanceof WebsiteReadError?error.code:"http_error");
        if (signal.aborted) break;
      }
    }
  } catch(error) {
    options.signal?.throwIfAborted();
    warnings.push(error instanceof WebsiteReadError?error.code:signal.aborted?"timeout":"http_error");
  }
  return {pages,warnings:[...new Set(warnings)].slice(0,8)};
}
