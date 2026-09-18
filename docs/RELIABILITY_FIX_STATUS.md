# Qurtiz AI reliability fixes — verification record

Scope: finish the existing application. Commercial SaaS work (plans, billing,
entitlements and monetization) and the public landing page are deferred by the
owner's instruction. Existing authentication and workspace security remain in scope.

This is a local implementation record, not a production completion certificate.
No database migration, social post or deployment has been performed in this pass.
The existing private storage bucket's file limit and media MIME allowlist were
updated through Supabase to enable video uploads (see the media record below).

## Implemented locally

| Area | Change | Verification required beyond unit tests |
| --- | --- | --- |
| Chat continuity | Server-owned history, transactional first-turn creation, thread lock, concurrent-turn rejection, deterministic retry replacement, completed tool-result preservation | Real PostgreSQL concurrent requests and at least ten consecutive messages with each configured AI adapter |
| Chat recovery | Saved assistant placeholder, final response and terminal run state saved together, stale run recovery, cancellation polling, reconnect retrieves saved response | Refresh/disconnect during text and tool execution; process restart; cross-process cancellation |
| Chat controls | Native FileList attachments, edited-message replacement, late-stream overwrite protection, mobile controls and scroll behavior | Browser attachment/edit/retry/stop/reopen testing |
| Agent tools | Research and competitor access, saved-result IDs, content details, bulk progress, execution-time permissions and cancellation | Viewer/editor/admin separation and real permitted tool results |
| Generation and approval | Atomic content/variants/run persistence, per-variant QA, shared approval transitions, caption edits invalidate approval/schedules | Generate/edit/reject/approve for all formats and both platforms |
| Bulk/jobs | Atomic queued-to-running claim, durable enqueue from UI and agent, pg-boss array handler, shared startup promise, saved partial item IDs, stale-run terminal recovery and user notification | Persistent worker deployment and retry of only failed partial items |
| Uploads | Signed direct storage upload followed by authenticated finalization; MIME/size/signature validation; existing carousel order and reel preview preserved | Real image/video files, size limits, cancelled upload, ordering and cross-workspace access |
| Publishing truth | Buffer accepted/unknown status stays processing; delivery polling confirms sent/error; provider IDs preserved; caption uses the platform variant; ordered Meta/Buffer carousel payloads; official Instagram and Facebook Reel flows | Real Buffer status lifecycle and Meta/Buffer media delivery |
| Scheduling | Strict future timestamp; job/status transaction; item lock; approval recheck; active/uncertain delivery guard | Competing publish/schedule/edit requests against PostgreSQL |
| Duplicate prevention | Immediate-publish reservation under item lock; previously accepted or uncertain jobs block re-creation; ambiguous network failures and lost workers do not automatically resend | Process termination immediately before/after external acceptance; operational reconciliation procedure |
| First Comment | Published content can enter comment-only retry without re-creating the main post; PostgreSQL row lock claims comment sends to block concurrent retries | Real Meta comment success/failure and concurrent PostgreSQL validation |
| Security | Connection management requires workspace management permission; member counts scoped; server-side password reauthentication for deletion; cron fails closed; AI endpoint allowlist; remote chat attachment fetch removed | Live two-workspace security tests and migration review/application |
| Responsive navigation | Mobile drawer and desktop sidebar, bounded app layout and chat viewport, stacked mobile calendar agenda and tap-to-schedule controls | Tablet/desktop regression review and touch-device upload/dialog testing |
| Analytics sync | Platform-scoped published IDs, bounded cursor pagination, per-post failure isolation and actionable sync errors | Validate current metrics and real values with the approved Meta app/accounts |

## Remaining work before claiming completion

1. Apply and verify migration `0018_server_access_and_storage.sql` against a
   backed-up staging database. It restricts direct app-table API access and makes
   `brand-assets` private with membership-based storage policies. Review existing
   storage clients/policies before production application.
2. Test the full authenticated journey with a dedicated test workspace and real
   providers. Build and mock-based tests cannot establish provider delivery.
