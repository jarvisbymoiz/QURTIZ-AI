import { absoluteUrl } from "@/lib/public/site";

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
export function Breadcrumbs({
  items,
}: {
  items: { name: string; path: string }[];
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: item.name,
          item: absoluteUrl(item.path),
        })),
      }}
    />
  );
}

export function PageSchema({ name, description, path, type = "WebPage", items }: {
  name: string; description: string; path: string;
  type?: "WebPage" | "AboutPage" | "ContactPage" | "CollectionPage";
  items?: { name: string; path: string }[];
}) {
  return <JsonLd data={{
    "@context": "https://schema.org", "@type": type,
    "@id": absoluteUrl(`${path}#webpage`), url: absoluteUrl(path), name, description,
    inLanguage: "en", isPartOf: { "@type": "WebSite", name: "Qurtiz AI", url: absoluteUrl("/") },
    ...(items ? { mainEntity: { "@type": "ItemList", itemListElement: items.map((item, i) => ({
      "@type": "ListItem", position: i + 1, name: item.name, url: absoluteUrl(item.path),
    })) } } : {}),
  }} />;
}
