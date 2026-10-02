import type { MetadataRoute } from "next";
import { PUBLIC_PAGE_PATHS } from "@/lib/public/routes";
import { getArticles } from "@/lib/public/articles";
import { absoluteUrl } from "@/lib/public/site";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...PUBLIC_PAGE_PATHS.map((path) => ({ url: absoluteUrl(path) })),
    ...getArticles().map((a) => ({
      url: absoluteUrl(`/articles/${a.slug}`),
      lastModified: new Date(`${a.updatedAt}T00:00:00Z`),
    })),
  ];
}
