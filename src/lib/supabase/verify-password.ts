import "server-only";
import { createClient } from "@supabase/supabase-js";
/** Reauthenticate in an isolated client; never replace or revoke the browser's session. */
export async function verifyAccountPassword(user: { id: string; email: string }, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Account verification is not configured.");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  try {
    const { data, error } = await client.auth.signInWithPassword({ email: user.email, password });
    return !error && data.user?.id === user.id && !!data.session;
  } finally {
    // This disposable verification session only; never use the global scope.
    await client.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
}
