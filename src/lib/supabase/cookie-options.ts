/**
 * Centralized cookie options for Supabase authentication and workspace cookies.
 *
 * In web and embedded environments (such as AI Studio preview iframes), cookies
 * must support cross-site contexts via SameSite=None, Secure, and Partitioned (CHIPS)
 * when running over HTTPS.
 *
 * Additionally, @supabase/ssr session cookies must NOT be httpOnly: true, because
 * the browser client (@supabase/supabase-js) requires access to read and synchronize
 * tokens via document.cookie.
 */

export type CookieConfig = {
  path: string;
  sameSite: "none" | "lax";
  secure: boolean;
  httpOnly: boolean;
  partitioned?: boolean;
  maxAge?: number;
};

export function getAppCookieOptions(isHttps?: boolean): CookieConfig {
  let https = isHttps;
  let inIframe = false;

  if (typeof window !== "undefined") {
    if (typeof https === "undefined") {
      https = window.location.protocol === "https:";
    }
    try {
      inIframe = window.self !== window.top;
    } catch {
      inIframe = true;
    }
  } else {
    if (typeof https === "undefined") {
      https = process.env.NODE_ENV === "production";
    }
  }

  const isVercel =
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.NEXT_PUBLIC_APP_URL?.includes("vercel.app")) ||
    (typeof window !== "undefined" && window.location.hostname.includes("vercel.app"));

  // On Vercel (e.g. https://qurtiz-ai.vercel.app) or any top-level domain:
  // SameSite=Lax + Secure is the gold standard for Supabase SSR and prevents cookie dropping.
  if (isVercel || (!inIframe && https)) {
    return {
      path: "/",
      sameSite: "lax",
      secure: Boolean(https),
      httpOnly: false,
      maxAge: 400 * 24 * 60 * 60,
    };
  }

  // Inside embedded preview iframes over HTTPS (such as AI Studio preview iframe):
  if (https) {
    return {
      path: "/",
      sameSite: "none",
      secure: true,
      httpOnly: false,
      partitioned: true,
      maxAge: 400 * 24 * 60 * 60,
    };
  }

  return {
    path: "/",
    sameSite: "lax",
    secure: false,
    httpOnly: false,
    maxAge: 400 * 24 * 60 * 60,
  };
}
