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
| `DATABASE_URL` | Settings → Database → Connection string → **Session pooler** URI. Replace `[YOUR-PASSWORD]` with your DB password. Use port `5432` (session pooler), NOT `6543` (transaction pooler) — the app uses a standard connection pool. |

## 2. Gemini API key

1. Open https://aistudio.google.com/apikey
2. Create an API key (free tier includes generous daily quota).
3. Optional: set `QURTIZ_AI_MODEL` (default `gemini-2.5-flash`).

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

## Troubleshooting

| Symptom | Fix |
|---|---|
| Login page says configuration required | Supabase env vars missing in `.env.local`; restart dev server |
| `DATABASE_URL is not configured` | Add it to `.env.local`; restart |
| Migrations fail with auth.uid() error | You are not on a Supabase database — RLS policies require Supabase Postgres |
| Chat shows Configuration Required | Add `GEMINI_API_KEY` and restart the dev server |
| `relation already exists` | Schema already applied; skip migrating again |
