// Run against a local production server. Uses Playwright from an installed runtime.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.QURTIZ_PLAYWRIGHT_MODULE || "playwright",
);
const origin = process.env.QURTIZ_QA_ORIGIN || "http://localhost:3000";
const output = ".public-qa";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.QURTIZ_QA_BROWSER ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.addInitScript(() => {
  window.publicMetrics = { cls: 0, lcp: 0, longTasks: 0 };
  for (const type of ["layout-shift", "largest-contentful-paint", "longtask"]) {
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (type === "layout-shift" && !entry.hadRecentInput)
            window.publicMetrics.cls += entry.value;
          if (type === "largest-contentful-paint")
            window.publicMetrics.lcp = entry.startTime;
          if (type === "longtask") window.publicMetrics.longTasks++;
        }
      }).observe({ type, buffered: true });
    } catch {
      /* Unsupported browser diagnostic. */
    }
  }
});
const failures = [],
  report = [],
  errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const routes = [
  "/",
  "/features",
  "/about",
  "/open-source",
  "/security",
  "/contact",
  "/changelog",
  "/faq",
  "/privacy",
  "/terms",
  "/acceptable-use",
  "/data-deletion",
  "/articles",
  "/articles/what-is-an-ai-social-media-agent",
  "/articles/ai-powered-social-media-workflow",
  ...[
    "what-is-qurtiz-ai",
    "startup-social-media-workflow-qurtiz-ai",
    "chatbot-to-ai-agent-qurtiz",
    "automate-facebook-instagram-qurtiz-ai",
    "brand-brain-research-original-content",
  ].map((slug) => `/articles/${slug}`),
];
async function revealPage() {
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 700) {
    await page.evaluate((y) => scrollTo(0, y), y);
    await page.waitForTimeout(80);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(500);
}
try {
  for (const route of routes) {
    const response = await page.goto(`${origin}${route}`, {
      waitUntil: "networkidle",
    });
    const details = await page.evaluate(() => ({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content,
      canonical: document.querySelector('link[rel="canonical"]')?.href,
      h1: document.querySelectorAll("h1").length,
      robots: document.querySelector('meta[name="robots"]')?.content,
      overflow: document.documentElement.scrollWidth > innerWidth,
      brokenImages: [...document.images]
        .filter((img) => img.complete && img.naturalWidth === 0)
        .map((img) => img.src),
      schema: [
        ...document.querySelectorAll('script[type="application/ld+json"]'),
      ].map((s) => JSON.parse(s.textContent)),
      internalLinks: [...document.querySelectorAll("a[href]")]
        .map((a) => a.getAttribute("href"))
        .filter((href) => href.startsWith("/")),
    }));
    report.push({ route, status: response.status(), ...details });
    if (
      response.status() !== 200 ||
      details.h1 !== 1 ||
      !details.description ||
      !details.canonical ||
      details.robots?.includes("noindex") ||
      details.overflow ||
      details.brokenImages.length
    )
      failures.push({ route, reason: "Page/SEO/layout integrity", details });
  }
  for (const name of ["title", "description", "canonical"])
    if (
      new Set(report.filter((r) => r.title).map((r) => r[name])).size !==
      report.length
    )
      failures.push({ reason: `Duplicate ${name}` });
  const links = [
    ...new Set(
      report
        .flatMap((r) => r.internalLinks ?? [])
        .map((href) => href.split("#")[0])
        .filter(Boolean),
    ),
  ];
  for (const href of links) {
    const response = await page.request.get(`${origin}${href}`, {
      maxRedirects: 0,
    });
    if (response.status() >= 400)
      failures.push({ href, status: response.status() });
  }
  for (const path of [
    "/sitemap.xml",
    "/robots.txt",
    "/rss.xml",
    "/llms.txt",
    "/manifest.webmanifest",
    "/opengraph-image",
    "/icon.svg",
    "/apple-icon.png",
    "/favicon.ico",
  ]) {
    const response = await page.request.get(`${origin}${path}`, {
      maxRedirects: 0,
    });
    report.push({
      route: path,
      status: response.status(),
      contentType: response.headers()["content-type"],
    });
    if (response.status() !== 200)
      failures.push({ path, status: response.status() });
  }
  for (const path of [
    "/dashboard",
    "/chat",
    "/settings",
    "/content-studio",
    "/connections",
    "/calendar",
  ]) {
    const response = await page.request.get(`${origin}${path}`, {
      maxRedirects: 0,
    });
    if (
      response.status() !== 307 ||
      !response.headers().location?.includes("/login")
    )
      failures.push({ path, status: response.status(), reason: "Auth gate" });
  }
  for (const path of ["/login", "/signup"]) {
    await page.goto(`${origin}${path}`, { waitUntil: "networkidle" });
    if (!(await page.locator("input[type=email]").isVisible()))
      failures.push({ path, reason: "Auth form missing" });
    if (!(await page.locator('a[href="/"]').count()))
      failures.push({ path, reason: "Home link missing" });
  }
  await page.goto(origin, { waitUntil: "networkidle" });
  await revealPage();
  await page.screenshot({ path: `${output}/home-desktop.png`, fullPage: true });
  await page.screenshot({ path: `${output}/home-desktop-viewport.png` });
  report.push({
    route: "/",
    diagnostic: "Local desktop lab metrics (not field Core Web Vitals)",
    metrics: await page.evaluate(() => window.publicMetrics),
  });
  await page
    .locator("#publishing")
    .screenshot({ path: `${output}/platform-ecosystem.png` });
  await page
    .locator(".publishing-demo")
    .screenshot({ path: `${output}/publishing-demo.png` });
  await page.getByRole("tab", { name: "Brand Brain", exact: true }).click();
  if (
    !(await page
      .getByRole("tabpanel")
      .getByText("The context behind your content.")
      .isVisible())
  )
    failures.push({ reason: "Preview tab does not update" });
  await page.screenshot({
    path: `${output}/preview-desktop.png`,
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of routes) {
    await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      failures.push({ route, reason: "Mobile overflow" });
  }
  await page.goto(origin, { waitUntil: "networkidle" });
  await revealPage();
  await page.screenshot({ path: `${output}/home-mobile.png`, fullPage: true });
  await page.screenshot({ path: `${output}/home-mobile-viewport.png` });
  await page.locator(".mobile-nav summary").click();
  await page.screenshot({ path: `${output}/navigation-mobile.png` });
  if (
    !(await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Features", exact: true })
      .isVisible())
  )
    failures.push({ reason: "Mobile menu unavailable" });
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Features", exact: true })
    .click();
  await page.waitForURL("**/features");
  if (await page.locator(".mobile-nav").evaluate((el) => el.open))
    failures.push({ reason: "Mobile menu remains open after navigation" });
  await page.goto(`${origin}/faq`, { waitUntil: "networkidle" });
  await page.locator(".faq-item summary").first().click();
  if (!(await page.locator(".faq-item").first().locator("p").isVisible()))
    failures.push({ reason: "FAQ interaction" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(origin, { waitUntil: "networkidle" });
  if (
    await page
      .locator(".system-core")
      .evaluate((el) => getComputedStyle(el).animationName !== "none")
  )
    failures.push({ reason: "Reduced motion ignored" });
  const demo = page.locator(".publishing-demo");
  if ((await demo.getAttribute("data-demo-stage")) !== "7")
    failures.push({ reason: "Reduced-motion demo does not settle" });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator(".demo-stages button").nth(5).click();
  if ((await demo.getAttribute("data-demo-stage")) !== "5")
    failures.push({ reason: "Published demo interaction" });
  await page.locator(".demo-stages button").nth(6).click();
  if (
    (await demo.getAttribute("data-demo-stage")) !== "6" ||
    (await demo.getAttribute("data-demo-playing")) !== "false"
  )
    failures.push({ reason: "First Comment demo interaction" });
  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin, { waitUntil: "networkidle" });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      failures.push({ reason: "Responsive overflow", width });
  }
  for (const entry of report.filter((r) => r.route.startsWith("/articles/"))) {
    const article = entry.schema.find((s) => s["@type"] === "Article");
    if (
      !article?.datePublished ||
      !article?.dateModified ||
      !article?.image ||
      !entry.schema.some((s) => s["@type"] === "BreadcrumbList")
    )
      failures.push({
        reason: "Incomplete article schema",
        route: entry.route,
      });
  }
  for (const href of [
    ...new Set(report.flatMap((r) => r.internalLinks ?? [])),
  ].filter((h) => h.includes("#"))) {
    const [path, hash] = href.split("#");
    await page.goto(`${origin}${path || "/"}`, { waitUntil: "networkidle" });
    if (
      !(await page.evaluate(
        (id) => Boolean(document.getElementById(decodeURIComponent(id))),
        hash,
      ))
    )
      failures.push({ reason: "Missing link anchor", href });
  }
  if (errors.length)
    failures.push({ reason: "Browser runtime errors", errors });
  await writeFile(
    `${output}/report.json`,
    JSON.stringify(
      { checkedAt: new Date().toISOString(), report, failures },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      { routes: routes.length, internalLinks: links.length, failures },
      null,
      2,
    ),
  );
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
}
