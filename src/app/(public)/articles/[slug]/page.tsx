import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  getArticles,
  getArticle,
  getRelatedArticles,
  readingMinutes,
  articleDate,
} from "@/lib/public/articles";
import { publicMetadata, absoluteUrl } from "@/lib/public/site";
import { Breadcrumbs, JsonLd } from "@/components/public/schema";
import { ArticleCard } from "@/components/public/article-card";
import { PublicCTA } from "@/components/public/shell";
import { ShareArticle } from "@/components/public/share-article";
export const dynamicParams = false;
export function generateStaticParams() {
  return getArticles().map((a) => ({ slug: a.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) return {};
  const meta = publicMetadata(
    a.seoTitle,
    a.seoDescription,
    `/articles/${slug}`,
  );
  return {
    ...meta,
    authors: [{ name: a.author }],
    openGraph: {
      ...meta.openGraph,
      type: "article",
      publishedTime: a.publishedAt,
      modifiedTime: a.updatedAt,
      authors: [a.author],
      tags: a.tags,
      images: [
        { url: absoluteUrl(a.image), width: 1200, height: 630, alt: a.title },
      ],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: a.seoTitle,
      description: a.seoDescription,
      images: [absoluteUrl(a.image)],
    },
  };
}
export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) notFound();
  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Articles", path: "/articles" },
          { name: a.title, path: `/articles/${slug}` },
        ]}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: a.title,
          description: a.description,
          image: [absoluteUrl(a.image)],
          datePublished: a.publishedAt,
          dateModified: a.updatedAt,
          author: {
            "@type": "Organization",
            name: a.author,
            url: absoluteUrl("/about"),
          },
          publisher: {
            "@type": "Organization",
            name: "Qurtiz AI",
            logo: {
              "@type": "ImageObject",
              url: absoluteUrl("/brand/symbol.svg"),
            },
          },
          mainEntityOfPage: absoluteUrl(`/articles/${slug}`),
        }}
      />
      <article className="public-container article-page">
        <header className="page-hero">
          <nav aria-label="Breadcrumb">
            <Link href="/">Home</Link> / <Link href="/articles">Articles</Link>{" "}
            / <span>{a.category}</span>
          </nav>
          <span className="eyebrow">{a.category}</span>
          <h1>{a.title}</h1>
          <p>{a.description}</p>
          <div className="article-byline">
            <span>{a.author}</span>
            <time dateTime={a.publishedAt}>{articleDate(a.publishedAt)}</time>
            <span>{readingMinutes(a)} min read</span>
            <span>
              Updated{" "}
              <time dateTime={a.updatedAt}>{articleDate(a.updatedAt)}</time>
            </span>
          </div>
          <div className="article-tags">
            {a.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </header>
        <Image
          className="article-hero-image"
          src={a.image}
          alt={
            a.title.includes("agent")
              ? "An AI agent connects brand context with research, creation and publishing tools"
              : "Workflow stages connect brand context, research, content, review and publication"
          }
          width={1200}
          height={630}
          sizes="(max-width: 700px) 100vw, 1240px"
          priority
        />
        <div className="info-layout">
          <aside className="info-toc">
            <span className="eyebrow">IN THIS GUIDE</span>
            {a.sections.map((s) => (
              <a key={s.id} href={`#${s.id}`}>
                {s.title}
              </a>
            ))}
          </aside>
          <div className="public-prose">
            {a.sections.map((s) => (
              <section key={s.id} id={s.id}>
                <h2>{s.title}</h2>
                {s.paragraphs.map((p) => (
                  <p key={p}>{p}</p>
                ))}
                {s.steps && (
                  <>
                    <h3>Put it into practice</h3>
                    <ol>
                      {s.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </>
                )}
                {s.link && (
                  <Link className="text-link" href={s.link.href}>
                    {s.link.label} ↗
                  </Link>
                )}
              </section>
            ))}
            <ShareArticle
              title={a.title}
              url={absoluteUrl(`/articles/${slug}`)}
            />
          </div>
        </div>
      </article>
      <section className="public-container related-articles">
        <span className="eyebrow">KEEP EXPLORING</span>
        <h2>Related reading</h2>
        <div className="article-grid">
          {getRelatedArticles(a).map((item) => (
            <ArticleCard article={item} key={item.slug} />
          ))}
        </div>
      </section>
      <PublicCTA />
    </>
  );
}
