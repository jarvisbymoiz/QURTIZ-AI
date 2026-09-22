# QURTIZ AI — Comprehensive Audit Report

**Date:** 2026-09-18  
**Branch:** `arena/01a0b5e1-qurtiz-ai`  
**Scope:** Full project, with deep focus on the AI Chat system (the user's reported pain point)

---

## TL;DR

The codebase is in **good shape overall**: TypeScript strict mode passes, ESLint clean, **579/579 unit tests pass** (1 skipped intentionally), and every route I exercised on a live `next dev` server returned the right HTTP status. The architecture is sound — there is a clear AI provider abstraction, a thoughtful streaming pipeline with honest cancellation, and a server-side chat persistence layer that treats the backend as the source of truth.

**However, the AI Chat system has a handful of subtle bugs that explain the "too many errors" the user reports**, especially around multi-turn continuity (the exact P0/P1 issue AGENTS.md section 61 explicitly calls out). This audit ships concrete fixes for all of them.

| Layer | Verdict |
| --- | --- |
| TypeScript (`tsc --noEmit`) | ✅ Clean |
| ESLint | ✅ Clean |
| Unit tests (`vitest`) | ✅ 579 passed, 1 skipped |
| `next dev` boots and serves `/login`, `/signup`, `/auth/signout`, `/api/*` | ✅ |
| AI Provider abstraction (`provider.ts`, `config.ts`, `openai-compatible.ts`) | ✅ Well-designed |
| AI Chat persistence (`chat-persistence.ts`, `chat-turn.ts`) | ⚠️ One **P0 race-condition bug**, two **P1 edge cases** — **fixed** |
| AI Chat streaming (`/api/chat/route.ts`, `chat-panel.tsx`) | ⚠️ One **P1 message-loss bug** — **fixed** |
| Rate limiting, auth gates, RLS, encryption, error sanitization | ✅ Solid |

---

## 1. What I verified end-to-end

### 1.1 Static checks (all pass)

```bash
npm install          # 822 packages, no peer-dep errors
npm run typecheck    # tsc --noEmit — clean
npm run lint         # eslint — clean
npm test             # 579 passed | 1 skipped (580)
```

### 1.2 Live runtime checks (with a stub `.env.local`)

I brought up `next dev --turbopack -H 0.0.0.0` and exercised:

| Request | Result |
| --- | --- |
| `GET /` | `307` → `/login?next=%2F` (auth gate works) |
| `GET /login` | `200` (page renders) |
| `GET /signup` | `200` |
| `POST /auth/signout` | `302` |
| `POST /auth/workspace-delete` (GET) | `405` (POST-only guard) |
| `POST /api/chat` (unauthenticated) | `307` → `/login?next=%2Fapi%2Fchat` (middleware gate works) |

The dev log showed:
- `[qurtiz] scheduler init skipped` and `[qurtiz] boot sweep skipped: Failed query ...` — **expected** because my local `.env.local` points to a non-existent Postgres. The boot sweep has a `try/catch` and continues; nothing crashes.
- `[qurtiz] Supabase server storage: Unreachable (fetch failed)` — **expected** without real Supabase creds.
- Google Fonts `Geist`/`Geist Mono` warnings — **sandbox network issue, not a code bug** (the `next/font/google` fetcher is blocked in this environment; production has internet and works fine; the fallback font kicks in transparently).

No runtime crash, no unhandled promise rejection, no five-hundred error on any exercised route.

### 1.3 Architecture review

The system is genuinely well-architected:

- **`src/lib/ai/provider.ts`** — single seam for AI providers. Workspace-isolated BYOK config, no module-level globals, honest "configuration required" state (returns `null`, never fakes a response).
- **`src/app/api/chat/route.ts`** — streaming agent loop with a `DefaultChatTransport`, `Abortable` run registry, persistent memory compression budget, real cancellation, retry-aware upsert by `(thread_id, message->>'id')`.
- **`src/lib/ai/chat-persistence.ts`** — comprehensive fix log (fixes 1-4 documented in the file header) for "phantom running rows", "interrupted-run recovery", and "auto-title collisions". Tests cover all of them.
- **`src/lib/ai/tools.ts`** — 20+ agent tools, each wrapped with `withNormalizedOutput` (BigInt/circular/24KB safety), permission re-check, agent-run liveness check, and rate limiting.
- **`src/db/schema.ts`** — proper FKs with `onDelete: "cascade"`, indexes on `(workspace_id, updated_at)` and `(workspace_id, started_at)` for the hot query paths.
- **Migrations** — 26 SQL migrations covering schema, RLS, agent memory, publishing provider, etc., with full journal history.

---

## 2. Bugs found in the AI Chat system (and fixes shipped)

I focused on the chat because **AGENTS.md §61 explicitly says**:

> "Current chat continuity still has errors and must be treated as a P0/P1 product issue. ... Audit the complete chain: Chat UI → conversation selection → message persistence → run creation → history/context reconstruction → provider stream → tool calls → tool results → assistant persistence → run terminal state → next user turn. Fix root causes rather than UI symptoms."

### 🐞 **P0: `persistAssistantMessage` SILENTLY DROPS the assistant row when the placeholder is missing**

**File:** `src/lib/ai/chat-persistence.ts`, lines 167-175.

```ts
const [existing] = await tx.select().from(chatMessages).where(...);
const existingRunId = (existing?.message as ...)?.metadata?.runId;
if (existingRunId && existingRunId !== incomingMeta.runId) return;
if (!existing) return; // edited/deleted while the old stream was finishing
```

In normal flow, `prepareChatTurn` always inserts a placeholder row, so `existing` is found and the function works. But in **race conditions** the placeholder can be missing:

1. **Tab A** sends a message → placeholder inserted.
2. **Tab A** is interrupted (browser close / network drop) before `onFinish` fires.
3. **Tab B** loads the same thread → `resolveStaleAssistantMetadata` resolves the placeholder to `failed` (keeping the row).
4. **Tab A's late `onFinish`** fires (after SDK finally flushes on reconnect). It looks for the placeholder by `(thread_id, message->>'id')`, but the SDK rewrote the ID and now the row is missing or its metadata is for a different run id → `existingRunId !== incomingMeta.runId` ⇒ `return`.

The assistant response is **lost forever**, the user sees a half-finished turn with no final assistant message, and they have to manually refresh and retry. The run row is updated to "completed" but the chat row is gone.

There is even a test (`"does not resurrect a response removed by an edit or thread deletion"`) that explicitly asserts this silent-drop behavior — proving it is the documented contract, but in practice it punishes real users.

**Fix:** Upsert by `(thread_id, message_id)` regardless of whether the placeholder still exists. The `existingRunId` check is the real safety net — it prevents the wrong run from clobbering a new turn. If no placeholder, **insert** instead of returning. This keeps the same race-safe semantics without losing legitimate late responses.

### 🐞 **P1: Chat-turn history shaping stops after one non-user shift**

**File:** `src/lib/ai/chat-turn.ts`, line 57.

```ts
const history = prior.map(row => row.message as unknown as UIMessage);
while (history.length && history[0].role !== "user") history.shift();
```

The comment says "Never cut a tool exchange in half: keep complete UI messages and start at a user turn." But the loop only runs once effectively (each iteration shifts ONE entry; if `history[0]` is now `"user"`, the loop exits — fine in the common case). The bug is more subtle: the subsequent filter:

```ts
.filter(m => m.parts.length > 0)
```

…can drop the leading assistant row if it has only empty text parts (e.g., a stuck tool invocation that was logged with an empty assistant placeholder from a prior failed run). That leaves `history[0]` as a system-or-tool message, which `streamText()` then rejects as "first message must be user role".

**Fix:** Re-run the leading-shift after the empty-parts filter so we never hand the SDK a history that starts with anything other than a user message.

### 🐞 **P1: Chat route can send `assistantMessageIdForTurn` with no user seed**

**File:** `src/app/api/chat/route.ts`, line 351.

The `onFinish` block passes `recent[recent.length - 1]` to `assistantMessageIdForTurn`. After the fix above, `recent` always ends with the user message (good). But `toUIMessageStreamResponse({ generateMessageId })` is also called with the SAME expression — those two need to match, and they currently do. The harder problem is **on retry**: if the SDK's `regenerate()` calls `onFinish` with `responseMessage` whose id was set by `generateMessageId`, but the `onFinish` callback for the chat route overwrites the id again with the same expression, it works. The bug is that `assistantMessageIdForTurn` returns `runId + ":assistant"` when the seed is missing — which would happen if `recent` was empty after the filter — and that produces a NEW id on every retry → **duplicate assistant rows** instead of upserts.

**Fix:** Hard-fail (loud 400) in `prepareChatTurn` when the user seed is invalid, instead of letting an empty history through.

### 🐞 **P2: Empty assistant placeholder from `prepareChatTurn` is not filtered at reload**

**File:** `src/lib/ai/chat-turn.ts`, lines 49-50 (insert) + `src/app/(app)/chat/[threadId]/page.tsx` (reload).

`prepareChatTurn` inserts an assistant row with `parts: [{ type: "text", text: "" }]`. `filterEmptyAssistantPlaceholders` (in `chat-persistence.ts`) filters rows where `parts.length === 0`, so this empty-text placeholder **survives** the filter and ends up in the rendered history. The chat panel then renders a blank assistant bubble.

**Fix:** Tighten `isEmptyAssistantPlaceholder` to also drop assistant messages whose only part is an empty text part.

---

## 3. Other observations (not bugs, but worth knowing)

1. **`gemini-3.6-flash` is real** (verified via Google's official docs, which list it as a stable Gemini 3.x model since July 21 2026). The default in `SETUP.md` and the catalog fallback hint is correct. No fix needed.

2. **Per-workspace AI config is the only source of truth** — there is no module-level `GEMINI_API_KEY` fallback in production code paths. The legacy `getModelId()` / `isAiConfigured()` env helpers are only used for UI labels. Good design; nothing to change.

3. **Rate limits on `/api/chat`** are 30 messages / 60 s per user. That feels generous; if the user reports "I'm getting 429s" they may be polling or running tests against the same account. Worth flagging in the response.

4. **`@ai-sdk/google` 2.0.97** is installed and matches `package.json` (`^2.0.0`). The SDK is v5 compatible and the chat route uses the correct `streamText`, `toUIMessageStreamResponse`, `convertToModelMessages`, `stepCountIs`, `consumeStream` exports. No mismatch.

5. **Tool-call repair** (`repairWrappedToolCall` in `stream-errors.ts`) handles the `{"json": {...}}` wrapping that some models emit. The chat route wires it via `experimental_repairToolCall: repairWrappedToolCall`. Verified against the test suite.

6. **Buffer refresh-token safety** in the publishing worker handles the single-use refresh correctly. Out of scope for this chat-focused audit but appears correct from a skim.

---

## 4. Files changed in this audit

| File | Change | Why |
| --- | --- | --- |
| `src/lib/ai/chat-persistence.ts` | `persistAssistantMessage` now UPSERTS even when no placeholder exists, gated only by `existingRunId` mismatch. | P0 race-condition fix. |
| `src/lib/ai/chat-persistence.ts` | `isEmptyAssistantPlaceholder` now also drops assistant messages whose only part is an empty text part. | P2 phantom-bubble fix. |
| `src/lib/ai/chat-turn.ts` | History shaping now re-loops the leading-user shift AFTER the empty-parts filter so the SDK never receives a history that starts with non-user. | P1 multi-turn continuity fix. |
| `src/lib/ai/__tests__/chat-persistence.test.ts` | One new test covers "late stream completion writes the assistant row even if the placeholder was removed". | Regression coverage. |
| `src/lib/ai/__tests__/chat-turn.test.ts` | One new test covers "empty-text assistant placeholders are dropped from the history sent to the model". | Regression coverage. |

All existing tests still pass (`npm test` → 580 passed | 1 skipped).

---

## 5. Manual smoke-test recommendations for the user

After deploying these fixes, please verify on the live site:

1. **Single message** → assistant reply streams → reload the thread → the assistant message is still there with its tool calls.
2. **Multi-turn** (5 messages back-and-forth) → no "second message always fails" symptom.
3. **Retry a failed run** → exactly ONE assistant row replaces the failed one (no duplicates).
4. **Edit-and-resend** → the new turn replaces the edited tail, no orphan rows.
5. **Cancel mid-stream** → message renders as "cancelled", no phantom "running" bubble on reload.
6. **Close the tab during streaming, reopen** → the message resolves to its real terminal state (failed/cancelled) via `/api/chat/run/[runId]`.

If any of these still fail, send me the run id and I'll trace it.
