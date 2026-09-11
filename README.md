# QURTIZ AI — Social Media Agent

An agent-first social media operating system: research → strategy → content →
visuals → platform adaptation → QA → approval → schedule → publish → analyze → learn.

> **Current status: M1 (Foundation) complete — code-verified.** Runtime
> verification requires Supabase + Gemini credentials (see SETUP.md).

## Stack

- **Next.js 15** (App Router, TypeScript strict, React 19)
- **Tailwind CSS v4 + shadcn/ui** — dark-first premium design system
- **Supabase** — Auth (email + magic link), Postgres, Storage (later)
- **Drizzle ORM** — typed schema + SQL migrations in `src/db/migrations`
- **Vercel AI SDK v5** — `AIProvider` abstraction, default Google Gemini
- **Vitest** — unit tests for pure logic

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in values — see SETUP.md
npm run db:migrate            # applies schema to your Supabase DB
npm run dev
```

Without env vars the app still builds and renders honest
"Configuration Required" states — nothing is faked.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run db:generate` | Regenerate migrations from schema |
| `npm run db:migrate` | Apply migrations (needs DATABASE_URL) |

## M1 feature checklist

```
FOUNDATION (M1)
[x] Next.js 15 + TS strict + Tailwind v4 + shadcn/ui scaffold
[x] Supabase Auth (email/password + magic link) with middleware gate
[x] Multi-workspace model with role-based access (owner/admin/editor/viewer)
[x] Postgres schema (Drizzle): workspaces, members, brands, brand_memory,
    chat threads/messages, agent_runs/steps, platform_connections, content shell
[x] RLS policies as defense-in-depth + server-side tenancy guards
[x] Brand Brain CRUD: business, audience, voice, visual identity, content rules
[x] Brand Memory: list / pause / delete / manual add, chat-sourced saves
[x] AI Chat: streaming, tool-calling agent (brand tools), persisted threads
[x] AIProvider abstraction (Vercel AI SDK, Gemini default, cost logging)
[x] Dashboard v1 with honest empty + not-connected states
[x] Honest "coming in M2+" placeholders for future sections
[x] Unit tests (slug, permissions, cost estimation, validation)

CONTENT (M2)          [ ] research, generation, adaptation, QA, visuals
CALENDAR (M3)         [ ] calendar, scheduling, approval center, campaigns
META INTEGRATION (M4) [ ] FB/IG OAuth, publishing, token management
ANALYTICS (M5)        [ ] insights sync, dashboards, AI analysis
INTELLIGENCE (M6)     [ ] competitors, growth lab, adaptive learning
AUTOPILOT (M7)        [ ] guardrailed autonomous loop
```

## Repo layout

```
src/
  app/            routes (auth pages, app shell, api)
  components/     ui (shadcn), layout, brand, chat, settings
  db/             drizzle schema + migrations
  lib/            supabase clients, permissions, validation, ai provider/tools
  server/actions/ server actions (workspace, brand, memory)
```

See ARCHITECTURE.md for the workspace-isolation and AI-provider patterns.

"# QURTIZ-AI" 
