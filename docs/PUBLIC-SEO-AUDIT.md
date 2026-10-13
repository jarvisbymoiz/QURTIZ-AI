# Public SEO/AEO audit — 2 October 2026

Scope: the approved route inventory, 13 public website pages and 7 published articles. No Search Console indexing requests or deployments were performed in this pass.

## Verification

- Optimized Next.js production build: PASS (52 generated routes/resources).
- TypeScript: PASS.
- Vitest: 901 passed, 1 skipped; 80 test files passed, 1 skipped. An initial concurrent-build test timeout passed on targeted rerun and full rerun with two workers.
- Companion tests: 20 passed.
- Prerendered HTML audit: 20/20 pages passed unique title/description, canonical, Open Graph, one H1, H2 content, parseable schema, internal paths and anchor targets.
- Local production HTTP verification: all 20 public pages, sitemap, robots and RSS returned direct HTTP 200 with expected content types. API/auth responses carried explicit noindex headers. Private visitors page redirected anonymous requests to login.
- Sitemap: 20 unique production URLs. RSS: all 7 published articles. Login/signup HTML retains noindex. Application layouts retain noindex.
- Existing AI SDK dynamic-dependency build warnings remain; build succeeds.

## Route report

FIXED means an SEO enhancement was added, then all rendered checks passed. All pages also benefit from the hardened production canonical helper.

| Route | Result | Change |
| --- | --- | --- |
| / | PASS | Existing Organization/WebSite/WebApplication schema and public metadata preserved |
| /features | FIXED | Added WebPage schema |
| /about | FIXED | Added AboutPage schema |
| /contact | FIXED | Added ContactPage schema |
| /open-source | FIXED | Added WebPage schema |
| /security | FIXED | Added WebPage schema |
| /changelog | FIXED | Added WebPage schema |
| /privacy | FIXED | Added WebPage schema |
| /terms | FIXED | Added WebPage schema |
| /acceptable-use | FIXED | Added WebPage schema |
| /data-deletion | FIXED | Added WebPage schema |
| /faq | PASS | Existing visible FAQ answers and FAQPage/Breadcrumb schema preserved |
| /articles | FIXED | Added CollectionPage and article ItemList schema |
| /articles/what-is-qurtiz-ai | FIXED | Expanded article category, tags, language, reading duration and URL metadata/schema |
| /articles/startup-social-media-workflow-qurtiz-ai | FIXED | Same shared article improvements |
| /articles/chatbot-to-ai-agent-qurtiz | FIXED | Same shared article improvements |
| /articles/automate-facebook-instagram-qurtiz-ai | FIXED | Same shared article improvements |
| /articles/brand-brain-research-original-content | FIXED | Same shared article improvements |
| /articles/what-is-an-ai-social-media-agent | FIXED | Same shared article improvements |
| /articles/ai-powered-social-media-workflow | FIXED | Same shared article improvements |

## Future articles

Add complete typed entries to `src/lib/public/qurtiz-articles.ts` or the editorial registry in `articles.ts`. Existing entries default to published; use `status: "draft"` for unpublished work and `status: "published"` when ready. `getArticles()` is the single publication filter used by the index, sitemap, RSS, related content, homepage selection and static route generation. `getArticle()` applies the same filter, so drafts cannot render at a guessed URL.

Supply a unique slug, title, description, SEO title/description, author, category, tags, local hero image, YYYY-MM-DD publication/update dates and complete sections with stable IDs and valid contextual links. The shared article route automatically generates canonical/OG/Twitter metadata, breadcrumbs and Article schema. Rebuild/redeploy after adding or publishing an article: these routes are statically generated.

Repeat `npm test -- --maxWorkers=2`, `npm run build`, `npm run typecheck` and `node scripts/audit-public-seo.mjs .next` (or pass the custom build directory).

## Limits

This report verifies the current code and locally served optimized production build, not a new Vercel deployment or Google indexing state. Search visibility, AEO inclusion and rich results are not guaranteed. Existing legal pages still identify themselves as deployment-specific drafts; operator identity/contact/legal details need real operator input, not invented text.
