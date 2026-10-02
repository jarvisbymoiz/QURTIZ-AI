import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Network, Check, ArrowRight } from "lucide-react";
import { QurtizMark } from "@/components/brand/mark";

export function PlatformIdentity({
  platform,
  size = 48,
}: {
  platform: "facebook" | "instagram";
  size?: number;
}) {
  return (
    <Image
      className="official-platform-logo"
      src={`/integrations/${platform}.png`}
      alt={`${platform === "facebook" ? "Facebook" : "Instagram"} logo`}
      width={size}
      height={size}
      unoptimized
    />
  );
}
export function PlatformEcosystem() {
  return (
    <section
      id="publishing"
      className="public-section public-container ecosystem-section"
    >
      <div className="section-heading split-heading">
        <div>
          <span className="eyebrow">YOUR CONTENT. ITS NEXT DESTINATION.</span>
          <h2>
            Create with context.
            <br />
            <span>Publish where your audience lives.</span>
          </h2>
        </div>
        <p>
          Facebook and Instagram are the destinations. Meta Direct and Buffer
          are the publishing connections that get your approved content there.
        </p>
      </div>
      <div className="ecosystem-map">
        <svg
          className="ecosystem-connections"
          viewBox="0 0 1000 360"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className="connection-base"
            d="M150 180H290Q320 180 320 85H510M290 180Q320 180 320 275H510M620 85H680Q720 85 720 180H830M620 275H680Q720 275 720 180H830"
          />
          <path
            className="connection-signal"
            d="M150 180H290Q320 180 320 85H510M290 180Q320 180 320 275H510M620 85H680Q720 85 720 180H830M620 275H680Q720 275 720 180H830"
          />
        </svg>
        <div className="ecosystem-origin">
          <span className="eyebrow">YOUR WORKSPACE</span>
          <div className="ecosystem-qurtiz">
            <QurtizMark className="size-14" />
            <strong>Qurtiz AI</strong>
          </div>
          <span className="ecosystem-origin-label">
            Content + visuals
            <br />
            Review + approval
          </span>
        </div>
        <div className="connection-column">
          <span className="eyebrow">PUBLISHING CONNECTIONS</span>
          <div className="connection-card meta-connection">
            <div className="connection-identity">
              <Network size={24} aria-hidden />
              <h3>Meta Direct</h3>
            </div>
            <p>Direct platform API connection</p>
            <Link href="/features#publishing">
              Explore the connection <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="connection-card buffer-connection">
            <div className="buffer-logo-room">
              <Image
                src="/integrations/buffer.png"
                alt="Buffer logo"
                width={36}
                height={36}
                className="official-buffer-logo"
                unoptimized
              />
              <h3>Buffer</h3>
            </div>
            <p>Compatible connected accounts</p>
            <Link href="/faq">
              Connection requirements <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
        <div className="platform-column">
          <span className="eyebrow">SUPPORTED SOCIAL PLATFORMS</span>
          <div className="platform-destinations">
            {(["facebook", "instagram"] as const).map((platform) => (
              <div
                className={`platform-card ${platform}-destination`}
                key={platform}
              >
                <div className="platform-logo-room">
                  <PlatformIdentity platform={platform} />
                </div>
                <h3>{platform === "facebook" ? "Facebook" : "Instagram"}</h3>
                <span className="platform-format">Eligible posts & media</span>
                <span className="platform-ready">
                  <Check size={12} />
                  Connected workflow
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ecosystem-caption">
        <span>
          <QurtizMark className="size-4" />
          Qurtiz <ArrowRight size={12} /> Connection <ArrowRight size={12} />{" "}
          Platform
        </span>
        <p>
          Illustrative routing. Publishing requires an eligible account,
          permissions and running backend jobs. Supported formats vary by
          connection.
        </p>
      </div>
      <p className="trademark-note">
        Third-party trademarks belong to their respective owners. Integration
        identification does not imply endorsement or partnership.{" "}
        <a
          href="https://www.meta.com/brand/resources/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Meta brand resources
        </a>{" "}
        ·{" "}
        <a
          href="https://buffer.com/press"
          target="_blank"
          rel="noopener noreferrer"
        >
          Buffer brand resources
        </a>
      </p>
    </section>
  );
}
