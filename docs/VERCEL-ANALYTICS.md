# Vercel website analytics integration

## Initial audit — October 2, 2026

- Source branch: `codex/hobby-deployment`, base commit `32ecc72`.
- Next.js 15.5.24 App Router, React 19.2; one root layout.
- Existing Node instrumentation boots job infrastructure. It is unchanged.
- Official npm latest versions checked: `@vercel/analytics` 2.0.1 and
  `@vercel/speed-insights` 2.0.0. Both installed with compatible Next/React peers.
- `https://qurtiz-ai.vercel.app/` initially redirects to login, indicating this
  alias has not received the new public website build.
- Its Speed Insights script endpoint returns JavaScript (200). Its Web Analytics
  script endpoint is redirected by auth (307). This is endpoint evidence, not
  confirmation of dashboard feature state or collected data.
- No `.vercel/project.json`, Vercel CLI authentication token, or Vercel credential
  in `.env.local` was available. The Vercel connector is not connected in this
  session. Browser/computer automation initialization also fails locally.
- Actual owning account, project ID, team ID, plan, Production deployment and
  feature settings must be inspected through authenticated Vercel access.

## Implementation

One `VercelTelemetry` component is mounted in the root layout on Vercel. It uses
only the official Next.js SDK exports; neither nested layouts nor manual
page-view events duplicate it. Framework navigation remains SDK-managed.

Tracking permits public marketing/article pages and login/signup only, excludes
private application/API/callback paths, and removes all URL query strings and
hashes. A strict-origin referrer policy limits outgoing referrer URLs to origins.
No form values, tokens, user IDs, prompts or workspace content are custom event
properties. There is no third-party counter, fingerprinting script or public
visitor widget added by Qurtiz.

Optional custom events: `get_started_clicked`, `login_clicked`,
`article_cta_clicked` and first form-focus `signup_started`. Properties are only
fixed source/destination categories. Enable the flag only after checking actual
plan eligibility; do not upgrade billing silently. Article opens already have
standard page views and do not need another event.

The auth middleware excludes official Vercel intake prefixes without exempting
private application routes. SDK script and intake requests must be checked again
on the actual Preview/Production build, including any platform resilient-intake
paths used by Vercel.

## Private visitor dashboard

Route: `/settings/visitors`; API: `/api/admin/website-analytics`.
A Settings link appears only for explicitly configured operator user IDs.
Workspace ownership never confers deployment-wide reporting access.
Both the page and endpoint check authentication and operator authorization;
responses are private/no-store. The API is rate limited and uses one-minute
server-side request coalescing/cache. The client refreshes while visible, supports
pause/manual retry, and stops automatic updates after three consecutive failures.

Metrics come from the official fixed endpoint:
`GET https://api.vercel.com/v1/query/web-analytics/visits/aggregate`.
All requests filter for Production. Totals use the single environment aggregate;
unique visitors are never calculated by adding daily visitor counts. Reports
include today, seven-day and 30-day totals, pages, referrers, countries, devices,
browsers and daily traffic. UTC calendar periods include today and are disclosed.
Vercel privacy semantics, reporting window and processing latency apply. This is
an aggregate dashboard, not a count of concurrently online people.

Unavailable sections display errors/dashes. Empty successful API responses can
show zero; rejected requests and invalid numeric data never become zero traffic.
Only explicit whitelisted output fields reach the browser, never credentials or
raw upstream error bodies. Requests have a 12-second timeout and no automatic
upstream retries. No database migration or analytics data duplication is added.

## Credentials and configuration

| Variable | Purpose | Exposure |
| --- | --- | --- |
| `VERCEL_ANALYTICS_TOKEN` | Vercel access token with reporting access to the exact project/team | Server-only secret |
| `QURTIZ_VERCEL_PROJECT_ID` | Exact existing project ID (automatic VERCEL_PROJECT_ID is fallback) | Server-only configuration |
| `QURTIZ_VERCEL_TEAM_ID` | Owning team ID when applicable (automatic VERCEL_TEAM_ID is fallback) | Server-only configuration |
| `QURTIZ_WEBSITE_ANALYTICS_ADMIN_IDS` | Comma-separated verified Qurtiz operator Supabase user UUIDs | Server-only configuration; empty denies all |
| `NEXT_PUBLIC_VERCEL_CUSTOM_EVENTS_ENABLED` | Explicit eligibility switch, defaults false | Public boolean; never a token |

Create a token at https://vercel.com/account/tokens if no usable scoped token is
available. Store it in Vercel project Settings → Environment Variables as
`VERCEL_ANALYTICS_TOKEN` for intended Production/Preview environments, and in
ignored `.env.local` for local authenticated reporting validation. Never paste
it in chat or commit it. A local `VERCEL_TOKEN` may be used by the CLI for project
inspection/deployment, but the app only reads `VERCEL_ANALYTICS_TOKEN`.

