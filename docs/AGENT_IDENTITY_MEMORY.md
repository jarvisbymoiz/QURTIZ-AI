# Agent identity and persistent memory

## Audit and implementation

The existing system had shared workspace `brand_memory` rows, a Brand Brain management panel and an append-only chat memory tool. It had no private personal memory, workspace agent profile, conflict handling or protected versioned database identity. This implementation extends that architecture rather than replacing chat or the content pipeline.

1. `agent_identities`: release-controlled immutable identity versions. Version 1 is seeded by migration 0020 and matches `identity.ts`. Only reviewed releases may publish a new version and change the selected version in code. Learning tools and management actions have no identity-write path. An UPDATE/DELETE trigger rejects mutation, including through the application database role.
2. `workspace_agent_profiles`: one relational row per workspace, with separate operating, strategy, workflow and platform fields. Admins/owners edit it in Settings. Profiles are reference guidance, never authorization or protected system instructions.
3. `user_agent_memories`: private to a `(workspace_id, user_id)` pair. A composite membership foreign key removes personal memories if that membership is deleted. Preferences deliberately do not follow a user into another workspace.
4. Existing `brand_memory`: shared workspace knowledge, extended with a semantic key, category and superseded timestamp. Existing Brand Brain, content and Auto Run integrations are preserved. Superseded records remain in storage but are excluded from active retrieval and the legacy management panel.

## Learning and explicit commands

Chat uses the existing `update_brand_memory` tool with structured scope/category/key/content. Ambiguous preferences default to `user`. Clearly workspace-wide brand/workflow decisions may use `workspace` with editor-or-higher permission. The agent instructions require durable user-provided information, not every message, temporary requests, secrets or tool-generated instructions. Credential-like values and protected key namespaces are rejected by server validation.

Common language, tone and emoji preferences receive canonical semantic keys, including platform prefixes where applicable. Other preferences use an agent-selected stable semantic key; exact normalized text has a deterministic fallback key. Updates supersede the active value. Advisory transaction locks serialize writes to each user/workspace scope; partial unique indexes prohibit duplicate active keys. Legacy Brand Brain entries are matched by their canonical meaning when updating common preference slots.

“Remember”, “from now on” and changed preferences use the save tool. `retrieve_agent_memory` returns relevant keys; `forget_agent_memory` removes the requested key and its superseded versions. The model must only confirm success after a successful tool result. Semantic extraction and unusual preference-key selection depend on the chosen model's tool-calling quality; there is no second background AI call or regex-only interpreter pretending to understand arbitrary conversations.

Forgetting removes persistent memory, not original chat messages or already generated posts. Full visible conversation history remains intact. The user can still edit/forget entries directly in Settings independently of AI interpretation.

## Context and budget

Before each chat turn the server authorizes membership and reads bounded relevant memory candidates. SQL text ranking and common preference slots select a maximum of 100 candidates per scope; task/category/keyword/platform relevance selects at most 8 entries per scope with 1,200 characters per scope. Response-wide style preferences remain relevant to replies. Other facts are not injected into unrelated greetings. Workspace profiles load relevant sections only for work-related requests.

The final JSON reference block is bounded in UTF-8 bytes, normally at most 3,200 bytes, with a smaller allocation for lower model/account limits. It uses the selected provider/model budget and an applicable learned limit. Entire values are omitted instead of truncating their meaning. Omitted data stays in the database and can be retrieved through the bounded memory tool. Protected identity and reference data go through the existing outgoing-payload estimator and compression wrapper together with tools, Brand Brain, history and attachments.

Content generation, bulk strategy and research use the same authorized retrieval service. Auto Run content and research explicitly exclude personal memories and use shared workspace guidance. No account keys, file-backed shared memories, unbounded memory injection, duplicate conversation history or additional provider adapters are introduced.

## Permissions and privacy

- Personal read/write/delete: authenticated owner of the private memory plus active workspace membership.
- Workspace memory read: workspace members; write/delete: editor/admin/owner.
- Profile read: members; edit: admin/owner.
- All queries scope workspace and, for personal data, user. Deleted workspaces are rejected.
- Settings actions derive the actor from the server session and verify the expected active workspace. The component is keyed by workspace so switching resets old edit state.
- RLS enforces those boundaries. Legacy membership-only Brand Brain write policies are removed because PostgreSQL permissive policies combine with OR.
- The existing server-only table grants remain in force. Anonymous/authenticated direct browser database access is revoked; tests temporarily grant access only inside transactions that roll back.
- Successful memory saves log scope/key/id, not private content. Management errors log categories rather than query parameters.

## Deployment and migration

Migration: `src/db/migrations/0020_agent_memory.sql`, registered in the Drizzle journal. Apply through the normal migration runner to an up-to-date environment. For a repository whose earlier additive migrations were already applied manually, `node scripts/agent-memory-db.mjs --apply` applies just 0020 inside a transaction with bounded lock/statement timeouts and verifies RLS/grants. It is idempotent; it does not advance or skip the canonical migration ledger. Do not skip unapplied older migrations.

The configured development database received 0020 and the verified legacy-policy correction. Existing content, media, chat messages and credentials were preserved. Exact duplicate workspace-memory rows are superseded, not deleted. No new environment variables are required for normal operation. Restart/redeploy the application after code deployment; each request reads persisted data instead of a process-local memory cache.

`0020_snapshot.json` captures the current logical schema, including the earlier chat-context column. Drizzle generation reports no pending schema changes. RLS, grants, identity triggers and operational search indexes are maintained in the reviewed SQL migration. Use versioned migrations rather than `db:push` on production.

