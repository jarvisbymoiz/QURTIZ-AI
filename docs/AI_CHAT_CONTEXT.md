# Long AI Chat context management

## Execution flow

The server loads the entire trusted conversation in `prepareChatTurn`; it no longer silently cuts off at 24 messages. The browser sends only the current user turn, so its request size does not grow with visible history. Database/UI messages remain original; no messages are deleted by compression.

`chat-budget.ts` wraps the resolved chat LanguageModelV2 for all configured providers. It checks the final provider-neutral call options before each request, including agent/system instructions, Brand Brain, memory, message framing, attachments, tools/schema descriptions, provider options and tool results added during subsequent steps. The approach uses the installed AI SDK V2 model interface (https://v5.ai-sdk.dev/docs/reference/ai-sdk-core/language-model-v2-middleware).

Older turns are summarized in bounded input chunks with the same workspace-selected raw model and without tools. The summary retains decisions, requirements, preferences, state, unresolved tasks, facts/IDs and relevant tool results. It is injected as assistant reference data, never as privileged system instructions. Earlier attachment bytes are excluded from summarization text; their saved analysis and attachment-presence note remain, and the full original attachment stays in visible history.

The latest two user turns are retained by default. Compression starts and ends on user-turn boundaries so tool call/results stay paired. When necessary, the oldest of these recent turns is summarized too; the current user message and current tool exchange remain intact. A current message/attachment or fixed agent context that cannot fit receives an actionable error rather than silent truncation.

The summary, SHA-256 hashes of its source prefix and any learned request limit are persisted in `chat_threads.context`. Unchanged prefixes reuse memory across browser/server restarts. Edits/retries invalidate stale summary prefixes. Learned limits are scoped to provider/model and never applied to another provider/model. Original assistant persistence, run IDs, cancellation, streaming and tool permissions remain in the existing route.

## Configuration

Set `QURTIZ_CHAT_LIMITS_JSON` in the server environment. Resolution order is default -> provider -> provider/model. Limits must reflect the selected model AND your account/gateway tier; the repository cannot infer a custom endpoint's actual context or account TPM quota. Example operational configuration (replace values with your actual limits):

```json
{
  "default": { "contextTokens": 32768, "requestTokens": 16384, "outputTokens": 2048, "threshold": 0.75, "recentTurns": 2, "summaryTokens": 1024, "attachmentTokens": 4096 },
  "custom/example-model": { "contextTokens": 32768, "requestTokens": 12000 }
}
```

Defaults are conservative application budgets, not claims about provider capabilities. Threshold must be 0.2–0.9; default 0.75 leaves margin for the UTF-8-based token estimate. The estimate is deliberately conservative but is not an exact provider tokenizer. Multimodal attachments use a configurable per-file `attachmentTokens` reserve (default 4096), rather than incorrectly treating image/PDF binary bytes as text tokens. Increase this reserve for large/dense PDFs or high-resolution inputs; actual costs differ by model and modality (https://ai.google.dev/gemini-api/docs/tokens). Existing upload size/MIME validation remains unchanged. Output is reserved separately and capped to the smaller configured output budget or one eighth of available capacity. Configure smaller request limits for accounts with lower TPM quotas, even when the model has a large context window.

A context/request-size/TPM rejection triggers stronger compression and ONE automatic retry per run. A reported numeric limit is learned for that conversation/provider/model. Early stream error parts are handled before semantic output reaches the client. Errors after text or tool input/output begins are surfaced rather than replaying potentially executed external actions. The safety timeout and cancellation signal also cover summary generation. Summary usage/cost is included in run metering, including when later generation fails.

Compression cannot eliminate account-wide concurrent traffic or exhausted quota. Ordinary requests-per-minute errors retain existing provider error handling; oversized current attachments and fixed context must fit independently of older history.

## Migration / deployment

Apply `src/db/migrations/0019_chat_context.sql` before deploying this code, or use the canonical migration runner with the normal environment configured. The additive `context jsonb` column was applied and verified on the currently configured project database. The SQL is idempotent and preserves all messages. It can safely run again through the canonical runner (the targeted application did not advance the migration ledger or skip older migrations).

Restart the server after environment configuration changes. To roll back behavior, restore the former route/transport code; leaving the nullable context column is safe and preserves conversation history.

## Validation

- Simulated long histories shrink below budget while recent turns and original input remain intact.
- Persistent memory reuse, edited prefix invalidation, provider/model configuration resolution and complete trusted history are covered.
- HTTP 413 and early SSE rejection retry once with a smaller request; repeated rejection and unrelated errors terminate honestly.
- Current tool exchanges remain paired, and streams with semantic output never replay.
- Existing actual agent schemas and sequential content-library/Brand Brain tool execution run through the wrapper under a configurable smaller budget.
- Full suite, typecheck, lint and production build are required. Live provider quota behavior and summary fidelity require a configured account/session test; simulated provider tests do not claim live API verification.

## Safe-budget regression correction

The observed conversation stored an 8,000-token learned request limit with no environment override. The prior route eagerly supplied the complete Brand Brain and up to 60 memories on every turn, and exposed every agent tool schema on every step. Those fixed costs could exceed the existing safe input budget before a small user message was counted. The earlier tool acceptance test used a tiny test system prompt, so it did not catch production instruction/context overhead.

The request/threshold/output budgets remain unchanged. Chat now uses `lazyContext` in the existing system prompt builder and reads brand information through the existing scoped tools only when relevant. Full Brand Brain remains available; branded copy/strategy/visual tasks must read Brand Brain and active facts unless relevant current results are already available. Research, Analytics and competitors remain on-demand tools.

`chat-tools.ts` keeps the existing tool registry and each original tool/execute/permission wrapper. Initial exposed schemas are discovery plus Brand Brain/facts/memory. The model enables up to four required tools for the next step using `discover_tools`. SDK `prepareStep` uses only the latest discovery from the current run; old conversation discovery results never reactivate unrelated schemas on a new turn. Discovery is metadata-only and gives no new account or publishing permission. See the installed SDK `activeTools`/`prepareStep` interfaces.

Large fetched tool results are compacted only when the actual composed request exceeds the safe budget. Tool-call IDs/pairs and recent user/text messages remain intact; original outputs stay in database/UI. Compact references are persisted by content hash (bounded to 16 entries), so unchanged tool data can reuse its compact representation after restart. The final estimate uses the configured attachment reserve consistently in every branch. Non-token byte/request errors are not interpreted as numeric token-limit metadata.

### Internal diagnostics

Development server logs emit `[chat:budget]` with provider/model/run ID, phase (`incoming`, `ready`, `too-large`), usable input budget, output reserve, covered message count, system message count, tool count, and estimated contributions:

`system + agentInstructions + tools + injectedContext + summary + recentHistory + currentMessage + attachments + framing`, plus total.

No prompt text, tool data, secrets or attachments are logged. Production disables these logs unless explicitly enabled with `QURTIZ_CHAT_BUDGET_DEBUG=1`. Diagnostics never enter normal chat responses. The estimate is recalculated from each actual outgoing model call, never accumulated across turns.

### Regression coverage

- Five small turns using the full production instruction builder and actual tool schemas, under the unchanged learned 8,000-token limit: no summary calls, one system message, zero attachments/summary, exact user counts 1–5.
- Same real instructions/schemas and budget with a genuinely long conversation: compression, removed source prefix, retained current request, persisted summary reuse on continuation.
- The old eager production-sized Brand Brain plus all schemas reproduces the fixed-overhead budget exceedance.
- Actual SDK discovery -> existing action -> final response; unrelated Analytics schema stays absent and new runs start with the core schema set.
- Persisted summary sent once in place of source history; oversized tool data compacted once and restored without replacing user turns or replaying actions.
- Existing cancellation, attachment, HTTP 413/early SSE retry, edit invalidation, provider configuration and oversize-message protections remain tested.

## Incomplete-summary recovery

The former summarizer used the compact memory size as the provider's total completion limit and treated every `finishReason=length` or empty text response as a terminal chat failure. Reasoning can consume completion tokens before any final text is emitted. The configured custom `openai/gpt-oss-120b` provider reproduced a constrained generation returning `length`, 64 output tokens and zero final text.

Memory size and generation allowance are now distinct. Every summary request reserves a generation allowance within the unchanged safe total request budget and configured output maximum. An incomplete/empty result gets one bounded concise retry. Completed memory is capped independently. If both attempts remain incomplete, a deterministic extractor saves explicitly labeled selected verbatim excerpts from the real source/prior memory. It prioritizes constraints, preferences, decisions, unresolved tasks, IDs and corrections, retains source role labels when available, and marks partial/omitted material. It never presents a truncated AI draft as completed memory. Full original history and recent user turns remain unchanged; provider authentication/network/filter failures are still reported honestly.

`[chat:compression]` development diagnostics report finish reason, text length, input estimate, generation allowance, desired memory size, attempt and mode (`ai`, `retry`, `extractive`). No conversation text is logged. Existing debug gating applies.

Validation: a synthetic long conversation successfully compressed and completed a streamed reply against the actual configured provider, with memory saved in test state only and no database/chat/social modifications. Truncation/empty-output fallback, reasoning-only recovery, persistence reuse, safe total summary budgets and unmasked authentication failures have regression coverage. The opt-in provider test is `src/lib/ai/__tests__/compression-provider.test.ts`; run only that test with `RUN_LIVE_COMPRESSION_TEST=true` to spend provider tokens on synthetic data. It reads the configured workspace and writes memory only in-process; normal suites skip it.

## Short-turn/tool budget regression fix

Authenticated chat now uses compact operating guidance alongside the unchanged protected identity instead of repeating the full workflow instructions. Obvious actions and discovery expose only needed schemas; unrelated memory/brand schemas stay discoverable. Compressed tool references are reapplied when older history is subsequently recomposed, preventing the original oversized result from returning to the outgoing payload. Full original UI/database history remains unchanged. HTTP 429 RPM/TPM windows are not learned as request capacity; rate-limited summary generation falls back to labelled source excerpts and stops further summarization API calls for that run. Actual provider/model request budgets and safe checks remain enforced. Provider account RPM/TPM ceilings cannot be increased by application code.

Validation: 579 local regression tests passed; final compression tests passed after the rate-limit fallback adjustment. Typecheck and lint passed. No live AI-provider calls were used for this focused fix.