Obtain IDs from the authenticated existing project/team; never create a second
project as a workaround. Configure operator UUIDs deliberately. Redeploy after
environment changes. The SDK collection integrations do not require a reporting
access token.

## Deployment and acceptance checklist

1. Authenticate/connect Vercel and inspect the existing Qurtiz project,
   deployed commit, domains, plan, environment and feature states.
2. Enable/verify Web Analytics and Speed Insights in that project. Preserve
   existing backend credentials/scheduler settings. Check available limits.
3. Set reporting/authorization variables server-side; verify API access directly.
4. Deploy Preview, load public routes and interact normally. Check SDKs mount
   once, script/intake requests succeed, private routes are dropped, and
   canonical/SEO/login/signup checks still pass.
5. Deploy Production explicitly to the verified existing project. Repeat actual
   browser collection checks on its Production domain and navigation. Page-view
   intake acceptance alone is not proof of reporting ingestion.
6. Query official Production visit aggregates/counts and/or dashboard to confirm
   recorded visits; inspect Vercel Speed Insights for received real-user metrics
   (LCP, INP, CLS, TTFB and other exposed metrics). Allow platform processing
   latency; do not fabricate INP or claim field improvement from local tests.
7. Sign in as an allowed operator and retrieve real reports in Qurtiz. Verify
   another authenticated user gets 403 without a Vercel request.

Run local validation with `npm run typecheck`, `npm run lint`,
`npm test -- --maxWorkers=2`, `npm run build`. Production browser verification
can extend `scripts/verify-public-website.mjs`. Use read-only local validation
with `DISABLE_BACKGROUND_WORKER=true`; do not disable real production jobs.
The initial npm 11 optional-Svelte peer resolution conflicted with the existing
Vite test tooling; a targeted legacy-peer install installed only the two official
packages. Normal `npm ci --dry-run --ignore-scripts` subsequently passed; no
project-wide legacy-peer setting or extra framework dependencies were added.

## Official references

- https://vercel.com/docs/analytics/quickstart
- https://vercel.com/docs/speed-insights/quickstart
- https://vercel.com/docs/analytics/web-analytics-api
- https://openapi.vercel.sh
- https://vercel.com/docs/analytics/limits-and-pricing
- https://vercel.com/docs/speed-insights/package

## Current verification status

Implementation is prepared. Account feature state, actual IDs, Preview/Production
deployment, real collected visits, field vitals and authenticated operator
reports remain unverified until Vercel access is supplied. No Vercel deployment
or remote environment change has been performed during the unauthenticated pass.

## Local validation results

- Final production build passed with the Vercel code path enabled.
- TypeScript passed. ESLint has zero errors and five pre-existing warnings;
  targeted final script/dashboard lint also passed.
- Full suite: 896 passed, one existing skipped test, 80 passed test files.
- Public browser regression: 20 routes, 23 internal destinations, zero failures;
  desktop/mobile, schema, links, auth forms/gates and reduced motion retained.
- Runtime SDK mounting: exactly one Analytics and one Speed Insights script
  on home, features, article, login and signup.
- Both actual registered SDK beforeSend hooks strip public query/hash probes
  and return null for private paths; strict-origin metadata is present.
- No actual provider token was added, no project/team ID invented, no account
  setting enabled, no Preview/Production deployed, no collected traffic or field
  vitals claimed verified. Those acceptance checks are BLOCKED by authentication.

Run `scripts/verify-vercel-tracking.mjs` against the authenticated verified
Preview/Production origin via `QURTIZ_ANALYTICS_VERIFY_ORIGIN`. It records SDK
mounting, real intake responses and the query privacy probe. With reporting
credentials it checks actual Production aggregate counts separately. It refuses
localhost and marks missing collection/reporting evidence as failures. Its local
report is ignored. Final Speed Insights field-data inspection still requires
authenticated account/API access.

## Exact changed files

```text
.env.example
.vercelignore
docs/VERCEL-ANALYTICS.md
package-lock.json
package.json
scripts/verify-vercel-tracking.mjs
src/app/(app)/settings/page.tsx
src/app/(app)/settings/visitors/page.tsx
src/app/api/admin/website-analytics/route.ts
src/app/layout.tsx
src/components/analytics/vercel-telemetry.tsx
src/components/analytics/website-traffic-dashboard.tsx
src/lib/public/pages.ts
src/lib/website-analytics/__tests__/route.test.ts
src/lib/website-analytics/__tests__/server.test.ts
src/lib/website-analytics/__tests__/tracking.test.ts
src/lib/website-analytics/access.ts
src/lib/website-analytics/server.ts
src/lib/website-analytics/tracking.ts
src/lib/website-analytics/types.ts
src/middleware.ts
```

## Connected account inspection — October 2, 2026

