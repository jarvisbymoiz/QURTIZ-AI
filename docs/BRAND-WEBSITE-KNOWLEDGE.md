# Brand website knowledge

## User flow

Save a public website in Brand Brain → Business. Saving attempts a bounded website
read, without replacing any business description, prices, audience, voice, memory,
visual identity or user instructions. The Website knowledge card displays the actual
read status, source pages, last successful read, source text and any reading failures.
Use **Read / refresh website** to refresh the saved source explicitly. Workspace
editors/admins with `brand:write` can refresh; viewers can read the cached source data.
The action accepts no client-selected workspace ID or arbitrary URL.

Existing workspaces do not need to re-save: relevant Agent/content/Auto Run requests
read their saved website automatically when its cache is missing or older than
24 hours. Brand Brain page rendering itself never crawls a website.

## Shared AI context

`getBrandWebsiteContext` is the one retrieval path used by:

- AI Chat's existing `get_brand_brain` tool, including source URLs and reading status.
- The shared `generateAndPersistContent` pipeline used by Studio, AI Chat, bulk
  creation and Auto Run, before the model request.
- Auto Run topic/strategy planning.
- Brand-aware research opportunity generation.

Website text is clearly delimited as external reference data, never instructions or
permission. User-entered Brand Brain/current instructions take priority. The context
selects relevant paragraphs within a bounded budget and names only pages actually
read. Stale cached text is marked stale; text over seven days old is excluded from
factual claims. No price, product, customer statistic or offer is invented by the
reader. AI inference remains inference, not a guaranteed fact extraction service.
There is no new provider/model dependency or hard-coded model name. The website
reader needs no Brave key or LLM call; the existing configured model analyzes the
retrieved text when planning content or answering.

## Reading limits and security

- Public HTTPS only; saved HTTP URLs are upgraded to HTTPS, never downgraded.
- Username/password URLs, internal/private/loopback/metadata addresses, unsupported
  ports and obvious authentication/application/API paths are rejected.
- Uses the existing private-address/DNS-rebinding guarded socket connector. Every
  redirect is manual and validated; a public hostname changing to a private IP is
  rejected at connection time. Cookies/authorization headers are never forwarded.
- Query strings/fragments are removed. No credential or session parameter is sent.
- Reads robots.txt per origin. Forbidden pages are skipped. Unavailable/challenged
  robots fail closed; 404/410 permits reading. Crawl-delay sites get only the initial
  page rather than extra requests that ignore their requested delay.
- Home plus up to three linked product/service/about/pricing/contact pages. Internal
  candidates use the home page's canonical origin; child redirects cannot leave it.
  No unrestricted recursive crawl, external-link traversal or guessed URL grids.
- 20-second overall network deadline, per-request deadlines, three redirect hops,
  512 KiB decompressed/page, 64 KiB robots, four pages and 6,000 text characters/page.
- HTML parser removes scripts/styles/forms/hidden/navigation/footer text. Nothing is
  executed; images/files are not downloaded. JavaScript-only or challenged pages
  fail honestly rather than yielding fake extracted knowledge.

## Persistence and recovery

Uses the existing workspace-scoped `settings` row with key
`brand_website_knowledge`; no schema migration or new environment variable is needed.
`sourceUrl` guards against stale source reuse after editing/removing the website.
Versioned validated snapshots store status, bounded source pages, timestamps and
safe warning codes. A transactionally claimed 60-second lease deduplicates readers
across Vercel instances/cold starts. Completion checks both the lease and current
Brand Brain URL; an old read cannot overwrite a newer website.

24-hour cache; at least five minutes between read attempts, including manual
refresh, plus the normal action rate limit. Failed automatic reads back off for an
hour, preserving previously read text with its original timestamp. Expired leases
render as failed and can be recovered on a subsequent eligible read. There are no
client timers, in-memory background jobs or permanent loading states.

Website failures are supplementary: core content generation continues from manual
Brand Brain with an honest unavailable/stale note. Saving business details is not
rolled back just because the external site is blocked. Website knowledge is private
inside the workspace and cascades with its existing settings on workspace deletion.
Server diagnostics include status, page count and safe reason codes, not source
bodies, URLs, credentials or private workspace data.

## Verification (13 October 2026)

- Real local authenticated **Read / refresh website** action returned HTTP 200;
  UI showed **4 public pages read** from the workspace's saved Moiz Creator site.
- Real website reader → existing Supabase settings → cached context test passed.
  Read sources: homepage, services index, document-formatting and PDF-to-Word pages.
  Read-only SQL verified persisted ready status, source URLs and nonempty text.
- Real AI Chat using the configured OpenRouter text model completed two steps,
  including **Reading Brand Brain**, and streamed website-based service details
  with links. Document-formatting page limits/revision terms were checked against
  the actual stored public page text. No content creation or publishing was triggered.
- Mobile 390px and desktop 1440px checked: page width equaled viewport width,
  controls/source cards wrapped correctly; screenshot evidence is in ignored
  `.public-qa/brand-website-knowledge.png` and `website-knowledge-chat.png`.
- Hermetic tests cover private URLs/redirects, robots, crawl-delay, oversized bodies,
  source extraction, cache/leases, changed URLs, isolation, failures, permissions,
  cancellation, content-model payload and Auto Run strategy consumption.
- Full offline suite: **1,069 passed / one skipped**, across 99 passing test files.
  TypeScript, focused ESLint and production build passed (52 static pages).
  Production dependency audit: zero advisories.
  Existing development-only advisories are unchanged; no forced tooling downgrade.
- Compiled production build served locally: authenticated refresh completed with
  **ready / four pages / no warnings**, button returned to enabled state, and the
  updated UTC last-read timestamp rendered correctly. Background workers stayed
  disabled. This is a production-build smoke test, not a Vercel deployment claim.

Vercel rollout has not been performed for these local changes. Existing Production
posts, Auto Run configuration and publishing schedules were not changed. The live
reader saved only the supplementary website knowledge to the shared database.
