# Graphify for Codex development

Installed on 1 October 2026 using the official PyPI `graphifyy[mcp,sql]` package,
version **0.9.73**, the latest published version at installation time.
Upstream: https://github.com/Graphify-Labs/graphify.

## Scope

- `.tools/graphify/venv/`: isolated Python environment (ignored).
- `.codex/skills/graphify/`: upstream project-level Codex skill and references.
- `.codex/config.toml`: local MCP registration (ignored because it contains checkout paths).
- `.codex/graphify.mjs`: launcher resolving the environment/index within this project.
- `graphify-out/`: generated code graph (ignored).
- `AGENTS.md`: tailored Graphify guidance appended to the existing instructions;
  previous instructions were preserved in full. The product `AGENT_CORE.md` is unchanged.

Graphify is for unfamiliar architecture, dependency tracing, impact analysis and
related-file discovery. Known-file edits should use direct source reads. Treat
graph edges as navigation evidence and verify current source before editing.
Queries should be narrow, with a small token budget. Graphify's requested budget
can be advisory; the Codex MCP registration additionally caps query output at
1,500 tokens. This reduces unnecessary context loading but is not a measured
guarantee of a particular token saving.

The server exposes only `query_graph`, `get_node`, `get_neighbors`, and
`shortest_path` to Codex. It runs over local stdio, with query logging disabled.
Indexing is code-only AST extraction: no LLM calls, API keys, database access or
cloud source upload. `.graphifyignore` excludes private and generated files.

No npm dependencies, application imports, build hooks, global Codex model settings,
global MCP registrations, multi-agent flags or Git hooks were added. The upstream
Codex PreToolUse hook is an intentional no-op; its command uses the local launcher
so it does not depend on a globally installed `graphify` executable. Developer
tooling is excluded from Vercel uploads and ESLint traversal.

## Use and maintenance

Restart Codex or reload MCP servers to discover the new project server. Codex loads
project configuration only for trusted projects; accept the normal project-trust
prompt if shown. This setup does not change trust or security settings globally.
The running chat's tool catalog is not retroactively updated.

```powershell
# Recreate environment/config/index after cloning (Python 3.10+ and Node required)
python .codex/setup_graphify.py

# Refresh after a meaningful batch of structural changes
node .codex/graphify.mjs extract . --code-only --max-workers 4

# Scoped queries without restarting Codex
node .codex/graphify.mjs query "executeAutoRun companion images" --budget 1500
node .codex/graphify.mjs explain "executeAutoRun"
node .codex/graphify.mjs path "executeAutoRun" "schedulePost"
```

The setup script preserves an existing project config instead of overwriting it.
When upgrading Graphify, deliberately update the version pin and refresh the index;
do not rerun the upstream installer over the tailored AGENTS section without review.
Semantic indexing of documentation/media remains opt-in.

## Verification

Initial index: **396 files / 2,394 nodes / 8,076 edges / 127 communities**.
After including the setup launcher/helper: **398 files / 2,398 nodes / 8,078 edges**.
A real CLI query and MCP initialize/list-tools/query call returned the relationships
from `executeAutoRun` to `generateAndPersistContent`, `enqueueCompanionImage`,
`generateVisual`, `schedulePost` and notification builders, with source locations.
The original AGENTS instruction prefix was compared with its pre-install backup
and remained intact. Application package files were not modified.

Lint passed with five existing warnings; typecheck and production build passed.
The build retains the existing AI SDK dynamic-dependency warnings.

## Rollback

Remove only `[mcp_servers.graphify]` and its child tables from local Codex config,
then reload Codex. Remove the appended `## graphify` section and the project skill/
hook entry if no longer wanted. Generated graph/environment can be discarded and
recreated. No database migration or Vercel runtime rollback is necessary.