Rollback: redeploy the previous application while retaining additive tables/columns. Do not drop memory tables or remove the stronger RLS policies to roll back application code. Review backups before any destructive schema rollback.

## Verification

```powershell
npm test
npm run typecheck
npm run lint
npm run build

# Disposable fixtures; read/write isolation, supersession, streaming tools,
# fresh-connection persistence, forged RLS writes, protected identity.
$env:RUN_LIVE_TESTS='true'
npm test -- src/lib/ai/__tests__/persistent-memory.live.test.ts

# Also test natural commands using the configured provider (bounded paid AI calls).
$env:RUN_LIVE_MEMORY_PROVIDER='true'
npm test -- src/lib/ai/__tests__/persistent-memory.live.test.ts
```

The default suite is hermetic. Live tests remove their temporary workspaces and runs. Provider tests resolve an existing configured provider, use temporary memory data, and never publish or change customer content. The short/long context test uses the real schema definitions, system prompt and budget wrapper with a deterministic model; the database streaming test uses real authorized tool handlers with a deterministic model.

Before production rollout, manually verify Settings at mobile/tablet widths, learning in authenticated chat, a new chat recalling preferences, workspace switching while editing, and logout/sign-in recovery. Database persistence/isolation and fresh-connection recovery are automated; these checks do not substitute for a live authenticated browser session or prove arbitrary third-party models interpret every natural-language preference identically.

### Verified development results

- Full regression suite: 559 tests passed; the separate opt-in compression-provider test is skipped by default.
- Live memory/database suite: 9 tests passed, including simultaneous writes, cross-user editing rejection, RLS read/write isolation, immutable identity, streamed tool persistence and fresh-connection recovery.
- Natural remember → update → forget passed against the configured custom `openai/gpt-oss-120b` provider with real tool executions in disposable workspaces.
- Short five-turn chat and genuinely long-history compression passed with bounded persistent memory/profile context in the outgoing payload.
- Typecheck, lint and isolated production build passed. Existing AI SDK dynamic-import bundler warnings remain; no application lint warnings or type/build errors.
- All ten original non-memory tool implementations match the pre-change baseline.
- Final database verification: all four tables retain RLS and denied direct anonymous/authenticated access.


## Proactive core identity releases 2 and 3

`src/lib/ai/identity.ts` contains protected IDENTITY (personality), AGENT (action/clarification/tool truth), and BOOT (scoped, selective run preparation) concepts. These are one compact immutable structured identity release, not shared user-writable markdown files. Migration `0021_proactive_agent_identity.sql` inserts version 2, and `0022_compact_agent_identity.sql` publishes a more compact version 3 for request-budget compatibility, retaining all earlier releases and learned memories. Release 3 selected version 3; the current editing release selects immutable version 4, with the same release constant as a deployment fallback. No learned preference can write core identity.

Apply the additive release with `node scripts/agent-memory-db.mjs --apply --identity-release`; deploy/restart the application so it selects the new version. Existing memory schema/RLS/grants are unchanged. Rollback means deploying the previous code selecting version 1, not deleting identity or memory records.

Clear creation requests use the existing content tool and infer style from relevant context. Creation now accepts requested format and tone, routed into the same QA/persistence pipeline. Missing essential offer facts merit one focused question; optional tone/audience/CTA choices do not. "Create it in Studio" should reuse an already saved real post. Scheduling still requires approval. The current release exposes authorized in-place editing through the shared Content Studio update service. See `AGENT_POST_EDITING.md` for tools, approval rules, published corrections and validation. Media uploads and provider integrations retain their existing implementations.


Obvious creation/scheduling requests expose one matching action schema immediately; other capabilities remain discoverable on demand. This is schema availability, not automatic execution or permission escalation. It uses only the current user message, so old tool discoveries do not reactivate tools. Actual request token estimation remains enabled for all schemas.

Provider behavior tests: `RUN_LIVE_TESTS=true RUN_LIVE_IDENTITY_PROVIDER=true npx vitest run src/lib/ai/__tests__/proactive-identity.live.test.ts`. This uses the configured provider with synthetic brand/post fixtures and in-memory action tools; it is not real publishing or authenticated browser E2E. Calls are paced by `LIVE_IDENTITY_SPACING_MS` (default 30000) for low-TPM accounts. Existing live memory tests exercise real database authorization and RLS in disposable workspaces.


### Proactive identity validation (September 18, 2026)

- Final regression suite: 566 passed, one opt-in compression-provider test skipped. Typecheck, lint and isolated production build passed; existing AI SDK bundler/cache warnings remain.
- Eight live database tests passed, including immutable current identity version 3, RLS and cross-user/workspace isolation.
- Six short turns with bounded memory and the immediately available creation schema fit the unchanged 8,000-token operational budget without compression. Genuine long history is summarized with full visible history preserved.
- Configured-provider synthetic fixtures verified offer creation, professional refinement, carousel conversion, reuse of existing Studio content and tomorrow scheduling. The full sequence exposed a hidden-read-tool failure on usual-style reuse; get_content availability was corrected. A final seeded continuation passed usual-style reuse and another-version creation. These are provider reasoning/tool-routing tests with fixture actions, not real publishing/browser E2E.
- Ordinary chat uses the centralized concise role guidance; detailed visual instructions are included for explicit visual/slide prompt or reel-script requests. The content generation engine continues to receive the full existing generation guidance. Protected identity and scoped memories remain in the bounded request pipeline.
