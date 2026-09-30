# Agent Auto Run

## Vercel Production repair (30 September 2026) — live release gate open

**Root causes observed on Production:** `vercel.json` has no Cron entries because the project uses Hobby. The existing GitHub Actions scheduler is the intended five-minute trigger, but the latest two scheduled runs both failed at **Require scheduler credential**: repository secret `QURTIZ_CRON_SECRET` is absent. Unauthenticated Production probes of `/api/cron/maintenance` and `/api/cron/publish` both returned HTTP **503**, confirming Vercel Production `CRON_SECRET` is absent too. No background scan or due-post publication can start until the same strong secret is configured in both places. The Vercel runtime also intentionally omits pg-boss workers, while the old maintenance route only enqueued Auto Run work into pg-boss; even a valid trigger would have left that work unconsumed.

**Current serverless design:** the authenticated GitHub Actions schedule calls bounded Node-runtime Vercel functions; Postgres remains the source of truth. The maintenance invocation transactionally scans due workspace-local occurrences, persists one `jobs(type=autopilot)` row per occurrence, recovers stale running rows, and directly claims one eligible queued job slice. A slice saves the strategy or processes one post using the existing content generator, Brand Brain, relevant context, research, visual service/cloud companion, media readiness check, centralized scheduling and notification path. It then persists `result.stage`, `createdIds`, `nextPostIndex`, and retry timing before exiting. The next invocation resumes from the checkpoint. A conditional `queued → running` update prevents concurrent cron calls from processing the same slice. Stale running claims return to the queue after 30 minutes; transient failures back off 5–10 minutes for at most three real attempts. Waiting for the paired companion does not consume an attempt. The full run is complete only after the configured post count has been processed; its completion notification remains a separate persisted record.

The independent `/api/cron/publish` invocation scans due `publishing_jobs`, atomically claims them and calls the same `publishNow` service as Publish Now. That service owns Meta-first/Buffer fallback routing, provider post ID/permalink, first comment state, and publication status. A first-comment failure does not undo an accepted main post. The existing delivery recovery and notification reconciliation remain in maintenance. Scheduled UTC timestamps and workspace-local candidate slots are unchanged.

**Configuration required to activate Production:** set the *same new random secret* in Vercel Production `CRON_SECRET` and GitHub Actions repository secret `QURTIZ_CRON_SECRET`. Do not paste it into chat or source. Run the workflow manually once and verify both `publish` and `maintenance` jobs complete; then inspect scheduled runs and Vercel function logs. Preview is protected by Vercel SSO and has no separate external trigger; testing Preview requires an explicitly configured reachable Preview deployment and its own scoped scheduler credential. The public Production browser, API providers, social connections and companion account must also be ready for full-path live tests.

**Verification still required:** a browser-closed Production occurrence, exact persisted post count and generated fields, real image completion, Calendar scheduling, actual Meta/Buffer publication, external ID/permalink, first comment, notification, redeploy recovery, and duplicate cron test. Do not call Auto Run complete until those checks pass.

**Code verification:** focused serverless dispatch tests prove Vercel never calls pg-boss; a three-post run resumes across separate invocations, QA retries and images consume bounded slices, deferred jobs are skipped, and companion waiting does not charge an API image provider. Full app regression: **872 passed, one skipped**; TypeScript typecheck, schema validation (36 tables, zero problems), and the production build passed. These tests do not substitute for the live release gates above.

**Deployment check:** commit `aec3e8d` built successfully on Vercel Preview and Production. The Production alias still returns HTTP **503** from both cron routes before authentication because `CRON_SECRET` remains unset. This is the expected fail-closed response; no live Auto Run or scheduled publish was triggered. GitHub `QURTIZ_CRON_SECRET` also remains unconfigured at the last checked scheduled run. Production and Preview full-path results are **not verified**.

## Audit and root causes

The previous minute scanner performed research, creation and scheduling inline. It claimed an exact-minute occurrence before doing work, so a missed scan, crash or provider failure could permanently lose that run. Saving settings replaced the JSON claim. Research results were truncated to the requested quantity but did not guarantee that quantity. Platforms were fixed to Facebook and Instagram, and every post received the same next-day hour with an 18:30 fallback.

