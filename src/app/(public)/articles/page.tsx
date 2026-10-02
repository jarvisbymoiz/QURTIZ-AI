import { getArticles } from "@/lib/public/articles";
import { ArticleCard } from "@/components/public/article-card";
import { publicMetadata } from "@/lib/public/site";
import { Breadcrumbs } from "@/components/public/schema";
export const metadata = publicMetadata(
  "Articles — The Qurtiz Journal",
  "Practical guides to AI social media agents, brand-aware content creation, human review, automation and connected publishing workflows.",
  "/articles",
);
export default function ArticlesPage() {
  const articles = getArticles();
  const featured = articles.find((a) => a.featured);
  const categories = [...new Set(articles.map((a) => a.category))];
  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Articles", path: "/articles" },
        ]}
      />
      <div className="public-container journal-page">
        <header className="page-hero">
          <span className="eyebrow">THE QURTIZ JOURNAL</span>
          <h1>
            Better context.
            <br />
            <span>Better creative decisions.</span>
          </h1>
          <p>
            Practical thinking for the people connecting AI, content and social
            media operations.
          </p>
        </header>
        <nav className="journal-categories" aria-label="Article topics">
          {categories.map((c) => (
            <a key={c} href={`#${c.toLowerCase().replaceAll(" ", "-")}`}>
              {c}
            </a>
          ))}
        </nav>
        {featured && (
          <section className="featured-article">
            <span className="eyebrow">FEATURED GUIDE</span>
            <ArticleCard article={featured} />
          </section>
        )}
        <h2 className="journal-heading">Latest articles</h2>
        <div className="article-grid">
          {articles.map((a) => (
            <ArticleCard key={a.slug} article={a} />
          ))}
        </div>
        {categories.map((c) => (
          <section
            className="journal-topic"
            id={c.toLowerCase().replaceAll(" ", "-")}
            key={c}
          >
            <h2>{c}</h2>
            <p>
              {c === "Guides"
                ? "Step-by-step approaches to a connected content process."
                : "Understand the role of tools, context and human judgment."}
            </p>
            {articles
              .filter((a) => a.category === c)
              .map((a) => (
                <a href={`/articles/${a.slug}`} key={a.slug}>
                  {a.title} ↗
                </a>
              ))}
          </section>
        ))}
      </div>
    </>
  );
}
