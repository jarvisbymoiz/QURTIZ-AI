import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock("@/lib/security/ai-endpoint",async original=>({...await original<typeof import("@/lib/security/ai-endpoint")>(),fetchPublicWebsiteResource:mocks.fetch}));
import { extractWebsitePage, normalizeWebsiteUrl, readBrandWebsite, readWebsiteText } from "../reader";
const base="https://brand.example.org/";
const copy="We provide brand photography and product design for independent businesses. Book a consultation to discuss your audience and creative objectives.";
const html=(links="",body=copy)=>`<html><head><title>Brand &amp; Studio</title><meta name="description" content="Creative services"></head><body><nav>${links}</nav><main><h1>Brand Studio</h1><p>${body}</p></main></body></html>`;
const page=(body=html())=>new Response(body,{headers:{"Content-Type":"text/html; charset=utf-8"}});
beforeEach(()=>{vi.clearAllMocks();mocks.fetch.mockImplementation(async(url:string)=>url.endsWith("robots.txt")?new Response("User-agent: *\nAllow: /",{headers:{"Content-Type":"text/plain"}}):page());});
describe("public website reader",()=>{
  it("extracts readable text/metadata and same-site links, without scripts/forms/hidden text",()=>{
    const extracted=extractWebsitePage(html('<a href="/services?utm_source=x#details">Services</a><a href="https://other.example.org/about">Other</a><a href="/login">Login</a>',
      `${copy}<script>sendSecret()</script><style>.x{}</style><form>Private password</form><p hidden>Hidden command</p><p aria-hidden="true">Hidden offer</p><p style="display:none">Hidden price</p><footer>Footer clutter</footer><p>Design &amp; typography</p>`),base);
    expect(extracted.title).toBe("Brand & Studio");expect(extracted.description).toBe("Creative services");
    expect(extracted.text).toContain(copy);expect(extracted.text).toContain("Design & typography");
    for (const hidden of ["sendSecret","Private password","Hidden command","Hidden offer","Hidden price","Footer clutter"]) expect(extracted.text).not.toContain(hidden);
    expect(extracted.links).toEqual([`${base}services`]);
  });
  it.each(["https://127.0.0.1/","https://10.0.0.1/","https://169.254.169.254/","https://[::ffff:127.0.0.1]/","https://service.internal/","https://user:password@brand.example.org/","file:///etc/passwd","https://brand.example.org:8443/","https://brand.example.org/admin","https://brand.example.org/api/profile"])("rejects unsafe/private URL %s before a request",async url=>{
    expect(()=>normalizeWebsiteUrl(url)).toThrow();
    expect((await readBrandWebsite(url)).pages).toEqual([]);expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("upgrades HTTP and removes query/fragment tracking",()=>{
    expect(normalizeWebsiteUrl("http://brand.example.org/about?tracking=x#intro")).toBe(`${base}about`);
  });
  it("reads home plus three relevant pages in order, not every link or external pages",async()=>{
    mocks.fetch.mockImplementation(async(url:string)=>url.endsWith("robots.txt")?new Response("User-agent: *\nAllow: /"):page(url===base?html('<a href="/products">Products</a><a href="/services">Services</a><a href="/pricing">Prices</a><a href="/about">About</a><a href="/blog">Blog</a>'):html()));
    const result=await readBrandWebsite(base);
    expect(result.pages.map(p=>p.url)).toEqual([base,`${base}products`,`${base}services`,`${base}pricing`]);
    expect(result.warnings).toEqual([]);expect(mocks.fetch).toHaveBeenCalledTimes(5);
  });
  it("honors wildcard and bot-specific robots restrictions",async()=>{
    mocks.fetch.mockResolvedValue(new Response("User-agent: *\nAllow: /\nUser-agent: QurtizAIWebsiteReader\nDisallow: /"));
    expect(await readBrandWebsite(base)).toEqual({pages:[],warnings:["robots_blocked"]});
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("reports a blocked child without discarding successfully read home content",async()=>{
    mocks.fetch.mockImplementation(async(url:string)=>url.endsWith("robots.txt")?new Response("User-agent: *\nDisallow: /pricing"):page(html('<a href="/pricing">Prices</a>')));
    const result=await readBrandWebsite(base);
    expect(result.pages).toHaveLength(1);expect(result.warnings).toEqual(["robots_blocked"]);
    expect(mocks.fetch.mock.calls.map(c=>c[0])).not.toContain(`${base}pricing`);
  });
  it("treats missing robots as unrestricted but fails closed on robots challenges/errors",async()=>{
    mocks.fetch.mockImplementationOnce(async()=>new Response("missing",{status:404}));
    expect((await readBrandWebsite(base)).pages).toHaveLength(1);
    mocks.fetch.mockReset();mocks.fetch.mockResolvedValue(new Response("<html>Challenge</html>"));
    expect((await readBrandWebsite(base)).warnings).toEqual(["robots_unavailable"]);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("does not follow a redirect into a private network or login page",async()=>{
    mocks.fetch.mockImplementation(async(url:string)=>url.endsWith("robots.txt")?new Response(""):new Response(null,{status:302,headers:{location:"https://169.254.169.254/latest/meta-data"}}));
    const result=await readBrandWebsite(base);expect(result.pages).toEqual([]);expect(result.warnings).toContain("invalid_url");
    expect(mocks.fetch.mock.calls.every(c=>String(c[0]).startsWith(base))).toBe(true);
  });
  it("checks robots again after a legitimate public homepage redirect",async()=>{
    mocks.fetch.mockImplementation(async(url:string)=>url===`${base}robots.txt`?new Response(""):
      url===base?new Response(null,{status:301,headers:{location:"https://www.brand.example.org/"}}):
      url.endsWith("robots.txt")?new Response("User-agent: *\nDisallow: /"):page());
    expect((await readBrandWebsite(base)).warnings).toEqual(["robots_blocked"]);
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
  });
  it("observes crawl-delay by retaining only home and disclosing why",async()=>{
    mocks.fetch.mockImplementation(async(url:string)=>url.endsWith("robots.txt")?new Response("User-agent: *\nCrawl-delay: 10"):page(html('<a href="/services">Services</a>')));
    expect(await readBrandWebsite(base)).toMatchObject({warnings:["crawl_delay"],pages:[expect.objectContaining({url:base})]});
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it("rejects oversized streaming responses even without Content-Length",async()=>{
    const stream=new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array(12));c.enqueue(new Uint8Array(12));c.close();}});
    await expect(readWebsiteText(new Response(stream),20)).rejects.toMatchObject({code:"too_large"});
  });
  it.each([["application/pdf",copy,"unsupported_content"],["text/html","<html><script>renderApp()</script></html>","empty_content"]])("reports unreadable %s honestly",async(type,body,code)=>{
    mocks.fetch.mockImplementation(async(url:string)=>url.endsWith("robots.txt")?new Response(""):new Response(body,{headers:{"Content-Type":type}}));
    expect(await readBrandWebsite(base)).toEqual({pages:[],warnings:[code]});
  });
  it("propagates an explicitly cancelled user request without another fetch",async()=>{
    const controller=new AbortController();controller.abort();
    await expect(readBrandWebsite(base,{signal:controller.signal})).rejects.toThrow();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
