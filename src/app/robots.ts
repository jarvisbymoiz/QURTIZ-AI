import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/public/site";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/dashboard",
        "/login",
        "/signup",
        "/onboarding",
        "/settings",
        "/chat",
        "/content-studio",
        "/research-lab",
        "/calendar",
        "/campaigns",
        "/analytics",
        "/competitors",
        "/brand-brain",
        "/connections",
        "/notifications",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
