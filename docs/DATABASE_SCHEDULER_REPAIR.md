# Database and scheduled publishing repair — 22 September 2026

## pg-boss connection recovery (25 September 2026)

Node instrumentation now launches pg-boss without blocking Next.js startup.
The Node process keeps one global worker across Turbopack reloads; Edge
instrumentation does not load it. If initialization fails, the partial worker
is stopped and startup retries with capped 5–60 second backoff. Vercel request
lambdas still use the configured cron endpoints rather than a persistent
worker.

pg-boss reads `DATABASE_URL`, uses SSL for the remote Supabase pooler, and has
a 30-second connection timeout. A direct `pg` query using the same URL and SSL
connected in 9 seconds during diagnosis, while a direct pg-boss startup took
16 seconds. Both exceed or approach pg-boss's previous 10-second default.
If TCP succeeds but direct `pg` later times out too, inspect session-pooler
availability and competing dev servers before changing the URL. Parallel
`next dev` instances must use separate `NEXT_DIST_DIR` directories to avoid
Turbopack build-file collisions.

## Existing project audit

The connected database is Supabase project `lmbnkzldrmflyssuavau`, reached through
the Tokyo session pooler. The public JavaScript served by
`https://qurtiz-ai.vercel.app/login` references the same Supabase project. This
confirms the public auth/storage configuration, **not** the private Vercel
`DATABASE_URL`. Vercel is signed out in the available browser; there is no local
Vercel project link or deployment token. Production environment variables and
active cron invocations remain unverified.

| Area | Finding before repair | Current result |
| --- | --- | --- |
| Migration history | Stopped at 0016; later one-off scripts bypassed the ledger | Reconciled through 0030 |
| Studio/calendar media | 0026 tables and visual/brand asset lifecycle columns missing | Applied; existing assets default to permanent |
| Research | 0027 usage table missing | Applied, server-only with RLS |
| Notifications | 0028 `meta` missing | Applied with `{}` default for old records |
| Access controls | 0018 storage policies/server grants absent | Applied; all 32 application tables have RLS and deny direct browser access |
| New-table protection | 0026 lacked RLS/revokes | New 0029 adds protection |
| Storage helper | Default privileges retained explicit anonymous EXECUTE | New 0030 revokes it and pins search path |
| Scheduled jobs | Persisted correctly; two overdue pending jobs, one old processing job | Worker fixes implemented; production trigger activation pending |
| Publisher | Shared Meta-first/Buffer pipeline and media support already exist | Reused; no replacement publisher |
| First Comment | Existing separate result/status lifecycle | Implementation unchanged; regression tests pass |

## Migrations and preservation

The repair first ran inside a transaction and rolled back successfully. It then
committed 0017–0029 in one transaction, with lock/statement timeouts and an
advisory migration lock. 0030 subsequently ran through the normal Drizzle
migrator. No user tables were dropped, no workspace was recreated, and row
counts for every pre-existing application table were preserved.

* 0017 already existed physically: verified its nullable text column and index,
  then recorded it without recreating either.
* 0018 was missing: applied server grants, storage membership function and policies.
* 0019–0025 had unrecorded/partial manual application: replayed their idempotent
  statements and recorded their real source hashes. Immutable identity releases
  and existing memories remain preserved.
* 0026–0028 were missing: applied the actual repository SQL.
* 0026's journal timestamp preceded 0025. Corrected its timestamp so a database
  last migrated at 0025 cannot silently skip 0026.
* 0029 and 0030 are additive security migrations introduced by this repair.
* Historical ledger entries 0000–0013 contain legacy **32-character** hashes,
  not Drizzle SHA-256 hashes. These historical records were preserved, not
  rewritten to pretend they were original Drizzle executions. Their resulting
  schema is checked structurally. 0014–0030 have current source hashes.

`src/db/schema.ts` supplies Drizzle's inferred TypeScript types; there is no
separate generated Supabase type file to regenerate. The live integration test
selects every column from all 32 actual Drizzle table definitions. Catalog
validation additionally checks types, nullability, defaults, primary keys,
foreign keys, expected indexes, enums, RLS/grants, storage policies, helper
permissions/search paths and the identity immutability trigger.

Normal deployments:

```sh
npm run db:audit
npm run db:migrate
npm run db:validate
npx drizzle-kit check
```