The existing shared content generator, QA, Brand Brain, research service, analytics computations, lifecycle, Post Review, publishing jobs and Meta-first/Buffer-fallback provider resolution are retained. Auto Run no longer uses the legacy single-slot helper. Manual scheduling defaults are unchanged.

## Execution and persistence

1. The existing minute scanner locks each workspace's Autopilot settings, checks enabled state, local run times and weekdays, and inserts a `jobs` row of type `autopilot` in the same transaction as the occurrence cursor.
2. The scanner sends queued rows to the existing pg-boss `autopilot-run` queue. Queue-send failures leave the database job recoverable.
3. The worker conditionally claims a queued row, reads brand/recent content, real measured analytics, competitor insights and upcoming Calendar jobs, and runs the existing research service.
4. An AI strategy call must return exactly the requested number of distinct topics. Research may supply fewer opportunities; the strategy must still satisfy the count without claiming unsourced ideas are live trends. Strategy usage is recorded in `agent_runs`.
5. Each post uses the shared content generator with the selected platforms and format. Every platform must have exactly one matching variant and pass QA. Up to three QA attempts per post are allowed. Failed drafts are retained as failed review candidates; they do not count toward the requested valid-post quantity.
6. Generated IDs are stable by run/post/QA attempt. Workspace-scoped lookup and a database transaction lock prevent duplicate persisted content after lost acknowledgements or competing retries. Job checkpoints preserve topics, valid IDs, warnings and progress.
7. Optional image generation uses the existing visual service and ordered Carousel slides. Reels require real uploaded video; image generation cannot create a playable Reel. Incomplete media remains for review with an explicit warning. Media readiness uses exactly the same uploaded-media precedence and generated-slide deduplication as publishing.
8. Eligible posts are approved and routed through the existing centralized `schedulePost`. Under a workspace transaction lock it reads committed publishing jobs and reserves a conflict-free slot for each platform. Manual scheduling takes the same workspace lock, so it participates in Calendar serialization. Auto Run authorization is rechecked from locked settings before scheduling.
9. Existing background publishing executes those jobs and resolves healthy Meta/Buffer connections at execution time. Scheduling success is not publishing success. Provider failure, First Comment recovery, reconciliation and retry remain in the publishing service.

No new database table or migration is required: settings JSON and the existing jobs/agent-runs/publishing-jobs models are reused.

## Settings contract

| Setting | Enforcement |
| --- | --- |
| Enabled | Scanner and worker check persisted state; disabling cancels queued/interrupted runs before further phases. Already committed Calendar jobs remain scheduled. |
| Run times / run days | Up to six local HH:MM occurrences on selected weekdays, using workspace timezone; DST gaps are skipped. |
| Posts per run | Exact 1–3 valid, persisted content items, each with the requested platform variants. Persistent failures explicitly fail the run with saved progress. |
| Platforms | Selected Facebook/Instagram targets only. A missing usable connection reports a scheduling error. |
| Content formats | Selected formats rotate across the requested posts; the model must honor each chosen format. |
| Niche focus | Included in research and brand-informed AI strategy. |
| Generate images | Uses configured real image generation/storage; disabled means no automatic visuals. Existing uploads are preserved. |
| Require approval | The run snapshot or latest settings requiring approval keeps content in review. Turning this off does not silently auto-approve old completed runs. |
| Auto-schedule | Only runs with automatic approval and auto-scheduling enabled can reserve slots. The latest settings can revoke scheduling. |
| Fallback times | Configurable local posting slots, distinct from run-start times. Defaults: 09:00, 12:00, 17:00. |
| Minimum gap | 30–1440 minutes between reserved posts on the same platform, including manual and other Auto Run jobs. |
| Daily post cap | 1–6 reserved posts per platform/local day; additional posts move to subsequent dates. |

