"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** One observer for public storytelling. SSR content remains visible without JS. */
export function MotionSurface({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = surface.current;
    if (!root || !window.IntersectionObserver) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const targets = root.querySelectorAll<HTMLElement>(
      ".public-section, .hero-system, .agent-story, .provider-story, .open-source-story, .public-cta",
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          element.dataset.inView = String(entry.isIntersecting);
          if (entry.isIntersecting) element.dataset.revealed = "true";
        }
      },
      { threshold: 0.06, rootMargin: "0px 0px 60px 0px" },
    );
    for (const element of targets) {
      element.dataset.reveal = "true";
      const bounds = element.getBoundingClientRect();
      if (bounds.top < innerHeight && bounds.bottom > 0)
        element.dataset.revealed = "true";
      observer.observe(element);
    }
    const update = () => {
      root.dataset.motionEnabled = String(!preference.matches);
    };
    update();
    preference.addEventListener("change", update);
    const visibility = () => {
      root.dataset.pageVisible = String(!document.hidden);
    };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [pathname]);
  return (
    <div className="public-site" ref={surface}>
      {children}
    </div>
  );
}
