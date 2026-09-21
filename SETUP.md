# SETUP — QURTIZ AI

Follow these steps exactly. Total time: ~15 minutes.

## 1. Supabase project

1. Create a free account at https://supabase.com → **New project**.
2. Choose a name (e.g. `qurtiz-ai`), a strong DB password, and a region
   close to you (e.g. Singapore / UAE for Pakistan).

### 1a. Auth settings

- **Authentication → Providers → Email**: enable.
  For instant local signup convenience you may disable "Confirm email"
  while developing; re-enable it before inviting real users.
- **Authentication → URL Configuration**:
  - Site URL: `http://localhost:3000`
  - Redirect URLs: add `http://localhost:3000/auth/callback`

### 1b. Get your keys

From **Project Settings**:

| Env var | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → anon public key |
| `DATABASE_URL` | Settings → Database → Connection string → **Session pooler** URI (e.g. `postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres`). Replace `[PASSWORD]` with your DB password. Use port `5432` (Session Pooler mode), NOT direct `db.[ref].supabase.co` (which is IPv6-only and subject to direct connection caps) and NOT `6543` (Transaction pooler mode). |

## 2. Gemini API key

1. Open https://aistudio.google.com/apikey
2. Create an API key (free tier includes generous daily quota).
3. Optional: set `QURTIZ_AI_MODEL` (default `gemini-3.6-flash`).

## 3. Configure the app

```bash
cp .env.example .env.local
# fill in the four required values + app URL
```

## 4. Apply the database schema

```bash
npm run db:migrate
```

This runs the committed SQL migrations (`src/db/migrations`) — tables,
indexes, enums, and Row-Level Security policies.

## 5. Run

```bash
npm run dev
```

Open http://localhost:3000 → create an account → create your first
workspace → fill the Brand Brain → chat with your agent.

## 6. Meta integration (M4 — publishing)

1. Create a Business-type app at developers.facebook.com; copy App ID +
   App Secret into `.env.local` as `META_APP_ID` / `META_APP_SECRET`.
2. Facebook Login → Settings → **Valid OAuth Redirect URI**:
   `http://localhost:3000/api/meta/callback` (your real domain in production).
3. App roles → add your Facebook account as Admin/Developer/Tester
   (required until App Review is approved).
4. Submit App Review for: `pages_show_list`, `pages_manage_posts`,
   `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`.
5. Restart the dev server → Connections → **Connect with Facebook**.
   Your Page + linked Instagram account link automatically; tokens are
   stored AES-256-GCM encrypted.

## 7. Buffer integration (Buffer publishing provider)

Buffer is the interim publishing route while the Meta App Review is pending.
Any workspace member can switch the publishing provider and
connect/disconnect Buffer channels from Connections.

Buffer's developer program uses **OAuth2 Authorization Code + PKCE** on
`auth.buffer.com`: the authorize dialog lives at
`https://auth.buffer.com/auth` and the token endpoint at
`https://auth.buffer.com/token`. The app requests the scopes
`posts:read posts:write account:read offline_access` (`offline_access` yields
a refresh token; overridable via `BUFFER_OAUTH_SCOPES`). The authorize step
sends `code_challenge` + `code_challenge_method=S256`, and the token exchange
sends the matching `code_verifier` (carried inside the signed OAuth state
marker).

Buffer refresh tokens are **single-use**: every refresh returns a new refresh
token and invalidates the old one. When a Buffer publish hits an auth error,
the publishing worker refreshes the token once, persists the newest encrypted
envelope, and retries the publish; if the refresh fails, the job fails
permanently with a reconnection prompt.

- Local development over OAuth requires HTTPS (Buffer only accepts
  `https://` redirect URIs): run `npm run dev:https` (Turbopack + the
  pre-generated certificate pair in `certificates/`, which is gitignored;
  regenerate anytime with mkcert), set
  `NEXT_PUBLIC_APP_URL=https://localhost:3000` in `.env.local`, register
  `https://localhost:3000/api/buffer/callback` in the Buffer app, and
  accept the self-signed certificate warning once in the browser.

1. Create an app at buffer.com/developers; copy the OAuth client id + secret
   into `.env.local` as `BUFFER_CLIENT_ID` / `BUFFER_CLIENT_SECRET`.
2. Buffer app settings → **Redirect URI**:
   `https://localhost:3000/api/buffer/callback` (your real domain in
   production).
3. Restart the dev server → Connections → **Connect with Facebook/Instagram
   (Buffer)** while signed in and inside a workspace to start the flow.
   Facebook/Instagram channels link as `provider = "buffer"` connections;
   tokens are stored AES-256-GCM encrypted.
4. Publishing jobs snapshot the workspace publishing provider at schedule
   time (`settings` key `publishing` → `{ provider }`; default `meta`). Jobs
   created while a provider is active keep that provider even if it is
   toggled later. Buffer posts are created at fire time via the documented
   `createPost` GraphQL mutation (`schedulingType: automatic`,
   `mode: customScheduled`) with `dueAt` ≈ now + 60s (ISO-8601 UTC) so the
   free-plan queue cap (10 scheduled updates/channel) never accumulates.
   The documented mutation has no media input yet — visuals are not
   attached (the publishing job result records `mediaAttached: false`
   until Buffer documents media support).
5. API transport is Buffer's GraphQL API: every call is a
   `POST https://api.buffer.com` (the root — no `/graphql` path) with
   `Authorization: Bearer <accessToken>` and a `{ "query": ... }` JSON body.
   The connect flow discovers `account { organizations }` and then
   `channels(input: { organizationId })` per organization; publishing uses
   the `createPost` mutation above. GraphQL-level failures can arrive inside
   an HTTP 200 `errors` array and are surfaced as rejected publishes /
   sanitized `detail` params in the Connections toast. Refresh tokens stay
   single-use and are already rotated + persisted by the publishing worker.

