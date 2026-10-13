import type { Metadata } from "next";

export const repositoryUrl = "https://github.com/jarvisbymoiz/QURTIZ-AI";
/** SEO URLs must never inherit a request/browser origin or localhost. */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" && url.hostname !== "localhost" && !url.hostname.endsWith(".localhost") && url.hostname !== "127.0.0.1") {
        return url.origin;
      }
    } catch { /* Use the known production origin for invalid local configuration. */ }
  }
  return "https://qurtiz-ai.vercel.app";
}
export const absoluteUrl = (path: string) => `${siteUrl()}${path}`;
export function publicMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: absoluteUrl(path),
      types: { "application/rss+xml": absoluteUrl("/rss.xml") },
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { "max-image-preview": "large" },
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(path),
      siteName: "Qurtiz AI",
      type: "website",
      images: [
        {
          url: absoluteUrl("/opengraph-image"),
          width: 1200,
          height: 630,
          alt: "Qurtiz AI — your social media workflow, connected",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteUrl("/opengraph-image")],
    },
  };
}
