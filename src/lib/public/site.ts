import type { Metadata } from "next";
import { getPublicAppUrl } from "@/lib/app-url";

export const repositoryUrl = "https://github.com/jarvisbymoiz/QURTIZ-AI";
export const siteUrl = () => getPublicAppUrl();
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
