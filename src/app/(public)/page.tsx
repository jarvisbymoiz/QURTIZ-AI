import { PlatformEcosystem } from "@/components/public/platforms";
import { PublishingDemo } from "@/components/public/publishing-demo";
import { CapabilitiesSection } from "@/components/public/capabilities";
import Link from "next/link";
import { ArrowUpRight, Code2, ArrowRight, ShieldCheck } from "lucide-react";
import { publicMetadata, repositoryUrl, absoluteUrl } from "@/lib/public/site";
import { features, faqs } from "@/lib/public/product";
import { HeroWorkflow, WorkflowSection } from "@/components/public/workflow";
import { ProductPreview } from "@/components/public/product-preview";
import { PublicCTA } from "@/components/public/shell";
import { JsonLd } from "@/components/public/schema";
import { ArticleCard } from "@/components/public/article-card";
import { getArticles } from "@/lib/public/articles";

export const metadata = publicMetadata(
  "Qurtiz AI — Your AI Social Media Operating System",
  "Research, create, design, review, schedule, publish and analyze in one brand-aware AI workspace. Free software with public source and configurable providers.",
  "/",
);
export default function HomePage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": absoluteUrl("/#organization"),
              name: "Qurtiz AI",
              url: absoluteUrl("/"),
              logo: absoluteUrl("/brand/symbol.svg"),
              sameAs: [repositoryUrl],
            },
            { "@type": "WebSite", name: "Qurtiz AI", url: absoluteUrl("/") },
            {
              "@type": "WebApplication",
              name: "Qurtiz AI",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              url: absoluteUrl("/"),
              description:
                "An AI social media operating system for brand context, research, content, scheduling, publishing and analytics.",
            },
          ],
        }}
      />
      <section className="hero public-container">
        <div className="hero-copy">
          <Link href="/open-source" className="hero-badge">
            <span className="status-dot" />
            Free + Open Source <ArrowUpRight size={13} />
          </Link>
          <p className="eyebrow hero-eyebrow">
            YOUR AI SOCIAL MEDIA OPERATING SYSTEM
          </p>
          <h1>
            Great ideas.
            <br />
            One <span>intelligent</span>
            <br />
            workflow.
          </h1>
          <p className="hero-description">
            Research. Create. Design. Schedule. Publish. Analyze.
            <br />
            Bring your social media work together with an AI agent that
            understands your brand.
          </p>
          <div className="button-row">
            <Link className="public-button" href="/signup">
              Get started free <ArrowUpRight size={18} />
            </Link>
            <Link className="public-button secondary" href="#product">
              Explore Qurtiz <ArrowRight size={17} />
            </Link>
          </div>
          <p className="hero-footnote">
            Your workspace. Your AI provider. Your creative direction.
          </p>
        </div>
        <HeroWorkflow />
      </section>
      <div className="capability-band">
        <div className="public-container">
          <span>BUILT FOR THE WHOLE PROCESS</span>
          <span>Brand-aware</span>
          <span>Source-aware research</span>
          <span>Human approval</span>
          <span>Connected publishing</span>
        </div>
      </div>
      <section id="product" className="public-section public-container">
        <div className="section-heading split-heading">
          <div>
            <span className="eyebrow">MEET YOUR NEW WORKSPACE</span>
            <h2>
              Less switching.
              <br />
              <span>More creating.</span>
            </h2>
          </div>
          <p>
            From the first question to the next content plan, keep your context
            and your work in the same place.
          </p>
        </div>
        <ProductPreview />
      </section>
      <WorkflowSection />
      <PlatformEcosystem />
      <PublishingDemo />
      <section id="features" className="public-section public-container">
        <div className="section-heading">
          <span className="eyebrow">PURPOSEFUL INTELLIGENCE</span>
          <h2>
            Every part of the process.
            <br />
            <span>Built to work together.</span>
          </h2>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <Link
              className="feature-card"
              key={feature.id}
              href={`/features#${feature.id}`}
            >
              <div>
                <span className="feature-number">{feature.number}</span>
                <ArrowUpRight size={18} />
              </div>
              <span className="eyebrow">{feature.short}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </Link>
          ))}
        </div>
      </section>
      <CapabilitiesSection />
      <section className="agent-story public-container">
        <div>
          <span className="eyebrow">A CONVERSATION THAT GOES SOMEWHERE</span>
          <h2>
            Say what you need.
            <br />
            <span>Give your ideas momentum.</span>
          </h2>
          <p>
            Use AI Chat as your interface to the workspace. Bring brand context,
            research and creation into the same conversation.
          </p>
          <Link className="text-link" href="/features#agent">
            Explore the agent <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="agent-prompts">
          <span>WAYS TO GET STARTED</span>
          {[
            "Create a post for my niche",
            "Research topics for next week's plan",
            "Turn this idea into a carousel",
            "Improve this caption",
            "Help me plan a visual",
            "Analyze available content performance",
          ].map((prompt) => (
            <div key={prompt}>
              {prompt}
              <ArrowUpRight size={15} />
            </div>
          ))}
          <small>
            Illustrative prompts. Actions depend on your configuration and
            permissions.
          </small>
        </div>
      </section>
      <section id="auto-run" className="public-section public-container">
        <div className="section-heading split-heading">
          <div>
            <span className="eyebrow">AUTOMATION WITH DIRECTION</span>
            <h2>
              Keep the workflow moving.
              <br />
              <span>Keep control of the work.</span>
            </h2>
          </div>
          <p>
            Auto Run brings workspace context, content generation, visuals and
            configured scheduling together. Set it up around the providers and
            accounts you actually use.
          </p>
        </div>
        <div className="autorun-line">
          {["Context", "Idea", "Content", "Visual", "Schedule", "Publish"].map(
            (label, i) => (
              <span key={label}>
                <small>0{i + 1}</small>
                {label}
                {i < 5 && <ArrowRight size={15} />}
              </span>
            ),
          )}
        </div>
        <p className="section-note">
          Review automation settings before enabling external actions. Eligible
          account connections and background execution are required.
        </p>
      </section>
      <section className="provider-story public-container">
        <div>
          <span className="eyebrow">FLEXIBLE BY DESIGN</span>
          <h2>
            Bring the AI
            <br />
            <span>that works for you.</span>
          </h2>
          <p>
            Choose text and image providers in Workspace Settings. Connect
            Facebook and Instagram through supported Meta or Buffer connections.
          </p>
          <Link className="text-link" href="/faq">
            Understand the requirements <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="provider-grid">
          <div>
            Text models<small>Ideas, strategy & captions</small>
          </div>
          <div>
            Image providers<small>Visual generation</small>
          </div>
          <div>
            Meta<small>Facebook & Instagram</small>
          </div>
          <div>
            Buffer<small>Compatible publishing connections</small>
          </div>
        </div>
      </section>
      <section className="public-section public-container">
        <div className="section-heading">
          <span className="eyebrow">MAKE IT YOUR WORKSPACE</span>
          <h2>
            For people who
            <br />
            <span>have something to say.</span>
          </h2>
        </div>
        <div className="use-case-grid">
          {[
            ["Creators", "Build a repeatable process around your voice."],
            ["Freelancers", "Keep each client's brand context together."],
            ["Social media managers", "Move from briefs to approved content."],
            [
              "Small businesses",
              "Turn products and services into useful stories.",
            ],
            ["Startups", "Build a consistent content rhythm."],
            ["Agencies", "Organize the work by brand workspace."],
            ["Marketing teams", "Connect strategy, review and publishing."],
          ].map(([name, text]) => (
            <div key={name}>
              <h3>{name}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="open-source-story public-container">
        <Code2 size={34} />
        <span className="eyebrow">OPEN TO POSSIBILITY</span>
        <h2>
          Your workflow.
          <br />
          <span>With the source in view.</span>
        </h2>
        <p>
          Qurtiz is free and actively developed in public. Explore the
          architecture, follow the work and help shape what comes next.
          Third-party services may have their own costs.
        </p>
        <div className="button-row">
          <a
            className="public-button"
            href={repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Explore on GitHub <ArrowUpRight size={17} />
          </a>
          <Link href="/open-source" className="text-link">
            About the project <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <section className="trust-strip public-container">
        <ShieldCheck size={30} />
        <div>
          <h2>Control belongs in the workspace.</h2>
          <p>
            Server-side membership checks. Encrypted stored provider
            credentials. Administrator connection controls.
          </p>
        </div>
        <Link className="text-link" href="/security">
          How it works <ArrowUpRight size={16} />
        </Link>
      </section>
      <section className="public-section public-container">
        <div className="section-heading split-heading">
          <div>
            <span className="eyebrow">LATEST FROM QURTIZ</span>
            <h2>
              A better way
              <br />
              <span>to think about the work.</span>
            </h2>
          </div>
          <Link className="text-link" href="/articles">
            All articles <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="article-grid homepage-articles">
          {getArticles()
            .slice(0, 3)
            .map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
        </div>
      </section>
      <section id="faq" className="public-section public-container faq-section">
        <div className="section-heading">
          <span className="eyebrow">A FEW GOOD QUESTIONS</span>
          <h2>
            Clear answers.
            <br />
            <span>Before you get started.</span>
          </h2>
          <Link className="text-link" href="/faq">
            All questions <ArrowUpRight size={16} />
          </Link>
        </div>
        <div>
          {faqs.slice(0, 6).map(([q, a]) => (
            <details className="faq-item" key={q}>
              <summary>
                {q}
                <span aria-hidden>+</span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <PublicCTA />
    </>
  );
}