The connected Vercel app confirmed project `qurtizai` (`prj_iFnOjahHlYlTiu2qMc2lhMNEkhTI`) in MoizCreator (`team_heTRiSuvwSU04QWElS18Ngrr`), linked to `jarvisbymoiz/QURTIZ-AI`. Production alias: `https://qurtiz-ai.vercel.app`, currently commit `b014641`. The public-site commit `32ecc72` has a Ready Preview. Local ignored project binding and non-secret reporting IDs now match this existing project.

Team/project listing and deployment inspection work. Project-details tool has a schema mismatch (`projectId` versus backend `idOrName`); advertised deploy action returns Tool not found. Neither feature enablement nor received traffic can be inferred from these reads. A MoizCreator-scoped Vercel access token is required for CLI/API operations and official reporting. Add `VERCEL_TOKEN` to ignored `.env.local`; configure server-only `VERCEL_ANALYTICS_TOKEN` for deployed reporting and explicit operator UUIDs in `QURTIZ_WEBSITE_ANALYTICS_ADMIN_IDS`. Never expose tokens through NEXT_PUBLIC variables.

Production endpoint inspection: `/_vercel/speed-insights/script.js` returned HTTP 200 JavaScript; `/_vercel/insights/script.js` returned HTTP 200 HTML. This does not establish feature settings or received metrics. The pending middleware exclusion protects both official tracking paths from application authentication routing. Deployment and authenticated receipt verification remain required.

## Authenticated deployment verification — October 2, 2026

The user supplied VERCEL_TOKEN through ignored .env.local. Authenticated REST reads returned HTTP 200 and confirmed project/team IDs. The owning team is Hobby; custom events remain disabled. Added sensitive server-only VERCEL_ANALYTICS_TOKEN and non-secret QURTIZ_VERCEL_PROJECT_ID/QURTIZ_VERCEL_TEAM_ID to Preview and Production. Existing VERCEL_TOKEN is scoped to Development. No credentials are recorded here.

Preview dpl_FLQZHFP1oaTvJEx5aAFpYZUxiTJc and Production dpl_31eVnAosyghp1841g2rBtNLLLFnT built successfully. Production alias https://qurtiz-ai.vercel.app is live. Exactly one official Analytics 2.0.1 and Speed Insights 2.0.0 script mounts on each tested public route. Vercel assigns hashed resilient-intake endpoints; verification reads their actual SDK attributes. Six Production page-view requests returned HTTP 200 with no query privacy probe leakage. These are deliberate verification visits, not customer acquisition claims. Headless browsers are ignored by the official SDK; collection checks used an isolated regular Chrome profile.

Speed Insights project state changed from hasData:false to hasData:true with dataReceivedAt. Official Production metrics queries returned LCP, INP, CLS, TTFB and FCP samples for homepage/features. Initial homepage samples: LCP 2.27s, INP 48ms, CLS 0, TTFB 350ms, FCP 2.05s. Sparse QA samples cannot establish representative Core Web Vitals performance.

Real visitor reporting remains blocked: visits/count and all nine visits/aggregate queries (Today, seven days, thirty days, pages, referrers, countries, devices, browsers, daily trend) return HTTP 400 web_analytics_not_enabled. Both teamId and slug forms were tested. Project webAnalytics contains an ID, but the reporting API denies enablement; accepted intake alone does not prove report availability. Request IDs and sanitized results are in ignored .public-qa/production-reporting-check.json. No fake zeros or substituted traffic data are used.

The admin UUID in the user message is still the literal placeholder <PASTE UUID HERE>. The operator allowlist remains empty/fail-closed, pending a real explicitly designated UUID. No tenant owner is automatically authorized. Production unauthenticated page/API requests redirect to login. Live public regression: twenty routes, twenty-three internal links, zero failures. Eight deployed homepage scripts and local static client output were scanned for the actual token: zero matches.

Deployment packaging additionally excludes local .next* builds, .public-qa browser profiles/reports, scaffold and artifacts through .vercelignore. Initial oversized upload was stopped before retrying with the safe exclusions. Latest reporting-error handling has thirteen targeted analytics tests passing.

The follow-up reporting-error Preview is dpl_6Kg6o62hqKnKuJB3z2GM8ZcG2G39 (Ready). The final Production rebuild is dpl_5MCK1zidJRkejvWYD2QpfjfBsZBM, verified READY and aliased to https://qurtiz-ai.vercel.app (HTTP 200). Latest TypeScript and targeted ESLint checks passed. Connected Vercel runtime-error inspection found no errors for affected public/reporting routes in the last hour. The official visitor API also rejects project-name queries, ruling out a project-ID formatting mismatch.

Final official Production LCP count query returned five route groups: homepage four samples; features two; article route two; login two; signup two. Core-vital values and ingestion are real provider results, including QA traffic. Final visits/count still returns HTTP 400 web_analytics_not_enabled after successful Production deployment. Completion remains blocked on the actual operator UUID and provider-side Web Analytics reporting enablement/state.
