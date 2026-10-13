# Production insights sync

Manual `Sync insights`, the pg-boss handler, and `/api/cron/insights` use `syncInsightsForWorkspace`. Nothing publishes or modifies social account connections.

## Root causes reproduced on real accounts

The former Facebook insights list contains invalid metrics. Instagram Graph v22 explicitly rejects the retired `impressions` metric. This made every remotely listed post fail; the original UI collapsed the errors into 147 warnings.

Facebook now reads `post_media_view` and supported reaction/comment/share fields. Instagram reads `views`, `reach`, `saved`, `shares`, `like_count`, and `comments_count`. Unsupported format-specific metrics are isolated; supported values remain usable. Views are distinct from impressions. Engagement rate only uses engagement from rows with measured reach. Absent metrics are not replaced with invented zeroes.

Nine historical Facebook deliveries stored uploaded photo IDs. Account post attachments provide the verified photo-to-feed mapping; only analytics associations are repaired. Publishing records and First Comment IDs are unchanged. Buffer internal IDs are never passed to Graph. A historical Buffer delivery without a real platform ID or matching permalink remains `provider_not_supported`; content/date similarity is insufficient to safely link it.

## Durability and schedule

Supabase pg_cron/pg_net wakes `qurtiz-insights` every five minutes. The database `settings` key `analytics_sync_v2`, scoped to each workspace, gates a complete cycle every four hours. A five-minute atomic lease prevents overlapping manual/automatic execution. Per-post checkpoints and unique metric upserts allow bounded serverless slices to resume after a crash. Transient failures retry after 5/10/20 minutes, at most three times, then return to the four-hour cadence. Invalid metrics, credentials, permissions, and missing posts are not blindly retried.

The endpoint accepts an endpoint-scoped HMAC signed using the existing Vault scheduler secret. Permanent secrets are not queued, returned, or logged. Unsigned requests return 401. Existing maintenance/publishing scheduler jobs remain unchanged. The maintenance script supports all three jobs for future installs; do not rotate the existing Vault secret without synchronizing deployed `CRON_SECRET`.

The manual summary includes checked, synced, skipped, failed, remaining, and warning counts. Checked counts discovered platform posts plus unmatched historical delivery records; unmatched records may represent already measured account posts whose association cannot be proven. Completed status and nextDue persist independently of an open browser.

## Diagnosis and verification

Structured warnings contain workspace/platform/post identifiers and one typed reason: `missing_external_id`, `token_expired`, `permission_missing`, `unsupported_metric`, `post_not_found`, `provider_not_supported`, `rate_limited`, `connection_missing`, `account_mismatch`, `network_error`, or `provider_error`. Never log Graph response bodies, tokens, full pagination URLs, Vault values, or queued headers.

Tests: `npm test`, `npm run typecheck`, `npm run build`. The opt-in `RUN_LIVE_TESTS=true RUN_LIVE_INSIGHTS=true` sync test writes actual metrics using configured accounts; do not run without authorized production data access. It verifies overlapping lease rejection and real Facebook/Instagram persistence. Scheduler verification must separately confirm deployed endpoint HTTP results, pg_cron execution, database timestamps, and the stored four-hour nextDue. A forced due test proves execution, not that four elapsed hours have passed.

To recover an abandoned run, wait for lease expiry; the next wake resumes its cursor. Token/permission failures require reconnecting or correcting provider access. Legacy deliveries without proven identity need a trustworthy platform ID/permalink; do not guess.

## Verified rollout

Production manual UI and the actual Supabase scheduled tick both completed with 154 checked, 147 synced, seven skipped, zero failed. All nine photo-ID associations recovered. The seven historical Buffer deliveries lack usable provider credentials and verified platform permalinks; both Buffer connections are currently not connected. The scheduled HTTP response was 200 and the next due time was persisted four hours after completion. Initial eligibility was forced once to test the schedule; four elapsed hours were not observed.

Buffer documents `externalLink` on retrieved posts, but it cannot be retrieved without provider access. Its experimental metrics are not a replacement for the verified Meta data path here: [API reference](https://developers.buffer.com/reference.html), [Buffer API limitations](https://support.buffer.com/en-us/articles/using-buffers-api-GtIYIQilz5).