The migration CLI now loads `.env.local`; an already-set deployment
`DATABASE_URL` retains precedence. Do not run the old `supabase-schema.sql`
bootstrap or isolated `*-db.mjs --apply` scripts on an existing deployment.
Those scripts bypass history. For a database with the *same verified legacy
state*, `npm run db:reconcile` performs a rollback-only rehearsal and
`npm run db:reconcile -- --apply` commits it. Unexpected partial DDL fails the
transaction; investigate rather than reset or force-push the schema.

## Scheduler root causes and fixes

Persistent Node deployments register pg-boss schedules at boot. Database queue
rows alone do not run workers while the host is stopped. Vercel correctly skips
those persistent polling loops, but the repository had no `vercel.json` cron
registration, and `.env.local` has no `CRON_SECRET`. The existing HTTP handler
also mixed publishing, Auto Run and cleanup within a 60-second execution limit,
although a single Reel upload permits 120 seconds.

The repaired Vercel configuration invokes `/api/cron/publish` each minute. It
processes at most five due jobs concurrently, oldest first, through the existing
`publishNow` service. Pending jobs remain in Postgres across process restarts.
The endpoint has an 800-second budget; this requires an appropriate Vercel
Pro/Enterprise runtime configuration. It is not an exact-second scheduler;
normal dispatch latency is up to a cron interval, plus provider processing or
backlog. A persistent worker remains the alternative for heavier workloads.

`/api/cron/maintenance` runs every five minutes for Buffer delivery polling,
pending delivery notification updates, Auto Run scanning and media cleanup.
It no longer delays the publishing request. Both routes bypass browser session
middleware and independently require the configured bearer secret.

The worker now locks the same content item as Publish Now, reschedule and
unschedule before atomically claiming a pending, due job with no external ID.
This closes the race where a stale manual/reschedule read could replace a job
as a worker started it. The due-time predicate is checked again during claim.
Notification consolidation also locks the item, and stale recovery only emits
a notification when its conditional state transition actually wins.

Explicit rate-limit and Meta transient rejections retry at 5 then 10 minutes,
with at most three worker attempts. Meta success payloads, media flows, routing,
Buffer OAuth/GraphQL and First Comment requests are unchanged. Network timeouts
after a mutation are ambiguous: they remain reconciliation-required failures,
not automatically replayed posts. A lost processing claim without a provider ID
becomes a visible failure after 30 minutes, longer than the cron budget. A known
provider ID prevents resending the main post. Buffer acceptance stays pending
until its real delivery status is confirmed.

UTC timestamps remain the persisted scheduling source of truth. Workspace IANA
timezones are used for input/output. Invalid dates, invalid times and nonexistent
DST wall-clock times are rejected instead of silently shifted. Tests cover
Karachi, New York winter/summer, Kolkata and Auckland. Ambiguous fall-back times
retain the existing deterministic offset choice.

## Completion roadmap / priority fix list

1. **Done:** repair live schema/history and validate preservation/security.
2. **Done:** fix worker claims, cron source configuration, retry classification,
   notification handling and invalid local-time input.
3. **Done:** automated publisher, First Comment, media, scheduler and live database
   regression checks; typecheck, lint and production build.
4. **Deployment required:** confirm private production DB target, configure
   `CRON_SECRET`, deploy this checkout including the previously untracked
   0026–0028 migrations, and verify registered cron executions.
5. **Live acceptance pending:** use designated accounts/content for real public
   Facebook/Instagram, Carousel, Reel and First Comment tests. No public test
   post was created and no existing overdue post was fired by this repair.

## Production activation

1. Compare Vercel Production `DATABASE_URL`'s project reference with the project
   above. If it differs, audit that database before migrating it. Never paste
   credentials into logs or this report.
2. Set a random server-only `CRON_SECRET` in Vercel Production and deploy the
   complete reviewed checkout. Vercel supplies its bearer header to cron calls.
   Ensure the plan supports minute-frequency cron and the 800-second duration.
   Do not enable persistent pg-boss polling inside request lambdas.
3. Verify the two registered cron routes, inspect their execution logs and the
   publishing response's `checked`/`interrupted` counts. Missing cron configuration
   is now visible in the authenticated health check and startup logs.
4. On Vercel Hobby, use an authorized external minute-frequency trigger to a
   suitably hosted endpoint or a persistent worker; daily Hobby cron is not
   suitable. No paid upgrade/provider was selected by this repair.
