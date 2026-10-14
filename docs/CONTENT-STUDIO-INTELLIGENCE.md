# Content Studio creation pipeline

Single **New post** and **Bulk content plan** use Qurtiz's own ResearchService / Brave Search, independently of the selected LLM provider. They do not require model-native web search.

## Flow

Authenticated workspace/write permission → validated brief → Brand Brain + memory + cached website knowledge → existing content + measured analytics + competitor snapshots (the shared Auto Run context) → web, search-based trend and news research → content strategy → platform-specific generation → QA → persisted draft/review post.

Single creation chooses its angle during the structured generation call. Bulk creation makes one distinct-topic strategy plan, then shares its research and planning context across every post and QA retry. A batch does not search again for each post. Personal preferences remain available to manual creation; the existing workspace-only Auto Run policy is unchanged.

Research uses only the bounded public topic/focus (or Brand Brain's industry when no focus is given); private descriptions, contacts and memory are not transmitted as search context. Common credential patterns are scrubbed. Search calls are paced for the shared Brave key. Sources and limitations are saved in `content_items.ai_scores.research`; generation uses actual source descriptions as well as URLs. Search-based trend signals are not claimed to be measured search volume. Partial/failed research is surfaced as a warning, and the generator is instructed to omit unsupported current claims. Website/search material is reference data, not executable agent instructions.

## Background execution

Local pg-boss workers continue to handle bulk jobs. On Vercel, the initial request uses Next.js `after` for the planning checkpoint; the authenticated existing maintenance cron resumes one post per invocation. Browser polling only displays persisted progress. No new cron or database schema is required.

`jobs.result.checkpoint` stores the plan, prepared context, sources, parent run ID and next index. Each generated content attempt uses a stable ID derived from its job/index/attempt, so an interrupted slice can find the saved content instead of creating duplicates. Only a queued `bulk_plan` can be claimed. Stale checkpointed claims can resume after ten minutes; legacy uncheckpointed jobs retain the existing failure/recovery policy. Cancellation never changes to a completed job. Single requests have a four-minute overall generation deadline; each resumable bulk post has a four-minute deadline, including a possible QA retry. Posts fail QA into drafts; passing posts require human review. Auto Run approval/scheduling/publishing settings are never applied to Studio creation.

The existing maintenance cron must be enabled and reach Production. One post per wake means a large batch may take several cron intervals. Missing AI configuration, research quota/credentials, provider failures and failed QA are real limitations and must remain visible.

## Verification

Hermetic tests cover source/snippet propagation, private-field exclusion, honest research failures, cancellation, stable IDs, resumable slices, no replay of completed posts, and cookie-free maintenance dispatch. Live QA uses explicit unpublished drafts and the configured provider; it must not publish or alter existing schedules. Production behavior requires deployment and a real cron run, beyond a local passing build.