Configuration saves merge into JSON, preserving the occurrence cursor. Re-enabling records an activation instant to avoid creating occurrences from the disabled period. Active runs use a configuration snapshot for stable quantity/platform/format/timing; current enable/approval/auto-schedule settings can stop further external actions. Changes to the other settings apply to future runs.

## Timing evidence and Calendar behavior

Timing uses real synced post performance by platform and, when sufficient rows exist, format. At least three measured posts and repeated positive engagement in a candidate hour are required. Measured engagement is a proxy for suitable posting hours; it is **not audience-online data**, and no audience activity numbers are fabricated. If evidence is insufficient, validated configurable fallback slots apply.

Ranked candidate times are checked from tomorrow in the workspace timezone through a bounded 60-day horizon. The next available candidate must respect the per-platform minimum gap and daily cap. Pending, processing and published publishing jobs occupy slots; cancelled/failed jobs do not. Multiple platforms for one item can share a time, while different posts on the same platform are distributed. A full horizon fails visibly rather than stacking posts.

The publishing job records timing source, timezone and candidate times. Its persisted UTC timestamp drives Calendar and execution. The settings card shows actual last-run progress, errors and review/media warnings and can refresh backend status.

## Recovery and deployment

- Missed occurrences within the previous 24 hours are recovered oldest first, one per workspace per scan; older downtime does not create an unbounded backlog.
- Queued jobs are resent oldest first (up to 50 per scan). A single job can be claimed by only one current worker.
- Running jobs without a phase heartbeat for 30 minutes are requeued. AI calls are bounded; completed content and committed schedules are reused on recovery.
- Transient run failures preserve progress and retry up to three executions. Corrupt saved config fails terminally. Disable results in cancelled state. QA/media errors are never represented as successful publishing.
- Browser closure has no effect on the worker. Server downtime pauses processing until a worker returns.
- Local/persistent Next servers register existing pg-boss workers at startup. `DATABASE_URL` must support pg-boss schema creation and transactions; configured AI keys, encryption key, storage and connected provider credentials must be available to the worker.
- On Vercel, authenticated maintenance invocations process bounded resumable slices directly; they do not start pg-boss. A persistent worker remains an option for higher throughput and tighter timing, but is not required for basic Production Auto Run. Hobby still requires the external scheduled trigger and matching secrets described above.
- Do not enable `DISABLE_BACKGROUND_WORKER=true` in the actual worker environment. Restart the development/worker server after deploying these changes so it registers the new queue consumer.

## Validation

Automated tests cover exact three-post creation even with one research result, approval/scheduling rules, lost persistence acknowledgement and saved-progress recovery, disabled runs, corrupt config, scheduling retries, missing-media review, configurable fallbacks, measured platform timing, DST, weekday/catch-up handling, daily limits and multi-run Calendar distribution. Publishing service tests exercise actual slot insertion and commit-time settings guards. Existing manual scheduling, Meta/Buffer payloads, First Comment and media regressions remain in the full suite.

Before production rollout, use a dedicated test workspace and connected test social accounts:

1. Set three posts/run and two nearby run times. Verify six valid items, selected variants, saved config after refresh, unique Calendar slots, timezone and daily cap.
2. Repeat with review required and auto-schedule disabled; verify no publishing jobs are created. Upload actual Carousel/Reel media and approve/schedule manually.
3. Test both measured analytics and custom fallback times, including existing manually scheduled conflicts and simultaneous workers.
4. Kill the worker during creation and after a schedule commit, restart, and verify saved IDs are reused and no accepted provider post is duplicated.
5. Disable during execution and change approval requirements before schedule commit; verify remaining work stops and already scheduled posts retain their explicit existing lifecycle.
6. Force AI/storage/provider failures and exhaust retries; verify bounded terminal states, retained valid posts, actionable messages and notifications.
7. Let scheduled jobs execute on test Meta/Buffer accounts; verify actual ordered media, Reel playback, First Comment, provider IDs, final persisted status and refresh of Calendar/Content Studio.

Hermetic tests mock network providers. They do not prove a live provider publication or database locking across real worker processes; the staging steps above are required to establish those results.
