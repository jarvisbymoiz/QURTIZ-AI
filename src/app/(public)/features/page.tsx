import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { features } from "@/lib/public/product";
import { publicMetadata } from "@/lib/public/site";
import { Breadcrumbs } from "@/components/public/schema";
import { PublicCTA } from "@/components/public/shell";
export const metadata = publicMetadata(
  "Features — One connected social content workflow",
  "Explore Qurtiz AI's brand-aware agent, research, Content Studio, visuals, scheduling, Facebook and Instagram publishing, First Comment and Auto Run.",
  "/features",
);
export default function FeaturesPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Features", path: "/features" },
        ]}
      />
      <header className="public-container page-hero">
        <span className="eyebrow">THE QURTIZ TOOLKIT</span>
        <h1>
          More than a caption.
          <br />
          <span>A connected workflow.</span>
        </h1>
        <p>
          Give your ideas context, develop the content, review the work and
          publish through configured connections.
        </p>
      </header>
      <div className="public-container feature-details">
        {features.map((feature) => (
          <section id={feature.id} key={feature.id}>
            <span className="feature-number">{feature.number}</span>
            <div>
              <span className="eyebrow">{feature.short}</span>
              <h2>{feature.title}</h2>
              <p>{feature.description}</p>
              <p>{feature.detail}</p>
            </div>
          </section>
        ))}
        <section id="first-comment">
          <span className="feature-number">07</span>
          <div>
            <span className="eyebrow">CAPTION + FIRST COMMENT</span>
            <h2>
              Ready together.
              <br />
              Published in sequence.
            </h2>
            <p>
              Prepare a separate First Comment alongside your caption, for
              supporting context, a question or an additional CTA.
            </p>
            <p>
              Meta Direct attempts it after a successful Facebook or Instagram
              post and saves its own result. Permissions and API eligibility
              apply. Compatible Buffer connections pass it as optional metadata;
              a provider rejection may cause it to be skipped. A published post
              stays published if the comment fails.
            </p>
            <Link
              className="text-link"
              href="/articles/automate-facebook-instagram-qurtiz-ai"
            >
              Explore publishing and First Comment <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>
        <section id="auto-run">
          <span className="feature-number">08</span>
          <div>
            <span className="eyebrow">AUTO RUN</span>
            <h2>
              Repeat the workflow.
              <br />
              Keep your settings in control.
            </h2>
            <p>
              Configure automated content work around Brand Brain, available
              context, generation, media and scheduling. Approval behavior
              follows your workspace settings.
            </p>
            <p>
              Auto Run needs working AI providers, eligible publishing
              connections and backend execution. Provider failures remain
              failures; available analytics provide evidence for future
              planning.
            </p>
            <Link
              className="text-link"
              href="/articles/startup-social-media-workflow-qurtiz-ai"
            >
              Build your startup workflow <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>
      </div>
      <PublicCTA />
    </>
  );
}
