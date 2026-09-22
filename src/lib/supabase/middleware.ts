import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAppCookieOptions } from "./cookie-options";

// /api/meta/callback and /api/buffer/callback must be reachable without a
// session: Meta/Buffer redirect the browser here after OAuth (the session can
// expire mid-flow while the user grants access on the provider site), and the
// route itself re-verifies the session and workspace membership before
// persisting anything.
// /auth/workspace-delete must be reachable without a session: the emailed
// delete-confirmation link lands here before the code exchange creates one;
// the route re-verifies the session and workspace membership itself.
const PUBLIC_PATHS = ["/login", "/signup", "/auth/callback", "/auth/signout", "/api/meta/callback", "/api/buffer/callback", "/auth/workspace-delete"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the Supabase auth session and enforces the auth gate.
 * Must stay edge-runtime safe: no Node APIs here.
 */
export async function updateSession(request: NextRequest) {
  // Machine endpoint authenticates its bearer secret in the route itself.
  if (["/api/cron/publish", "/api/cron/maintenance"].includes(request.nextUrl.pathname)) return NextResponse.next({ request });
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without configuration, let requests through to pages that will render
  // an honest "Configuration Required" state instead of crashing the edge.
  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const isHttps =
    request.headers.get("x-forwarded-proto") === "https" ||
    request.nextUrl.protocol === "https:" ||
    process.env.NODE_ENV === "production";

  const appCookieOptions = getAppCookieOptions(isHttps);

  const supabase = createServerClient(url, anonKey, {
    cookieOptions: appCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, {
            ...options,
            ...appCookieOptions,
          }),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!user && !isPublic(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Copy any cookies set during updateSession (e.g. cleared sessions)
    supabaseResponse.cookies.getAll().forEach((c) => {
      redirectResponse.cookies.set(c.name, c.value, c);
    });
    return redirectResponse;
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Copy any cookies set during updateSession (e.g. refreshed sessions)
    supabaseResponse.cookies.getAll().forEach((c) => {
      redirectResponse.cookies.set(c.name, c.value, c);
    });
    return redirectResponse;
  }

  return supabaseResponse;
}
