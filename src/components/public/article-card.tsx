import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import {
  articleDate,
  readingMinutes,
  type Article,
} from "@/lib/public/articles";
export function ArticleCard({ article }: { article: Article }) {
  return (
    <Link className="article-card" href={`/articles/${article.slug}`}>
      <div className="article-cover">
        <Image
          src={article.image}
          alt={`Illustrated guide: ${article.title}`}
          width={1200}
          height={630}
          sizes="(max-width: 700px) 100vw, 50vw"
        />
      </div>
      <div className="article-card-body">
        <div className="article-meta">
          <span>{article.category}</span>
          <span>{readingMinutes(article)} min read</span>
        </div>
        <h3>
          {article.title}
          <ArrowUpRight size={20} />
        </h3>
        <p>{article.description}</p>
        <time dateTime={article.publishedAt}>
          {articleDate(article.publishedAt)}
        </time>
      </div>
    </Link>
  );
}
