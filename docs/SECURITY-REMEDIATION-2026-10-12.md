# Qurtiz security remediation — October 12, 2026

## Status and limits

Source mitigations have been applied for all 14 preliminary leads from run-1. The original audit remains incomplete: browser/deployment hunters and independent audit critics/verifiers did not finish. The leads were not independently confirmed exploits. This document records defensive fixes and local regression verification, not a security clearance or evidence of a production compromise.

The user explicitly authorized ordinary local TypeScript checks, offline tests and the production build outside the skill sandbox. Live-provider tests, deployment, database migrations and production probes were not performed. Existing unrelated worktree changes were preserved. Production must receive these source changes, and the local Companion must be updated, before those instances gain the protections.

## Source mitigations

| Preliminary lead | Change |
| --- | --- |
| Private chat titles / deleted threads on dashboard | Recent chats now require the current user, workspace and a null deletion timestamp. |
| Pending Meta discovery exposed to lower roles | The server page reads discovery settings only for workspace administrators. |
| Unauthorized upload housekeeping action | Removed the housekeeping export from the server-action module; retained it in a server-only internal library. It had no callers; no cleanup job behavior was changed. |
| Bulk cancellation reaching campaign jobs | Cancellation and retry selectors require bulk_plan; cancellation also restricts the atomic update to a nonterminal tenant-owned bulk job. |
| Membership-only connection mutation | Meta and Buffer initiation and callback independently require workspace:manage. A role downgrade between initiation and callback is checked again. |
| Ambiguous Storage signing paths | Single/batch signers reject traversal, backslashes, percent encoding, query/fragment delimiters, empty segments and foreign workspace keys. Generation reference reads use the same key validator. |
| Cross-origin embedded sign-out | POST sign-out requires matching Origin and rejects cross-site fetch metadata before contacting Supabase. |
| Unbounded provider image JSON | Responses are read with a 24MB streaming ceiling before JSON parsing, including absent/misleading Content-Length. Invalid JSON still follows existing honest error handling. |
| Reference download fanout | At most 16 saved designs, sequential downloads, 5MB per file and a 32MB complete-set ceiling. Over-limit sets fail explicitly rather than dropping images. Upload transactions serialize and enforce the design count; upload attempts are rate limited. Provider-specific lower limits remain intact. |
| Lower-trust context approving posts | Approval requires an explicit approve request containing the exact UUID in the current human message. Retrieved memory/research cannot supply the authorization. Generic approval requests ask for an ID or Content Studio approval. |
| Parent cancellation lost in research | Abort signals pass through research tools, source bundles, fallback grounding and model generation; cancellation is checked before persistence. Fixed the fallback's erroneous prompt variable. |
| Cancelled successful searches escaping accounting | Live usage is recorded by the shared provider promise independently of a cancelled waiter. Joiners remain cache-hit usage and do not duplicate live charges. Removed research-query text from the touched diagnostic messages. |
| Local Companion UUID assertions exposing pairing | Pairing requires a short-lived server-issued ownership proof verified through the exact allowed Qurtiz origin. Owner binding is rechecked after asynchronous verification. Cloud challenge redemption rechecks current workspace capability. Existing locally retained pairing credentials continue working. |
| Revocation racing image persistence | Completion rechecks and locks the device and job, then persists through that same database transaction. Revocation and completion serialize on the device row, and revoked/cancelled/expired work cannot insert a visual. |

Additional reproduced source issue: publishing media selection omitted lifecycle filters. It now selects only permanent, referenced assets in the correct workspace, so removed media cannot be chosen for a subsequent publish. Scheduling, First Comment and provider publishing handlers otherwise remain unchanged.

## Dependency remediation

Production npm audit: **0 advisories** (previously 25 dependency records, including one critical). Updated Next.js to 15.5.27, Drizzle to 0.45.4, Sharp and compatible package releases; pinned repaired transitive Undici, multipart parser, PostCSS, fflate, worker-pool and esbuild versions. Vitest was upgraded to 5.0.4 with test-only JSX compiler configuration and current Node type definitions. Full tests verify these combinations.

