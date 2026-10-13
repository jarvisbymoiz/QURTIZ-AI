# Caption instructions — October 6, 2026

`AGENT_CORE.md` remains the shared, release-controlled instruction source. Its High-Engagement Social Caption Rule applies to Chat creation and the shared generation service used by Content Studio, bulk jobs, campaigns and Auto Run. It teaches varied hooks, short introductions, readable benefit sections, relevant emoji anchors, highlights, audience value, questions and goal-matched CTAs. The structure is flexible; explicit concise, formal or no-emoji preferences take precedence. Language and business details come from Brand Brain and the current request.

Saved Facebook/Instagram captions use plain text with actual newlines, short section labels and relevant emojis. They must not contain Markdown bold/headings, HTML entities, decorative Unicode letters or trailing escape artifacts. Hashtags remain a separate field. Research supports facts; a style example is not evidence for its launch, price or performance claims.

Short edit turns receive compact craft guidance from the same core, preserving the existing small-provider context-budget behavior. Full creation instructions are not sent on greetings or short edits.

`create_content` now forwards the current user brief to its existing child generation call. Actual Web Search results from the current authenticated run are also forwarded as bounded reference data. The reference is held only inside that run's tool instance, cleared before a subsequent search, and never shared with another workspace/run. Researched creation should wait for search completion. No schema/table, publishing or approval changes were made; these changes do not rewrite existing saved captions.

Files changed: `AGENT_CORE.md`, `src/lib/ai/agent-core.ts`, `src/lib/ai/content.ts`, `src/lib/ai/tools.ts`, `src/lib/ai/search-tool.ts`, `src/lib/ai/__tests__/global-instruction.test.ts`, `src/lib/ai/__tests__/caption-handoff.test.ts`, `src/lib/ai/__tests__/caption-style.live.test.ts`, and this document.

Verification: real configured OpenRouter provider calls through the existing structured-generation/fallback pipeline passed an engaging Roman Urdu/English educational caption with emoji/blank-line checks, and an explicit formal-English/no-emoji override. No posts were saved or published during these read-only generation checks. Run isolation and failed-search reference clearing are covered by the handoff regression test. Existing short-edit budget tests pass without compression. These checks verify formatting and instruction plumbing, not guaranteed engagement or every future model response.

Opt-in live test (uses configured provider quota): `RUN_LIVE_TESTS=true RUN_LIVE_CAPTION=true npx vitest run src/lib/ai/__tests__/caption-style.live.test.ts` (set these environment variables using the syntax of your shell).
