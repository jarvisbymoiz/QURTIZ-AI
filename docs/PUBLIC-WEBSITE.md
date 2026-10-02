# Public website audit and completion roadmap

Audit date: 2 October 2026. Scope: public website, branding, articles and discovery; preserve the authenticated product.

## Existing project audit

| Area | Status | Source evidence |
| --- | --- | --- |
| Authentication | Implemented; live account regression requires credentials | Supabase SSR middleware, password server action, magic links, signup and callback |
| Dashboard | Implemented, currently occupies `/` | `(app)/page.tsx`, workspace guard in `(app)/layout.tsx` |
| Brand, content, agent, research | Implemented services; provider E2E not certified by this audit | `lib/ai`, `lib/research/service.ts`, `lib/content`, server actions |
| Publishing and scheduling | Implemented; preserve | `lib/publishing/service.ts`, Meta and Buffer clients, jobs and cron routes |
| Public homepage and product pages | Missing | Root resolves to authenticated dashboard |
| Articles, RSS and public sitemap | Missing | No public content routes |
| Brand symbol | Letter placeholder | Auth layout and sidebar use Q |
| Public/private SEO | Partial | Root metadata exists; no route-specific discovery foundation |
| Contact and license | Missing configuration | Git remote verified; no contact email or LICENSE file |

The public launch blocker is the root route collision: dashboard, login defaults,
workspace redirects and dashboard revalidation all assume `/`. Moving just the
page would disconnect those flows. Move them together to `/dashboard` and keep
the existing authenticated layout and service handlers.

## Completion roadmap and priority fixes

1. Separate public routing from private dashboard; verify redirects and auth gates.
2. Centralize an abstract SVG mark and shared public navigation/footer.
3. Build responsive server-rendered homepage, product explanations and trust pages.
4. Add typed content repository, two editorial guides, TOC, related articles and RSS.
5. Add canonical metadata, social images, schemas, sitemap, robots and app icons.
6. Integrate branding with existing auth presentation; run typecheck, lint, tests,
   build, HTTP checks and desktop/mobile browser review.

## Deployment and editorial operations

Set `NEXT_PUBLIC_APP_URL` to the production origin before building; canonical URLs,
RSS and sitemap use it. Public rendering requires no database or provider access.
Existing authenticated environment requirements are unchanged.

Articles live in `src/lib/public/articles.ts`, behind a typed repository boundary.
Add a unique slug, title, description, dates, author, category, tags, featured flag,
image and section content. Reading time, detail routes, metadata, related links,
sitemap and RSS derive from that repository. Dates must be actual editorial dates.
No fake releases or customer claims are permitted.

Policy pages are deployment-specific drafts. Before a public production launch,
the operator must supply its legal identity, contact channel, retention periods,
jurisdiction and processor arrangements, and review the drafts. Repository issues
are for non-sensitive reports; never ask users to post credentials or private data.
The project owner must select and add an open-source license before promising
specific reuse rights. No license is invented by this change.

Rollback: restore the dashboard root file and routing references together. No
database migration, provider API change or new runtime dependency is needed.

## Verification and handoff

Verified on 2 October 2026:

| Check | Result |
| --- | --- |
| Production build | Passed; existing AI SDK dynamic-dependency warnings remain |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with five pre-existing unused-variable warnings |
| Full Vitest suite | 883 passed, one skipped; 77 files passed, one skipped |
| Final agent/routing regression checks | 14 passed after dashboard cache-path update |
| Public browser routes | All 15 pages returned 200; one H1 each, unique titles/descriptions/canonicals, indexable metadata, parsed JSON-LD |
| Internal link targets | 18 checked without broken responses |
| Discovery and assets | Sitemap, robots, RSS, llms.txt, manifest, social image and icons returned 200 |
| Protected routes | Logged-out dashboard, chat, settings, Studio, connections and calendar redirect to login |
| Auth presentation | Login/signup email forms and home links render; handlers retained |
| Responsive layout | All public pages checked at 390px and 1440px; homepage, features and article also checked at 320px, 768px, 1024px and 1280px without horizontal overflow |
| Interactions | Mobile menu closes after navigation; tabs work with click and arrow keys; FAQ opens; reduced-motion disables diagram animation |
| Article sharing | Clipboard fallback tested; native share chooser requires manual interactive validation |
| Runtime errors | No browser page errors in the main route pass |

The first full suite run timed out in one research test while the production build
was running. That test passed in isolation and the full suite passed on rerun with
bounded workers. The browser's initial image check was corrected to distinguish
not-yet-loaded lazy images from failed images; the images were inspected in the
rendered screenshots. The mobile-menu persistence issue found by browser QA was
fixed and the complete route pass was rerun against the final production build.

These are website and routing checks, not certification of the whole product.
Live account creation, password/magic-link sign-in, external-provider publishing,
and tenant database operations were not exercised with customer accounts in this
pass. Existing provider and workspace regression tests passed. No database
migration was applied. Billing, entitlements and subscriptions retain their
existing implementation; the public site introduces no paid plan or billing
integration.

Local screenshots and reports are in ignored `.public-qa/`. To repeat the browser
pass, start the production server and run `node scripts/verify-public-website.mjs`.
Supply `QURTIZ_PLAYWRIGHT_MODULE` with the Playwright module path from Codex's
bundled workspace runtime if it is not installed locally. Optional
`QURTIZ_QA_BROWSER` and `QURTIZ_QA_ORIGIN` select a browser executable and test URL.
`node scripts/generate-brand-assets.mjs` regenerates icons and editorial artwork
from the shared geometry in `src/lib/public/brand.json`.

The typecheck scope includes source, root TypeScript configuration and current
`.next` route types; stale `.next-*` audit directories no longer inject obsolete
route validators into the check. The local code-only Graphify index was refreshed
after the structural changes.

Before deployment: set the canonical origin, select/publish a source license,
complete policy/operator/contact details, and verify real sign-in and provider
flows on the intended HTTPS deployment. Follow the existing application deployment
setup; standalone output needs the generated static assets and `public` directory
available to its server. The icon/manifest addition does not promise offline use.

Reference conventions: [Next.js metadata and social images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)
and [Google's structured-data introduction](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data).
Structured data and large-image metadata support discovery; they do not guarantee
rankings, rich results or Discover inclusion.


## Focused premium enhancement — October 2, 2026

The homepage now adds restrained motion, a supported-platform ecosystem, a
controllable publishing/First Comment illustration, six verified capability
stories and three recent editorial cards. Five new complete guides bring the
article repository to seven entries, with unique covers and relevance-ranked
related content. Feature and FAQ pages explain First Comment and Auto Run.
Details, evidence and repeatable verification are in
[PUBLIC-ENHANCEMENTS.md](PUBLIC-ENHANCEMENTS.md). This pass leaves authenticated
application and backend workflows unchanged.
