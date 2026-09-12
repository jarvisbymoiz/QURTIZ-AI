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
};

export function getAppCookieOptions(isHttps?: boolean): CookieConfig {
  let https = isHttps;

  if (typeof https === "undefined") {
    if (typeof window !== "undefined") {
      https = window.location.protocol === "https:";
    } else {
      https = process.env.NODE_ENV === "production";
    }
  }

  if (https) {
    return {
      path: "/",
      sameSite: "none",
      secure: true,
      httpOnly: false,
      partitioned: true,
    };
  }

  return {
    path: "/",
    sameSite: "lax",
    secure: false,
    httpOnly: false,
  };
}
