// Verify real Vercel collection. Never substitute mocked requests for this check.
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.QURTIZ_PLAYWRIGHT_MODULE || "playwright",
);
const origin = process.env.QURTIZ_ANALYTICS_VERIFY_ORIGIN;
if (
  !origin ||
  new URL(origin).protocol !== "https:" ||
  /^(localhost|127\.)/.test(new URL(origin).hostname)
)
  throw new Error(
    "Set QURTIZ_ANALYTICS_VERIFY_ORIGIN to the verified Preview or Production HTTPS domain.",
  );
const receipts = [],
  failures = [];
let reporting = { status: "unconfigured" };
async function count() {
  const token = process.env.VERCEL_ANALYTICS_TOKEN;
  const projectId = process.env.QURTIZ_VERCEL_PROJECT_ID;
  if (!token || !projectId) return null;
  const url = new URL(
    "https://api.vercel.com/v1/query/web-analytics/visits/count",
  );
  url.searchParams.set("projectId", projectId);
  if (process.env.QURTIZ_VERCEL_TEAM_ID)
    url.searchParams.set("teamId", process.env.QURTIZ_VERCEL_TEAM_ID);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) return { status: response.status };
  const body = await response.json();
  return {
    status: response.status,
    pageviews: body.data?.pageviews,
    visitors: body.data?.visitors,
  };
}
const before = await count();
const browser = process.env.QURTIZ_QA_CDP
  ? await chromium.connectOverCDP(process.env.QURTIZ_QA_CDP)
  : await chromium.launch({
  executablePath:
    process.env.QURTIZ_QA_BROWSER ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
try {
  const context = process.env.QURTIZ_QA_CDP ? browser.contexts()[0] : await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  if (process.env.QURTIZ_QA_ACCESS_FILE) {
    const access = JSON.parse(await readFile(process.env.QURTIZ_QA_ACCESS_FILE, "utf8"));
    await page.goto(access.url, { waitUntil: "networkidle" });
  }
  page.on("response", (response) => {
    const request = response.request(),
      url = new URL(request.url());
    if (url.origin !== new URL(origin).origin) return;
    if (/insights/.test(url.pathname) || request.method() === "POST") {
      const probeLeaked = (request.postData() || "").includes(
        "qurtiz-privacy-probe",
      );
      receipts.push({
        path: url.pathname,
        method: request.method(),
        status: response.status(),
        probeLeaked,
      });
    }
  });
  const scripts = [];
  for (const path of [
    "/?probe=qurtiz-privacy-probe",
    "/features",
    "/articles/what-is-qurtiz-ai",
    "/login",
    "/signup",
  ]) {
    await page.goto(new URL(path, origin).toString(), {
      waitUntil: "networkidle",
    });
    if (path === "/signup") await page.locator("input[type=email]").focus();
    scripts.push({
      path: path.split("?")[0],
      scripts: await page
        .locator('script[data-sdkn*="@vercel/"]')
        .evaluateAll((nodes) =>
          nodes.map((node) => ({
            src: new URL(node.src).pathname,
            attributes: { ...node.dataset },
          })),
        ),
    });
    await page.waitForTimeout(1000);
  }
  await page.goto(new URL("/", origin).toString(), {
    waitUntil: "networkidle",
  });
  const pause = page.getByRole("button", {
    name: "Pause publishing illustration",
  });
  if (await pause.count()) await pause.click();
  const other = await context.newPage();
  await other.bringToFront();
  await page.waitForTimeout(1500);
  await page.goto("about:blank");
  await page.waitForTimeout(1500);
  for (const route of scripts) {
    if (route.scripts.filter((s) => s.attributes.sdkn?.startsWith("@vercel/speed-insights")).length !== 1)
      failures.push(`Speed Insights script missing/duplicated: ${route.path}`);
    if (route.scripts.filter((s) => s.attributes.sdkn?.startsWith("@vercel/analytics")).length !== 1)
      failures.push(`Web Analytics script missing/duplicated: ${route.path}`);
  }
  const sdkEndpoints = (sdk, attribute) => scripts.flatMap((route) =>
    route.scripts.filter((s) => s.attributes.sdkn?.startsWith(sdk))
      .map((s) => s.attributes[attribute]).filter(Boolean)
      .map((endpoint) => new URL(endpoint, origin).pathname));
  const views = sdkEndpoints("@vercel/analytics", "viewEndpoint");
  const vitals = sdkEndpoints("@vercel/speed-insights", "endpoint");
  if (
    !receipts.some(
      (r) =>
        r.method === "POST" && (views.includes(r.path) || /\/insights\/view$/.test(r.path)) && r.status < 300,
    )
  )
    failures.push("No accepted Web Analytics intake observed.");
  if (
    !receipts.some(
      (r) =>
        r.method === "POST" && (vitals.includes(r.path) || /speed-insights/.test(r.path)) && r.status < 300,
    )
  )
    failures.push("No accepted Speed Insights intake observed.");
  if (receipts.some((r) => r.probeLeaked))
    failures.push("URL query privacy probe leaked into analytics.");
  const after = await count();
  if (after) reporting = { status: "queried", before, after };
  if (
    !after ||
    after.status !== 200 ||
    !(after.pageviews > 0) ||
    !(after.visitors > 0)
  )
    failures.push(
      "Production reporting data is not verified (credential, permission, empty data or processing latency).",
    );
  await mkdir(".public-qa", { recursive: true });
  const report = {
    origin,
    checkedAt: new Date().toISOString(),
    receipts,
    scripts,
    reporting,
    failures,
    note: "Intake acceptance is separate from report ingestion. Field-vital dashboard/API data still requires authenticated Vercel inspection. Preview collection does not establish Production collection.",
  };
  await writeFile(
    ".public-qa/vercel-tracking-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
}