## 8. Brave Search (built-in platform research service)

Live web research (the agent's `web_search` tool, Research Lab grounding,
trend suggestions) is powered by **one shared project-level Brave Search
API key** — not by per-user or per-workspace credentials.

1. Create a key at https://brave.com/search/api/ (the free tier works).
2. Add it to the project environment only: `BRAVE_SEARCH_API_KEY=...`
   (server-only; never `NEXT_PUBLIC_`, never in any Supabase table or
   workspace settings field).
3. Apply the usage-tracking migration on a network with DB access:
   `node scripts/brave-research-db.mjs --apply`.
4. Restart the app. All workspaces immediately share the integration,
   with per-workspace rate limits, plan allowances, anonymous public-result
   caching and per-workspace usage attribution (`GET /api/research/usage`).

Missing or invalid key = research tools degrade gracefully to an honest
"live research unavailable" result; AI Chat keeps working. Full
architecture and security rules: `docs/RESEARCH_BRAVE.md`.

## 9. Deploying to Vercel (https://qurtiz-ai.vercel.app)

When deploying to Vercel with your custom or assigned URL (e.g. `https://qurtiz-ai.vercel.app`):

### 8a. Supabase Authentication URL Configuration (CRITICAL for Email Confirmation)
If email confirmation links are redirecting to `localhost` instead of `https://qurtiz-ai.vercel.app`, it is because Supabase defaults the project **Site URL** to `http://localhost:3000`.

1. Go to your **[Supabase Dashboard](https://supabase.com/dashboard)**.
2. Select your project → **Authentication** → **URL Configuration**.
3. Set **Site URL** to:
   ```text
   https://qurtiz-ai.vercel.app
   ```
4. Under **Redirect URLs**, click **Add URL** and add:
   ```text
   https://qurtiz-ai.vercel.app/**
   https://qurtiz-ai.vercel.app/auth/callback
   ```
   *(You can keep `http://localhost:3000/**` in Redirect URLs if you also develop locally).*
5. Click **Save**.

### 8b. Vercel Environment Variables
In your Vercel Project Settings → **Environment Variables**, configure:

| Key | Value / Source |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://qurtiz-ai.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL (`https://xyz.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase `anon` public key |
| `DATABASE_URL` | Your Supabase Postgres Session Pooler URI (port 5432) |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase `service_role` secret key |
| `GEMINI_API_KEY` | Your Google Gemini API Key |
| `ENCRYPTION_KEY` | 32-byte hex / base64 string for AES-256 token encryption |
| `QURTIZ_AI_MODEL` | `gemini-3.6-flash` (or your chosen model) |

### 8c. Meta & Buffer OAuth Redirects (If using social publishing)
If you connect Meta or Buffer on production:
- Meta App Settings → Valid OAuth Redirect URI: `https://qurtiz-ai.vercel.app/api/meta/callback`
- Buffer App Settings → Redirect URI: `https://qurtiz-ai.vercel.app/api/buffer/callback`

### 8d. Applying Database Schema to Supabase (CRITICAL — Fixes "Something went wrong")
When deploying to Vercel, Vercel builds the frontend and serverless functions, but **does not automatically execute database migrations on your remote Supabase database**. If tables are missing, the app crashes with *"Something went wrong"*.

To initialize all tables, types, enums, indexes, and Row-Level Security policies in 10 seconds:
1. Go to your **[Supabase Dashboard](https://supabase.com/dashboard)**.
2. Select your project → click **SQL Editor** in the left sidebar.
3. Click **New query**.
4. Copy the entire contents of the **`supabase-schema.sql`** file (located at the root of this repository) and paste it into the editor.
5. Click **Run** (or `Ctrl+Enter`).
6. All 18 tables (`workspaces`, `workspace_members`, `content_items`, `brands`, `platform_connections`, `notifications`, `agent_runs`, etc.) and RLS policies will be created immediately.

### 8e. Verify Live Deployment Health
You can visit:
```text
https://qurtiz-ai.vercel.app/api/health
```
This endpoint checks:
- Whether all required environment variables are set in Vercel.
- Whether the database connection over SSL is active.
- Whether all required database tables exist in Supabase.
- If anything is missing or misconfigured, it returns an explicit diagnostic message and quick-fix instructions.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Something went wrong" repeatedly on Vercel | 1. Open `https://qurtiz-ai.vercel.app/api/health` to see the exact issue.<br>2. Run `supabase-schema.sql` in Supabase SQL Editor if tables are missing.<br>3. Verify `DATABASE_URL` in Vercel is the Session Pooler URI (port 5432) with your correct DB password. |
| `EMAXCONNSESSION: max clients reached` | 1. Go to Supabase Dashboard → Project Settings → Database.<br>2. Under Connection string, choose **Session** pooler (URI mode).<br>3. Verify the host is `aws-0-[region].pooler.supabase.com` and port is `5432`.<br>4. Update `DATABASE_URL` in Vercel Environment Variables and redeploy. |
| Login page says configuration required | Supabase env vars missing in Vercel / `.env.local`; set and redeploy |
| `DATABASE_URL is not configured` | Add it to Vercel Environment Variables; redeploy |
| Migrations fail with auth.uid() error | You are not on a Supabase database — RLS policies require Supabase Postgres |
| Chat shows Configuration Required | Add `GEMINI_API_KEY` and restart / redeploy |
| `relation already exists` | Schema already applied; skip migrating again |