5. Review the old unconfirmed processing job on the actual provider before any
   retry. The two already-overdue scheduled posts will become eligible as soon
   as a real worker/cron runs; confirm their continued relevance before activation.

References: [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing),
[cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs),
[function durations](https://vercel.com/docs/functions/configuring-functions/duration).

## Validation evidence and limits

* Schema: 32 tables, 360 columns, 69 catalog indexes, 81 constraints, 13 enums;
  expected schema/security checks pass. Normal migration rerun and snapshot
  chain validation pass.
* Automated suite: 747 passed, one existing opt-in test skipped. Includes manual
  publishing, provider routing, media payloads, First Comment and timezone tests.
* Live Postgres integration: eight tests passed, covering actual application
  columns, two-worker contention, fresh-connection persistence, future/cancelled
  jobs, the manual/reschedule lock boundary, permanent failures/notifications,
  real storage isolation and persisted Buffer notification confirmation.
  Fixtures had their own random workspace and were removed afterwards; no
  provider credentials or real external publication were used in these tests.
* Typecheck and lint pass. Production build passes with the existing AI SDK
  dynamic-dependency warning. Builds used `DISABLE_BACKGROUND_WORKER=true` to
  prevent production jobs from firing during build verification.
* Browser-closed and actual server-restart **public posting** scenarios, real
  Facebook/Instagram/Carousel/Reel delivery and live First Comment remain
  unexecuted. Connection-reset tests prove database persistence, not live
  provider delivery. Authenticated page/UI smoke tests remain pending; database
  query compatibility for their persisted data has been verified.

## September 23 follow-up: non-publishing verification

The user requested verification without a live publishing run. No provider
publication, production job trigger, deployment, or live test-fixture mutation
was performed in this follow-up.

Read-only validation of the configured database still passes: 32 tables,
360 columns, 69 indexes, 81 constraints and 13 enums, with no reported schema
or security problems. All 31 migration timestamps remain recorded. The legacy
0000–0013 hash-format discrepancy described above remains historical; no ledger
history was rewritten to conceal it.

Production HTTP checks at 2026-09-23 14:22 UTC confirmed an operational blocker:

- `/api/cron/publish`: HTTP 503, `Cron is not configured`.
- `/api/cron/maintenance`: HTTP 307 to the browser login page.

The production publishing endpoint lacks its cron secret, and maintenance is
not using this checkout's machine-auth middleware behavior. Configuring the
secret and deploying the current cron routes remains required. A successful
database query or unit test does not establish that Vercel cron is running.
Private production `DATABASE_URL` and registered cron executions remain
unverified without authenticated deployment access.

Additional code fixes:

- Buffer delivery status polls now use oldest-check-first ordering in batches
  of five to bound the cron HTTP budget, persist
  their attempt count, refresh authentication once using the existing token
  mechanism, and stop after 48 unsuccessful/nonterminal polls. A missing
  connection or exhausted budget produces an actionable unconfirmed-delivery
  state. The accepted provider ID remains intact; polling never resends a post.
- A stale nonterminal poll cannot overwrite an already terminal job with
  `processing`. Confirmed delivery clears `awaitingDelivery`.
- Notification recovery creates missing success/acceptance notices from
  persisted publishing results, including manual Publish Now and an interrupted
  worker. Existing content-item locking serializes consolidation.
- Consolidated notifications retain every observed platform job state. One
  platform completing no longer hides another pending delivery; a mixed
  success/failure is shown as partial and retains the real successful permalink.
  Existing records use the existing JSON metadata column; no migration is needed.
- These changes do not alter main-post payloads or First Comment execution.

Validation: full hermetic suite passed with 783 tests and one opt-in test
skipped; typecheck, lint, schema validation and migration snapshot validation
passed. An additional maintenance-route test verifies authenticated delivery
and notification recovery without browser cookies or real provider calls.
The 103 targeted publishing/worker/cron tests also pass after the final batch
limit and temporary token-refresh recovery changes. Production build validation uses `DISABLE_BACKGROUND_WORKER=true`.
The build passes with the existing AI SDK dynamic-dependency warnings.
These follow-up changes are local and have not been deployed.

Activation can produce recovered notifications for existing persisted posts.
This is a projection of real stored results, not evidence of a new publication.
Real Facebook/Instagram, Carousel/Reel, First Comment, browser-closed and actual
server-restart delivery remain outside this non-live verification scope.
