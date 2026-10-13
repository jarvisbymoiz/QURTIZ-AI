import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  if (request.nextUrl.pathname.startsWith("/api/") || request.nextUrl.pathname.startsWith("/auth/")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and Next internals.
     * api routes are included so the session stays fresh for them.
     */
    "/((?!_next/static|_next/image|_vercel/insights/|_vercel/speed-insights/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
