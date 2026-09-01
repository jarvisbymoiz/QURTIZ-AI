"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (see SETUP.md).",
    );
  }
  // M13: keep cookie attributes aligned with the server client. Browsers
  // ignore httpOnly on document.cookie writes, so the client can still read
  // its own session; secure + lax apply to cookies it persists.
  return createBrowserClient(url, anonKey, {
    cookieOptions: { httpOnly: true, secure: true, sameSite: "lax" },
  });
}
