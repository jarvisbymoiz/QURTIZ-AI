# Campaign execution and recovery

Campaigns group existing Content Studio items; they do not introduce another publishing system. Creation accepts a validated name, goal, audience, offer, CTA, duration and supported platforms. Manual campaigns start in `planning`; AI campaigns start in `generating` with a durable `jobs(type=campaign)` record. Every day is persisted in `campaign_items`.

## Generation

Persistent pg-boss workers retain the full campaign handler. On Vercel, the existing authenticated maintenance endpoint claims one queued campaign and generates one pending day per invocation. The deployed Supabase scheduler invokes this endpoint without a browser. Atomic queued-to-running claims prevent concurrent execution. Saved days are skipped; the day UUID is the content generation idempotency key. A shared 150-second abort signal bounds each slice. Saved Brand Brain, memory and the configured workspace AI provider are reused.

Each slice checkpoints progress from real linked posts. Consecutive failed slices stop after three attempts. An explicit **Retry generation** action only accepts a failed job in the current workspace and requeues missing days without deleting saved content. Cancelling stops subsequent days; an already running provider call may finish its current day. Stale running claims are failed by the existing generation recovery service. Inspect the associated `agent_runs` failure for provider diagnostics; never expose provider credentials.

The JSON fallback contract includes the required carousel slide fields and reel script fields. All output still passes the existing schema; incomplete slides are not fabricated or silently converted to another format.

## Linking, scheduling and publishing

All mutations validate the active workspace and permission. A content item can belong to only one day within a campaign. Soft-deleted and foreign-workspace posts cannot be linked. Approve delegates to the shared content approval service. Schedule delegates to the existing scheduling service with campaign-selected platforms and workspace timezone. The normal media/variant readiness checks remain active. Partial scheduling is reported rather than marked wholly successful.

Calendar and Content Studio remain the interfaces for actual per-platform publishing, media preparation and delivery recovery. Campaigns do not automatically publish AI drafts. Unschedule delegates to the existing content unscheduling action. Deleting a campaign deletes its day associations, preserving linked posts, media and independent publishing jobs.

## Status and analytics

Reports use real publishing jobs and stored post metrics for linked content. `completed` requires every campaign day to be linked and every selected platform to have a published delivery with a provider post ID. Scheduled, failed and unidentified deliveries cannot complete the campaign. Otherwise a linked campaign is `active`, and an empty campaign is `planning`; cancelled/generating states are preserved. Status is reconciled when the campaign report loads or Refresh status is used. Metrics are the existing analytics service's measurements, not synthetic campaign estimates or automatic attribution.

## Verification

Unit coverage verifies platform-filtered scheduling, cron invocation and truthful completion conditions. Opt-in real database tests reject cross-workspace mutation and recovery preserves existing links. Run ordinary checks with `npx tsc --noEmit` and `npx vitest run`. Live recovery requires `RUN_LIVE_TESTS=true` and an explicitly selected `CAMPAIGN_RETRY_TEST_ID` whose name starts with `Campaign verification`; it changes only that failed QA campaign's job state.

Production verification on October 5, 2026 created, edited and linked real campaigns, approved and scheduled an existing visual post for Facebook/Instagram, observed both Calendar jobs, then unscheduled both. A separate campaign linked to three already published posts reached completed and showed stored analytics. A deletion test removed a QA campaign while preserving its linked published content. Fresh external publication and authenticated localhost UI verification remain separate release gates; these checks must not be represented as having passed until actually performed.
