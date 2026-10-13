"use client";
import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/next";
import { track } from "@vercel/analytics";
import { SpeedInsights } from "@vercel/speed-insights/next";
import {
  acquisitionClick,
  publicTrackingUrl,
} from "@/lib/website-analytics/tracking";

export function VercelTelemetry() {
  useEffect(() => {
    // Vercel custom events require an eligible plan. No implicit paid upgrade.
    if (process.env.NEXT_PUBLIC_VERCEL_CUSTOM_EVENTS_ENABLED !== "true") return;
    let signupStarted = false;
    const onClick = (event: MouseEvent) => {
      const path = location.pathname;
      if (!publicTrackingUrl(location.href)) return;
      const anchor = (
        event.target instanceof Element ? event.target : null
      )?.closest("a[href]");
      if (!anchor) return;
      const target = new URL(anchor.getAttribute("href") ?? "", location.href);
      if (target.origin !== location.origin) return;
      const click = acquisitionClick(path, target.pathname);
      if (click) track(click.name, click.data);
    };
    const onFocus = (event: FocusEvent) => {
      if (
        location.pathname !== "/signup" ||
        signupStarted ||
        !(event.target instanceof HTMLInputElement)
      )
        return;
      if (!event.target.closest("form")) return;
      signupStarted = true;
      track("signup_started"); // Never reads or sends field values.
    };
    document.addEventListener("click", onClick);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("focusin", onFocus);
    };
  }, []);
  return (
    <>
      <Analytics
        beforeSend={(event) => {
          const url = publicTrackingUrl(event.url);
          return url ? { ...event, url } : null;
        }}
      />
      <SpeedInsights
        beforeSend={(event) => {
          const url = publicTrackingUrl(event.url);
          return url ? { ...event, url } : null;
        }}
      />
    </>
  );
}
