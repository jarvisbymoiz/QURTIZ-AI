import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPublicAppUrl } from "@/lib/app-url";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";
  const next =
    rawNext.startsWith("/login") || rawNext.startsWith("/signup")
      ? "/"
      : rawNext.startsWith("/")
        ? rawNext
        : "/";

  // Determine the canonical public origin (e.g. https://qurtiz-ai.vercel.app)
  const publicOrigin = getPublicAppUrl(request);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${publicOrigin}${next}`);
    }
  }

  return NextResponse.redirect(`${publicOrigin}/login?error=auth_callback_failed`);
}
