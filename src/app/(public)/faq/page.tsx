import { faqs } from "@/lib/public/product";
import { publicMetadata } from "@/lib/public/site";
import { JsonLd, Breadcrumbs } from "@/components/public/schema";
import { PublicCTA } from "@/components/public/shell";
export const metadata = publicMetadata(
  "FAQ — Clear answers about Qurtiz AI",
  "Understand Qurtiz's free status, public source, brand-aware agent, providers, social publishing, images, research, credentials and workspace data.",
  "/faq",
);
export default function FAQPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "FAQ", path: "/faq" },
        ]}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map(([q, a]) => ({
            "@type": "Question",
            name: q,
            acceptedAnswer: { "@type": "Answer", text: a },
          })),
        }}
      />
      <div className="public-container faq-page">
        <header className="page-hero">
          <span className="eyebrow">FREQUENTLY ASKED QUESTIONS</span>
          <h1>
            Good questions.
            <br />
            <span>Clear answers.</span>
          </h1>
          <p>
            Know what Qurtiz does, what it needs and where you stay in control.
          </p>
        </header>
        {faqs.map(([q, a]) => (
          <details className="faq-item" key={q}>
            <summary>
              {q}
              <span aria-hidden>+</span>
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
      <PublicCTA />
    </>
  );
}