3. Finish publishing reconciliation UX for ambiguous outcomes. These jobs fail
   visibly and block automatic resends; an operator must verify the actual provider
   result. Do not clear the guard or retry until delivery is known. Durable Meta
   container checkpoints still need a persistence model before a process restart can
   resume the same provider container safely.
4. Deployment validation of the persistent worker remains mandatory. Stale bulk and
   campaign runs now terminate honestly with saved partial IDs, but retrying only the
   exact failed items still needs an explicit user workflow. A publish cron does not
   consume bulk jobs.
5. Validate analytics metrics and missing-data semantics with the current approved
   Meta app and real media. Pagination and per-post error isolation are implemented.
6. Mobile authenticated routes were reviewed for Calendar, Studio, Brand Brain,
   Research, Competitors, Analytics, Connections and Settings. Finish tablet/desktop,
   keyboard, touch upload/reorder, and full dialog interaction regression testing.
7. Validate database relationships, tenant integrity, storage orphan cleanup and
   concurrent media finalization/reordering. Review health diagnostics for sensitive
   error disclosure and ensure production errors are actionable without secrets.
8. Local rate limits are process-local safeguards. Distributed operational abuse
   and cost controls remain necessary for multiple server instances. This is separate
   from the commercial quota/billing work that the owner deferred.
9. Extend agent content editing/regeneration and confirm retrying a chat turn cannot
   duplicate previously completed write tools. Chat message deduplication alone does
   not make external/tool side effects idempotent.

## Environment and operation

### Content Studio Review follow-up — September 16

- Fixed single-image preview selection excluding uploads with `slideIndex=0`.
  Uploaded overrides now match publishing selection instead of depending on row order.
- Preview signing verifies active workspace membership/path and uses server storage
  credentials when configured, with the authenticated storage client as fallback.
  Saved files with unavailable URLs stay visible with a retry control.
- Captions, platform first comments, main visual prompts and individual carousel
  slide prompts can be saved from Review. Changes invalidate approval; scheduled,
  published and actively publishing content is protected.
- Slide generation now uses the selected variant and finds the persisted slide
  index rather than an array position; generated assets persist that slide index.
- Existing carousel one-image preview/reorder/remove and Reel native video
  controls remain. The redundant general uploader is limited to single images.
- Validation: TypeScript, ESLint, production build and 475 tests passed. Ten existing
  uploaded image objects signed and returned HTTP 200 with expected MIME types.
  Browser testing was blocked by browser request-header policy loading failure.
  No saved video objects exist, so live Reel upload/player validation remains open.

- `AI_ALLOWED_BASE_URLS`: exact custom API base URLs separated by commas. Catalog
  defaults are supported without an entry. Configure custom gateways before use.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: server-only storage access for
  worker uploads and signed media URLs. Keep the service key out of client bundles.
- `CRON_SECRET`: required bearer credential for the publishing cron route.
- Persistent Node hosting starts pg-boss through instrumentation. On a deployment
  carrying `VERCEL`, a separate persistent process must explicitly enable
  `ENABLE_BACKGROUND_WORKER=true` to consume bulk/campaign/analytics jobs. Do not
  enable a persistent polling worker inside a request-only serverless function.
- `DISABLE_BACKGROUND_WORKER=true` skips startup workers, storage checks and legacy
  credential migration for UI/build verification. It must not remain enabled on the
  actual worker host.
- `RUN_LIVE_TESTS=true` opts into existing live tests, which may use configured
  providers and stored workspace data. Default tests are hermetic.

## Launch validation gates

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- Two users/two workspaces: deny foreign chat, content, jobs, media, research and
  credentials through both application routes and Supabase APIs.
- Chat: new thread → ten turns → parallel tools → refresh → retry → edit earlier
  turn → cancellation → disconnected client → reopen. Assert saved parts, IDs and
  statuses after every terminal state.
