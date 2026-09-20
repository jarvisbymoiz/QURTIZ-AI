# Brave Search — built-in platform research service

Brave Search is a **Qurtiz platform service**, not a user-configured AI
provider. One shared project-level API key powers live web research for
every user and every workspace. Nobody configures Brave; nobody can see
the key; nobody brings their own.

```
User/Workspace → Qurtiz AI Agent → ResearchService → BraveSearchProvider → BRAVE_SEARCH_API_KEY (server .env)
```

## Architecture

| Module | Role |
| --- | --- |
| `src/lib/research/brave.ts` | **The only file that reads `BRAVE_SEARCH_API_KEY`.** Sends it to Brave in the `X-Subscription-Token` header (never the URL). Typed errors: `disabled` / `unauthorized` / `quota` / `http` / `network` / `timeout`. Bounded timeout (10s) + one small retry for transient 5xx/transport failures; no retry burn on 429 — the `Retry-After` hint is surfaced instead. |
| `src/lib/research/strategies.ts` | Source-aware query shaping: `trends` (Google Trends/search-interest signals), `official`, `news`, `announcements`, `community` (Reddit), `creators` (YouTube), `web` (broad fallback). All share the same endpoint + key. |
| `src/lib/research/limits.ts` | Plan defaults (free/pro/business/enterprise: per-minute + monthly **live** allowance), global shared-key QPS guard, cache TTL, env overrides. |
| `src/lib/research/service.ts` | The internal ResearchService. Validation → anonymous public-result cache → graceful config failure → per-workspace rate limit → request dedup → global QPS → monthly plan cap → Brave. Records usage per workspace/user. Never throws. |
| `src/lib/research/usage.ts` | `research_usage_events` persistence + per-workspace summary for reporting. Telemetry failures are logged and swallowed — research availability never depends on analytics writes. |
| `src/app/api/research/usage/route.ts` | `GET /api/research/usage?days=30` — workspace-scoped usage rollup (`brand:read`). Returns booleans/counts only, never secrets. |

Consumers: the `web_search` agent tool (`src/lib/ai/search-tool.ts`),
Research Lab topic grounding (`src/lib/ai/research.ts`), and trend
suggestions (`src/lib/ai/trends.ts`). The AI agent does not know or care
which API key is used — it calls the Research tool and gets either
results or an honest, typed failure it can explain.

## Security rules (enforced + tested)

1. The key is read exclusively from `process.env.BRAVE_SEARCH_API_KEY`
   inside `src/lib/research/brave.ts` at call time.
2. No `NEXT_PUBLIC_` exposure, no client-bundle reference, no workspace
   settings field, no Supabase user/workspace table stores it.
3. No error message, return value, API response or log line contains the
   key or the header carrying it (errors carry status codes + Brave's
   own messages only).
4. In production, the app also works with no key at all: every research
   path returns `{ ok:false, reason:"provider_unavailable", message }`
   that the agent relays honestly. AI Chat never crashes.

## Workspace/user isolation

- The credential is shared; **attribution is not**. Every request carries
  the authenticated `workspaceId` + `userId`; every usage event is
  recorded against them (`research_usage_events`, cascades with the
  workspace, server-only grants).
- The shared result cache stores **only normalized public web results**,
  keyed by `strategy + normalized query + region + language + freshness`.
  It never keys on or contains Brand Brain, memory, niche context, or any
  tenant identity. Different workspaces asking the same public question
  may share the anonymous cached answer — that is deliberate cost control.
- Usage analytics (`/api/research/usage`) are strictly workspace-scoped.

## Usage control (shared quota protection)

- **Short-term caching** (default 15 min TTL, `BRAVE_SEARCH_CACHE_TTL_SECONDS`).
- **Request deduplication**: concurrent identical requests share one live call.
- **Rate limiting**: per-workspace per-minute (plan-scaled), global QPS
  guard (default 1/s = Brave free tier, `BRAVE_SEARCH_MAX_QPS`).
- **Retry/backoff**: one bounded retry for transient failures, timeouts at 10s.
- **Daily/monthly tracking**: all requests logged; **live** monthly calls
  (cache misses only) are capped per plan
  (Free 300 / Pro 3,000 / Business 15,000 live calls per UTC month by
  default; override with `QURTIZ_RESEARCH_LIMITS_JSON`).
- **Abuse protection**: per-minute caps apply before any Brave call.

Plan enforcement reads the workspace's plan tier (shared with storage
quotas). Unknown plans degrade to `free` — the most conservative tier.

## Operations

- Apply migration `0027_brave_research.sql` on a network with DB access:
  `node scripts/brave-research-db.mjs --apply` (the sandbox cannot reach
  Supabase). Until applied, research still works but usage events are
  dropped (logged warning) and monthly caps fail open.
- Missing/invalid `BRAVE_SEARCH_API_KEY` = honest `provider_unavailable`
  results; never a crash.