The shadcn generator CLI was used only for a CSS import. Its existing CSS utilities were copied without stylistic changes into shadcn-utilities.css with their MIT notice, and the unrelated vulnerable CLI dependency was removed. Components, design and behavior are retained.

Remaining full npm audit: **five development-only records**, all in the ESLint chain: braces, micromatch, fast-glob, @next/eslint-plugin-next and eslint-config-next. braces 3.0.3 / micromatch 4.0.8 are current stable releases and remain covered by the advisory. No patched current-branch release was available. npm's proposed downgrade of eslint-config-next to 14.2.35 was not applied to this Next 15 project. The reviewed Next rule invokes these globs only for an explicitly supplied settings.next.rootDir; this project supplies no rootDir glob. Keep lint configuration and repository inputs trusted; this boundary mitigation does not remove the advisory. Do not expose lint/tooling as a public service. Upstream patching or a separately reviewed tooling migration remains required.

Advisory references: [Next.js](https://github.com/advisories/GHSA-4jqv-mc3x-m676), [Drizzle](https://github.com/advisories/GHSA-gpj5-g38j-94v9), [Sharp](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), [remaining braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The cited Next advisory explicitly excludes Vercel hosting; no deployed exploit was claimed.

## Verification

- Full offline suite: 990 passed, 1 skipped, 90 passing test files.
- Subsequently added focused checks: four sign-out tests and one reference-count test passed (seven focused tests including two already in the full run); 995 distinct application checks passed overall.
- Companion suite: 21 passed.
- Production build: passed (Next 15.5.27, 52 static pages, dynamic application/API routes retained). Existing lint/cache warnings and provider-utils dynamic-import warnings remain warnings.
- Final TypeScript: passed.
- git diff --check: passed.
- Regression fixtures cover rejected viewer/editor OAuth requests before token exchange, healthy admin initiation, revoked/cancelled image completion, healthy transaction-bound completion, duplicate completions, ambiguous Storage keys, chunked response overflow, explicit approval ID binding and cancellation-independent live-search accounting.
- Real production multi-tenant database, OAuth provider, browser and Companion rollout verification remain pending. No production customer data was accessed and no external action was performed.

## Files changed in this remediation

- `companion/server.mjs`
- `companion/server.test.mjs`
- `package-lock.json`
- `package.json`
- `src/app/(app)/connections/page.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/api/buffer/callback/route.ts`
- `src/app/api/buffer/connect/route.ts`
- `src/app/api/companion/jobs/[jobId]/complete/route.ts`
- `src/app/api/companion/pair/route.ts`
- `src/app/api/companion/pair/verify/route.ts`
- `src/app/api/meta/callback/route.ts`
- `src/app/api/meta/connect/route.ts`
- `src/app/auth/signout/route.ts`
- `src/app/globals.css`
- `src/app/shadcn-utilities.css`
- `src/lib/ai/__tests__/local-companion.test.ts`
- `src/lib/ai/image.ts`
- `src/lib/ai/local-companion.ts`
- `src/lib/ai/research.ts`
- `src/lib/ai/tools.ts`
- `src/lib/companion/__tests__/pairing.test.ts`
- `src/lib/crypto/__tests__/key-migration.test.ts`
- `src/lib/media/abandoned-uploads.ts`
- `src/lib/publishing/service.ts`
- `src/lib/research/__tests__/service.test.ts`
- `src/lib/research/bundle.ts`
- `src/lib/research/service.ts`
- `src/lib/security/__tests__/companion-completion.test.ts`
- `src/lib/security/__tests__/oauth-boundary.test.ts`
- `src/lib/security/__tests__/remediation.test.ts`
- `src/lib/security/__tests__/signout-origin.test.ts`
- `src/lib/security/agent-intent.ts`
- `src/lib/security/bounded-response.ts`
- `src/lib/security/storage-key.ts`
- `src/lib/visuals/__tests__/references.test.ts`
- `src/lib/visuals/generate.ts`
- `src/server/actions/media-upload.ts`
- `src/server/actions/schedule.ts`
- `src/server/actions/visuals.ts`
- `vitest.config.ts`
- `docs/SECURITY-REMEDIATION-2026-10-12.md`
