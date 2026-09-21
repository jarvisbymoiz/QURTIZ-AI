# Server-render schema drift safeguards

## Scope and inspection

This is a new implementation, not a reconstruction of unavailable commit 2709200.

The authenticated app layout and all 13 app pages await Drizzle reads during
Server Component rendering. Full-row selections include every column in the
current TypeScript schema, even when a deployed database has not yet received
that column. Workspace/membership lookup is shared by these routes and can fail
before the shell renders. The sidebar previously selected entire notification
rows despite only needing the `read` field; migration 0028 adds `notifications.meta`.

Status of this targeted fix:

- Implemented: server-render guards on the app layout and every current app page.
- Implemented: sidebar notification projection avoids dependency on `meta`.
- Tested: direct and Drizzle-wrapped missing-table (`42P01`) / missing-column
  (`42703`) errors, real layout and notifications entry points, sanitized output,
  unchanged redirects/errors, and recovery on the next render.
- Not verified: a live Supabase deployment before/after applying migrations.
- Unchanged: actions, API routes, provider behavior, authorization, and writes.

## Behavior

Only those two PostgreSQL codes (including nested `cause` chains) trigger the
explicit **Database update required** view. No fabricated empty lists or records
are returned. If workspace resolution fails, the guard does not redirect the
user to onboarding or render private children. No raw SQL, parameters, or error
messages are exposed by the guard; its server log contains only a static render
scope and SQLSTATE.

Permission, connection, validation, unexpected application errors, and Next.js
redirect/not-found control flow continue to propagate. This is not a schema
repair mechanism or a guarantee that features work against an older schema.
Affected pages remain unavailable until the database and code match. Existing
helper-level error handling is unchanged.

Each async page needs its own guard: wrapping a layout cannot catch a child's
later React render. Future async database-backed pages should use
`withSchemaGuard` too. Do not use it for actions or writes.

## Deployment and recovery

1. Back up the database and review pending SQL migrations and the migration
   ledger against the deployment's current schema.
2. Apply pending committed migrations using the existing deployment process
   (`DATABASE_URL` configured, `npm run db:migrate`; see SETUP.md). Prefer doing
   this before deploying code that requires new columns. Do not rerun a full
   bootstrap schema or recreate workspaces as an error-recovery step.
3. Reload affected pages. The guard does not cache errors, retry writes, or run
   DDL. Look for `[qurtiz schema drift]` in server logs if the mismatch persists.
4. If migrations cannot safely be applied, roll back the application to the last
   version compatible with that database. Do not drop data to match code.

No new migrations, environment variables, or external services are introduced.
No production database changes were performed during this implementation.

## Verification

- `npm test`: 759 passed, 1 skipped (live suites excluded by repository default).
- `npm run typecheck`: passed. Fixed an existing workflow test fake's `.from`
  signature so its table-aware override typechecks; no runtime workflow change.
- `npm run lint`: passed, no warnings.
- `npm run build`: blocked by sandbox TLS/network access to Google Fonts.
- Additional production compilation/prerender verification passed using Next's
  `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` with temporary local CSS font stubs. This
  does not verify real font downloads. The stubs are not committed and app font
  configuration is unchanged. Run the normal build in deployment CI with network
  access before release.
