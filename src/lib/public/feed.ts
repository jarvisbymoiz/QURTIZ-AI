import { getArticles } from "./articles";
import { absoluteUrl } from "./site";
export function escapeXml(value: string): string {
  return value.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
}
export function articleFeed(): string {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Qurtiz AI Journal</title><link>${escapeXml(absoluteUrl("/articles"))}</link><description>Practical guides to AI social media and content operations.</description><language>en</language><atom:link href="${escapeXml(absoluteUrl("/rss.xml"))}" rel="self" type="application/rss+xml"/>${getArticles()
    .map(
      (a) =>
        `<item><title>${escapeXml(a.title)}</title><link>${escapeXml(absoluteUrl(`/articles/${a.slug}`))}</link><guid isPermaLink="true">${escapeXml(absoluteUrl(`/articles/${a.slug}`))}</guid><description>${escapeXml(a.description)}</description><category>${escapeXml(a.category)}</category><pubDate>${new Date(`${a.publishedAt}T00:00:00Z`).toUTCString()}</pubDate></item>`,
    )
    .join("")}</channel></rss>`;
}
