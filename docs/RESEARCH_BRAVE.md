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
| `src/lib/research/service.ts` | The internal ResearchService. Validation → anonymous public-result cache → graceful config failure → per-workspace rate limit → request dedup → global QPS → monthly plan cap → Brave. Records usage per workspace/user. Never throws. Emits structured `[research]` diagnostics. |
| `src/lib/research/bundle.ts` | Multi-source trend research: parallel focused searches across `trends` + `news` + `community` (creators optional), URL-deduplicated, partial-success tolerant. Used by Research Lab grounding + trend suggestions. |
| `src/lib/research/usage.ts` | `research_usage_events` persistence + per-workspace summary for reporting. Telemetry failures are logged and swallowed — research availability never depends on analytics writes. |
| `src/app/api/research/usage/route.ts` | `GET /api/research/usage?days=30` — workspace-scoped usage rollup (`brand:read`). Returns booleans/counts only, never secrets. |

Consumers: the `web_search` agent tool (`src/lib/ai/search-tool.ts`),
Research Lab topic grounding (`src/lib/ai/research.ts`), and trend
suggestions (`src/lib/ai/trends.ts`). The AI agent does not know or care
which API key is used — it calls the Research tool and gets either
results or an honest, typed failure it can explain.

**Provider independence is the whole point.** The ResearchService runs in
the Qurtiz backend with the shared key; the selected AI model (Gemini,
OpenAI, Claude, OpenRouter, MiniMax, GLM, NVIDIA, custom
OpenAI-compatible, …) only calls the `web_search` tool and analyzes the
results. No provider-native search capability is ever required, and the
tool implementation never consults workspace AI config
(`getWorkspaceTextModel`). The agent system prompt explicitly forbids
attributing research failures to the selected AI provider.

**No silent model-knowledge fallback.** When the user asked for current
data ("right now" / "latest" / "trending") and live research fails, the
tool returns the real reason (missing key / invalid key / quota with
retry window / timeout / zero results) plus anti-hallucination framing;
the agent relays it instead of producing a stale 2024-style trend list
presented as live. Research Lab topics without live sources stay labeled
"AI-knowledge estimates" — never presented as sourced.

**Multi-source trend research.** "What is trending in my niche" requests
first resolve the niche from Brand Brain / workspace context, then run a
focused `trendSourceBundle` (`src/lib/research/bundle.ts`): parallel
Brave searches across `trends` (Google Trends / search-interest
signals), `news` (past week), and `community` (Reddit) — URL-deduplicated,
partial-success tolerant, and failures are named per source class.

**Diagnostics.** Development logs emit one structured `[research]` line
per event: tool selected, strategy, region,
freshness, HTTP status, result count, `cache hit` / `dedupe join`,
blocked reasons (workspace rate limit, global QPS, monthly plan cap),
controlled provider error reason, and fallback attempts (including the Gemini
grounding fallback in the Research Lab path). No API key, headers, or
tenant-private context are ever logged. `/api/health` additionally
reports `BRAVE_SEARCH_API_KEY` as a presence boolean (value never
returned), so env loading is verifiable at runtime.

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
  keyed by `strategy + normalized query + region + language + freshness + count`.
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


## Agent search request contract (October 2026)

The existing tool registry owns execution: `web_search` calls ResearchService and Brave, independently of the selected LLM. Each chat step derives its attached schemas and authoritative availability instructions from the same active tool names. Search stays attached on every step, including creation, edits, greetings and after unrelated discovery. Compact search schema descriptions preserve the small-model budget; no intent regex decides search availability. Missing capabilities require discovery before invocation. Brand Brain, persistent memory and chat history remain unchanged.

Brave uses GET `https://api.search.brave.com/res/v1/web/search`, URLSearchParams, no body, and a server-only `X-Subscription-Token` header. Validate queries (600 characters/75 words maximum), integer count 1–20, supported search languages and freshness before networking. Normalize supported countries; valid countries without a localized Brave index (including PK) use `ALL`, which means worldwide rather than localized results. Do not use UI locales such as en-US as search_lang.

Reproduced production usage record: query `ChatGPT 6.1 Sol Astra level model low cost`, country PK, language en, freshness pw, HTTP 422. Brave's validation response rejects unsupported search-country values. HTTP 400/422 yields invalid_request with whitelisted validation field names only; no automatic retry, raw response, private arguments or credentials. Bounded retries remain for 5xx/transport failures.

Run opt-in real provider verification with RUN_LIVE_TESTS=true and RUN_LIVE_SEARCH=true: `npx vitest run src/lib/ai/__tests__/web-search-provider.live.test.ts`. This reads configured providers, makes real LLM/Brave calls and records normal research usage; it does not create posts or publish. It verifies each distinct configured provider without changing workspace configuration.

## Search hardening and verification — October 5, 2026

Chat search is read-only (`brand:read`), and awaits normalization of the actual tool output. Cancellation ends the caller's run without aborting a shared anonymous Brave request needed by another workspace. Every provider request still has its own bounded timeout. Malformed HTTP-200 payloads fail as response errors, without transient retries. Logs omit queries and arbitrary provider messages; registry, execution, result count and continuation stage are recorded with controlled reasons.

Explicit native-tool incompatibility enables a validated JSON decision through the same configured LLM, then the existing Qurtiz search tool and model continuation. Authentication, quota, missing registry tools and transport errors do not activate that protocol. No alternate model is hard-coded. Daily token/request quota and billing exhaustion are non-retryable; ordinary transient throttling and server errors retain SDK retries.

BRAVE_SEARCH_API_KEY is configured server-side in local, Preview and Production. Preview was missing the key and was provisioned as a sensitive Vercel environment variable. No client variable or workspace credential setting was added.

Verification: the configured model completed a real streamed search with ten Brave sources. Current-news and niche research also completed with real source links. A broader multiple-source answer omitted an exact source URL; this remains an unsuccessful citation verification, not a claimed pass. The rerun and the actual localhost Chat run reached Brave HTTP 200/ten results, then model continuation hit the configured provider's daily TPD quota. Production and Preview builds succeeded, but authenticated deployed Chat verification is pending Production sign-in and sufficient provider quota. Unsupported-native-tool protocol, cancellation isolation, schemas, output normalization and malformed responses are covered by regression tests; other providers are not claimed live-verified without configured credentials.

Opt-in multi-turn test (real provider charges/usage): set RUN_LIVE_TESTS=true and RUN_LIVE_SEARCH_JOURNEY=true, then run `npx vitest run src/lib/ai/__tests__/search-journey.live.test.ts`. It performs public read-only research and a follow-up/non-search conversation, without publishing or modifying content.

### Files changed in this Web Search pass

Runtime: `src/app/api/chat/route.ts`, `src/lib/ai/agent.ts`, `src/lib/ai/chat-tools.ts`, `src/lib/ai/openai-compatible.ts`, `src/lib/ai/search-compatible-model.ts` (new), `src/lib/ai/search-tool.ts`, `src/lib/ai/tools.ts`, `src/lib/research/brave.ts`, `src/lib/research/service.ts`.

Verification: `src/lib/ai/__tests__/openai-compatible.test.ts`, `src/lib/ai/__tests__/search-compatible-model.test.ts` (new), `src/lib/ai/__tests__/search-journey.live.test.ts` (new), `src/lib/research/__tests__/brave.test.ts`, `src/lib/research/__tests__/service.test.ts`. This document records the outcomes; unrelated pre-existing working-tree changes were preserved.

Final hermetic validation: TypeScript passed; 956 tests passed, one skipped. Preview and Production builds passed. These checks do not replace the pending authenticated deployed Chat and follow-up/citation verification.
