import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

// Audit actual prerendered production HTML, not just component source.
const root = join(process.argv[2] || ".next", "server", "app");
const sitemap = readFileSync(join(root, "sitemap.xml.body"), "utf8");
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => new URL(m[1]));
assert.equal(new Set(urls.map(u => u.href)).size, urls.length, "duplicate sitemap URL");
const origin = urls[0].origin;
assert.ok(origin.startsWith("https://") && !origin.includes("localhost"));
const html = new Map();
const documents = new Map();
const read = path => readFileSync(join(root, path === "/" ? "index.html" : `${path.slice(1)}.html`), "utf8");
for (const url of urls) {
  assert.equal(url.origin, origin, "mixed canonical origins");
  assert.ok(!/^\/(api|auth|dashboard|settings|login|signup|onboarding|chat)(\/|$)/.test(url.pathname));
  const source = read(url.pathname);
  html.set(url.pathname, source);
  documents.set(url.pathname, source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, ""));
}
const titles = new Set(), descriptions = new Set();
for (const [path, source] of html) {
  const document = documents.get(path);
  const title = document.match(/<title>(.*?)<\/title>/)?.[1];
  const description = document.match(/<meta name="description" content="([^"]+)"/)?.[1];
  assert.ok(title && description, `${path}: missing metadata`);
  assert.ok(!titles.has(title) && !descriptions.has(description), `${path}: duplicate metadata`);
  titles.add(title); descriptions.add(description);
  assert.equal((document.match(/<h1\b/g) || []).length, 1, `${path}: H1 count`);
  assert.ok(document.includes("<h2"), `${path}: missing H2 content`);
  const canonical = document.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  assert.equal(canonical && new URL(canonical).href, new URL(path, origin).href, `${path}: canonical`);
  assert.ok(!/<meta name="robots" content="[^"]*noindex/.test(document), `${path}: accidental noindex`);
  for (const property of ["og:title", "og:description", "og:url", "og:image"])
    assert.ok(document.includes(`property="${property}"`), `${path}: missing ${property}`);
  const schemas = [...source.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  assert.ok(schemas.length, `${path}: missing schema`);
  if (path.startsWith("/articles/")) {
    const article = schemas.find(s => s["@type"] === "Article");
    assert.ok(article && article.datePublished && article.dateModified && article.image && article.mainEntityOfPage);
    assert.equal(article.url, `${origin}${path}`);
    assert.ok(schemas.some(s => s["@type"] === "BreadcrumbList"));
  }
  for (const match of document.matchAll(/<a\b[^>]*href="([^\"]+)"/g)) {
    const href = match[1].replaceAll("&amp;", "&");
    if (!href.startsWith("/") && !href.startsWith("#")) continue;
    const target = new URL(href, `${origin}${path}`);
    if (target.origin !== origin) continue;
    if (["/login", "/signup", "/rss.xml"].includes(target.pathname)) continue;
    assert.ok(documents.has(target.pathname), `${path}: unknown link ${href}`);
    if (target.hash) assert.ok(documents.get(target.pathname).includes(`id="${decodeURIComponent(target.hash.slice(1))}"`), `${path}: broken anchor ${href}`);
  }
  console.log(`PASS ${path}`);
}
const feed = readFileSync(join(root, "rss.xml.body"), "utf8");
const articleUrls = urls.filter(u => u.pathname.startsWith("/articles/"));
assert.equal((feed.match(/<item>/g) || []).length, articleUrls.length);
for (const url of articleUrls) assert.ok(feed.includes(`<link>${url.href}</link>`));
assert.ok(!feed.includes("localhost"));
assert.ok(readFileSync(join(root, "robots.txt.body"), "utf8").includes(`Sitemap: ${origin}/sitemap.xml`));
for (const path of ["/login", "/signup"]) {
  if (existsSync(join(root, `${path.slice(1)}.html`))) assert.ok(/<meta name="robots" content="[^"]*noindex/.test(read(path)));
}
console.log(`PASS sitemap, robots, RSS, auth noindex: ${urls.length} public URLs / ${articleUrls.length} articles`);
