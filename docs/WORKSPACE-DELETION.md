# Password-only workspace deletion

## User flow

Settings → Delete workspace → enter account password → Permanently delete workspace.

No email link, OTP, polling confirmation, typed-name step or global sign-out remains. The dialog snapshots the selected workspace when opened. The server receives that exact UUID, rather than deriving its deletion target from a mutable active-workspace cookie. The current authenticated user must be both the creator and an owner member; ownership is checked again inside the deletion transaction.

Password verification uses a nonpersisting Supabase client. Its disposable verification session is signed out with `scope: local`; the browser's existing account session stays intact. No password is written to job input, cookies, database records or logs.

When accepted, only the selected workspace is tombstoned. Its memberships are removed, pending publishing is cancelled, active agent/generation jobs are cancelled, Companion devices are revoked, provider credentials are removed and Auto Run is disabled. Other workspace rows and memberships are untouched. A publishing operation already in progress must finish before deletion can be accepted. Published or already accepted external social posts are not deleted from Facebook, Instagram or Buffer.

If the deleted workspace was active, its cookie moves to a remaining workspace. With no workspace left, the user goes to onboarding while staying signed in. A different active workspace is preserved when deletion originated from another tab.

## Durable cleanup

The existing `jobs` table stores a `workspace_delete` job while the tombstoned workspace still exists. The worker runs through:

- Production: the existing authenticated `/api/cron/maintenance` route (connected Supabase scheduler is active every five minutes).
- Persistent localhost/server: the existing minute-based pg-boss chat-run sweep.

The worker claims database rows with locks and a ten-minute lease; stale claims recover after a terminated invocation. It deletes only files inside `brand-assets/<selected-workspace-UUID>/`, including abandoned uploads with no application row. Batches cap file deletion at 100 objects and folder reads at 25; additional batches resume from the remaining namespace.

Previously issued [Supabase signed upload URLs](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl) remain valid for two hours. Initial file cleanup can start at the next worker invocation, but the durable tombstone/job remains for two hours plus five minutes. After that drain period the namespace is swept again, then the workspace row is deleted with database cascades. This catches late uploads rather than silently leaving orphan files. The UI correctly says background cleanup is queued, not already completed.

No schema migration is required. The connected Production database was checked read-only: `workspaces.deleted_at` exists and all 34 direct workspace foreign keys use ON DELETE CASCADE. Read-only aggregate checks across the 15 workspace-owned parent/child relationships found zero cross-workspace references. The purge removes memberships, content/variants, brand/memory, chats, media rows, campaigns, settings/AI configuration, research, analytics, notifications, publishing and Companion state belonging to that workspace. It does not delete the Supabase account, other tenants, operational logs, backups or external platform copies.

## Failure handling and recovery

Storage/database failures retain the durable job and inaccessible workspace; they are not reported as a completed purge. Attempts back off exponentially, up to one hour, and stop after eight failures with a failed job visible in server operations. Safe logs record the workspace UUID, attempt count and a structured reason; they do not contain credentials, private URLs or content. Missing cleanup service configuration blocks the initial deletion request.

An operator can inspect `jobs` rows where `type = 'workspace_delete'` and the corresponding tombstone. Fix Storage/configuration or database availability first. To retry, reset only the verified failed deletion job to queued, clear its error and set result to `{ failures: 0 }`; never modify another job type or an active workspace. Keep the tombstone until successful cleanup. No browser must remain open for execution.

## Verification

Offline tests cover wrong passwords, owner-only access, selected-workspace isolation, old-tab cookie handling, last-workspace onboarding, duplicate queue requests, publishing conflicts, prefix-only Storage deletion, multi-batch cleanup, late signed uploads, durable retry, and isolated password-verification session handling. Full local regression suite: 1,019 passed, 1 skipped. The subsequently added maintenance-failure check passed in the targeted cron suite. TypeScript and production build passed.

No real Production workspace was deleted during verification. The new source must be deployed to activate this behavior in Production; the scheduler itself was already active and was not changed.
