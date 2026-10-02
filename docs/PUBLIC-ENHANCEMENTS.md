# Public website enhancement pass — 2026-10-02

## Audit and scope

The existing Next.js public layout, typography, colors, responsive navigation,
article repository and authenticated product are reused. No publishing backend,
authentication flow, schema, database or provider configuration changes are needed
for this pass.

| Capability | Evidence and public presentation |
| --- | --- |
| Facebook / Instagram | Actual Meta publishing and eligible Buffer channel publishing; shown as destinations |
| Meta Direct / Buffer | Publishing connections, never extra social networks |
| First Comment / Meta | `src/lib/meta/publish.ts` and `src/lib/publishing/service.ts`: separate post-success comment request, independently persisted status and comment-only retries |
| First Comment / Buffer | `src/lib/buffer/client.ts` and publishing service: optional channel metadata, provider-dependent acceptance and recorded skip fallback |
| Research / trends | Configured Brave-backed research; no claim of a direct Google Trends integration |
| Competitor discovery | Eligible Meta Instagram Business Discovery and configured web research |
| Images / carousels / reels | Configured image generation, ordered carousel media, reel planning and video upload; no AI video generation claim |
| Context / agent / automation | Brand Brain, scoped user/workspace memory, tools, multi-provider configuration and configured Auto Run |
| Analytics | Actual available provider metrics; no illustrative numbers represented as live analytics |

## Implemented

1. Preserve the hero composition and add flowing signals and contextual stages.
2. Add platform/connection architecture, official Facebook and Instagram assets,
   original Buffer identity, and descriptive Meta Direct text.
3. Add a controllable, clearly illustrative eight-step publishing product sequence.
4. Explain First Comment, provider eligibility and separate failure behavior.
5. Present verified capabilities through six connected visual stories.
6. Publish five complete educational guides with distinct covers, metadata,
   dates, reading times, Article/Breadcrumb schemas and relevant related links.
7. Automatically include all seven articles in the index, sitemap and RSS, and
   show three recent guides on the homepage.

## Motion and performance

CSS transform/opacity and SVG signals avoid heavy animation libraries. One
public observer controls section reveal and off-screen CSS animation pausing.
The publishing sequence runs only while visible, pauses in a hidden document,
and supports pause/manual selection. Reduced motion shows a settled sequence
and disables animated effects. Semantic server-rendered copy stays crawlable
and visible without JavaScript. Article imagery uses Next Image; integration
assets are small local PNGs. No additional remote tracking or provider calls.

## Brand and editorial constraints

Official assets and provenance are documented in `public/integrations/SOURCES.md`.
Meta company-logo use requires approval under its current guidelines, so the
site identifies Meta Direct in text. Third-party ownership and non-endorsement
are stated. Official marks retain their colors and proportions.

Qurtiz currently advertises no paid software plan, but providers and deployment
can cost money. The repository has no license file: the guides explain public
source availability without promising unrestricted open-source reuse. Publishing
still requires eligible accounts and permissions. Auto Run follows configuration.

## Reproduce validation

Run `npm run typecheck`, `npm run lint`, `npm test -- --maxWorkers=2`, and
`npm run build`. For a read-only public production preview set
`DISABLE_BACKGROUND_WORKER=true`, start the server, and run
`scripts/verify-public-website.mjs` with the documented Playwright runtime path.
The script verifies desktop/mobile routes, metadata, Article/Breadcrumb schema,
internal links and anchors, responsive overflow, reduced motion, illustration
controls, sitemap/RSS and unauthenticated application gates. Reports/screenshots
are local and ignored in `.public-qa`. Live account/provider operations need
configured accounts and were not invoked by this public-site enhancement.

Regenerate covers with `node scripts/generate-qurtiz-article-covers.mjs`.

## Validation results

- Production build and final TypeScript check passed.
- ESLint: no errors; five existing warnings in generated/check and companion files.
- Regression suite: 884 passed, one existing skipped test, 77 passed test files.
- Production Chrome browser pass: 20 public routes, 23 internal destinations,
  all internal section anchors and Article/Breadcrumb schemas, zero failures.
- Desktop/mobile screenshots reviewed; viewport overflow checked at
  320, 390, 768, 1024 and 1440 pixels.
- Demo progression advances while visible and stays at the same stage while
  off-screen. Reduced motion settles at the final stage with no autoplay.
- Login/signup forms and protected application redirects verified.
- Homepage first-load JS: 118 kB in the Next production report. Local lab
  layout shift was zero. LCP varied with test workload (3.76 seconds during
  the broad run; isolated fresh load 1.15 seconds, warm navigation 0.21 seconds).
  These local diagnostics are not production field Core Web Vitals.
- Code-only Graphify index refreshed. No live social post was published.

An initial browser check exposed that floating the interactive product preview
kept its tabs moving. Its container animation was removed, then the production
build and interaction checks passed. Decorative workflow motion remains.
