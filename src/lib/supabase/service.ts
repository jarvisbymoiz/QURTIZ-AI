import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for background workers (pg-boss) and other
 * non-request contexts (instrumentation, cron). The service role bypasses
 * RLS, so this must never be imported from client code or used to answer
 * unscoped user-facing requests — the key is a secret. Authenticated media
 * signing must verify workspace membership and the object path before using it.
 *
 * Unlike `@/lib/supabase/server`, this does NOT touch request APIs
 * (cookies()), so it is safe to call where no request scope exists — e.g.
 * `attemptPublish` in a pg-boss worker would otherwise throw
 * "cookies was called outside a request scope" before the Meta call.
 *
 * Env vars are read lazily so that `next build` works without configuration.
 */
export function createServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase service role is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (see SETUP.md).",
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