- Content: generate single/bulk → edit → QA → approve/reject → schedule → worker
  → confirmed publish → persisted status → analytics.
- Carousel: upload several images → reorder/remove → one-image preview → publish
  every remaining image in exact order. Reel: actual video MIME → native preview
  → provider processing → confirmed final result.
- Publishing: healthy Meta primary; compatible Buffer fallback; neither connected;
  expired token; comment failure; accepted-but-pending Buffer; unknown network
  outcome; concurrent clicks; restart after acceptance. Assert no duplicate posts.
- Mobile/tablet/desktop: keyboard and touch navigation, focus, dialogs, no horizontal
  overflow, attachment/upload controls and calendar usability.

## Content Studio media verification — September 16, 2026

- Carousel batches append after existing uploads, normalizing legacy null/tied
  positions. Preview and publishing share stable ordering; reordering persists
  `slideIndex` and removal targets one upload only.
- Review shows one carousel image at a time with edge navigation and a position
  indicator. Missing preview URLs retain navigation and offer refresh recovery.
- PNG/JPEG/WebP images are limited to 9MB each and 10 per carousel. Reels accept
  MP4/MOV/WebM up to 50MB and preserve MIME types with native video controls.
  Playback still depends on the browser supporting the video's codec.
- Signed storage uploads bypass server action body limits. A 120-second storage
  request timeout bounds hung transfers. Progress counts confirmed attached files.
  Stop finishes the current file and retains remaining files for retry; it does
  not abort bytes already transferring. Batches stop on the first failure to
  preserve order. Finalization retries reuse the uploaded object/ticket.
- Upload, remove and reorder enforce workspace permissions, editable lifecycle
  states and active-publishing protection. Append/reorder serialize under the
  content-item lock. Publishing rejects image-only Reels and video carousels.
- Automated verification: 480 tests across 38 files pass; typecheck and lint pass.
  Production build passes with the existing AI SDK dynamic-dependency warning.
- Live browser verification remains blocked: the in-app browser reported a
  refused connection and a fresh tab timed out, despite the local verification
  server starting successfully. No live social publish or database migration
  was performed. The verification server was stopped.
- Staging must verify upload/add/reorder/remove/refresh, playable video, approval,
  scheduling and ordered Meta/Buffer delivery. Existing migration 0018 supplies
  the private bucket, 50MB storage limit and media MIME allowlist; verify staging
  configuration before applying any migration. Failed/unattached storage objects
  require operational cleanup if a ticket expires before finalization.
- Live storage configuration was inspected: it initially allowed only images up
  to 5MB. Supabase rejected 64MB with HTTP 413; updating to 50MB and adding MP4,
  MOV and WebM succeeded. A read-back confirmed the bucket remains private,
  its limit is 52,428,800 bytes, and all six supported MIME types are allowed.
  No table/security policies or existing media objects were changed.
- `scripts/media-storage-smoke.mjs` passed against configured private Storage for
  real synthetic PNG, H.264 MP4, H.264 MOV and VP9 WebM files. Signed uploads
  preserved MIME/size; private signed previews downloaded identical SHA-256
  bytes; the check removed its own temporary objects and local fixtures. It
  creates no database content rows and does not test authenticated finalization,
  UI playback, approval, scheduling or provider delivery. Run explicitly with
  `RUN_LIVE_MEDIA_TEST=true`; FFmpeg must be installed (or set `FFMPEG_PATH`).

## Source rollback

The pre-fix source backup is
`C:\Users\IRONMAN\AppData\Local\Temp\qurtiz-before-fixes-20260915-184143.zip`.
It intentionally excludes environment secrets. No Git history is available in this
checkout. Preserve `.env.local` and database backups independently. Do not blindly
reverse storage restrictions or database migrations to roll back application code.

For any publishing error with an accepted provider ID or an unconfirmed outcome,
inspect the social account/Buffer post before intervention. Never reset such jobs to
pending in bulk. Cancellation of chat stops further tool starts but cannot undo
external work already accepted by a provider.
