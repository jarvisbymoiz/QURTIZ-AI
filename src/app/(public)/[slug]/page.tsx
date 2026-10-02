import Link from "next/link";
import { notFound } from "next/navigation";
import { publicPages } from "@/lib/public/pages";
import { publicMetadata } from "@/lib/public/site";
import { Breadcrumbs } from "@/components/public/schema";
export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(publicPages).map((slug) => ({ slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = publicPages[slug];
  if (!page) return {};
  return publicMetadata(page.title, page.description, `/${slug}`);
}
export default async function PublicInfoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = publicPages[slug];
  if (!page) notFound();
  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: page.title, path: `/${slug}` },
        ]}
      />
      <article className="public-container info-page">
        <header className="page-hero">
          <nav aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden> / </span>
            {slug.replaceAll("-", " ")}
          </nav>
          <span className="eyebrow">{page.eyebrow}</span>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </header>
        {page.policy && (
          <aside className="policy-note">
            Deployment-specific draft. The hosted operator must complete its
            identity, private contact and applicable legal details before
            launch.
          </aside>
        )}
        <div className="info-layout">
          <aside className="info-toc">
            <span className="eyebrow">ON THIS PAGE</span>
            {page.sections.map((s, i) => (
              <a href={`#section-${i}`} key={s.heading}>
                {s.heading}
              </a>
            ))}
          </aside>
          <div className="public-prose">
            {page.sections.map((s, i) => (
              <section id={`section-${i}`} key={s.heading}>
                <h2>{s.heading}</h2>
                {s.paragraphs.map((p) => (
                  <p key={p}>{p}</p>
                ))}
                {s.links && (
                  <div className="context-links">
                    {s.links.map((l) => (
                      <Link key={l.href} href={l.href}>
                        {l.label} ↗
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      </article>
    </>
  );
}
