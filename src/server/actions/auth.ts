"use server";

import { createClient } from "@/lib/supabase/server";

export type LoginActionResult = {
  ok: boolean;
  error?: string;
};

export async function loginWithPasswordAction(
  email: string,
  password: string,
): Promise<LoginActionResult> {
  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data.session) {
      return { ok: false, error: "Unable to establish an authenticated session." };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Authentication failed.",
    };
  }
}
