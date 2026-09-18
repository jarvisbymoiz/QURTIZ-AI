# Existing-post editing in AI Chat

## Architecture and scope

Chat uses the existing provider adapters, streaming loop, lazy tools, protected identity and budget/compression wrapper. `find_posts` locates workspace-scoped posts across sessions (current user's posts by default; shared posts explicitly). `get_content` returns real IDs/current `updatedAt`, relevant copy, prompts, slides, scripts, ordered media metadata and delivery state. Select sections/one slide instead of repeatedly loading the entire post.

`edit_content` and Studio's caption/review-field actions call the same `lib/content/edit.ts` transaction. It checks active workspace membership and editor/owner/admin permissions, locks the parent, checks optimistic concurrency, patches only supplied fields, reruns existing deterministic QA and revokes approval. It never inserts a content item. Empty hashtag arrays and empty first comments are intentional clears; omitted fields remain unchanged. Carousel slide ordinals are one-based and retain existing slide indices, other slides and uploaded media.

Optional `edit_reel_script` and `edit_post_platforms` schemas load through discovery. They call that same transaction; splitting schemas keeps routine caption edits small. Script patches preserve omitted keys; a supplied scenes array replaces that array. Platform changes preserve the parent ID, forbid new duplicate platforms and require at least one remaining variant. A variant with delivery history cannot be removed.

`set_content_status` reuses the existing lifecycle for draft/review/archive; approval/rejection keep their dedicated tools. `schedule_content` reschedules approved/scheduled posts through the existing centralized scheduler. Changing copy on scheduled content first requires user-authorized `unschedule_content`; cancellation retains job history and excludes accepted deliveries. Edited copy requires review and explicit reapproval before scheduling again. Active publishing/generation or an unconfirmed provider delivery awaiting reconciliation blocks editing, unscheduling and media changes.

`reorder_post_media` reuses Studio's upload-order transaction: all IDs must be existing uploaded assets on that same post/workspace, and the full media-type list must match. It preserves paths, MIME types and other media types. Chat cannot set arbitrary media URLs, attach another post's assets or upload binary files through an edit patch. New/replacement files continue through the existing Studio upload UI. This release adds no provider-side editing APIs.

## Published corrections

Published or provider-accepted content requires explicit Qurtiz-only correction scope (`internalOnly=true`). Corrections go into the additive `content_items.internal_edits` column, as field patches. Studio/Post Review and Agent reads merge these patches for display. Original item/variant delivery fields, platform relationships and publishing jobs stay unchanged. Meta First Comment retries therefore retain the original comment. These corrections do **not** change the published social-platform post. Platform changes on published content are rejected.

## UI refresh

Successful tool writes revalidate Studio, Calendar and dashboard routes. Chat emits a workspace-scoped BroadcastChannel change notification after persisted tool success; an open Studio tab refreshes its server data, including an open Post Review. Focus refresh is a fallback. Post Review updates saved caption values when not actively editing and displays explicitly cleared tags. Visual Prompt, AI visual actions, Carousel uploads/ordering/navigation and Reel video controls remain available.

## Deployment

Apply the additive migrations in order:

- `0023_content_internal_edits.sql`: display-only correction column; no original copy/media modified.
- `0024_agent_editing_identity.sql`: immutable protected identity version 4; earlier identities/memories retained.
- `0025_content_server_grants.sql`: restores server-only content browser grants intended by 0018; existing RLS retained. Server services perform membership and workspace authorization.

For an already deployed database, `node scripts/content-edit-db.mjs --apply` applies these idempotent statements with lock/statement timeouts and verifies identity, column, RLS and browser grants. The configured database was verified after applying them. Use the canonical migration runner for new deployments; snapshot 0025 includes the additive column for future schema generation. No new environment variables are required.

Deploy/restart the application to use the new identity/tools. Rollback selects prior code/identity; keep the additive column/corrections and tightened server-only grants. Do not delete original posts, immutable identities or media as a rollback.

## Validation

- Canonical `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- Live disposable database tests: `$env:RUN_LIVE_TESTS='true'; npm test -- src/lib/content/__tests__/edit.live.test.ts`.
- Optional actual-model routing with entirely synthetic tool implementations: `$env:RUN_LIVE_TESTS='true'; $env:RUN_LIVE_EDIT_PROVIDER='true'; npm test -- src/lib/ai/__tests__/post-editing-provider.live.test.ts`. This tests model interpretation/schema routing, not real publishing or authenticated browser behavior.
- Regression coverage: same-chat creation/read/edit tools, fresh-connection/new-session lookup, no duplicate parent, copy-only patches, clears, master/slide prompts, Reel copy/script/video retention, stale writes, malformed/foreign variants, platform addition/removal, media ordering, authorized scheduling/rescheduling/unscheduling, required reapproval, active publisher guards, published delivery/comment preservation, literal search wildcards, ambiguity guidance, role/workspace isolation and server-only RLS/grants.
- Real editing schemas and recent conversation are tested under an unchanged 8,000-token request limit; irrelevant brand/memory-write schemas and optional script schemas are discoverable instead of always injected. Existing long-conversation compression tests continue to run.

Before browser sign-off, verify authenticated Chat → edit → Studio/Post Review refresh, cross-tab refresh while a modal is open, and preserved in-progress manual caption edits/uploads. Automated rendering and database tests do not constitute a live authenticated browser E2E run.

### Verified results — September 18, 2026

- 576 regression tests passed; one optional compression-provider test skipped.
- All 14 disposable Postgres editing tests passed; publishing/reconciliation guards and media-order preservation passed final focused checks.
- Configured model passed four entirely synthetic routing scenarios: previous-session caption edit, known Carousel slide edit, ambiguous-post clarification without writes, and approved-post rescheduling without content edits or duplicates. The first attempt exposed an invalid read-section name; the exact enum is now explained in the tool description and the complete rerun passed.
- Canonical typecheck, lint and final isolated production build passed. Applied migrations 0023–0025 were verified with content RLS enabled and browser grants denied.
- Existing AI SDK bundler/cache warnings remain. Browser authentication/visual E2E and real social-platform publishing were not exercised by this editing task.
