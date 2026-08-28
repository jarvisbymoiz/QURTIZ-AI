# ARCHITECTURE — QURTIZ AI (M1)

## Module map

```
UI (React Server Components + client islands)
   ↓ server actions / route handlers
Application layer  src/server/actions/*  (validated with zod, role-checked)
   ↓
Domain / Agent     src/lib/ai/*  (provider registry, tools, prompt, run logging)
   ↓
Data access        src/lib/workspace.ts + src/db/* (Drizzle, tenancy guards)
   ↓
Postgres (Supabase)  ← RLS defense-in-depth
```

## Workspace isolation (multi-tenant)

Two layers, deliberately:

1. **Server-side guard (primary).** All DB access runs server-side only.
   Server actions and route handlers resolve the user from the Supabase
   session and the workspace from an httpOnly cookie, then verify
   membership via `getMembership(userId, workspaceId)` before any read or
   write. Every table carries `workspace_id` and every query filters by it.
2. **Postgres RLS (defense-in-depth).** Migrations enable RLS on every
   workspace-scoped table with member-based policies keyed to `auth.uid()`.
   The app's server connection (table owner) bypasses RLS by design; the
   policies protect any future direct client access via PostgREST.

Why not RLS-only? The app talks to Postgres directly via Drizzle for typed,
composable queries. Enforcing claims-per-request would add fragility now
for a path (direct client DB access) we do not use. If that changes, the
policies are already in place.

## Authentication

Supabase Auth with @supabase/ssr cookie sessions. Middleware refreshes the
session on every request and gates non-public routes. Auth flows:
password, magic link (PKCE), and email confirmation via `/auth/callback`.

## AI provider abstraction

`src/lib/ai/provider.ts` is the single seam:

- `getModel()` resolves the configured model from the registry
  (Google today; OpenAI and others slot in without touching agent code).
- Returns `null` when unconfigured — the UI renders an honest
  "Configuration Required" state. No response is ever faked.
- `estimateCost` maps token usage to USD per model and is written to
  `agent_runs` after every run (`agent_steps` records each tool call).

The chat agent is a streaming tool-calling loop (AI SDK v5): intent →
optional tools (Brand Brain read, memory write, facts list) → response.
Agent authority at M1 is read + internal-write only; publishing and other
external actions do not exist yet by design. External actions in later
milestones will require explicit approval flows (Manual mode default).

## Brand memory

Durable preferences/facts/rules stored per workspace
(`brand_memory`). The agent saves via the `update_brand_memory` tool when
the user states something durable; the user can pause, edit, or delete any
memory in the Brand Brain UI. Memory feeds the system prompt on every run.

## Design decisions (ADR summary)

| Decision | Alternative | Why |
|---|---|---|
| Modular monolith (single Next.js app) | Microservices | One deployable, faster iteration; module boundaries keep later extraction possible |
| Drizzle + direct Postgres | Supabase client SDK only | Typed SQL + migrations in repo; RLS policies still applied |
| Server actions + RSC | Client-heavy REST | Less API surface, colocation, simpler authz |
| pg-boss jobs (M3) | Redis queue | One datastore, good enough for scheduled publishing at MVP scale |
| Template-first visuals (M2) | AI-raster only | Deterministic brand-safe text rendering at ~$0/image |
| Official Meta APIs only (M4) | Browser automation publishing | ToS-compliant, stable, honest failure states |

## Milestones

M1 Foundation → M2 Content engine → M3 Calendar/approval → M4 Meta
publishing → M5 Analytics → M6 Intelligence → M7 Autopilot. See README.md
checklist for live status.

