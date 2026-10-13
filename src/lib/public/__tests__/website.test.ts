import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  isPublicWebsitePath,
  safeAuthDestination,
  PUBLIC_PAGE_PATHS,
} from "../routes";
import { getArticles, getArticle, getRelatedArticles, readingMinutes, isPublishedArticle } from "../articles";
import { publicPages } from "../pages";
import { publicMetadata, siteUrl } from "../site";
import { articleFeed, escapeXml } from "../feed";
import sitemap from "@/app/sitemap";
import { updateSession } from "@/lib/supabase/middleware";
import { middleware } from "@/middleware";

const auth = vi.hoisted(() => ({ getUser: vi.fn(), create: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: auth.create }));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-public-key");
  auth.create.mockReset();
  auth.getUser.mockReset();
  auth.create.mockReturnValue({ auth: { getUser: auth.getUser } });
  auth.getUser.mockResolvedValue({ data: { user: null } });
});
describe("public routing and authentication regression", () => {
  it("adds noindex to service responses without changing public page indexing", async () => {
    for (const path of ["/api/cron/publish", "/api/meta/callback", "/auth/callback"]) {
      const response = await middleware(new NextRequest(`https://qurtiz.test${path}`));
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    }
    expect((await middleware(new NextRequest("https://qurtiz.test/features"))).headers.get("x-robots-tag")).toBeNull();
  });
  it("serves marketing and discovery without calling the auth provider", async () => {
    for (const path of [
      ...PUBLIC_PAGE_PATHS,
      "/articles/what-is-an-ai-social-media-agent",
      "/rss.xml",
      "/robots.txt",
      "/sitemap.xml",
      "/manifest.webmanifest",
      "/opengraph-image",
    ]) {
      const response = await updateSession(
        new NextRequest(`https://qurtiz.test${path}`),
      );
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }
    expect(auth.create).not.toHaveBeenCalled();
  });
  it("keeps application and API routes behind the existing gate", async () => {
    for (const path of [
      "/dashboard",
      "/chat",
      "/settings",
      "/content-studio",
      "/api/research/usage",
      "/features/private",
      "/articles/a/private",
    ]) {
      expect(isPublicWebsitePath(path)).toBe(false);
      const response = await updateSession(
        new NextRequest(`https://qurtiz.test${path}`),
      );
      const target = new URL(response.headers.get("location")!);
      expect(target.pathname).toBe("/login");
      expect(target.searchParams.get("next")).toBe(path);
    }
  });
  it("takes signed-in login visits to the dashboard while keeping home public", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "user" } } });
    const login = await updateSession(
      new NextRequest("https://qurtiz.test/login"),
    );
    expect(new URL(login.headers.get("location")!).pathname).toBe("/dashboard");
    const home = await updateSession(new NextRequest("https://qurtiz.test/"));
    expect(home.headers.get("location")).toBeNull();
  });
  it("rejects open redirects and obsolete root/auth destinations", () => {
    for (const path of [
      null,
      "/",
      "//evil.test",
      "https://evil.test",
      "/\\evil.test",
      "/login?next=/",
      "/signup",
      "/auth/callback",
      "/chat\n",
    ])
      expect(safeAuthDestination(path)).toBe("/dashboard");
    expect(safeAuthDestination("/calendar?view=week")).toBe(
      "/calendar?view=week",
    );
  });
});
describe("article discovery integrity", () => {
  it("excludes draft articles from the public publication predicate", () => {
    const article = getArticles()[0];
    expect(isPublishedArticle({ ...article, status: "draft" })).toBe(false);
    expect(isPublishedArticle({ ...article, status: "published" })).toBe(true);
    expect(getArticle(article.slug)).toEqual(article);
  });
  it("keeps canonical discovery on production even with local configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    expect(siteUrl()).toBe("https://qurtiz-ai.vercel.app");
    expect(sitemap().every(entry => entry.url.startsWith(`${siteUrl()}/`))).toBe(true);
    expect(articleFeed()).not.toContain("localhost");
  });
  it("requires unique editorial metadata, existing local links and article images", async () => {
    const { existsSync } = await import("node:fs");
    const published = getArticles();
    const titles = [...Object.values(publicPages).map(p => p.title), ...published.map(a => a.seoTitle)];
    const descriptions = [...Object.values(publicPages).map(p => p.description), ...published.map(a => a.seoDescription)];
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    const valid = new Set([...PUBLIC_PAGE_PATHS, "/signup", "/login", ...published.map(a => `/articles/${a.slug}`)]);
    const links = [...Object.values(publicPages).flatMap(p => p.sections.flatMap(s => s.links ?? [])), ...published.flatMap(a => a.sections.flatMap(s => s.link ? [s.link] : []))];
    for (const link of links.filter(l => l.href.startsWith("/"))) expect(valid.has(link.href.split("#")[0])).toBe(true);
    for (const article of published) {
      expect(existsSync(`public${article.image}`)).toBe(true);
      const path = `/articles/${article.slug}`;
      const meta = publicMetadata(article.seoTitle, article.seoDescription, path);
      expect(meta.alternates?.canonical).toBe(`${siteUrl()}${path}`);
      expect(meta.openGraph).toBeTruthy();
      expect(article.sections.every(s => s.title && s.paragraphs.length)).toBe(true);
    }
  });
  it("selects a bounded set of relevant related articles without the current article", () => {
    for (const article of getArticles()) {
      const related = getRelatedArticles(article);
      expect(related).toHaveLength(3);
      expect(related.some((item) => item.slug === article.slug)).toBe(false);
      expect(new Set(related.map((item) => item.slug)).size).toBe(3);
    }
  });
  it("gives every article a unique URL, section identifiers and substantial content", () => {
    const articles = getArticles();
    expect(new Set(articles.map((a) => a.slug)).size).toBe(articles.length);
    for (const a of articles) {
      expect(readingMinutes(a)).toBeGreaterThanOrEqual(5);
      expect(new Set(a.sections.map((s) => s.id)).size).toBe(a.sections.length);
      expect(a.publishedAt <= a.updatedAt).toBe(true);
    }
  });
  it("includes every article in RSS and sitemap, without private URLs", () => {
    const feed = articleFeed();
    const urls = sitemap().map((entry) => new URL(entry.url).pathname);
    for (const a of getArticles()) {
      expect(feed).toContain(`/articles/${a.slug}`);
      expect(urls).toContain(`/articles/${a.slug}`);
    }
    expect(urls).not.toContain("/dashboard");
    expect(urls).not.toContain("/login");
    expect(escapeXml('<a x="1">Tom & Jane</a>')).toBe(
      "&lt;a x=&quot;1&quot;&gt;Tom &amp; Jane&lt;/a&gt;",
    );
  });
});
